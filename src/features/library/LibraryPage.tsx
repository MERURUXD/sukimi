import { useApolloClient, useMutation, useQuery } from '@apollo/client/react'
import { BookCheck, ClockFading, Download, Eye, EyeOff, FolderInput, LibraryBig } from 'lucide-react'
import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react'
import { EnqueueDownloads, UpdateChapters } from '@/api/chapters'
import { Can } from '@/features/auth/Can'
import { GalleryPill } from '@/features/gallery/GalleryPill'
import { useLaterActions, useLaterList } from '@/features/later/useLater'
import { useNsfw, useNsfwActions } from '@/features/nsfw/useNsfw'
import { useLive } from '@/api/live'
import { hasSnapshot, withSnapshot } from '@/api/persist'
import { captureUser, StaleSessionError } from '@/api/userContext'
import { syncTrackProgressMany } from '@/features/tracking/sync'
import { Popover } from '@/components/ui/Popover'
import { BatchBar } from '@/components/ui/BatchBar'
import { LoadError } from '@/components/ui/LoadError'
import type { SegItem } from '@/components/ui/Seg'
import { toast, toastError } from '@/components/ui/toast'
import { count } from '@/lib/format'
import { useSelection } from '@/lib/useSelection'
import { applyView, inCategory, librarySources, SORTS } from './filtering'
import { LibraryGrid, LibrarySkeleton } from './LibraryGrid'
import { LibraryToolbar } from './LibraryToolbar'
import { libraryScore } from './sortValues'
import {
  type LibraryManga,
  Categories,
  ChapterIds,
  LibraryMangas,
  SetInLibrary,
  SetMangasCategories,
  UpdateLibrary,
} from './queries'
import { useLibraryView, type LibraryTab } from './store'

export function LibraryPage() {
  const lib = useQuery(LibraryMangas)
  const cats = useQuery(Categories)
  // 刷新页面后先用上次保存的数据，网络数据到了再替换
  const data = withSnapshot('library', lib.data)
  const catData = withSnapshot('categories', cats.data)
  const { loading, error, refetch } = lib
  const syncing = loading && !lib.data && !!data
  // 既没有内存缓存也没有本地快照、要等网络时，数据到了播一次进场动画
  const [intro] = useState(() => !lib.data && !hasSnapshot('library'))
  const view = useLibraryView()
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query.trim())

  const all = useMemo(() => data?.mangas.nodes ?? [], [data])
  // 「稍后再看」是固定标签：列表里可能有不在书库的漫画，另外按 id 取
  const later = useLaterList()
  const { remove: removeLater } = useLaterActions()
  const isLater = view.category === 'later'
  const base: readonly LibraryManga[] = useMemo(() => (isLater ? later.items ?? [] : all), [isLater, later.items, all])
  // 每个用户的默认分类 id 不同，不能写死 0
  const defaultCategoryId = catData?.categories.nodes.find((c) => c.default)?.id ?? 0
  // 追踪网站的评分档位，用来把不同分制折算到一起；和书库同一份数据，快照里也有
  const trackers = data?.trackers.nodes
  const scales = useMemo(() => new Map(trackers?.map((t) => [t.id, t.scores] as const)), [trackers])
  // 按评分排序时，封面上标出分数
  const scoreOf = useMemo(
    () => (view.sort === 'score' ? (m: LibraryManga) => libraryScore(m.trackRecords.nodes, scales) : undefined),
    [view.sort, scales],
  )
  const items = useMemo(
    () => applyView(base, { ...view, defaultCategoryId, query: deferredQuery, scales }),
    [base, view, defaultCategoryId, deferredQuery, scales],
  )
  const order = useMemo(() => items.map((m) => m.id), [items])
  const sources = useMemo(() => librarySources(base), [base])

  /* 分类：默认分类没有漫画时隐藏；「稍后再看」固定排在最后 */
  const laterCount = later.items?.length
  const categories = useMemo<SegItem<LibraryTab>[]>(() => {
    const cats = catData?.categories.nodes ?? []
    const tabs: SegItem<LibraryTab>[] = [{ value: 'all', label: '全部', count: all.length }]
    for (const c of cats) {
      const n = all.filter((m) => inCategory(m, c.id, defaultCategoryId)).length
      if (c.default && n === 0) continue
      tabs.push({ value: c.id, label: c.default ? '默认' : c.name, count: n })
    }
    tabs.push({ value: 'later', label: '稍后再看', count: laterCount })
    return tabs
  }, [catData, all, defaultCategoryId, laterCount])

  // 记住的分类已被删除时回到「全部」
  useEffect(() => {
    if (catData && typeof view.category === 'number' && !categories.some((c) => c.value === view.category)) view.setCategory('all')
  }, [catData, categories, view])

  /* 多选 */
  const [selecting, setSelecting] = useState(false)
  const sel = useSelection(order)
  const exitSelect = useCallback(() => {
    setSelecting(false)
    sel.clear()
  }, [sel])

  // 「稍后再看」里读完自动移出的漫画也从选择里去掉，免得批量操作作用到看不见的那部
  const { selected, setSelected } = sel
  useEffect(() => {
    if (!isLater || !later.items) return
    const still = new Set(later.items.map((m) => m.id))
    if ([...selected].some((id) => !still.has(id))) setSelected(new Set([...selected].filter((id) => still.has(id))))
  }, [isLater, later.items, selected, setSelected])

  useEffect(() => {
    if (!selecting) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') exitSelect()
      if ((e.ctrlKey || e.metaKey) && e.key === 'a' && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault()
        sel.selectAll()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selecting, exitSelect, sel])

  /* 检查书库更新：进度来自全局订阅，结束后订阅那边会刷新书库 */
  const updater = useLive((s) => s.updater)
  const updating = updater.isRunning ? { finished: updater.finished, total: updater.total } : null
  const client = useApolloClient()
  const [startUpdate] = useMutation(UpdateLibrary)

  const refresh = async () => {
    try {
      // 「稍后再看」里有不在书库的漫画，检查更新时按整个书库算
      const cat = typeof view.category === 'number' ? [view.category] : undefined
      await startUpdate({ variables: { categories: cat } })
      toast('开始检查书库更新')
    } catch (e) {
      toastError('无法开始更新', e)
    }
  }

  /* 批量操作 */
  const [updateChapters] = useMutation(UpdateChapters)
  const [enqueue] = useMutation(EnqueueDownloads)
  const [setInLibrary] = useMutation(SetInLibrary)
  const [setCats] = useMutation(SetMangasCategories)
  const [busy, setBusy] = useState(false)
  const nsfw = useNsfw()
  const { setManga: setNsfw } = useNsfwActions()
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [catPop, setCatPop] = useState(false)
  const ids = [...sel.selected]

  const chapterIds = async (filter: object) => {
    const still = captureUser()
    const { data: r } = await client.query({
      query: ChapterIds,
      variables: { filter: { mangaId: { in: ids }, ...filter } },
      fetchPolicy: 'network-only',
    })
    // 查询期间换了账号：查到的是上一个账号的章节，不能再拿去改新账号的数据
    still()
    return r?.chapters.nodes.map((c) => c.id) ?? []
  }

  const run = async (label: string, fn: () => Promise<string | void>) => {
    setBusy(true)
    try {
      const msg = await fn()
      toast(msg || label)
    } catch (e) {
      if (!(e instanceof StaleSessionError)) toastError(`${label}失败`, e)
    } finally {
      setBusy(false)
    }
  }

  const markRead = () =>
    run('标为已读', async () => {
      const still = captureUser()
      const cids = await chapterIds({ isRead: { equalTo: false } })
      if (cids.length) {
        await updateChapters({ variables: { ids: cids, patch: { isRead: true } } })
        void syncTrackProgressMany(client, ids, still)
        // 标为已读的返回里没有最后阅读时间，重取一次「稍后再看」，读完的才会当场移出
        void client.refetchQueries({ include: ['LaterMangas'] })
      }
      return `已将 ${count(cids.length)} 话标为已读`
    })

  const downloadUnread = () =>
    run('加入下载', async () => {
      const cids = await chapterIds({ isRead: { equalTo: false }, isDownloaded: { equalTo: false } })
      if (cids.length) await enqueue({ variables: { ids: cids } })
      return cids.length ? `已将 ${count(cids.length)} 话加入下载队列` : '没有需要下载的未读章节'
    })

  const removeFromLibrary = () => {
    if (!confirmRemove) {
      setConfirmRemove(true)
      setTimeout(() => setConfirmRemove(false), 3000)
      return
    }
    setConfirmRemove(false)
    void run('移出书库', async () => {
      await setInLibrary({ variables: { ids, inLibrary: false } })
      await refetch()
      exitSelect()
      return `已将 ${ids.length} 部移出书库`
    })
  }

  const removeFromLater = () =>
    run('移出稍后再看', async () => {
      await removeLater(ids)
      exitSelect()
      return `已将 ${ids.length} 部移出稍后再看`
    })

  // 选中的都已是 NSFW 时按钮变成取消；有一部不是就按标记处理
  const picked = items.filter((m) => sel.selected.has(m.id))
  const allNsfw = picked.length > 0 && picked.every(nsfw.test)
  const toggleNsfw = () =>
    run(allNsfw ? '取消 NSFW 标记' : '标为 NSFW', async () => {
      await setNsfw(picked, !allNsfw)
      return allNsfw ? `已取消 ${picked.length} 部的 NSFW 标记` : `已将 ${picked.length} 部标为 NSFW，首页和画廊不再显示`
    })

  const realCategories = (catData?.categories.nodes ?? []).filter((c) => !c.default)
  const moveTo = (catId: number, add: boolean) =>
    run('修改分类', async () => {
      await setCats({ variables: { ids, add: add ? [catId] : [], remove: add ? [] : [catId] } })
    })

  /* 顶部摘要 */
  const unreadTotal = useMemo(() => all.reduce((n, m) => n + m.unreadCount, 0), [all])
  const dlTotal = useMemo(() => all.reduce((n, m) => n + m.downloadCount, 0), [all])
  const sortLabel = SORTS.find((s) => s.key === view.sort)?.label

  return (
    <>
      <div className="wrap">
        {/* 画廊入口是「去另一个页面」，放在标题这一行的右侧（44px 高，和 h1 的一行对齐），不混进下面对列表做操作的工具栏 */}
        <div className="flex items-start justify-between gap-4 pt-7 pb-[22px]">
          <div className="min-w-0">
            <h1 className="m-0 font-cjk text-[40px] leading-[1.1] font-black">书库</h1>
            {data && (
              <p className="mt-1.5 mb-0 text-muted num">
                {count(all.length)} 部 · 未读 {count(unreadTotal)} 话 · 已下载 {count(dlTotal)} 话
                {items.length !== all.length && ` · 当前显示 ${count(items.length)} 部`}，按{sortLabel}
                {view.desc ? ' ↓' : ' ↑'}
                {syncing && ' · 正在同步…'}
              </p>
            )}
          </div>
          <GalleryPill />
        </div>

        <LibraryToolbar
          categories={categories}
          sources={sources}
          query={query}
          onQuery={setQuery}
          selecting={selecting}
          onToggleSelect={() => (selecting ? exitSelect() : setSelecting(true))}
          updating={updating}
          onRefresh={refresh}
        />

        {isLater ? <>
          {!later.items && !later.error && <LibrarySkeleton density={view.density} />}
          {later.error && <LoadError message={later.error.message} onRetry={() => void later.refetch().catch(() => {})} />}
          {later.items && items.length === 0 && (
            <p className="px-6 py-20 text-center text-muted">
              {later.items.length === 0 ? '还没有稍后再看的漫画。在漫画详情页点时钟按钮，或在「发现」页长按、右键封面加入。' : '没有符合筛选条件的漫画。'}
            </p>
          )}
        </> : <>
          {loading && !data && <LibrarySkeleton density={view.density} />}
          {error && <LoadError message={error.message} onRetry={() => void refetch().catch(() => {})} />}
          {data && items.length === 0 && (
            <p className="px-6 py-20 text-center text-muted">
              {all.length === 0 ? '书库是空的，去「发现」页添加漫画吧。' : '没有符合筛选条件的漫画。'}
            </p>
          )}
        </>}

        <div className="pb-28">
          <LibraryGrid
            items={items}
            intro={intro}
            scoreOf={scoreOf}
            density={view.density}
            selecting={selecting}
            selected={sel.selected}
            onToggle={(id, index, e) => sel.toggle(id, index, e.shiftKey)}
            onLongPress={(id, index) => {
              setSelecting(true)
              sel.toggle(id, index)
            }}
          />
        </div>
      </div>

      <BatchBar
        open={selecting}
        count={sel.selected.size}
        unit="部"
        onSelectAll={sel.selectAll}
        selectAllLabel={`全选当前 ${count(items.length)} 部`}
        onCancel={exitSelect}
      >
        {!isLater && <Popover
          open={catPop}
          onClose={() => setCatPop(false)}
          side="top"
          align="left"
          label="移动到分类"
          className="w-[240px]"
          trigger={
            <button type="button" className="bb" disabled={busy || !ids.length} onClick={() => setCatPop((v) => !v)}>
              <FolderInput className="size-5" strokeWidth={1.8} />
              分类
            </button>
          }
        >
          {realCategories.length === 0 ? (
            <p className="m-0 px-2 py-1 text-[13px] text-muted">还没有分类。分类管理会放在设置页。</p>
          ) : (
            realCategories.map((c) => {
              const inAll = ids.length > 0 && ids.every((id) => all.find((m) => m.id === id)?.categories.nodes.some((x) => x.id === c.id))
              return (
                <button key={c.id} type="button" className="opt" aria-checked={inAll} role="menuitemcheckbox" onClick={() => moveTo(c.id, !inAll)}>
                  <span className="flex-1">{c.name}</span>
                  {inAll && <BookCheck className="size-4" />}
                </button>
              )
            })
          )}
        </Popover>}
        <button type="button" className="bb" disabled={busy || !ids.length} onClick={markRead}>
          <BookCheck className="size-5" strokeWidth={1.8} />
          全部已读
        </button>
        <button type="button" className="bb" disabled={busy || !ids.length} onClick={toggleNsfw}>
          {allNsfw ? <Eye className="size-5" strokeWidth={1.8} /> : <EyeOff className="size-5" strokeWidth={1.8} />}
          {allNsfw ? '取消 NSFW' : '标为 NSFW'}
        </button>
        <Can permission="DOWNLOAD_CHAPTERS">
          <button type="button" className="bb" disabled={busy || !ids.length} onClick={downloadUnread}>
            <Download className="size-5" strokeWidth={1.8} />
            下载未读
          </button>
        </Can>
        {isLater ? (
          <button type="button" className="bb" disabled={busy || !ids.length} onClick={removeFromLater}>
            <ClockFading className="size-5" strokeWidth={1.8} />
            移出稍后再看
          </button>
        ) : <button
          type="button"
          className={confirmRemove ? 'bb text-danger' : 'bb'}
          disabled={busy || !ids.length}
          onClick={removeFromLibrary}
        >
          <LibraryBig className="size-5" strokeWidth={1.8} />
          {confirmRemove ? '再点确认' : '移出书库'}
        </button>}
      </BatchBar>
    </>
  )
}
