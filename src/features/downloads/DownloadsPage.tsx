import { useMutation } from '@apollo/client/react'
import { Reorder, useDragControls } from 'motion/react'
import { ArrowDownToLine, ArrowUpToLine, GripVertical, Pause, Play, RotateCcw, Trash2, X } from 'lucide-react'
import { useMemo, useState, type KeyboardEvent } from 'react'
import { Link } from 'react-router'
import { useSharedServer } from '@/api/auth'
import { setDownloadStatus, StartDownloader, StopDownloader, useLive, type DownloadItem } from '@/api/live'
import { Glass } from '@/components/glass/Glass'
import { CoverImg } from '@/components/manga/CoverImg'
import { confirm } from '@/components/ui/Confirm'
import { Seg } from '@/components/ui/Seg'
import { toast, toastError } from '@/components/ui/toast'
import { cn } from '@/lib/cn'
import { chapterLabel, count } from '@/lib/format'
import { dropTarget, failed, groupByManga, moveGroup } from './downloads'
import { ClearDownloads, DequeueDownloads, ReorderDownload, ReorderDownloads, RequeueDownloads } from './queries'
import { t } from '@/i18n'

type View = 'order' | 'manga'

const stateText = (d: DownloadItem) => {
  if (d.state === 'DOWNLOADING')
    return d.chapter.pageCount > 0 ? t('downloads.pages', { done: Math.round(d.progress * d.chapter.pageCount), total: d.chapter.pageCount }) : `${Math.round(d.progress * 100)}%`
  if (d.state === 'ERROR') return d.tries > 0 ? t('downloads.stateErrorTries', { n: d.tries }) : t('downloads.stateError')
  if (d.state === 'FINISHED') return t('downloads.stateDone')
  return t('downloads.stateQueued')
}

/** 下载队列：实时状态来自全局订阅（api/live.ts），这里只负责展示和操作 */
export function DownloadsPage() {
  const queue = useLive((s) => s.queue)
  const running = useLive((s) => s.downloader) === 'STARTED'
  const connected = useLive((s) => s.connected)
  const [view, setView] = useState<View>('order')
  const shared = useSharedServer()

  const [start] = useMutation(StartDownloader)
  const [stop] = useMutation(StopDownloader)
  const [dequeue] = useMutation(DequeueDownloads)
  const [requeue] = useMutation(RequeueDownloads)
  const [reorderOne] = useMutation(ReorderDownload)
  const [reorderMany] = useMutation(ReorderDownloads)
  const [clear] = useMutation(ClearDownloads)

  const mangas = useMemo(() => groupByManga(queue), [queue])
  const errors = useMemo(() => failed(queue), [queue])

  const toggle = async () => {
    try {
      const r = running ? (await stop()).data?.stopDownloader : (await start()).data?.startDownloader
      if (r) useLive.setState({ downloader: r.downloadStatus.state })
    } catch (e) {
      toastError(running ? t('downloads.pauseFailed') : t('downloads.resumeFailed'), e)
    }
  }

  const remove = async (ids: number[]) => {
    try {
      const { data } = await dequeue({ variables: { ids } })
      setDownloadStatus(data?.dequeueChapterDownloads?.downloadStatus)
    } catch (e) {
      toastError(t('downloads.removeFailed'), e)
    }
  }

  // 服务端没有「重试」接口：出错的先移出再重新加入，排到队尾
  const retry = async () => {
    const ids = errors.map((d) => d.chapter.id)
    try {
      await dequeue({ variables: { ids } })
      const { data } = await requeue({ variables: { ids } })
      setDownloadStatus(data?.enqueueChapterDownloads?.downloadStatus)
      toast(t('downloads.requeued', { n: ids.length }))
    } catch (e) {
      toastError(t('downloads.retryFailed'), e)
    }
  }

  const clearAll = async () => {
    const ok = await confirm({
      title: shared ? t('downloads.clearTitleShared') : t('downloads.clearTitle'),
      body: shared
        ? t('downloads.clearBodyShared', { n: queue.length })
        : t('downloads.clearBody', { n: queue.length }),
      ok: t('downloads.clearOk'),
      danger: true,
    })
    if (!ok) return
    try {
      const { data } = await clear()
      setDownloadStatus(data?.clearDownloader?.downloadStatus)
    } catch (e) {
      toastError(t('downloads.clearFailed'), e)
    }
  }

  const reorder = async (id: number, to: number) => {
    try {
      const { data } = await reorderOne({ variables: { id, to } })
      setDownloadStatus(data?.reorderChapterDownload?.downloadStatus)
    } catch (e) {
      toastError(t('downloads.reorderFailed'), e)
    }
  }

  const moveManga = async (items: DownloadItem[], where: 'top' | 'bottom') => {
    try {
      const { data } = await reorderMany({ variables: { reorders: moveGroup(queue, items.map((d) => d.chapter.id), where) } })
      setDownloadStatus(data?.reorderChapterDownloads?.downloadStatus)
    } catch (e) {
      toastError(t('downloads.reorderFailed'), e)
    }
  }

  const status = queue.length
    ? t('downloads.summary', { state: running ? t('downloads.running') : t('downloads.paused'), chapters: count(queue.length), mangas: mangas.length }) + (errors.length ? t('downloads.summaryErrors', { n: errors.length }) : '')
    : t('downloads.empty')

  return (
    <div className="wrap pb-20">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-4 pt-9 pb-8">
        <div className="min-w-0 flex-auto">
          <h1 className="m-0 font-cjk text-[40px] font-black">{t('downloads.title')}</h1>
          <span className="text-sm text-muted" role="status">
            {status}
            {!connected && t('downloads.disconnected')}
          </span>
          {shared && (
            <p className="mt-1 mb-0 text-[13px] text-faint">
              {t('downloads.sharedNote')}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2.5 max-sm:gap-2">
          {errors.length > 0 && (
            <Glass flat as="button" type="button" className="gbtn rounded-full" onClick={() => void retry()}>
              <RotateCcw className="size-[18px]" strokeWidth={1.8} />
              {t('downloads.retry')}<span className="max-sm:hidden">{t('downloads.retryItems')}</span>
            </Glass>
          )}
          {queue.length > 0 && (
            <Glass flat as="button" type="button" className="gbtn rounded-full hover:text-danger" title={shared ? t('downloads.clearAllTitle') : undefined} onClick={() => void clearAll()}>
              <Trash2 className="size-[18px]" strokeWidth={1.8} />
              {t('downloads.clear')}
            </Glass>
          )}
          <button
            type="button"
            className="solid min-h-11"
            title={shared ? (running ? t('downloads.pauseAllTitle') : t('downloads.startAllTitle')) : undefined}
            onClick={() => void toggle()}
          >
            {running ? <Pause className="size-[18px]" strokeWidth={1.8} /> : <Play className="size-[18px] fill-current" strokeWidth={1.6} />}
            {running ? (
              <span>
                <span className="max-sm:hidden">{t('downloads.pauseAll')}</span><span className="sm:hidden">{t('downloads.pause')}</span>
              </span>
            ) : (
              <span>
                <span className="max-sm:hidden">{t('downloads.startAll')}</span><span className="sm:hidden">{t('downloads.start')}</span>
              </span>
            )}
          </button>
        </div>
      </div>

      {queue.length === 0 ? (
        <p className="py-16 text-center text-muted">
          {t('downloads.noQueueBefore')}
          <Link to="/updates" className="mx-1 font-semibold text-text">{t('downloads.noQueueLink')}</Link>
          {t('downloads.noQueueAfter')}
        </p>
      ) : (
        <>
          <Seg flat
            label={t('downloads.viewLabel')}
            value={view}
            onChange={setView}
            items={[
              { value: 'order', label: t('downloads.byOrder') },
              { value: 'manga', label: t('downloads.byManga'), count: mangas.length },
            ]}
            className="mb-6"
          />
          {view === 'order' ? (
            <OrderList queue={queue} onReorder={reorder} onRemove={(id) => void remove([id])} />
          ) : (
            mangas.map((items) => (
              <MangaGroup
                key={items[0].manga.id}
                items={items}
                isFirst={items === mangas[0]}
                isLast={items === mangas.at(-1)}
                onMove={(where) => void moveManga(items, where)}
                onRemove={(ids) => void remove(ids)}
              />
            ))
          )}
        </>
      )}
    </div>
  )
}

/* ───────── 按顺序：拖动排序 ───────── */

function OrderList({ queue, onReorder, onRemove }: { queue: DownloadItem[]; onReorder: (id: number, to: number) => Promise<void>; onRemove: (id: number) => void }) {
  const ids = useMemo(() => queue.map((d) => d.chapter.id), [queue])
  // 拖动中的本地顺序，记下开始拖时的队列顺序；服务端顺序变了（排序结果回来了）就作废。
  // 进度推送只改进度不改顺序，不会打断拖动
  const key = ids.join(',')
  const [drag, setDrag] = useState<{ key: string; order: number[] } | null>(null)
  const order = drag?.key === key ? drag.order : null
  const setOrder = (next: number[] | null) => setDrag(next && { key, order: next })
  const byId = useMemo(() => new Map(queue.map((d) => [d.chapter.id, d])), [queue])
  // 拖动期间下载完成的项去掉，新加入的接在后面
  const shown = order ? [...order.filter((id) => byId.has(id)), ...ids.filter((id) => !order.includes(id))] : ids

  const drop = (id: number) => {
    if (!order) return
    const to = dropTarget(ids, order, id)
    if (to == null) setOrder(null)
    // 成功时服务端的新顺序会让本地顺序自动作废；失败也要退回原顺序
    else void onReorder(id, to).finally(() => setDrag(null))
  }
  const nudge = (id: number, by: -1 | 1) => {
    const to = ids.indexOf(id) + by
    if (to >= 0 && to < ids.length) void onReorder(id, to)
  }

  return (
    <Reorder.Group axis="y" values={shown} onReorder={setOrder} className="m-0 flex list-none flex-col p-0">
      {shown.map((id) => (
        <OrderRow key={id} d={byId.get(id)!} onDrop={() => drop(id)} onNudge={(by) => nudge(id, by)} onRemove={() => onRemove(id)} />
      ))}
    </Reorder.Group>
  )
}

function OrderRow({ d, onDrop, onNudge, onRemove }: { d: DownloadItem; onDrop: () => void; onNudge: (by: -1 | 1) => void; onRemove: () => void }) {
  const controls = useDragControls()
  const [dragging, setDragging] = useState(false)
  const label = `${d.manga.title} ${chapterLabel(d.chapter)}`
  const keys = (e: KeyboardEvent) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault()
      onNudge(e.key === 'ArrowUp' ? -1 : 1)
    }
  }
  return (
    <Reorder.Item
      value={d.chapter.id}
      dragListener={false}
      dragControls={controls}
      onDragStart={() => setDragging(true)}
      onDragEnd={() => {
        setDragging(false)
        onDrop()
      }}
      whileDrag={{ scale: 1.015 }}
      // 拖动时盖住下面的行，才需要实色底
      className={cn('relative -mx-2 flex items-center gap-3 rounded-2xl px-2 py-2 transition-colors hover:bg-hover', dragging && 'z-10 bg-bg shadow-[0_16px_40px_rgba(0,0,0,.35)]')}
    >
      <button
        type="button"
        aria-label={t('downloads.dragAria', { label })}
        onPointerDown={(e) => controls.start(e)}
        onKeyDown={keys}
        className="gicon size-10 flex-none cursor-grab touch-none text-faint hover:text-text active:cursor-grabbing"
      >
        <GripVertical className="size-[18px]" />
      </button>
      <Item d={d} />
      <button type="button" className="gicon size-10 flex-none text-muted hover:text-danger" aria-label={t('downloads.removeAria', { label })} onClick={onRemove}>
        <X className="size-[18px]" />
      </button>
    </Reorder.Item>
  )
}

/** 封面、标题、话数、状态与进度 */
function Item({ d, compact }: { d: DownloadItem; compact?: boolean }) {
  return (
    <Link to={`/manga/${d.manga.id}`} className="flex min-w-0 flex-1 items-center gap-3 text-text no-underline">
      {!compact && (
        <span className="cv w-9 flex-none rounded-md">
          <CoverImg src={d.manga.thumbnailUrl} loading="lazy" />
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate font-semibold">{compact ? chapterLabel(d.chapter) : d.manga.title}</span>
        <span className={cn('flex items-center gap-3 text-xs text-muted num', d.state === 'ERROR' && 'text-danger')}>
          {!compact && <span className="truncate">{chapterLabel(d.chapter)}</span>}
          <span className="flex-none">{stateText(d)}</span>
          {d.state === 'DOWNLOADING' && (
            <span className="prog h-[3px] max-w-[160px] flex-1">
              <i style={{ width: `${d.progress * 100}%` }} />
            </span>
          )}
        </span>
      </span>
    </Link>
  )
}

/* ───────── 按漫画：整组移动 / 移出 ───────── */

function MangaGroup({ items, isFirst, isLast, onMove, onRemove }: {
  items: DownloadItem[]
  isFirst: boolean
  isLast: boolean
  onMove: (where: 'top' | 'bottom') => void
  onRemove: (ids: number[]) => void
}) {
  const m = items[0].manga
  return (
    <section aria-label={m.title} className="mb-7">
      <div className="mb-1.5 flex items-center gap-3">
        <Link to={`/manga/${m.id}`} className="cv w-11 flex-none rounded-lg">
          <CoverImg src={m.thumbnailUrl} loading="lazy" />
        </Link>
        <span className="flex min-w-0 flex-1 flex-col">
          <Link to={`/manga/${m.id}`} className="truncate font-bold text-text no-underline">{m.title}</Link>
          <span className="text-xs text-muted">{t('downloads.chaptersN', { count: items.length })}</span>
        </span>
        <button type="button" className="gicon size-10 text-muted hover:text-text disabled:opacity-30" disabled={isFirst} aria-label={t('downloads.moveTopAria', { title: m.title })} title={t('downloads.moveTop')} onClick={() => onMove('top')}>
          <ArrowUpToLine className="size-[18px]" strokeWidth={1.8} />
        </button>
        <button type="button" className="gicon size-10 text-muted hover:text-text disabled:opacity-30" disabled={isLast} aria-label={t('downloads.moveBottomAria', { title: m.title })} title={t('downloads.moveBottom')} onClick={() => onMove('bottom')}>
          <ArrowDownToLine className="size-[18px]" strokeWidth={1.8} />
        </button>
        <button type="button" className="gicon size-10 text-muted hover:text-danger" aria-label={t('downloads.removeAllAria', { title: m.title })} title={t('downloads.removeAll')} onClick={() => onRemove(items.map((d) => d.chapter.id))}>
          <X className="size-[18px]" />
        </button>
      </div>
      <div className="flex flex-col pl-14">
        {items.map((d) => (
          <div key={d.chapter.id} className="-mx-2 flex items-center gap-3 rounded-2xl px-2 py-1.5 hover:bg-hover">
            <Item d={d} compact />
            <button type="button" className="gicon size-9 flex-none text-muted hover:text-danger" aria-label={t('downloads.removeAria', { label: chapterLabel(d.chapter) })} onClick={() => onRemove([d.chapter.id])}>
              <X className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}
