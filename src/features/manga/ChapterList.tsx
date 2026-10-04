import { useMutation } from '@apollo/client/react'
import { useWindowVirtualizer } from '@tanstack/react-virtual'
import {
  ArrowDownUp,
  Bookmark,
  BookmarkMinus,
  BookCheck,
  BookOpen,
  Check,
  CheckCheck,
  CircleCheck,
  Download,
  ListChecks,
  MoreHorizontal,
  Trash2,
} from 'lucide-react'
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { Link } from 'react-router'
import { DeleteDownloads, EnqueueDownloads, UpdateChapters } from '@/api/chapters'
import { Glass } from '@/components/glass/Glass'
import { BatchBar } from '@/components/ui/BatchBar'
import { Popover } from '@/components/ui/Popover'
import { Seg } from '@/components/ui/Seg'
import { toast, toastError } from '@/components/ui/toast'
import { chapterNo, formatDate, ms } from '@/lib/format'
import { cn } from '@/lib/cn'
import { useLongPress } from '@/lib/useLongPress'
import { useSelection } from '@/lib/useSelection'
import type { Chapter } from './queries'
import { FROM_DETAIL } from '@/features/reader/nav'
import { useChapterView, type ChapterFilter } from './store'
export interface QueueItem {
  progress: number
  state: 'QUEUED' | 'DOWNLOADING' | 'FINISHED' | 'ERROR'
}

/** 章节相关的变更操作，列表行菜单和批量栏共用 */
export function useChapterActions(all: readonly Chapter[], onDownloadQueued: () => void, onDownloadsDeleted: () => void) {
  const [update] = useMutation(UpdateChapters)
  const [enqueue] = useMutation(EnqueueDownloads)
  const [remove] = useMutation(DeleteDownloads)

  return useMemo(() => {
    const wrap =
      <A extends unknown[]>(label: string, fn: (...a: A) => Promise<string | void>) =>
      async (...a: A) => {
        try {
          const msg = await fn(...a)
          if (msg) toast(msg)
        } catch (e) {
          toastError(`${label}失败`, e)
        }
      }
    const patch = (ids: number[], p: { isRead?: boolean; isBookmarked?: boolean; lastPageRead?: number }) =>
      update({ variables: { ids, patch: p } })

    return {
      setRead: wrap('标记', async (ids: number[], isRead: boolean) => {
        // 标为未读时同时清掉页码，避免「继续阅读」停在最后一页
        await patch(ids, isRead ? { isRead } : { isRead, lastPageRead: 0 })
        if (ids.length > 1) return `已将 ${ids.length} 话标为${isRead ? '已读' : '未读'}`
      }),
      setBookmarked: wrap('书签', async (ids: number[], isBookmarked: boolean) => {
        await patch(ids, { isBookmarked })
        if (ids.length > 1) return isBookmarked ? `已为 ${ids.length} 话加书签` : `已取消 ${ids.length} 话的书签`
      }),
      /** 选中章节（含）之前的全部标为已读 */
      markPreviousRead: wrap('标记', async (ids: number[]) => {
        const max = Math.max(...all.filter((c) => ids.includes(c.id)).map((c) => c.sourceOrder))
        const targets = all.filter((c) => c.sourceOrder <= max && !c.isRead).map((c) => c.id)
        if (targets.length) await patch(targets, { isRead: true })
        return `已将 ${targets.length} 话标为已读`
      }),
      download: wrap('下载', async (ids: number[]) => {
        const targets = all.filter((c) => ids.includes(c.id) && !c.isDownloaded).map((c) => c.id)
        if (!targets.length) return '选中的章节都已下载'
        await enqueue({ variables: { ids: targets } })
        onDownloadQueued()
        return `已将 ${targets.length} 话加入下载队列`
      }),
      deleteDownloads: wrap('删除下载', async (ids: number[]) => {
        const targets = all.filter((c) => ids.includes(c.id) && c.isDownloaded).map((c) => c.id)
        if (!targets.length) return '选中的章节没有下载'
        await remove({ variables: { ids: targets } })
        onDownloadsDeleted()
        return `已删除 ${targets.length} 话的下载`
      }),
    }
  }, [all, update, enqueue, remove, onDownloadQueued, onDownloadsDeleted])
}

type Actions = ReturnType<typeof useChapterActions>

const FILTERS: { value: ChapterFilter; label: string; test: (c: Chapter) => boolean }[] = [
  { value: 'all', label: '全部', test: () => true },
  { value: 'unread', label: '未读', test: (c) => !c.isRead },
  { value: 'downloaded', label: '已下载', test: (c) => c.isDownloaded },
  { value: 'bookmarked', label: '书签', test: (c) => c.isBookmarked },
]

export function ChapterList({
  mangaId,
  chapters,
  queue,
  actions,
}: {
  mangaId: number
  chapters: readonly Chapter[]
  queue: ReadonlyMap<number, QueueItem>
  actions: Actions
}) {
  const { filter, desc, setFilter, toggleOrder } = useChapterView()
  const visible = useMemo(() => {
    const test = FILTERS.find((f) => f.value === filter)?.test ?? (() => true)
    const list = chapters.filter(test)
    return desc ? list.reverse() : list
  }, [chapters, filter, desc])
  const order = useMemo(() => visible.map((c) => c.id), [visible])

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

  const onRowToggle = useCallback((id: number, index: number, e: MouseEvent) => sel.toggle(id, index, e.shiftKey), [sel])
  // 触屏长按：进入多选并选中这一话
  const onLongPress = useCallback(
    (id: number, index: number) => {
      setSelecting(true)
      sel.toggle(id, index)
    },
    [sel],
  )

  // 虚拟列表
  const box = useRef<HTMLDivElement>(null)
  const [top, setTop] = useState(0)
  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const t = el.getBoundingClientRect().top + window.scrollY
    if (Math.abs(t - top) > 0.5) setTop(t)
  })
  const v = useWindowVirtualizer({
    count: visible.length,
    estimateSize: () => 64,
    overscan: 10,
    scrollMargin: top,
    // 默认会取创建时的 window.scrollY 并在挂载后滚回去；切页时那是上一页的位置，交给 ScrollManager 处理
    initialOffset: 0,
    getItemKey: (i) => visible[i].id,
  })

  const unread = chapters.filter((c) => !c.isRead).length
  const ids = [...sel.selected]
  const selChapters = chapters.filter((c) => sel.selected.has(c.id))
  const allBookmarked = selChapters.length > 0 && selChapters.every((c) => c.isBookmarked)
  const counts: Record<ChapterFilter, number> = {
    all: chapters.length,
    unread,
    downloaded: chapters.filter((c) => c.isDownloaded).length,
    bookmarked: chapters.filter((c) => c.isBookmarked).length,
  }

  return (
    <section aria-labelledby="h-ch" className="wrap pb-32">
      <div className="flex flex-wrap items-center gap-2.5 pt-2 pb-[18px]">
        <div className="flex flex-auto items-baseline gap-3">
          <h2 id="h-ch" className="m-0 text-[28px] font-bold">
            章节
          </h2>
          <span className="text-muted num">
            {chapters.length} 话 · {unread} 话未读
          </span>
        </div>
        <div className="flex items-center gap-2.5 max-sm:w-full">
          <Seg
            label="章节筛选"
            items={FILTERS.map((f) => ({ value: f.value, label: f.label, count: f.value === 'all' ? undefined : counts[f.value] }))}
            value={filter}
            onChange={setFilter}
            className="max-sm:min-w-0 max-sm:flex-1"
          />
          <Glass as="button" type="button" className="gicon size-10 rounded-full" onClick={toggleOrder} aria-label={desc ? '切换为最早在上' : '切换为最新在上'} title={desc ? '最新在上' : '最早在上'}>
            <ArrowDownUp className="size-[18px]" strokeWidth={1.8} />
          </Glass>
          <Glass as="button"
              type="button"
              className={cn('rounded-full', 'gicon size-10', selecting && 'bg-g-hi')}
              onClick={() => (selecting ? exitSelect() : setSelecting(true))}
              aria-pressed={selecting}
              aria-label="多选章节"
              title="多选章节"
            >
            <ListChecks className="size-[18px]" strokeWidth={1.8} />
          </Glass>
        </div>
      </div>

      {visible.length === 0 && <p className="py-16 text-center text-muted">{chapters.length ? '没有符合筛选的章节' : '还没有章节'}</p>}

      <div ref={box} role="list" aria-label="章节列表" className="relative" style={{ height: v.getTotalSize() }}>
        {v.getVirtualItems().map((r) => {
          const c = visible[r.index]
          return (
            <div
              key={r.key}
              data-index={r.index}
              ref={v.measureElement}
              className="absolute inset-x-0 top-0 pb-0.5 has-[[aria-expanded=true]]:z-20"
              style={{ transform: `translateY(${r.start - v.options.scrollMargin}px)` }}
            >
              <ChapterRow
                c={c}
                index={r.index}
                mangaId={mangaId}
                selecting={selecting}
                selected={sel.selected.has(c.id)}
                queued={queue.get(c.id)}
                onToggle={onRowToggle}
                onLongPress={onLongPress}
                actions={actions}
              />
            </div>
          )
        })}
      </div>

      <BatchBar
        open={selecting}
        count={sel.selected.size}
        unit="话"
        onSelectAll={sel.selectAll}
        selectAllLabel={filter === 'all' ? '全选' : '全选当前筛选'}
        onCancel={exitSelect}
      >
        <button type="button" className="bb" disabled={!ids.length} onClick={() => actions.setRead(ids, true)}>
          <BookCheck className="size-5" strokeWidth={1.8} />
          已读
        </button>
        <button type="button" className="bb" disabled={!ids.length} onClick={() => actions.setRead(ids, false)}>
          <BookOpen className="size-5" strokeWidth={1.8} />
          未读
        </button>
        <button type="button" className="bb" disabled={!ids.length} onClick={() => actions.markPreviousRead(ids)}>
          <CheckCheck className="size-5" strokeWidth={1.8} />
          此前全部已读
        </button>
        <button type="button" className="bb" disabled={!ids.length} onClick={() => actions.setBookmarked(ids, !allBookmarked)}>
          {allBookmarked ? <BookmarkMinus className="size-5" strokeWidth={1.8} /> : <Bookmark className="size-5" strokeWidth={1.8} />}
          {allBookmarked ? '取消书签' : '书签'}
        </button>
        <button type="button" className="bb" disabled={!ids.length} onClick={() => actions.download(ids)}>
          <Download className="size-5" strokeWidth={1.8} />
          下载
        </button>
        <button type="button" className="bb" disabled={!ids.length} onClick={() => actions.deleteDownloads(ids)}>
          <Trash2 className="size-5" strokeWidth={1.8} />
          删除下载
        </button>
      </BatchBar>
    </section>
  )
}

/* ───────── 单行 ─────────
   无分隔线、无勾选圆圈：选中时章节号换成对勾 + 整行浅底色 */
const ChapterRow = memo(function ChapterRow({
  c,
  index,
  mangaId,
  selecting,
  selected,
  queued,
  onToggle,
  onLongPress,
  actions,
}: {
  c: Chapter
  index: number
  mangaId: number
  selecting: boolean
  selected: boolean
  queued: QueueItem | undefined
  onToggle: (id: number, index: number, e: MouseEvent) => void
  onLongPress: (id: number, index: number) => void
  actions: Actions
}) {
  const [menu, setMenu] = useState(false)
  const press = useLongPress(() => !selecting && onLongPress(c.id, index))
  const no = chapterNo(c.chapterNumber)
  const inProgress = !c.isRead && c.lastPageRead > 0
  const sub = inProgress
    ? `继续阅读 · 第 ${c.lastPageRead + 1}${c.pageCount > 0 ? ` / ${c.pageCount}` : ''} 页`
    : (c.scanlator ?? '')

  return (
    <div
      role="listitem"
      aria-selected={selecting ? selected : undefined}
      {...press}
      onClick={selecting ? (e) => onToggle(c.id, index, e) : undefined}
      className={cn(
        'group relative grid min-h-[62px] grid-cols-[48px_minmax(0,1fr)_72px_84px_44px] items-center gap-3 rounded-2xl px-2 py-1.5 transition-colors max-sm:grid-cols-[36px_minmax(0,1fr)_56px]',
        selecting ? 'cursor-pointer select-none' : '',
        selected ? 'bg-accent-soft' : 'hover:bg-hover focus-within:bg-hover',
      )}
    >
      <span
        className={cn(
          'flex items-center gap-1.5 justify-self-center text-[15px] font-semibold num',
          selected ? 'text-accent' : c.isRead ? 'text-faint' : 'text-text',
        )}
      >
        {selected ? (
          <Check className="size-5" strokeWidth={2.6} />
        ) : (
          <>
            {!c.isRead && <span className="size-[7px] rounded-full bg-accent" />}
            {no || '·'}
          </>
        )}
      </span>

      <span className="flex min-w-0 flex-col">
        {selecting ? (
          <span className={cn('truncate text-[15px]', c.isRead ? 'font-medium text-faint' : 'font-semibold')}>{c.name}</span>
        ) : (
          <Link
            to={`/manga/${mangaId}/chapter/${c.id}`}
            state={FROM_DETAIL}
            className={cn(
              'truncate text-[15px] no-underline after:absolute after:inset-0 after:rounded-2xl',
              c.isRead ? 'font-medium text-faint' : 'font-semibold text-text',
            )}
          >
            {c.name}
          </Link>
        )}
        {sub && <span className={cn('truncate text-xs', inProgress ? 'font-bold text-accent' : 'text-muted')}>{sub}</span>}
        {inProgress && c.pageCount > 0 && (
          <span className="mt-[7px] block h-[3px] w-40 overflow-hidden rounded-full bg-track">
            <i className="block h-full bg-accent" style={{ width: `${((c.lastPageRead + 1) / c.pageCount) * 100}%` }} />
          </span>
        )}
      </span>

      <span className="relative z-[1] flex items-center justify-end gap-1.5 text-muted">
        {c.isBookmarked && <Bookmark className="size-[18px] fill-current text-text" strokeWidth={1.8} aria-label="书签" />}
        {queued ? (
          <ProgressRing value={queued.progress} error={queued.state === 'ERROR'} />
        ) : c.isDownloaded ? (
          <CircleCheck className="size-[18px]" strokeWidth={1.8} aria-label="已下载" />
        ) : (
          !selecting && (
            <button
              type="button"
              className="gicon size-9 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
              onClick={() => actions.download([c.id])}
              aria-label={`下载 ${c.name}`}
            >
              <Download className="size-[18px]" strokeWidth={1.8} />
            </button>
          )
        )}
      </span>

      <span className="text-right text-[13px] text-muted num max-sm:hidden">{formatDate(ms(c.uploadDate))}</span>

      <span className="relative z-[1] max-sm:hidden">
        {!selecting && (
          <Popover
            open={menu}
            onClose={() => setMenu(false)}
            label={`更多操作：${c.name}`}
            className="w-[220px] p-2"
            trigger={
              <button
                type="button"
                className={cn('gicon size-10 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100', menu && 'opacity-100')}
                onClick={() => setMenu((v) => !v)}
                aria-label={`更多操作：${c.name}`}
                aria-expanded={menu}
              >
                <MoreHorizontal className="size-5" strokeWidth={1.8} />
              </button>
            }
          >
            <MenuItem icon={c.isRead ? BookOpen : BookCheck} onClick={() => (setMenu(false), actions.setRead([c.id], !c.isRead))}>
              {c.isRead ? '标为未读' : '标为已读'}
            </MenuItem>
            <MenuItem icon={c.isBookmarked ? BookmarkMinus : Bookmark} onClick={() => (setMenu(false), actions.setBookmarked([c.id], !c.isBookmarked))}>
              {c.isBookmarked ? '取消书签' : '加书签'}
            </MenuItem>
            <MenuItem icon={CheckCheck} onClick={() => (setMenu(false), actions.markPreviousRead([c.id]))}>
              此前全部已读
            </MenuItem>
            {c.isDownloaded ? (
              <MenuItem icon={Trash2} onClick={() => (setMenu(false), actions.deleteDownloads([c.id]))}>
                删除下载
              </MenuItem>
            ) : (
              <MenuItem icon={Download} onClick={() => (setMenu(false), actions.download([c.id]))} disabled={!!queued}>
                下载
              </MenuItem>
            )}
          </Popover>
        )}
      </span>
    </div>
  )
})

function MenuItem({
  icon: Icon,
  children,
  onClick,
  disabled,
}: {
  icon: typeof Download
  children: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button type="button" role="menuitem" className="opt" onClick={onClick} disabled={disabled}>
      <Icon className="size-[18px]" strokeWidth={1.8} />
      {children}
    </button>
  )
}

function ProgressRing({ value, error }: { value: number; error: boolean }) {
  const r = 7
  const len = 2 * Math.PI * r
  return (
    <svg viewBox="0 0 18 18" className={cn('size-[18px] -rotate-90', error && 'text-danger')} aria-label={error ? '下载出错' : `下载中 ${Math.round(value * 100)}%`}>
      <circle cx="9" cy="9" r={r} fill="none" stroke="var(--track)" strokeWidth="2" />
      <circle cx="9" cy="9" r={r} fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray={len} strokeDashoffset={len * (1 - value)} strokeLinecap="round" className="transition-[stroke-dashoffset] duration-500" />
    </svg>
  )
}
