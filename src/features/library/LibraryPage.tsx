import { useApolloClient, useMutation, useQuery } from '@apollo/client/react'
import { BookCheck, Download, FolderInput, LibraryBig } from 'lucide-react'
import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react'
import { EnqueueDownloads, UpdateChapters } from '@/api/chapters'
import { Can } from '@/features/auth/Can'
import { useLive } from '@/api/live'
import { hasSnapshot, withSnapshot } from '@/api/persist'
import { captureUser, StaleSessionError } from '@/api/userContext'
import { Popover } from '@/components/ui/Popover'
import { BatchBar } from '@/components/ui/BatchBar'
import type { SegItem } from '@/components/ui/Seg'
import { toast, toastError } from '@/components/ui/toast'
import { count } from '@/lib/format'
import { useSelection } from '@/lib/useSelection'
import { applyView, inCategory, librarySources, SORTS } from './filtering'
import { LibraryGrid, LibrarySkeleton } from './LibraryGrid'
import { LibraryToolbar } from './LibraryToolbar'
import {
  Categories,
  ChapterIds,
  LibraryMangas,
  SetInLibrary,
  SetMangasCategories,
  UpdateLibrary,
} from './queries'
import { useLibraryView } from './store'

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
  // 每个用户的默认分类 id 不同，不能写死 0
  const defaultCategoryId = catData?.categories.nodes.find((c) => c.default)?.id ?? 0
  const items = useMemo(
    () => applyView(all, { ...view, defaultCategoryId, query: deferredQuery }),
    [all, view, defaultCategoryId, deferredQuery],
  )
  const order = useMemo(() => items.map((m) => m.id), [items])
  const sources = useMemo(() => librarySources(all), [all])

  /* 分类：默认分类没有漫画时隐藏；只有一个分类时整个分段控件都不显示 */
  const categories = useMemo<SegItem<'all' | number>[]>(() => {
    const cats = catData?.categories.nodes ?? []
    const tabs: SegItem<'all' | number>[] = [{ value: 'all', label: '全部', count: all.length }]
    for (const c of cats) {
      const n = all.filter((m) => inCategory(m, c.id, defaultCategoryId)).length
      if (c.default && n === 0) continue
      tabs.push({ value: c.id, label: c.default ? '默认' : c.name, count: n })
    }
    return tabs
  }, [catData, all, defaultCategoryId])

  // 记住的分类已被删除时回到「全部」
  useEffect(() => {
    if (catData && view.category !== 'all' && !categories.some((c) => c.value === view.category)) view.setCategory('all')
  }, [catData, categories, view])

  /* 多选 */
  const [selecting, setSelecting] = useState(false)
  const sel = useSelection(order)
  const exitSelect = useCallback(() => {
    setSelecting(false)
    sel.clear()
  }, [sel])

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
      const cat = view.category === 'all' ? undefined : [view.category]
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
      const cids = await chapterIds({ isRead: { equalTo: false } })
      if (cids.length) await updateChapters({ variables: { ids: cids, patch: { isRead: true } } })
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
        <div className="pt-7 pb-[22px]">
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

        {loading && !data && <LibrarySkeleton density={view.density} />}
        {error && <p className="text-danger">加载失败：{error.message.split('\n')[0]}</p>}
        {data && items.length === 0 && (
          <p className="px-6 py-20 text-center text-muted">
            {all.length === 0 ? '书库是空的，去「发现」页添加漫画吧。' : '没有符合筛选条件的漫画。'}
          </p>
        )}

        <div className="pb-28">
          <LibraryGrid
            items={items}
            intro={intro}
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
        <Popover
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
        </Popover>
        <button type="button" className="bb" disabled={busy || !ids.length} onClick={markRead}>
          <BookCheck className="size-5" strokeWidth={1.8} />
          全部已读
        </button>
        <Can permission="DOWNLOAD_CHAPTERS">
          <button type="button" className="bb" disabled={busy || !ids.length} onClick={downloadUnread}>
            <Download className="size-5" strokeWidth={1.8} />
            下载未读
          </button>
        </Can>
        <button
          type="button"
          className={confirmRemove ? 'bb text-danger' : 'bb'}
          disabled={busy || !ids.length}
          onClick={removeFromLibrary}
        >
          <LibraryBig className="size-5" strokeWidth={1.8} />
          {confirmRemove ? '再点确认' : '移出书库'}
        </button>
      </BatchBar>
    </>
  )
}
