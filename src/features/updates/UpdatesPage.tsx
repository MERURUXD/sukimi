import { useMutation, useQuery } from '@apollo/client/react'
import { BookCheck, BookOpen, CircleCheck, Download, MoreHorizontal, RefreshCw } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Link } from 'react-router'
import { EnqueueDownloads, UpdateChapters } from '@/api/chapters'
import { useLive } from '@/api/live'
import { Glass } from '@/components/glass/Glass'
import { CoverImg } from '@/components/manga/CoverImg'
import { PageAmbient } from '@/components/manga/PageAmbient'
import { DownloadPill } from '@/components/manga/DownloadPill'
import { Seg } from '@/components/ui/Seg'
import { Popover } from '@/components/ui/Popover'
import { toast, toastError } from '@/components/ui/toast'
import { hasSnapshot, withSnapshot } from '@/api/persist'
import { RecentUpdates, type UpdateChapter } from '@/features/home/queries'
import { UpdateLibrary } from '@/features/library/queries'
import { chapterLabel } from '@/features/manga/MangaHero'
import { sfwAttr } from '@/lib/devSafe'
import { cn } from '@/lib/cn'
import { riseStep, useIntro } from '@/lib/intro'
import { LastUpdate, UPDATES_FILTERS, UPDATES_PAGE, type UpdatesFilter } from './queries'
import { count, dayLabel, sec, timeAgo } from '@/lib/format'

export function UpdatesPage() {
  const [filter, setFilter] = useState<UpdatesFilter>('all')
  const updates = useQuery(RecentUpdates, {
    variables: { first: UPDATES_PAGE, offset: 0, filter: UPDATES_FILTERS[filter] },
    fetchPolicy: 'cache-and-network',
    notifyOnNetworkStatusChange: true,
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
  const list = useMemo(() => data?.chapters.nodes ?? [], [data])
  const hasMore = data?.chapters.pageInfo.hasNextPage ?? false

  // 按抓取日期分组
  const days = useMemo(() => {
    const out: { label: string; rows: UpdateChapter[] }[] = []
    for (const c of list) {
      const label = dayLabel(sec(c.fetchedAt))
      if (out.at(-1)?.label === label) out.at(-1)!.rows.push(c)
      else out.push({ label, rows: [c] })
    }
    return out
  }, [list])

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
            variables: { offset: list.length },
            updateQuery: (prev, { fetchMoreResult }) => ({
              chapters: { ...fetchMoreResult.chapters, nodes: [...prev.chapters.nodes, ...fetchMoreResult.chapters.nodes] },
            }),
          })
      },
      { rootMargin: '600px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [hasMore, loading, fetchMore, list.length, updates.data])

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
  // 检查结束后刷新列表与时间（订阅那边也会刷新活动查询，这里保证分页从头来）
  const wasRunning = useRef(false)
  useEffect(() => {
    if (wasRunning.current && !updater.isRunning) {
      void refetch({ offset: 0 })
      void last.refetch()
    }
    wasRunning.current = updater.isRunning
  }, [updater.isRunning, refetch, last])

  /* 批量 */
  const [update] = useMutation(UpdateChapters)
  const [enqueue] = useMutation(EnqueueDownloads)
  const queue = useLive((s) => s.queue)
  const queued = useMemo(() => new Map(queue.map((d) => [d.chapter.id, d])), [queue])

  const markAllRead = async () => {
    const ids = list.filter((c) => !c.isRead).map((c) => c.id)
    if (!ids.length) return toast('列表里没有未读章节')
    try {
      await update({ variables: { ids, patch: { isRead: true } } })
      toast(`已将 ${ids.length} 话标为已读`)
      if (filter === 'unread') void refetch({ offset: 0 })
    } catch (e) {
      toastError('标记失败', e)
    }
  }
  const downloadAll = async () => {
    const ids = list.filter((c) => !c.isRead && !c.isDownloaded && !queued.has(c.id)).map((c) => c.id)
    if (!ids.length) return toast('列表里的未读章节都已下载')
    try {
      await enqueue({ variables: { ids } })
      toast(`已将 ${ids.length} 话加入下载队列`)
    } catch (e) {
      toastError('加入下载失败', e)
    }
  }

  const ts = Number(lastData?.lastUpdateTimestamp.timestamp ?? 0)
  const status = updater.isRunning
    ? `正在检查更新 · ${updater.finished} / ${updater.total}`
    : [ts ? `上次检查 ${timeAgo(ts)}` : null, data ? `${count(data.chapters.totalCount)} 话` : null, syncing ? '正在同步…' : null]
        .filter(Boolean)
        .join(' · ')
  const top = list[0]

  return (
    <>
      <PageAmbient src={top?.manga.thumbnailUrl} sfw={sfwAttr(top?.manga.source?.displayName)} />
      <div className="wrap pb-10">
        <header className="pt-4 md:pt-7 md:pb-3">
          <div className="flex items-center justify-between gap-3">
            <h1 className="m-0 font-cjk text-[32px] leading-[1.1] font-black md:text-[40px]">更新</h1>
            <button type="button" className="solid min-h-11 shrink-0" onClick={check} disabled={updater.isRunning}>
              <RefreshCw className={cn('size-[18px]', updater.isRunning && 'animate-spin')} strokeWidth={2} />
              {updater.isRunning ? '正在检查' : '检查更新'}
            </button>
          </div>
          <p className="mt-1 mb-0 text-[13px] text-muted num md:mt-1.5 md:text-sm">{status || ' '}</p>
          <div className="mt-3 flex items-center justify-between gap-3 md:flex-wrap">
            <Seg
              label="筛选"
              className="[&>button]:min-h-11 md:[&>button]:min-h-9"
              items={[
                { value: 'all', label: '全部' },
                { value: 'unread', label: '未读' },
                { value: 'downloaded', label: '已下载' },
              ]}
              value={filter}
              onChange={setFilter}
            />
            <div className="hidden items-center gap-3 md:flex">
              <Glass as="button" type="button" className="gbtn rounded-full" onClick={markAllRead}>
                全部标为已读
              </Glass>
              <Glass as="button" type="button" className="gbtn rounded-full" onClick={downloadAll}>
                下载全部未读
              </Glass>
            </div>
            <UpdatesMore onMarkRead={markAllRead} onDownload={downloadAll} />
          </div>
        </header>
        {updater.isRunning && (
          <div className="mt-1 h-[3px] overflow-hidden rounded-full bg-track">
            <i
              className="block h-full rounded-full bg-accent transition-[width] duration-500"
              style={{ width: `${updater.total ? (updater.finished / updater.total) * 100 : 0}%` }}
            />
          </div>
        )}

        <section aria-label="新章节" className="pb-6">
          {data && list.length === 0 && <p className="py-20 text-center text-muted">没有符合条件的章节</p>}
          {days.map((d, di) => (
            <div key={d.label}>
              <h2 className="mt-[26px] mb-2.5 flex items-baseline gap-2.5 text-lg font-bold">
                {d.label}
                <span className="text-[13px] font-medium text-muted">{d.rows.length} 话</span>
              </h2>
              {d.rows.map((c, ri) => (
                <Row key={c.id} rise={intro ? riseStep(rowIndex(days, di, ri)) : undefined} c={c} queued={queued.get(c.id)} onEnqueue={() => void enqueue({ variables: { ids: [c.id] } }).catch((e) => toastError('下载失败', e))} onToggleRead={() => void update({ variables: { ids: [c.id], patch: c.isRead ? { isRead: false, lastPageRead: 0 } : { isRead: true } } }).catch((e) => toastError('标记失败', e))} />
              ))}
            </div>
          ))}
          <div ref={sentinel} />
          {loading && !data && <RowsSkeleton />}
          {loading && data && !syncing && <p className="py-6 text-center text-muted">正在加载…</p>}
        </section>

        <DownloadPill />
      </div>
    </>
  )
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
        <button type="button" className="opt min-h-11" onClick={() => { close(); void onDownload() }}>
          <Download className="size-[18px] shrink-0" strokeWidth={1.8} />
          下载全部未读
        </button>
      </Popover>
    </div>
  )
}

/** 第几条（跨日期分组，日期标题也算一格），给进场动画排延迟 */
function rowIndex(days: { rows: unknown[] }[], di: number, ri: number) {
  let n = di + ri
  for (let i = 0; i < di; i++) n += days[i].rows.length
  return n
}

function RowsSkeleton() {
  return (
    <div className="flex flex-col gap-1 pt-[26px]" aria-hidden>
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="flex items-center gap-4 py-2.5 pl-2.5">
          <span className="skel aspect-[2/3] w-[46px] rounded-md" style={riseStep(i)} />
          <span className="flex flex-1 flex-col gap-2">
            <span className="skel h-3.5 w-2/5 rounded-full" style={riseStep(i)} />
            <span className="skel h-3 w-1/4 rounded-full" style={riseStep(i)} />
          </span>
        </div>
      ))}
    </div>
  )
}

function Row({
  c,
  rise,
  queued,
  onEnqueue,
  onToggleRead,
}: {
  c: UpdateChapter
  rise?: CSSProperties
  queued: { progress: number; state: string } | undefined
  onEnqueue: () => void
  onToggleRead: () => void
}) {
  const time = new Date(sec(c.fetchedAt)).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  const downloadStatus = queued?.state === 'ERROR' ? '下载出错' : `下载中 ${Math.round((queued?.progress ?? 0) * 100)}%`
  return (
    <div
      data-sfw={sfwAttr(c.manga.source?.displayName)}
      style={rise}
      className={cn('flex items-center gap-2 rounded-2xl py-2.5 pr-2 pl-2.5 transition-colors hover:bg-hover sm:gap-4', rise && 'rise')}
    >
      <Link to={`/manga/${c.mangaId}`} viewTransition className="cv w-[46px] flex-none rounded-md" aria-label={`${c.manga.title} 详情`}>
        <CoverImg src={c.manga.thumbnailUrl} loading="lazy" />
      </Link>
      <Link to={`/manga/${c.mangaId}/chapter/${c.id}`} className="flex min-w-0 flex-1 flex-col text-text no-underline">
        <span className="flex min-w-0 items-baseline gap-2">
          {!c.isRead && <span className="size-2 flex-none rounded-full bg-accent" />}
          <span className={cn('min-w-0 line-clamp-2 break-words sm:block sm:truncate', c.isRead ? 'font-medium text-muted' : 'font-semibold')}>{c.manga.title}</span>
        </span>
        <span className="truncate text-xs text-muted">
          {chapterLabel(c)}
          {c.name && chapterLabel(c) !== c.name ? ` · ${c.name}` : ''}
        </span>
        {/* 手机把时间与下载状态放回文字区，给标题和章节名留出宽度。 */}
        <span className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-muted num sm:hidden">
          <span>{time}</span>
          {queued && <span>{downloadStatus}</span>}
        </span>
      </Link>
      <span className="line-clamp-2 w-28 flex-none text-xs leading-snug text-muted break-words max-sm:hidden" title={c.manga.source?.displayName}>{c.manga.source?.displayName}</span>
      <span className="w-[52px] flex-none text-right text-xs text-muted num max-sm:hidden">{time}</span>
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
            <CircleCheck className="size-5" strokeWidth={1.8} />
          </span>
        ) : (
          <button type="button" className="gicon text-muted hover:text-text" onClick={onEnqueue} aria-label={`下载 ${c.manga.title} ${chapterLabel(c)}`}>
            <Download className="size-5" strokeWidth={1.8} />
          </button>
        )}
      </span>
      <button
        type="button"
        className="gicon text-muted hover:text-text"
        onClick={onToggleRead}
        aria-label={c.isRead ? '标为未读' : '标为已读'}
        title={c.isRead ? '标为未读' : '标为已读'}
      >
        {c.isRead ? <BookOpen className="size-5" strokeWidth={1.8} /> : <BookCheck className="size-5" strokeWidth={1.8} />}
      </button>
    </div>
  )
}
