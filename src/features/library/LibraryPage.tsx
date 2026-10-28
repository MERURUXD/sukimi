import { useApolloClient, useMutation, useQuery } from '@apollo/client/react'
import { Archive, ArchiveRestore, BookCheck, ClockFading, Download, Eye, EyeOff, FolderInput, LibraryBig, Star, StarOff } from 'lucide-react'
import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { EnqueueDownloads, UpdateChapters } from '@/api/chapters'
import { Can } from '@/features/auth/Can'
import { Glass } from '@/components/glass/Glass'
import { GalleryPill } from '@/features/gallery/GalleryPill'
import { useMobile } from '@/features/gallery/hooks'
import { useLaterActions, useLaterList } from '@/features/later/useLater'
import { MangaMenuItems } from '@/features/favorite/MangaMenuItems'
import { useFavoriteActions, useFavorites } from '@/features/favorite/useFavorites'
import { isShelved, shelfIds, withoutShelf } from '@/features/shelf/shelf'
import { useShelfActions } from '@/features/shelf/useShelf'
import { ContextMenu, useContextMenu } from '@/components/ui/ContextMenu'
import { useNsfw, useNsfwActions } from '@/features/nsfw/useNsfw'
import { useLive } from '@/api/live'
import { hasSnapshot, withSnapshot } from '@/api/persist'
import { captureUser, StaleSessionError } from '@/api/userContext'
import { syncTrackProgressMany } from '@/features/tracking/sync'
import { Popover } from '@/components/ui/Popover'
import { BatchBar } from '@/components/ui/BatchBar'
import { LoadError } from '@/components/ui/LoadError'
import { PageHeader } from '@/components/ui/PageHeader'
import type { SegItem } from '@/components/ui/Seg'
import { toast, toastError } from '@/components/ui/toast'
import { count } from '@/lib/format'
import { useSelection } from '@/lib/useSelection'
import { applyView, inCategory, librarySources, SORTS } from './filtering'
import { LibraryGrid, LibrarySkeleton, type TileDisplay } from './LibraryGrid'
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
import { t } from '@/i18n'

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
  const nsfw = useNsfw()
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query.trim())

  const all = useMemo(() => data?.mangas.nodes ?? [], [data])
  // 「稍后再看」是固定标签：列表里可能有不在书库的漫画，另外按 id 取
  const later = useLaterList()
  const { remove: removeLater } = useLaterActions()
  const isLater = view.category === 'later'
  // 「特别关心」只认书库里的：服务端只检查书库漫画的更新，移出书库的标记保留但不显示
  const favorites = useFavorites()
  const { setFavorite } = useFavoriteActions()
  const isFavorite = view.category === 'favorite'
  const favoriteList = useMemo(() => all.filter((m) => favorites.ids.has(m.id)), [all, favorites.ids])
  const base: readonly LibraryManga[] = useMemo(
    () => (isLater ? later.items ?? [] : isFavorite ? favoriteList : all),
    [isLater, later.items, isFavorite, favoriteList, all],
  )
  // 每个用户的默认分类 id 不同，不能写死 0
  const defaultCategoryId = catData?.categories.nodes.find((c) => c.default)?.id ?? 0
  // 搁置是隐藏分类：不出标签、不进分类菜单，只作筛选
  const shelf = useMemo(() => shelfIds(catData?.categories.nodes), [catData])
  const userCategories = useMemo(() => withoutShelf(catData?.categories.nodes ?? [], shelf), [catData, shelf])
  // 追踪网站的评分档位，用来把不同分制折算到一起；和书库同一份数据，快照里也有
  const trackers = data?.trackers.nodes
  const scales = useMemo(() => new Map(trackers?.map((t) => [t.id, t.scores] as const)), [trackers])
  // 按评分排序或打开了评分角标时，封面上标出分数
  // 列表模式下没有封面标记开关，只在按评分排序时显示评分列
  const showScore = view.sort === 'score' || (view.badges.score && view.density !== 'list')
  const scoreOf = useMemo(
    () => (showScore ? (m: LibraryManga) => libraryScore(m.trackRecords.nodes, scales) : undefined),
    [showScore, scales],
  )
  const mobile = useMobile()
  const display = useMemo<TileDisplay>(
    () => ({ cols: view.cols[mobile ? 'mobile' : 'desktop'], badges: view.badges, titleLines: view.titleLines, subline: view.subline }),
    [view.cols, mobile, view.badges, view.titleLines, view.subline],
  )
  const pinned = view.favoriteFirst && !isFavorite ? favorites.ids : undefined
  const items = useMemo(
    () => applyView(base, { ...view, defaultCategoryId, query: deferredQuery, scales, nsfw: nsfw.test, shelf, pinned }),
    [base, view, defaultCategoryId, deferredQuery, scales, nsfw.test, shelf, pinned],
  )
  const order = useMemo(() => items.map((m) => m.id), [items])
  const sources = useMemo(() => librarySources(base), [base])

  /* 分类：默认分类没有漫画时隐藏；「特别关心」「稍后再看」固定排在最后 */
  const laterCount = later.items?.length
  const favoriteCount = favorites.map && data ? favoriteList.length : undefined
  const categories = useMemo<SegItem<LibraryTab>[]>(() => {
    const tabs: SegItem<LibraryTab>[] = [{ value: 'all', label: t('library.tab.all'), count: all.length }]
    for (const c of userCategories) {
      const n = all.filter((m) => inCategory(m, c.id, defaultCategoryId, shelf)).length
      if (c.default && n === 0) continue
      tabs.push({ value: c.id, label: c.default ? t('library.tab.default') : c.name, count: n })
    }
    tabs.push({ value: 'favorite', label: t('library.tab.favorite'), count: favoriteCount })
    tabs.push({ value: 'later', label: t('library.tab.later'), count: laterCount })
    return tabs
  }, [userCategories, all, defaultCategoryId, shelf, favoriteCount, laterCount])

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

  // 「稍后再看」里读完自动移出的、「特别关心」里刚取消的漫画也从选择里去掉，免得批量操作作用到看不见的那部
  const { selected, setSelected } = sel
  const visible = isLater ? later.items : isFavorite && favorites.map ? favoriteList : undefined
  useEffect(() => {
    if (!visible) return
    const still = new Set(visible.map((m) => m.id))
    if ([...selected].some((id) => !still.has(id))) setSelected(new Set([...selected].filter((id) => still.has(id))))
  }, [visible, selected, setSelected])

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
      toast(t('library.checkStarted'))
    } catch (e) {
      toastError(t('library.checkFailed'), e)
    }
  }

  /* 批量操作 */
  const [updateChapters] = useMutation(UpdateChapters)
  const [enqueue] = useMutation(EnqueueDownloads)
  const [setInLibrary] = useMutation(SetInLibrary)
  const [setCats] = useMutation(SetMangasCategories)
  const [busy, setBusy] = useState(false)
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
      if (!(e instanceof StaleSessionError)) toastError(t('library.actionFailed', { label }), e)
    } finally {
      setBusy(false)
    }
  }

  const markRead = () =>
    run(t('library.bulk.markRead'), async () => {
      const still = captureUser()
      const cids = await chapterIds({ isRead: { equalTo: false } })
      if (cids.length) {
        await updateChapters({ variables: { ids: cids, patch: { isRead: true } } })
        void syncTrackProgressMany(client, ids, still)
        // 标为已读的返回里没有最后阅读时间，重取一次「稍后再看」，读完的才会当场移出
        void client.refetchQueries({ include: ['LaterMangas'] })
      }
      return t('library.bulk.markedRead', { count: cids.length, n: count(cids.length) })
    })

  const downloadUnread = () =>
    run(t('library.bulk.queue'), async () => {
      const cids = await chapterIds({ isRead: { equalTo: false }, isDownloaded: { equalTo: false } })
      if (cids.length) await enqueue({ variables: { ids: cids } })
      return cids.length ? t('library.bulk.queued', { count: cids.length, n: count(cids.length) }) : t('library.bulk.noneToDownload')
    })

  const removeFromLibrary = () => {
    if (!confirmRemove) {
      setConfirmRemove(true)
      setTimeout(() => setConfirmRemove(false), 3000)
      return
    }
    setConfirmRemove(false)
    void run(t('library.bulk.removeLibrary'), async () => {
      await setInLibrary({ variables: { ids, inLibrary: false } })
      await refetch()
      exitSelect()
      return t('library.bulk.removedLibrary', { count: ids.length, n: ids.length })
    })
  }

  const removeFromLater = () =>
    run(t('library.bulk.removeLater'), async () => {
      await removeLater(ids)
      exitSelect()
      return t('library.bulk.removedLater', { count: ids.length, n: ids.length })
    })

  // 和其他批量操作一样按全部已选算（筛选或搜索后看不见的也算）；都已是 NSFW 时按钮变成取消
  const picked = base.filter((m) => sel.selected.has(m.id))
  const allNsfw = picked.length > 0 && picked.every(nsfw.test)
  const toggleNsfw = () =>
    run(allNsfw ? t('library.bulk.unmarkNsfw') : t('library.bulk.markNsfw'), async () => {
      await setNsfw(picked, !allNsfw)
      return allNsfw ? t('library.bulk.unmarkedNsfw', { count: picked.length, n: picked.length }) : t('library.bulk.markedNsfw', { count: picked.length, n: picked.length })
    })

  // 「稍后再看」里可能有不在书库的，只对书库里的那些设特别关心
  const libraryIds = useMemo(() => new Set(all.map((m) => m.id)), [all])
  const favoritable = picked.filter((m) => libraryIds.has(m.id))
  const allFavorite = favoritable.length > 0 && favoritable.every((m) => favorites.ids.has(m.id))
  const toggleFavorite = () =>
    run(allFavorite ? t('library.bulk.unfavorite') : t('library.bulk.favorite'), async () => {
      await setFavorite(favoritable.map((m) => m.id), !allFavorite)
      const skipped = picked.length - favoritable.length
      const note = skipped ? t('library.bulk.skipped', { n: skipped }) : ''
      return (allFavorite ? t('library.bulk.unfavorited', { count: favoritable.length, n: favoritable.length }) : t('library.bulk.favorited', { count: favoritable.length, n: favoritable.length })) + note
    })

  // 和特别关心一样只对书库里的生效；全都已搁置时按钮变成取消
  const { setShelved } = useShelfActions()
  const allShelved = favoritable.length > 0 && favoritable.every((m) => isShelved(m, shelf))
  const toggleShelved = () =>
    run(allShelved ? t('library.bulk.unshelve') : t('library.bulk.shelve'), async () => {
      await setShelved(favoritable.map((m) => m.id), !allShelved)
      const skipped = picked.length - favoritable.length
      const note = skipped ? t('library.bulk.skipped', { n: skipped }) : ''
      return (allShelved ? t('library.bulk.unshelved', { count: favoritable.length, n: favoritable.length }) : t('library.bulk.shelved', { count: favoritable.length, n: favoritable.length })) + note
    })

  /* 鼠标右键菜单；触屏长按仍是多选 */
  const ctx = useContextMenu<LibraryManga>()
  const openCtx = ctx.open
  const onMenu = useCallback((m: LibraryManga, x: number, y: number) => openCtx(x, y, m), [openCtx])

  const realCategories = userCategories.filter((c) => !c.default)
  const moveTo = (catId: number, add: boolean) =>
    run(t('library.bulk.changeCategory'), async () => {
      await setCats({ variables: { ids, add: add ? [catId] : [], remove: add ? [] : [catId] } })
    })

  /* 顶部摘要 */
  const unreadTotal = useMemo(() => all.reduce((n, m) => n + m.unreadCount, 0), [all])
  const dlTotal = useMemo(() => all.reduce((n, m) => n + m.downloadCount, 0), [all])
  const sortLabel = SORTS.find((s) => s.key === view.sort)?.label
  const hasFilter = Object.values(view.filters).some((v) => v !== 0) || view.sources.length > 0 || deferredQuery.length > 0
  const clearAllFilters = () => {
    view.resetFilters()
    setQuery('')
  }

  return (
    <>
      <div className="wrap">
        {/* 画廊入口是「去另一个页面」，放在标题这一行的右侧（44px 高，和 h1 的一行对齐），不混进下面对列表做操作的工具栏 */}
        <PageHeader
          title={t('library.title')}
          sub={data && <>
            {t('library.stats', { total: count(all.length), unread: count(unreadTotal), downloaded: count(dlTotal) })}
            {items.length !== all.length && t('library.showing', { n: count(items.length) })}{t('library.sortedBy', { sort: sortLabel })}
            {view.desc ? ' ↓' : ' ↑'}
            {syncing && t('library.syncing')}
          </>}
          actions={<div className="flex-none self-start"><GalleryPill /></div>}
        />

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

        {isFavorite ? <>
          {(!favorites.map || !data) && !favorites.error && !error && <LibrarySkeleton density={view.density} />}
          {(favorites.error ?? error) && <LoadError message={(favorites.error ?? error)!.message} onRetry={() => void (favorites.error ? favorites.refetch() : refetch()).catch(() => {})} />}
          {favorites.map && data && items.length === 0 && (
            <div className="flex flex-col items-center gap-3 px-6 py-20 text-center text-muted">
              <p className="m-0">
                {favoriteList.length === 0 ? t('library.empty.favorite') : t('library.empty.noMatch')}
              </p>
              {favoriteList.length === 0 ? (
                all.length > 0 ? (
                  <Glass flat as="button" type="button" className="gbtn rounded-full text-text" onClick={() => view.setCategory('all')}>
                    {t('library.empty.viewAll')}
                  </Glass>
                ) : (
                  <Link to="/browse" className="rounded-full text-text no-underline">
                    <Glass flat as="span" className="gbtn rounded-full">{t('library.empty.goBrowse')}</Glass>
                  </Link>
                )
              ) : hasFilter && (
                <Glass flat as="button" type="button" className="gbtn rounded-full text-text" onClick={clearAllFilters}>
                  {t('library.empty.clearFilters')}
                </Glass>
              )}
            </div>
          )}
        </> : isLater ? <>
          {!later.items && !later.error && <LibrarySkeleton density={view.density} />}
          {later.error && <LoadError message={later.error.message} onRetry={() => void later.refetch().catch(() => {})} />}
          {later.items && items.length === 0 && (
            <div className="flex flex-col items-center gap-3 px-6 py-20 text-center text-muted">
              <p className="m-0">
                {later.items.length === 0 ? t('library.empty.later') : t('library.empty.noMatch')}
              </p>
              {later.items.length === 0 ? (
                <Link to="/browse" className="rounded-full text-text no-underline">
                  <Glass flat as="span" className="gbtn rounded-full">{t('library.empty.goBrowse')}</Glass>
                </Link>
              ) : hasFilter && (
                <Glass flat as="button" type="button" className="gbtn rounded-full text-text" onClick={clearAllFilters}>
                  {t('library.empty.clearFilters')}
                </Glass>
              )}
            </div>
          )}
        </> : <>
          {loading && !data && <LibrarySkeleton density={view.density} />}
          {error && <LoadError message={error.message} onRetry={() => void refetch().catch(() => {})} />}
          {data && items.length === 0 && (
            <div className="flex flex-col items-center gap-3 px-6 py-20 text-center text-muted">
              <p className="m-0">
                {all.length === 0 ? t('library.empty.library') : !hasFilter && typeof view.category === 'number' ? t('library.empty.category') : t('library.empty.noMatch')}
              </p>
              {all.length === 0 ? (
                <Link to="/browse" className="rounded-full text-text no-underline">
                  <Glass flat as="span" className="gbtn rounded-full">{t('library.empty.goBrowse')}</Glass>
                </Link>
              ) : hasFilter ? (
                <Glass flat as="button" type="button" className="gbtn rounded-full text-text" onClick={clearAllFilters}>
                  {t('library.empty.clearFilters')}
                </Glass>
              ) : typeof view.category === 'number' && (
                <Glass flat as="button" type="button" className="gbtn rounded-full text-text" onClick={() => view.setCategory('all')}>
                  {t('library.empty.viewAll')}
                </Glass>
              )}
            </div>
          )}
        </>}

        <div className="pb-28">
          <LibraryGrid
            items={items}
            intro={intro}
            scoreOf={scoreOf}
            display={display}
            density={view.density}
            selecting={selecting}
            selected={sel.selected}
            favorites={favorites.ids}
            onMenu={onMenu}
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
        unit={t('library.bulk.unit')}
        onSelectAll={sel.selectAll}
        selectAllLabel={t('library.bulk.selectAllShown', { n: count(items.length) })}
        onCancel={exitSelect}
      >
        {!isLater && <Popover
          open={catPop}
          onClose={() => setCatPop(false)}
          side="top"
          align="left"
          label={t('library.bulk.moveToCategory')}
          className="w-[240px]"
          trigger={
            <button type="button" className="bb" disabled={busy || !ids.length} onClick={() => setCatPop((v) => !v)}>
              <FolderInput className="size-5" strokeWidth={1.8} />
              {t('library.bulk.category')}
            </button>
          }
        >
          {realCategories.length === 0 ? (
            <p className="m-0 px-2 py-1 text-[13px] text-muted">{t('library.bulk.noCategories')}</p>
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
        <button type="button" className="bb" disabled={busy || !favoritable.length || !favorites.map} onClick={toggleFavorite}>
          {allFavorite ? <StarOff className="size-5" strokeWidth={1.8} /> : <Star className="size-5" strokeWidth={1.8} />}
          {allFavorite ? t('library.bulk.unfavoriteShort') : t('library.bulk.favoriteShort')}
        </button>
        <button type="button" className="bb" disabled={busy || !favoritable.length || !catData} onClick={toggleShelved}>
          {allShelved ? <ArchiveRestore className="size-5" strokeWidth={1.8} /> : <Archive className="size-5" strokeWidth={1.8} />}
          {allShelved ? t('library.bulk.unshelveShort') : t('library.bulk.shelveShort')}
        </button>
        <button type="button" className="bb" disabled={busy || !ids.length} onClick={markRead}>
          <BookCheck className="size-5" strokeWidth={1.8} />
          {t('library.bulk.allRead')}
        </button>
        <button type="button" className="bb" disabled={busy || !ids.length} onClick={toggleNsfw}>
          {allNsfw ? <Eye className="size-5" strokeWidth={1.8} /> : <EyeOff className="size-5" strokeWidth={1.8} />}
          {allNsfw ? t('library.bulk.unmarkNsfwShort') : t('library.bulk.markNsfw')}
        </button>
        <Can permission="DOWNLOAD_CHAPTERS">
          <button type="button" className="bb" disabled={busy || !ids.length} onClick={downloadUnread}>
            <Download className="size-5" strokeWidth={1.8} />
            {t('library.bulk.downloadUnread')}
          </button>
        </Can>
        {isLater ? (
          <button type="button" className="bb" disabled={busy || !ids.length} onClick={removeFromLater}>
            <ClockFading className="size-5" strokeWidth={1.8} />
            {t('library.bulk.removeLater')}
          </button>
        ) : <button
          type="button"
          className={confirmRemove ? 'bb text-danger' : 'bb'}
          disabled={busy || !ids.length}
          onClick={removeFromLibrary}
        >
          <LibraryBig className="size-5" strokeWidth={1.8} />
          {confirmRemove ? t('library.bulk.confirmRemove') : t('library.bulk.removeLibrary')}
        </button>}
      </BatchBar>

      <ContextMenu at={ctx.menu} onClose={ctx.close} label={ctx.menu ? t('library.bulk.menuLabel', { title: ctx.menu.target.title }) : t('library.bulk.menuFallback')}>
        {ctx.menu && <MangaMenuItems mangaId={ctx.menu.target.id} inLibrary={libraryIds.has(ctx.menu.target.id)} onDone={ctx.close} />}
      </ContextMenu>
    </>
  )
}
