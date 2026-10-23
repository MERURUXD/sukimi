import { useApolloClient, useMutation, useQuery } from '@apollo/client/react'
import { BookCheck, BookOpen, ChevronDown, CircleCheck, Download, MoreHorizontal, RefreshCw, Square, Star } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Link, useSearchParams } from 'react-router'
import { captureUser } from '@/api/userContext'
import { syncTrackProgressMany } from '@/features/tracking/sync'
import { useCan, useSharedServer } from '@/api/auth'
import { EnqueueDownloads, UpdateChapters } from '@/api/chapters'
import { Can } from '@/features/auth/Can'
import { useLive } from '@/api/live'
import { Glass } from '@/components/glass/Glass'
import { CoverImg } from '@/components/manga/CoverImg'
import { DownloadPill } from '@/components/manga/DownloadPill'
import { confirm } from '@/components/ui/Confirm'
import { LoadError } from '@/components/ui/LoadError'
import { Seg } from '@/components/ui/Seg'
import { Popover } from '@/components/ui/Popover'
import { ContextMenu, isMouseContext, useContextMenu } from '@/components/ui/ContextMenu'
import { MangaMenuItems } from '@/features/favorite/MangaMenuItems'
import { useFavorites } from '@/features/favorite/useFavorites'
import { useLongPress } from '@/lib/useLongPress'
import { toast, toastError } from '@/components/ui/toast'
import { hasSnapshot, withSnapshot } from '@/api/persist'
import { IN_LIBRARY, type UpdateChapter } from '@/features/home/queries'
import { UpdateLibrary, UpdateStop } from '@/features/library/queries'
import { sfwAttr } from '@/lib/devSafe'
import { useNsfwBlur } from '@/features/nsfw/useNsfw'
import { cn } from '@/lib/cn'
import { riseStep, useIntro } from '@/lib/intro'
import { groupByManga, groupRank, sortGroups, type UpdateGroup } from './group'
import { UPDATES_PAGE, updatesVariables } from './pagination'
import { LastUpdate, UPDATES_FEEDS, UPDATES_FILTERS, UpdateInterval, type UpdatesFilter } from './queries'
import { isFreshUpdate } from './visible'
import { UpdateCalendar } from './UpdateCalendar'
import { chapterLabel, clock, count, dayLabel, formatDate, sec, timeAgo } from '@/lib/format'

export function UpdatesPage() {
  // 视图放在网址里：从详情页返回时还停在日历
  const [params, setParams] = useSearchParams()
  const view = params.get('view') === 'calendar' ? 'calendar' : 'recent'
  const setView = (v: 'recent' | 'calendar') => setParams(v === 'calendar' ? { view: v } : {}, { replace: true })
  // 没有 MANAGE_SETTINGS 时服务端给的是默认值的遮蔽视图，不能当真实检查频率，干脆不查、不显示下次检查
  const canReadInterval = useCan('MANAGE_SETTINGS')
  const interval = useQuery(UpdateInterval, { skip: view !== 'calendar' || !canReadInterval, fetchPolicy: 'cache-first' })
  const [filter, setFilterState] = useState<UpdatesFilter>('all')
  const client = useApolloClient()
  // 起始范围按筛选各算一次：切换筛选时重算，缓存变化不会改它（否则每加载一页就换一次查询）
  const feed = UPDATES_FEEDS[filter]
  // 「特别关心」按标记的漫画 id 交给服务端筛，分页照常；还没取到标记或一部都没有时不查
  const favorites = useFavorites()
  const favoriteIds = useMemo(() => [...favorites.ids.keys()].sort((a, b) => a - b), [favorites.ids])
  const favoriteKey = favoriteIds.join(',')
  const noFavorites = filter === 'favorite' && (!favorites.map || favoriteIds.length === 0)
  const variables = useMemo(
    () => updatesVariables(client.cache, feed, filter === 'favorite' ? { ...IN_LIBRARY, mangaId: { in: favoriteKey ? favoriteKey.split(',').map(Number) : [] } } : UPDATES_FILTERS[filter]),
    [client, feed, filter, favoriteKey],
  )
  const updates = useQuery(feed, {
    variables,
    fetchPolicy: 'cache-and-network',
    notifyOnNetworkStatusChange: true,
    skip: noFavorites,
  })
  const { loading, fetchMore, refetch } = updates
  const last = useQuery(LastUpdate, { fetchPolicy: 'cache-and-network' })
  // 刷新页面后「全部」先用上次保存的数据，网络数据到了再替换
  const data = filter === 'all' ? withSnapshot('updates', updates.data) : updates.data
  const lastData = withSnapshot('lastUpdate', last.data)
  const syncing = loading && !updates.data && !!data
  // 既没有缓存也没有快照、要等网络时，数据到了播一次进场动画
  const [introWanted] = useState(() => !updates.data && !hasSnapshot('updates'))
  const intro = useIntro(introWanted, !!data)
  // 服务端原始条数用来分页；迁移时一并抓到的章节不显示，所以显示的条数可能少于它
  const loaded = data?.chapters.nodes.length ?? 0
  const list = useMemo(() => (data?.chapters.nodes ?? []).filter(isFreshUpdate), [data])
  const hasMore = data?.chapters.pageInfo.hasNextPage ?? false

  // 在这一行上点了「标为已读 / 未读」的组，先按点之前的档位留在原处，不然它当场挪走、下一行滑到指针下面，
  // 连点就会点错。换筛选、检查完更新或重新进入页面时才按新状态重排
  const [held, setHeld] = useState<ReadonlyMap<string, number>>(new Map())
  const hold = (g: UpdateGroup<UpdateChapter>) =>
    setHeld((prev) => (prev.has(g.key) ? prev : new Map(prev).set(g.key, groupRank(g, favorites.ids.has(g.mangaId)))))
  const setFilter = (f: UpdatesFilter) => {
    setFilterState(f)
    setHeld(new Map())
  }

  // 按抓取日期分组，同一天里同一部漫画的多话再折叠成一行；每天里没读完的在前，其中特别关心最先
  const days = useMemo(() => {
    const out: { label: string; rows: UpdateChapter[] }[] = []
    for (const c of list) {
      const label = dayLabel(sec(c.fetchedAt))
      if (out.at(-1)?.label === label) out.at(-1)!.rows.push(c)
      else out.push({ label, rows: [c] })
    }
    return out.map((d) => ({
      ...d,
      groups: sortGroups(groupByManga(d.rows, d.label), (g) => held.get(g.key) ?? groupRank(g, favorites.ids.has(g.mangaId))),
    }))
  }, [list, held, favorites.ids])
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set())
  const toggleGroup = (key: string) =>
    setOpen((prev) => {
      const next = new Set(prev)
      if (!next.delete(key)) next.add(key)
      return next
    })

  // 滚到底自动加载下一页
  const sentinel = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = sentinel.current
    if (!el || !hasMore) return
    const io = new IntersectionObserver(
      ([e]) => {
        // 快照数据只用来先显示，网络数据到了再分页
        if (e.isIntersecting && !loading && updates.data)
          void fetchMore({
            variables: { first: UPDATES_PAGE, offset: loaded },
            updateQuery: (prev, { fetchMoreResult }) => ({
              chapters: { ...fetchMoreResult.chapters, nodes: [...prev.chapters.nodes, ...fetchMoreResult.chapters.nodes] },
            }),
          })
      },
      { rootMargin: '600px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [hasMore, loading, fetchMore, loaded, updates.data])

  /* 检查更新 */
  const updater = useLive((s) => s.updater)
  const [start] = useMutation(UpdateLibrary)
  const check = async () => {
    try {
      await start({ variables: {} })
    } catch (e) {
      toastError('无法开始检查', e)
    }
  }
  // 服务端同一时间只有一个更新任务，多账号时停下的可能是别人发起的检查
  const shared = useSharedServer()
  const [stopUpdate] = useMutation(UpdateStop)
  const stop = async () => {
    if (
      shared &&
      !(await confirm({
        title: '停止检查更新？',
        body: '检查更新由服务端上的所有账号共用，其他人发起的检查也会一起停止。已经找到的新章节会保留。',
        ok: '停止',
        // 会停掉别人的检查：不默认聚焦确认按钮，避免误按回车
        danger: true,
      }))
    )
      return
    try {
      await stopUpdate()
      toast('已停止检查更新')
    } catch (e) {
      toastError('停止失败', e)
    }
  }
  // 检查结束后刷新列表与时间（订阅那边也会刷新活动查询，这里保证分页从头来）
  const wasRunning = useRef(false)
  useEffect(() => {
    if (wasRunning.current && !updater.isRunning) {
      setHeld(new Map())
      void refetch({ offset: 0 })
      void last.refetch()
    }
    wasRunning.current = updater.isRunning
  }, [updater.isRunning, refetch, last])

  /* 右键 / 长按某一行：特别关心、稍后再看 */
  const ctx = useContextMenu<UpdateChapter['manga']>()

  /* 批量 */
  const [update] = useMutation(UpdateChapters)
  const [enqueue] = useMutation(EnqueueDownloads)
  const queue = useLive((s) => s.queue)
  const queued = useMemo(() => new Map(queue.map((d) => [d.chapter.id, d])), [queue])

  const markAllRead = async () => {
    const unread = list.filter((c) => !c.isRead)
    const ids = unread.map((c) => c.id)
    if (!ids.length) return toast('列表里没有未读章节')
    const still = captureUser()
    try {
      await update({ variables: { ids, patch: { isRead: true } } })
      // 全部读完后按时间排，不再留着之前单独点过的组
      setHeld(new Map())
      toast(`已将 ${ids.length} 话标为已读`)
      void syncTrackProgressMany(client, unread.map((c) => c.mangaId), still)
      if (filter === 'unread') void refetch({ offset: 0 })
    } catch (e) {
      toastError('标为已读失败', e)
    }
  }
  const downloadAll = async () => {
    const ids = list.filter((c) => !c.isRead && !c.isDownloaded && !queued.has(c.id)).map((c) => c.id)
    if (!ids.length) return toast('列表里的未读章节都已下载')
    try {
      await enqueue({ variables: { ids } })
      toast(`已将 ${ids.length} 话加入下载队列`)
    } catch (e) {
      toastError('加入下载队列失败', e)
    }
  }

  const ts = Number(lastData?.lastUpdateTimestamp.timestamp ?? 0)
  const hours = interval.data?.settings.globalUpdateInterval
  const status = updater.isRunning
    ? `正在检查更新 · ${updater.finished} / ${updater.total}`
    : view === 'calendar'
      ? [ts ? `上次检查 ${timeAgo(ts)}` : null, nextCheck(ts, hours)].filter(Boolean).join(' · ')
      : [ts ? `上次检查 ${timeAgo(ts)}` : null, data ? `${count(Math.max(0, data.chapters.totalCount - (loaded - list.length)))} 话` : null, syncing ? '正在同步…' : null]
          .filter(Boolean)
          .join(' · ')

  return (
    <>
      <div className="wrap pb-10">
        <header className="pt-4 md:pt-7 md:pb-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-4 md:gap-7">
              <h1 className="m-0 font-cjk text-[32px] leading-[1.1] font-black md:text-[40px]">更新</h1>
              <Seg
                label="视图"
                className="[&>button]:min-h-11 md:[&>button]:min-h-9"
                items={[
                  { value: 'recent', label: '最近' },
                  { value: 'calendar', label: '日历' },
                ]}
                value={view}
                onChange={setView}
              />
            </div>
            {updater.isRunning ? (
              <button type="button" className="solid min-h-11 shrink-0" onClick={() => void stop()}>
                <Square className="size-4 fill-current" strokeWidth={2} />
                停止检查
              </button>
            ) : (
              <button type="button" className="solid min-h-11 shrink-0" onClick={check}>
                <RefreshCw className="size-[18px]" strokeWidth={2} />
                检查更新
              </button>
            )}
          </div>
          <p className="mt-1 mb-0 text-[13px] text-muted num md:mt-1.5 md:text-sm">{status || ' '}</p>
          {view === 'recent' && <div className="mt-3 flex items-center justify-between gap-3 md:flex-wrap">
            <Seg
              label="筛选"
              className="[&>button]:min-h-11 md:[&>button]:min-h-9"
              items={[
                { value: 'all', label: '全部' },
                { value: 'unread', label: '未读' },
                { value: 'downloaded', label: '已下载' },
                { value: 'favorite', label: '特别关心' },
              ]}
              value={filter}
              onChange={setFilter}
            />
            <div className="hidden items-center gap-3 md:flex">
              <Glass as="button" type="button" className="gbtn rounded-full" onClick={markAllRead}>
                全部标为已读
              </Glass>
              <Can permission="DOWNLOAD_CHAPTERS">
                <Glass as="button" type="button" className="gbtn rounded-full" onClick={downloadAll}>
                  下载全部未读
                </Glass>
              </Can>
            </div>
            <UpdatesMore onMarkRead={markAllRead} onDownload={downloadAll} />
          </div>}
        </header>
        {updater.isRunning && (
          <div className="mt-1 h-[3px] overflow-hidden rounded-full bg-track">
            <i
              className="block h-full rounded-full bg-accent transition-[width] duration-500"
              style={{ width: `${updater.total ? (updater.finished / updater.total) * 100 : 0}%` }}
            />
          </div>
        )}

        {view === 'calendar' ? <UpdateCalendar /> : <section aria-label="新章节" className="pb-6">
          {data && list.length === 0 && !noFavorites && <p className="py-20 text-center text-muted">没有符合条件的章节</p>}
          {noFavorites && favorites.map && <p className="py-20 text-center text-muted">还没有特别关心的漫画。在漫画详情页点星标，或右键、长按这里的条目设置。</p>}
          {days.map((d, di) => (
            <div key={d.label}>
              <h2 className="mt-[26px] mb-2.5 flex items-baseline gap-2.5 text-lg font-bold lg:text-xl">
                {d.label}
                <span className="text-[13px] font-medium text-muted">{d.rows.length} 话</span>
              </h2>
              {/* 宽屏分两栏，条目才能放大又不在右边空出一大片；items-start 让展开的组只撑高自己 */}
              <div className="xl:grid xl:grid-cols-2 xl:items-start xl:gap-x-6">
              {d.groups.map((g, gi) => {
                const rise = intro ? riseStep(rowIndex(days, di, gi)) : undefined
                const row = (c: UpdateChapter, nested = false) => (
                  <Row key={c.id} rise={nested ? undefined : rise} nested={nested} c={c} favorite={favorites.ids.has(c.mangaId)} onMenu={(x, y) => ctx.open(x, y, c.manga)} queued={queued.get(c.id)} onEnqueue={() => void enqueue({ variables: { ids: [c.id] } }).catch((e) => toastError('下载失败', e))} onToggleRead={() => { hold(g); const still = captureUser(); void update({ variables: { ids: [c.id], patch: c.isRead ? { isRead: false, lastPageRead: 0 } : { isRead: true } } }).then(() => { if (!c.isRead) void syncTrackProgressMany(client, [c.mangaId], still) }).catch((e) => toastError(c.isRead ? '标为未读失败' : '标为已读失败', e)) }} />
                )
                if (g.rows.length === 1) return row(g.rows[0])
                const expanded = open.has(g.key)
                return (
                  <div key={g.key}>
                    <GroupRow rows={g.rows} rise={rise} expanded={expanded} onToggle={() => toggleGroup(g.key)} favorite={favorites.ids.has(g.rows[0].mangaId)} onMenu={(x, y) => ctx.open(x, y, g.rows[0].manga)} />
                    {/* 常驻渲染，用网格行高 0fr → 1fr 做展开收起，下面的记录才会顺滑让位；收起时 inert 让键盘与读屏跳过 */}
                    <div
                      className={cn('grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]', expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0')}
                      inert={!expanded}
                    >
                      <div className="min-h-0 overflow-hidden">
                        {g.rows.map((c) => row(c, true))}
                        <div className="h-2" aria-hidden />
                      </div>
                    </div>
                  </div>
                )
              })}
              </div>
            </div>
          ))}
          <div ref={sentinel} />
          {loading && !data && <RowsSkeleton />}
          {updates.error && !data && <LoadError message={updates.error.message} onRetry={() => void refetch().catch(() => {})} />}
          {loading && data && !syncing && <p className="py-6 text-center text-muted">正在加载…</p>}
        </section>}

        <DownloadPill />
      </div>
      <ContextMenu at={ctx.menu} onClose={ctx.close} label={ctx.menu ? `${ctx.menu.target.title} 的操作` : '操作'}>
        {/* 更新页只列书库里的漫画 */}
        {ctx.menu && <MangaMenuItems mangaId={ctx.menu.target.id} inLibrary onDone={ctx.close} />}
      </ContextMenu>
    </>
  )
}

/** 下次自动检查：上次检查时间加上检查频率；关闭自动检查或时间已过时另说 */
function nextCheck(last: number, hours: number | null | undefined) {
  if (hours == null || !last) return null
  if (hours <= 0) return '自动检查已关闭'
  const at = last + hours * 3_600_000
  if (at <= Date.now()) return '即将自动检查'
  // dayLabel 只会往回数，往后的日子在这里单独说
  const days = Math.round((new Date(new Date(at).toDateString()).getTime() - new Date(new Date().toDateString()).getTime()) / 86_400_000)
  return `下次检查 ${days === 0 ? '今天' : days === 1 ? '明天' : formatDate(at)} ${clock(at)}`
}

function UpdatesMore({ onMarkRead, onDownload }: { onMarkRead: () => Promise<void>; onDownload: () => Promise<void> }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const trigger = useRef<HTMLButtonElement>(null)
  const firstAction = useRef<HTMLButtonElement>(null)
  const close = () => {
    setOpen(false)
    trigger.current?.focus()
  }
  useEffect(() => {
    if (!open) return
    firstAction.current?.focus()
    // 宽屏直接展示批量按钮，切换到宽屏时关闭手机弹层。
    const desktop = window.matchMedia('(min-width: 768px)')
    const changed = () => { if (desktop.matches) setOpen(false) }
    desktop.addEventListener('change', changed)
    return () => desktop.removeEventListener('change', changed)
  }, [open])

  return (
    <div className="shrink-0 md:hidden">
      <Popover
        open={open}
        onClose={close}
        id={id}
        label="更新批量操作"
        className="w-[224px] max-w-[calc(100vw-32px)]"
        trigger={
          <Glass as="button" ref={trigger} type="button" className="gicon rounded-full" aria-label="更多更新操作" aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => setOpen((v) => !v)}>
            <MoreHorizontal className="size-5" strokeWidth={1.8} />
          </Glass>
        }
      >
        <p className="pop-h">批量操作</p>
        <button ref={firstAction} type="button" className="opt min-h-11" onClick={() => { close(); void onMarkRead() }}>
          <BookCheck className="size-[18px] shrink-0" strokeWidth={1.8} />
          全部标为已读
        </button>
        <Can permission="DOWNLOAD_CHAPTERS">
          <button type="button" className="opt min-h-11" onClick={() => { close(); void onDownload() }}>
            <Download className="size-[18px] shrink-0" strokeWidth={1.8} />
            下载全部未读
          </button>
        </Can>
      </Popover>
    </div>
  )
}

/** 第几条（跨日期分组，日期标题也算一格），给进场动画排延迟 */
function rowIndex(days: { groups: unknown[] }[], di: number, gi: number) {
  let n = di + gi
  for (let i = 0; i < di; i++) n += days[i].groups.length
  return n
}

function RowsSkeleton() {
  return (
    <div className="flex flex-col gap-1 pt-[26px] xl:grid xl:grid-cols-2 xl:gap-x-6" aria-hidden>
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="flex items-center gap-4 py-2.5 pl-2.5 lg:gap-[18px] lg:py-3">
          <span className="skel aspect-[2/3] w-[46px] rounded-md lg:w-[72px] lg:rounded-lg" style={riseStep(i)} />
          <span className="flex flex-1 flex-col gap-2">
            <span className="skel h-3.5 w-2/5 rounded-full" style={riseStep(i)} />
            <span className="skel h-3 w-1/4 rounded-full" style={riseStep(i)} />
          </span>
        </div>
      ))}
    </div>
  )
}

/** 整行的右键（鼠标）和长按（触屏）都打开操作菜单；长按的位置取按下时的手指位置 */
function useRowMenu(open: (x: number, y: number) => void) {
  const at = useRef({ x: 0, y: 0 })
  const press = useLongPress(() => open(at.current.x, at.current.y))
  return {
    ...press,
    onPointerDown: (e: React.PointerEvent) => {
      at.current = { x: e.clientX, y: e.clientY }
      press.onPointerDown(e)
    },
    onContextMenu: (e: React.MouseEvent) => {
      if (!isMouseContext(e)) return press.onContextMenu(e)
      e.preventDefault()
      open(e.clientX, e.clientY)
    },
  }
}

/** 标题前的实心星：特别关心 */
const FavoriteMark = () => <Star className="size-3.5 flex-none self-center fill-current lg:size-4" strokeWidth={2.2} aria-label="特别关心" />

function Row({
  c,
  rise,
  nested,
  favorite,
  onMenu,
  queued,
  onEnqueue,
  onToggleRead,
}: {
  c: UpdateChapter
  rise?: CSSProperties
  favorite: boolean
  onMenu: (x: number, y: number) => void
  /** 折叠组展开后的子行：不重复封面与书名，只显示章节名 */
  nested?: boolean
  queued: { progress: number; state: string } | undefined
  onEnqueue: () => void
  onToggleRead: () => void
}) {
  const time = new Date(sec(c.fetchedAt)).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  const downloadStatus = queued?.state === 'ERROR' ? '下载出错' : `下载中 ${Math.round((queued?.progress ?? 0) * 100)}%`
  const menu = useRowMenu(onMenu)
  return (
    <div
      {...menu}
      data-sfw={sfwAttr(c.manga.source?.displayName)}
      data-nsfw={useNsfwBlur(c.manga)}
      data-reader-origin
      style={rise}
      className={cn('flex items-center gap-2 rounded-2xl pr-2 pl-2.5 transition-colors hover:bg-hover sm:gap-4 lg:gap-[18px]', nested ? 'py-1.5' : 'py-2.5 lg:py-3', rise && 'rise')}
    >
      {nested ? (
        <span className="w-[46px] flex-none lg:w-[72px]" aria-hidden />
      ) : (
        <Link to={`/manga/${c.mangaId}`} viewTransition className="cv w-[46px] flex-none rounded-md lg:w-[72px] lg:rounded-lg" aria-label={`${c.manga.title} 详情`}>
          <CoverImg src={c.manga.thumbnailUrl} loading="lazy" />
        </Link>
      )}
      <Link to={`/manga/${c.mangaId}/chapter/${c.id}`} viewTransition className="flex min-w-0 flex-1 flex-col text-text no-underline lg:gap-0.5">
        <span className="flex min-w-0 items-baseline gap-2">
          {!c.isRead && <span className="size-2 flex-none rounded-full bg-accent" />}
          {favorite && !nested && <FavoriteMark />}
          <span className={cn('min-w-0 line-clamp-2 break-words sm:block sm:truncate', nested ? 'lg:text-[15px]' : 'lg:text-lg', c.isRead ? 'font-medium text-muted' : nested ? 'font-medium' : 'font-semibold')}>{nested ? chapterLabel(c) : c.manga.title}</span>
        </span>
        {!nested && <span className={cn('truncate text-[13px] text-muted lg:text-[15px]', !c.isRead && 'lg:text-text')}>{chapterLabel(c)}</span>}
        {/* 手机把时间与下载状态放回文字区，给标题和章节名留出宽度。 */}
        <span className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-muted num sm:hidden">
          <span>{time}</span>
          {queued && <span>{downloadStatus}</span>}
        </span>
        {/* 宽屏同理：来源和时间收进文字区第三行，不再占两列，两栏时每栏才放得下大封面和大字 */}
        <span className="hidden truncate text-[13px] text-muted num lg:block" title={nested ? undefined : c.manga.source?.displayName}>{nested ? time : [c.manga.source?.displayName, time].filter(Boolean).join(' · ')}</span>
      </Link>
      <span className="line-clamp-2 w-28 flex-none text-[13px] leading-snug text-muted break-words max-sm:hidden lg:hidden" title={c.manga.source?.displayName}>{nested ? null : c.manga.source?.displayName}</span>
      <span className="w-[52px] flex-none text-right text-[13px] text-muted num max-sm:hidden lg:hidden">{time}</span>
      <span className="flex w-11 flex-none justify-end sm:w-24">
        {queued ? (
          <span className="flex w-11 flex-col items-center gap-1 sm:w-[84px] sm:items-stretch" title={downloadStatus}>
            <Download className="size-5 text-muted sm:hidden" strokeWidth={1.8} />
            <span className="text-xs text-muted num max-sm:hidden">{downloadStatus}</span>
            <span className="h-1 w-full overflow-hidden rounded-full bg-track">
              <i className="block h-full rounded-full bg-accent" style={{ width: `${queued.progress * 100}%` }} />
            </span>
          </span>
        ) : c.isDownloaded ? (
          <span className="grid size-11 place-items-center text-accent" title="已下载">
            <CircleCheck className="size-5 lg:size-[22px]" strokeWidth={1.8} />
          </span>
        ) : (
          <Can permission="DOWNLOAD_CHAPTERS">
            <button type="button" className="gicon text-muted hover:text-text" onClick={onEnqueue} aria-label={`下载 ${c.manga.title} ${chapterLabel(c)}`}>
              <Download className="size-5 lg:size-[22px]" strokeWidth={1.8} />
            </button>
          </Can>
        )}
      </span>
      <button
        type="button"
        className="gicon text-muted hover:text-text"
        onClick={onToggleRead}
        aria-label={c.isRead ? '标为未读' : '标为已读'}
        title={c.isRead ? '标为未读' : '标为已读'}
      >
        {c.isRead ? <BookOpen className="size-5 lg:size-[22px]" strokeWidth={1.8} /> : <BookCheck className="size-5 lg:size-[22px]" strokeWidth={1.8} />}
      </button>
    </div>
  )
}

/** 同一天同一部漫画的多话折叠行：显示最新一话，点开看全部 */
function GroupRow({ rows, rise, expanded, onToggle, favorite, onMenu }: {
  rows: UpdateChapter[]
  rise?: CSSProperties
  expanded: boolean
  onToggle: () => void
  favorite: boolean
  onMenu: (x: number, y: number) => void
}) {
  const c = rows[0]
  const menu = useRowMenu(onMenu)
  const unread = rows.filter((r) => !r.isRead).length
  const time = new Date(sec(c.fetchedAt)).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  const summary = `${chapterLabel(c)} 等 ${rows.length} 话${unread ? ` · ${unread} 话未读` : ''}`
  return (
    <div
      {...menu}
      data-sfw={sfwAttr(c.manga.source?.displayName)}
      data-nsfw={useNsfwBlur(c.manga)}
      style={rise}
      className={cn('flex items-center gap-2 rounded-2xl py-2.5 pr-2 pl-2.5 transition-colors hover:bg-hover sm:gap-4 lg:gap-[18px] lg:py-3', rise && 'rise')}
    >
      {/* 封面后面露出两层，像叠在一起的几话；右下角的数字是话数 */}
      <span className="relative mt-2 w-[46px] flex-none lg:w-[72px]">
        <span aria-hidden className="absolute inset-x-2 -top-2.5 h-full rounded-md bg-text/15 lg:inset-x-3 lg:rounded-lg" />
        <span aria-hidden className="absolute inset-x-1 -top-[5px] h-full rounded-md bg-text/30 lg:inset-x-1.5 lg:rounded-lg" />
        <Link to={`/manga/${c.mangaId}`} viewTransition className="cv relative rounded-md lg:rounded-lg" aria-label={`${c.manga.title} 详情`}>
          <CoverImg src={c.manga.thumbnailUrl} loading="lazy" />
        </Link>
        <span aria-hidden className="pointer-events-none absolute -right-2 -bottom-2 grid h-[22px] min-w-[22px] place-items-center rounded-full bg-accent px-1.5 text-[12px] leading-none font-bold text-on-accent num">{rows.length}</span>
      </span>
      <button type="button" className="flex min-w-0 flex-1 cursor-pointer flex-col border-0 bg-transparent p-0 text-left text-text lg:gap-0.5" aria-expanded={expanded} onClick={onToggle}>
        <span className="flex min-w-0 items-baseline gap-2">
          {unread > 0 && <span className="size-2 flex-none rounded-full bg-accent" />}
          {favorite && <FavoriteMark />}
          <span className={cn('min-w-0 line-clamp-2 break-words sm:block sm:truncate lg:text-lg', unread ? 'font-semibold' : 'font-medium text-muted')}>{c.manga.title}</span>
        </span>
        <span className={cn('truncate text-[13px] text-muted lg:text-[15px]', unread > 0 && 'lg:text-text')}>{summary}</span>
        <span className="mt-0.5 text-[13px] text-muted num sm:hidden">{time}</span>
        <span className="hidden truncate text-[13px] text-muted num lg:block" title={c.manga.source?.displayName}>{[c.manga.source?.displayName, time].filter(Boolean).join(' · ')}</span>
      </button>
      <span className="line-clamp-2 w-28 flex-none text-[13px] leading-snug text-muted break-words max-sm:hidden lg:hidden" title={c.manga.source?.displayName}>{c.manga.source?.displayName}</span>
      <span className="w-[52px] flex-none text-right text-[13px] text-muted num max-sm:hidden lg:hidden">{time}</span>
      <span className="w-11 flex-none sm:w-24" aria-hidden />
      <button type="button" className="gicon text-muted hover:text-text" onClick={onToggle} tabIndex={-1} aria-hidden>
        <ChevronDown className={cn('size-5 transition-transform lg:size-[22px]', expanded && 'rotate-180')} strokeWidth={1.8} />
      </button>
    </div>
  )
}
