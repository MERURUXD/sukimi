import { useMutation } from '@apollo/client/react'
import { useWindowVirtualizer } from '@tanstack/react-virtual'
import {
  ArrowDownUp,
  Bookmark,
  BookmarkMinus,
  BookCheck,
  BookOpen,
  CalendarClock,
  Check,
  CheckCheck,
  CircleCheck,
  Download,
  ListChecks,
  MoreHorizontal,
  Trash2,
} from 'lucide-react'
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type MouseEvent } from 'react'
import { Link } from 'react-router'
import { DeleteDownloads, EnqueueDownloads, UpdateChapters } from '@/api/chapters'
import { Glass } from '@/components/glass/Glass'
import { BatchBar } from '@/components/ui/BatchBar'
import { Popover } from '@/components/ui/Popover'
import { Seg } from '@/components/ui/Seg'
import { toast, toastError } from '@/components/ui/toast'
import { formatFullDate, ms } from '@/lib/format'
import { intervalLabel, nextChapterNumber, regularLabel, shortText } from '@/features/updates/predict'
import type { NextPrediction } from './NextUpdate'
import { cn } from '@/lib/cn'
import { useLongPress } from '@/lib/useLongPress'
import { useSelection } from '@/lib/useSelection'
import type { Chapter } from './queries'
import { FROM_DETAIL } from '@/features/reader/nav'
import { parsePageBookmarks } from '@/features/reader/pageTools'
import { Can } from '@/features/auth/Can'
import { useAuth, useCan } from '@/api/auth'
import { captureUser } from '@/api/userContext'
import { useChapterView, type ChapterFilter } from './store'
import { mangaIntro, mangaIntroDelay } from './intro'
import { t } from '@/i18n'
export interface QueueItem {
  progress: number
  state: 'QUEUED' | 'DOWNLOADING' | 'FINISHED' | 'ERROR'
}

/** 章节相关的变更操作，列表行菜单和批量栏共用 */
/** onMarkedRead：标为已读后调用，用来把进度推到追踪网站 */
export function useChapterActions(all: readonly Chapter[], onDownloadQueued: () => void, onDownloadsDeleted: () => void, onMarkedRead?: (still: () => void) => void) {
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
          toastError(t('library.actionFailed', { label }), e)
        }
      }
    const patch = (ids: number[], p: { isRead?: boolean; isBookmarked?: boolean; lastPageRead?: number }) =>
      update({ variables: { ids, patch: p } })

    return {
      setRead: async (ids: number[], isRead: boolean) => {
        const still = captureUser()
        try {
          // 标为未读时同时清掉页码，避免「继续阅读」停在最后一页
          await patch(ids, isRead ? { isRead } : { isRead, lastPageRead: 0 })
          if (isRead) onMarkedRead?.(still)
          if (ids.length > 1) toast(isRead ? t('library.bulk.markedRead', { count: ids.length, n: ids.length }) : t('manga.chapters.markedUnread', { n: ids.length }))
        } catch (e) {
          toastError(isRead ? t('manga.chapters.markReadFailed') : t('manga.chapters.markUnreadFailed'), e)
        }
      },
      setBookmarked: async (ids: number[], isBookmarked: boolean) => {
        try {
          await patch(ids, { isBookmarked })
          if (ids.length > 1) toast(isBookmarked ? t('manga.chapters.bookmarked', { n: ids.length }) : t('manga.chapters.unbookmarked', { n: ids.length }))
        } catch (e) {
          toastError(isBookmarked ? t('manga.chapters.bookmarkFailed') : t('manga.chapters.unbookmarkFailed'), e)
        }
      },
      /** 选中章节（含）之前的全部标为已读 */
      markPreviousRead: wrap(t('library.bulk.markRead'), async (ids: number[]) => {
        const max = Math.max(...all.filter((c) => ids.includes(c.id)).map((c) => c.sourceOrder))
        const targets = all.filter((c) => c.sourceOrder <= max && !c.isRead).map((c) => c.id)
        if (targets.length) {
          const still = captureUser()
          await patch(targets, { isRead: true })
          onMarkedRead?.(still)
        }
        return t('library.bulk.markedRead', { count: targets.length, n: targets.length })
      }),
      download: wrap(t('manga.chapters.download'), async (ids: number[]) => {
        const targets = all.filter((c) => ids.includes(c.id) && !c.isDownloaded).map((c) => c.id)
        if (!targets.length) return t('manga.chapters.allDownloaded')
        await enqueue({ variables: { ids: targets } })
        onDownloadQueued()
        return t('library.bulk.queued', { count: targets.length, n: targets.length })
      }),
      deleteDownloads: wrap(t('manga.chapters.deleteDownloads'), async (ids: number[]) => {
        const targets = all.filter((c) => ids.includes(c.id) && c.isDownloaded).map((c) => c.id)
        if (!targets.length) return t('manga.chapters.notDownloaded')
        await remove({ variables: { ids: targets } })
        onDownloadsDeleted()
        return t('manga.chapters.deletedDownloads', { n: targets.length })
      }),
    }
  }, [all, update, enqueue, remove, onDownloadQueued, onDownloadsDeleted, onMarkedRead])
}

type Actions = ReturnType<typeof useChapterActions>

const FILTERS: { value: ChapterFilter; label: string; test: (c: Chapter) => boolean }[] = [
  { value: 'all', label: t('manga.chapters.filterAll'), test: () => true },
  { value: 'unread', label: t('manga.chapters.filterUnread'), test: (c) => !c.isRead },
  { value: 'downloaded', label: t('manga.chapters.filterDownloaded'), test: (c) => c.isDownloaded },
  { value: 'bookmarked', label: t('manga.chapters.filterBookmarked'), test: (c) => c.isBookmarked },
]

export function ChapterList({
  mangaId,
  chapters,
  prediction = null,
  queue,
  actions,
  intro = false,
}: {
  mangaId: number
  chapters: readonly Chapter[]
  /** 预计下次更新；有的话在最新一话上面多一格预计的下一话 */
  prediction?: NextPrediction | null
  queue: ReadonlyMap<number, QueueItem>
  actions: Actions
  intro?: boolean
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

  // 虚拟列表：宽屏每个虚拟行放两话，按「左右、左右」的阅读顺序排，行高取两者较高的
  const cols = useWideScreen() ? 2 : 1
  const box = useRef<HTMLDivElement>(null)
  const [top, setTop] = useState(0)
  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const t = el.getBoundingClientRect().top + window.scrollY
    if (Math.abs(t - top) > 0.5) setTop(t)
  })
  const v = useWindowVirtualizer({
    count: Math.ceil(visible.length / cols),
    estimateSize: () => 64,
    overscan: 10,
    scrollMargin: top,
    // 默认会取创建时的 window.scrollY 并在挂载后滚回去；切页时那是上一页的位置，交给 ScrollManager 处理
    initialOffset: 0,
    getItemKey: (i) => `${cols}:${visible[i * cols].id}`,
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
        <div style={mangaIntroDelay(mangaIntro.chapterTitle)} className={cn('flex flex-auto items-baseline gap-3', intro && 'rise')}>
          <h2 id="h-ch" className="m-0 text-[28px] font-bold">
            {t('manga.chapters.title')}
          </h2>
          <span className="text-muted num">
            {t('manga.chapters.stat', { n: chapters.length, unread })}
          </span>
        </div>
        <div style={mangaIntroDelay(mangaIntro.chapterTools)} className="flex items-center gap-2.5 max-sm:w-full">
          {/* 背后还有没淡完的封面氛围光（见 MangaBackdrop），和顶部按钮一样只关透镜 */}
          <Seg suspendRefract
            label={t('manga.chapters.filterLabel')}
            items={FILTERS.map((f) => ({ value: f.value, label: f.label, count: f.value === 'all' ? undefined : counts[f.value] }))}
            value={filter}
            onChange={setFilter}
            className={cn('max-sm:min-w-0 max-sm:flex-1', intro && 'rise')}
          />
          <Glass suspendRefract as="button" type="button" style={mangaIntroDelay(mangaIntro.chapterTools)} className={cn('gicon size-10 rounded-full', intro && 'rise')} onClick={toggleOrder} aria-label={desc ? t('manga.chapters.toOldestFirst') : t('manga.chapters.toNewestFirst')} title={desc ? t('manga.chapters.newestFirst') : t('manga.chapters.oldestFirst')}>
            <ArrowDownUp className="size-[18px]" strokeWidth={1.8} />
          </Glass>
          <Glass suspendRefract as="button"
              type="button"
              style={mangaIntroDelay(mangaIntro.chapterTools)}
              className={cn('rounded-full', 'gicon size-10', selecting && 'bg-g-hi', intro && 'rise')}
              onClick={() => (selecting ? exitSelect() : setSelecting(true))}
              aria-pressed={selecting}
              aria-label={t('manga.chapters.select')}
              title={t('manga.chapters.select')}
            >
            <ListChecks className="size-[18px]" strokeWidth={1.8} />
          </Glass>
        </div>
      </div>

      {visible.length === 0 && <p style={mangaIntroDelay(mangaIntro.chapterRow)} className={cn('py-16 text-center text-muted', intro && 'rise')}>{chapters.length ? t('manga.chapters.emptyFiltered') : t('manga.chapters.empty')}</p>}

      {/* 只在「最新在上」且看全部时出现，排在列表外面，不参与虚拟列表、多选和筛选计数；筛选后预测不属于筛选结果 */}
      {prediction && desc && filter === 'all' && !selecting && (
        <div className={cn(cols > 1 && 'grid grid-cols-2 gap-x-6')}>
          <PredictedRow p={prediction} chapters={chapters} fill={cols > 1} introDelay={intro ? mangaIntro.chapterRow : undefined} />
        </div>
      )}

      <div ref={box} role="list" aria-label={t('manga.chapters.listAria')} className="relative" style={{ height: v.getTotalSize() }}>
        {v.getVirtualItems().map((r, i) => {
          const row = visible.slice(r.index * cols, r.index * cols + cols)
          return (
            <div
              key={r.key}
              data-index={r.index}
              ref={v.measureElement}
              className={cn('absolute inset-x-0 top-0 pb-0.5 has-[[aria-expanded=true]]:z-20', cols > 1 && 'grid grid-cols-2 gap-x-6')}
              style={{ transform: `translateY(${r.start - v.options.scrollMargin}px)` }}
            >
              {row.map((c, j) => (
                <ChapterRow
                  key={c.id}
                  c={c}
                  index={r.index * cols + j}
                  mangaId={mangaId}
                  fill={cols > 1}
                  selecting={selecting}
                  selected={sel.selected.has(c.id)}
                  queued={queue.get(c.id)}
                  onToggle={onRowToggle}
                  onLongPress={onLongPress}
                  actions={actions}
                  introDelay={intro ? mangaIntro.chapterRow + Math.min(i, 5) * 35 : undefined}
                />
              ))}
            </div>
          )
        })}
      </div>

      <BatchBar
        open={selecting}
        count={sel.selected.size}
        unit={t('manga.chapters.unit')}
        onSelectAll={sel.selectAll}
        selectAllLabel={filter === 'all' ? t('common.selectAll') : t('manga.chapters.selectAllFiltered')}
        onCancel={exitSelect}
      >
        <button type="button" className="bb" disabled={!ids.length} onClick={() => actions.setRead(ids, true)}>
          <BookCheck className="size-5" strokeWidth={1.8} />
          {t('manga.chapters.markRead')}
        </button>
        <button type="button" className="bb" disabled={!ids.length} onClick={() => actions.setRead(ids, false)}>
          <BookOpen className="size-5" strokeWidth={1.8} />
          {t('manga.chapters.markUnread')}
        </button>
        <button type="button" className="bb" disabled={!ids.length} onClick={() => actions.markPreviousRead(ids)}>
          <CheckCheck className="size-5" strokeWidth={1.8} />
          {t('manga.chapters.markPreviousRead')}
        </button>
        <button type="button" className="bb" disabled={!ids.length} onClick={() => actions.setBookmarked(ids, !allBookmarked)}>
          {allBookmarked ? <BookmarkMinus className="size-5" strokeWidth={1.8} /> : <Bookmark className="size-5" strokeWidth={1.8} />}
          {allBookmarked ? t('manga.chapters.removeBookmark') : t('manga.chapters.addBookmark')}
        </button>
        <Can permission="DOWNLOAD_CHAPTERS">
          <button type="button" className="bb" disabled={!ids.length} onClick={() => actions.download(ids)}>
            <Download className="size-5" strokeWidth={1.8} />
            {t('manga.chapters.download')}
          </button>
        </Can>
        <button type="button" className="bb" disabled={!ids.length} onClick={() => actions.deleteDownloads(ids)}>
          <Trash2 className="size-5" strokeWidth={1.8} />
          {t('manga.chapters.deleteDownloads')}
        </button>
      </BatchBar>
    </section>
  )
}

/** 预计的下一话：和章节行同样的排版，半透明、不能点；话数按现有最大话数加一，凑不出整数时只写「下一话」 */
function PredictedRow({ p, chapters, fill, introDelay }: { p: NextPrediction; chapters: readonly Chapter[]; fill: boolean; introDelay?: number }) {
  const next = nextChapterNumber(chapters)
  const name = next === null ? t('manga.next.nextChapter') : t('format.chapterNo', { n: next })
  const when = p.late > 0 ? t('manga.next.late', { n: p.late }) : t('manga.next.around', { date: formatFullDate(p.next) })
  return (
    <div
      style={introDelay === undefined ? undefined : mangaIntroDelay(introDelay)}
      className={cn(
        'grid min-h-[62px] items-center gap-3 rounded-2xl px-3 py-1.5 text-faint max-sm:grid-cols-[16px_minmax(0,1fr)_auto]',
        fill ? 'grid-cols-[20px_minmax(0,1fr)_104px_72px_44px]' : 'grid-cols-[20px_minmax(0,20rem)_104px_72px_44px]',
        introDelay !== undefined && 'rise',
      )}
      aria-label={t('manga.next.aria', { text: shortText(p) })}
    >
      <span className="flex items-center justify-center" aria-hidden>
        <CalendarClock className="size-4" strokeWidth={1.8} />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-[15px] font-medium">{name}</span>
        <span className="truncate text-[13px]">{t('manga.next.expect', { interval: intervalLabel(p.interval), regular: regularLabel(p) })}</span>
      </span>
      <span className="text-[13px] num max-sm:hidden">{when}</span>
      <span className="text-[13px] num sm:hidden">{when}</span>
    </div>
  )
}

/* ───────── 单行 ─────────
   无分隔线、无勾选圆圈：最左一格未读时是小圆点，选中时换成对勾，并给整行浅底色。
   章节名里通常已含「第 N 话」，不再单独显示章节号。内容靠左收紧，名称与日期不隔着大片空白 */
const ChapterRow = memo(function ChapterRow({
  c,
  index,
  mangaId,
  fill,
  selecting,
  selected,
  queued,
  onToggle,
  onLongPress,
  actions,
  introDelay,
}: {
  c: Chapter
  index: number
  mangaId: number
  /** 宽屏两列时名称列占满剩余宽度，日期与按钮靠右 */
  fill: boolean
  selecting: boolean
  selected: boolean
  queued: QueueItem | undefined
  onToggle: (id: number, index: number, e: MouseEvent) => void
  onLongPress: (id: number, index: number) => void
  actions: Actions
  introDelay?: number
}) {
  const [menu, setMenu] = useState(false)
  const canDownload = useCan('DOWNLOAD_CHAPTERS')
  const press = useLongPress(() => !selecting && onLongPress(c.id, index))
  const inProgress = !c.isRead && c.lastPageRead > 0
  const userId = useAuth((s) => s.user?.id)
  const marks = parsePageBookmarks(c.meta, userId)
  const sub = inProgress
    ? t('manga.row.continue', { page: c.lastPageRead + 1, of: c.pageCount > 0 ? ` / ${c.pageCount}` : '' })
    : (c.scanlator ?? '')

  return (
    <div
      role="listitem"
      aria-selected={selecting ? selected : undefined}
      data-reader-origin
      style={introDelay === undefined ? undefined : mangaIntroDelay(introDelay)}
      {...press}
      onClick={selecting ? (e) => onToggle(c.id, index, e) : undefined}
      className={cn(
        'group relative grid min-h-[62px] items-center gap-3 rounded-2xl px-3 py-1.5 transition-colors max-sm:grid-cols-[16px_minmax(0,1fr)_auto]',
        fill ? 'grid-cols-[20px_minmax(0,1fr)_104px_72px_44px]' : 'grid-cols-[20px_minmax(0,20rem)_104px_72px_44px]',
        selecting ? 'cursor-pointer select-none' : '',
        selected ? 'bg-accent-soft' : 'hover:bg-hover focus-within:bg-hover',
        introDelay !== undefined && 'rise',
      )}
    >
      <span className="flex items-center justify-center text-accent" aria-label={c.isRead ? undefined : t('manga.row.unread')}>
        {selected ? <Check className="size-5" strokeWidth={2.6} /> : !c.isRead && <span className="size-2 rounded-full bg-accent" />}
      </span>

      <span className="flex min-w-0 flex-col">
        {selecting ? (
          <span className={cn('truncate text-[15px]', c.isRead ? 'font-medium text-faint' : 'font-semibold')}>{c.name}</span>
        ) : (
          <Link
            to={`/manga/${mangaId}/chapter/${c.id}`}
            state={FROM_DETAIL}
            viewTransition
            className={cn(
              'truncate text-[15px] no-underline after:absolute after:inset-0 after:rounded-2xl',
              c.isRead ? 'font-medium text-faint' : 'font-semibold text-text',
            )}
          >
            {c.name}
          </Link>
        )}
        {sub && <span className={cn('truncate text-[13px]', inProgress ? 'font-bold text-accent' : 'text-muted')}>{sub}</span>}
        {inProgress && c.pageCount > 0 && (
          <span className="mt-[7px] block h-[3px] w-40 overflow-hidden rounded-full bg-track">
            <i className="block h-full bg-accent" style={{ width: `${((c.lastPageRead + 1) / c.pageCount) * 100}%` }} />
          </span>
        )}
        {/* 页面书签：点页码直接打开到那一页；叠在整行链接上面才能点到 */}
        {marks.length > 0 && !selecting && (
          <span className="relative z-[1] mt-1 flex min-w-0 items-center gap-x-2 text-[13px] text-muted" aria-label={t('manga.row.pageBookmarks')}>
            <Bookmark className="size-3 flex-none" strokeWidth={2} aria-hidden />
            {marks.slice(0, 4).map((p) => (
              <Link key={p} to={`/manga/${mangaId}/chapter/${c.id}?page=${p + 1}`} state={FROM_DETAIL} viewTransition className="text-muted no-underline num hover:text-text">
                {t('manga.row.pageN', { n: p + 1 })}
              </Link>
            ))}
            {marks.length > 4 && <span className="whitespace-nowrap">{t('manga.row.morePages', { n: marks.length })}</span>}
          </span>
        )}
      </span>

      <span className="text-[13px] text-muted num max-sm:hidden">{formatFullDate(ms(c.uploadDate))}</span>

      <span className="relative z-[1] flex items-center justify-end gap-1.5 text-muted">
        {c.isBookmarked && <Bookmark className="size-[18px] fill-current text-text" strokeWidth={1.8} aria-label={t('manga.row.bookmark')} />}
        {queued ? (
          <ProgressRing value={queued.progress} error={queued.state === 'ERROR'} />
        ) : c.isDownloaded ? (
          <CircleCheck className="size-[18px]" strokeWidth={1.8} aria-label={t('manga.row.downloaded')} />
        ) : (
          !selecting && canDownload && (
            <button
              type="button"
              className="gicon size-9 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
              onClick={() => actions.download([c.id])}
              aria-label={t('manga.row.downloadAria', { name: c.name })}
            >
              <Download className="size-[18px]" strokeWidth={1.8} />
            </button>
          )
        )}
      </span>

      <span className="relative z-[1] max-sm:hidden">
        {!selecting && (
          <Popover
            open={menu}
            onClose={() => setMenu(false)}
            label={t('manga.row.moreActions', { name: c.name })}
            className="w-[220px] p-2"
            trigger={
              <button
                type="button"
                className={cn('gicon size-10 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100', menu && 'opacity-100')}
                onClick={() => setMenu((v) => !v)}
                aria-label={t('manga.row.moreActions', { name: c.name })}
                aria-expanded={menu}
              >
                <MoreHorizontal className="size-5" strokeWidth={1.8} />
              </button>
            }
          >
            <MenuItem icon={c.isRead ? BookOpen : BookCheck} onClick={() => (setMenu(false), actions.setRead([c.id], !c.isRead))}>
              {c.isRead ? t('manga.chapters.markAsUnread') : t('manga.chapters.markAsRead')}
            </MenuItem>
            <MenuItem icon={c.isBookmarked ? BookmarkMinus : Bookmark} onClick={() => (setMenu(false), actions.setBookmarked([c.id], !c.isBookmarked))}>
              {c.isBookmarked ? t('manga.chapters.removeBookmark') : t('manga.chapters.addBookmark')}
            </MenuItem>
            <MenuItem icon={CheckCheck} onClick={() => (setMenu(false), actions.markPreviousRead([c.id]))}>
              {t('manga.chapters.markPreviousRead')}
            </MenuItem>
            {c.isDownloaded ? (
              <MenuItem icon={Trash2} onClick={() => (setMenu(false), actions.deleteDownloads([c.id]))}>
                {t('manga.chapters.deleteDownloads')}
              </MenuItem>
            ) : (
              canDownload && (
                <MenuItem icon={Download} onClick={() => (setMenu(false), actions.download([c.id]))} disabled={!!queued}>
                  {t('manga.chapters.download')}
                </MenuItem>
              )
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
    <svg viewBox="0 0 18 18" className={cn('size-[18px] -rotate-90', error && 'text-danger')} aria-label={error ? t('manga.row.downloadError') : t('manga.row.downloading', { pct: Math.round(value * 100) })}>
      <circle cx="9" cy="9" r={r} fill="none" stroke="var(--track)" strokeWidth="2" />
      <circle cx="9" cy="9" r={r} fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray={len} strokeDashoffset={len * (1 - value)} strokeLinecap="round" className="transition-[stroke-dashoffset] duration-500" />
    </svg>
  )
}

// 两列的章节行各约 600px，正好放下名称、日期与按钮；再窄就回到单列
const WIDE = '(min-width: 1280px)'
function useWideScreen() {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(WIDE)
      m.addEventListener('change', cb)
      return () => m.removeEventListener('change', cb)
    },
    () => window.matchMedia(WIDE).matches,
  )
}
