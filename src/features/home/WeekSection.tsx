import { AnimatePresence, motion, useReducedMotion, type Variants } from 'motion/react'
import { ChevronRight, X } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { create } from 'zustand'
import { resetOnUserContext } from '@/api/userContext'
import { MotionGlass } from '@/components/glass/Glass'
import { CoverImg } from '@/components/manga/CoverImg'
import { fade, spring } from '@/design/motion'
import { useLibraryView } from '@/features/library/store'
import { useFavorites } from '@/features/favorite/useFavorites'
import { useMedia } from '@/features/gallery/hooks'
import { usePrefetchManga } from '@/features/manga/prefetch'
import { cn } from '@/lib/cn'
import { sfwAttr } from '@/lib/devSafe'
import { chapterLabel, clock, sec, timeAgo } from '@/lib/format'
import type { ReadChapter, UpdateChapter } from './queries'
import { byDay, weekDays, type DayGroup } from './week'

/**
 * 展开的格子与布局版本。rev 在托盘出现、换格子和收起落定时各加一次，
 * 首页各模块和这一周里的各行拿它当 layoutDependency：只在托盘改变高度的那一帧排一次版，
 * 再用位移动画补过渡，不逐帧改高度（橱窗的封面墙很重）。放在模块里，从详情页返回时托盘还开着。
 */
export const useWeekTray = create<{ open: string | null; rev: number }>()(() => ({ open: null, rev: 0 }))
const setOpen = (open: string | null) => useWeekTray.setState((s) => ({ open, rev: open ? s.rev + 1 : s.rev }))
const settle = () => useWeekTray.setState((s) => ({ rev: s.rev + 1 }))
resetOnUserContext(() => useWeekTray.setState({ open: null }))

type LaneId = 'favorite' | 'updates' | 'recent'
type Manga = { id: number; title: string; thumbnailUrl?: string | null; source?: { displayName: string } | null }

interface Entry {
  manga: Manga
  sub: string
  /** 同一天更新了几话；多于一话时角标显示 */
  badge?: string
  /** 读到的进度（%），只有最近阅读有 */
  pct?: number
}

interface Lane {
  id: LaneId
  name: string
  total: string
  days: Entry[][]
  /** 每天的新章节话数（最近阅读为 0） */
  chapters: number[]
  /** 这一周出现过几部 */
  mangas: number
}

const LANE_LINK: Record<LaneId, string> = { favorite: '全部特别关心', updates: '全部更新', recent: '全部历史' }

const progressOf = (c: ReadChapter) =>
  c.isRead ? 100 : c.pageCount > 0 ? Math.round(((c.lastPageRead + 1) / c.pageCount) * 100) : 0

/** 今天的写「几小时前」，更早的写当天几点 */
const when = (t: number, day: number) => (day === 0 ? timeAgo(t) : clock(t))

function updateLane(id: LaneId, name: string, days: DayGroup<UpdateChapter>[][]): Lane {
  const chapters = days.map((d) => d.reduce((n, g) => n + g.items.length, 0))
  return {
    id, name, chapters, mangas: new Set(days.flat().map((g) => g.mangaId)).size,
    total: `本周 ${chapters.reduce((a, b) => a + b, 0)} 话`,
    days: days.map((groups, day) => groups.map(({ items }) => {
      const c = items[0]
      const t = when(sec(c.fetchedAt), day)
      return { manga: c.manga, sub: items.length > 1 ? `${items.length} 话 · ${t}` : `${chapterLabel(c)} · ${t}`, badge: items.length > 1 ? `+${items.length}` : undefined }
    })),
  }
}

function readLane(days: DayGroup<ReadChapter>[][]): Lane {
  const mangas = new Set(days.flat().map((g) => g.mangaId)).size
  return {
    id: 'recent', name: '最近阅读', chapters: days.map(() => 0), mangas,
    total: `本周 ${mangas} 部`,
    days: days.map((groups, day) => groups.map(({ items }) => {
      const c = items[0]
      return { manga: c.manga, sub: `${chapterLabel(c)} · ${when(sec(c.lastReadAt), day)}`, pct: progressOf(c) }
    })),
  }
}

/**
 * 「这一周」：特别关心的更新、其他更新、读过的漫画 × 最近 7 天。
 * 宽屏是 7 列的格子，点叠起的封面在这一行下面展开托盘；窄屏按日期切换，每类一条横向书架。
 */
export function WeekSection({ updates, partial, reads }: { updates: UpdateChapter[] | undefined; partial: boolean; reads: ReadChapter[] | undefined }) {
  const favorites = useFavorites().map
  const wide = useMedia('(min-width: 1024px)')
  const week = useMemo(() => {
    if (!updates && !reads) return null
    const now = Date.now()
    const ups = updates ?? []
    const fav = (c: UpdateChapter) => !!favorites?.has(c.mangaId)
    const lanes = [
      updateLane('favorite', '特别关心', byDay(ups.filter(fav), (c) => sec(c.fetchedAt), (c) => c.mangaId, now)),
      updateLane('updates', '最近更新', byDay(ups.filter((c) => !fav(c)), (c) => sec(c.fetchedAt), (c) => c.mangaId, now)),
      readLane(byDay(reads ?? [], (c) => sec(c.lastReadAt), (c) => c.manga.id, now)),
    ].filter((l) => l.days.some((d) => d.length))
    return { days: weekDays(now), lanes }
  }, [updates, reads, favorites])

  if (!week?.lanes.length) return null
  const chapters = week.lanes.reduce((n, l) => n + l.chapters.reduce((a, b) => a + b, 0), 0)
  const read = week.lanes.find((l) => l.id === 'recent')
  const summary = [chapters && `本周 ${chapters} 话新章节`, read && `读了 ${read.mangas} 部`, partial && '更早几天只显示了一部分'].filter(Boolean).join(' · ')

  return (
    <section aria-labelledby="h-week" className="pt-11">
      <div className="mb-[18px]">
        <h2 id="h-week" className="m-0 text-[26px] font-bold">这一周</h2>
        <span className="text-sm text-muted">{summary}</span>
      </div>
      {wide ? <WeekGrid days={week.days} lanes={week.lanes} /> : <WeekTabs days={week.days} lanes={week.lanes} />}
    </section>
  )
}

/* ───────── 宽屏：7 列格子 + 同源展开 ───────── */

const GRID = 'grid grid-cols-[112px_repeat(7,minmax(0,1fr))] gap-x-1.5'
/** 叠放最多露出几张 */
const STACK = 3
const cellId = (lane: LaneId, day: number) => `${lane}-${day}`
const coverId = (cell: string, manga: number) => `week:${cell}:${manga}`

function WeekGrid({ days, lanes }: { days: { name: string; date: string }[]; lanes: Lane[] }) {
  const open = useWeekTray((s) => s.open)
  const rev = useWeekTray((s) => s.rev)
  // 数据刷新后展开的那格可能空了，或整行都没了：当作收起
  const shown = lanes.some((l) => l.days.some((d, i) => d.length && cellId(l.id, i) === open)) ? open : null

  // Esc 收起，焦点回到那一格
  useEffect(() => {
    if (!shown) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      close(shown)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [shown])

  return (
    <div>
      <div className={cn(GRID, 'mb-1.5')}>
        <div />
        {days.map((d, i) => (
          <div key={d.date} className="flex items-baseline gap-1.5 px-2.5 pb-2.5">
            <span className={cn('text-sm', i === 0 ? 'font-extrabold' : 'font-medium')}>{d.name}</span>
            <span className="text-xs text-muted num">{d.date}</span>
          </div>
        ))}
      </div>
      {lanes.map((lane) => {
        const day = lane.days.findIndex((_, i) => cellId(lane.id, i) === shown)
        return (
          <motion.div key={lane.id} layout="position" layoutDependency={rev} transition={spring.fast} className="mb-1.5">
            <div className={GRID}>
              <div className="flex flex-col justify-center gap-1 pr-2">
                <span className="text-[15px] font-extrabold">{lane.name}</span>
                <span className="text-xs text-muted">{lane.total}</span>
              </div>
              {lane.days.map((entries, i) => (
                <div key={i} className={cn('min-h-[140px] rounded-[14px]', i === 0 && 'bg-hover/60')}>
                  {entries.length > 0 && (
                    <Stack id={cellId(lane.id, i)} entries={entries} open={i === day} label={`${days[i].name} · ${lane.name} · ${entries.length} 部`}
                      sub={lane.id === 'recent' ? `读了 ${entries.length} 部` : `${lane.chapters[i]} 话新章节`} />
                  )}
                </div>
              ))}
            </div>
            <AnimatePresence initial={false} mode="wait" onExitComplete={settle}>
              {day >= 0 && <Tray key={day} lane={lane} day={day} dayName={days[day].name} />}
            </AnimatePresence>
          </motion.div>
        )
      })}
    </div>
  )
}

function close(id: string) {
  setOpen(null)
  document.querySelector<HTMLElement>(`[data-week-cell="${id}"]`)?.focus({ preventScroll: true })
}

/** 叠起的封面：悬停时稍微散开，提示可以点开 */
const stackCover: Variants = {
  rest: (back: number) => ({ x: back * 14, y: back * 3, rotate: back * 3 }),
  spread: (back: number) => ({ x: back * 24, y: back * 3, rotate: back * 7 }),
}

function Stack({ id, entries, open, label, sub }: { id: string; entries: Entry[]; open: boolean; label: string; sub: string }) {
  const top = entries.slice(0, STACK)
  const first = entries[0].manga.title
  return (
    <motion.button
      type="button"
      data-week-cell={id}
      aria-expanded={open}
      aria-controls={open ? `tray-${id}` : undefined}
      aria-label={`${label}，${open ? '收起' : '点开查看'}`}
      onClick={() => (open ? close(id) : setOpen(id))}
      initial="rest"
      animate="rest"
      whileHover="spread"
      whileFocus="spread"
      // 展开时叠放的封面已经飞进托盘，原位不留：不靠 motion 的交叉淡入隐藏跟随者，同时换开另一行时它不一定生效
      className={cn('flex size-full min-h-[140px] flex-col gap-2 rounded-[14px] px-2.5 pt-3.5 pb-2.5 text-left text-text transition-colors hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text', open && 'bg-hover [&_.cv]:invisible')}
    >
      <span aria-hidden className="relative block h-[78px] w-full">
        {top.map((e, i) => {
          const back = top.length - 1 - i
          // 偏移和倾角放在外层：里层带 layoutId 的封面量到的是含偏移的位置，飞出、飞回都对得上
          return (
            <motion.span key={e.manga.id} custom={back} variants={stackCover} transition={spring.fast} data-sfw={sfwAttr(e.manga.source?.displayName)} className="absolute top-0 left-0 block w-12" style={{ zIndex: STACK - back }}>
              <motion.span layoutId={coverId(id, e.manga.id)} layoutCrossfade={false} transition={spring.default} className="cv rounded-[7px] shadow-[0_6px_14px_rgba(0,0,0,.18)]">
                <CoverImg src={e.manga.thumbnailUrl} loading="lazy" />
              </motion.span>
            </motion.span>
          )
        })}
        {entries.length > STACK && (
          <span className="absolute -top-2 z-10 rounded-full bg-text px-2 py-0.5 text-[11px] font-extrabold text-bg num" style={{ left: (STACK - 1) * 14 + 40 }}>
            +{entries.length - STACK}
          </span>
        )}
      </span>
      <span className="flex w-full min-w-0 flex-col">
        <span className="truncate text-[13px] font-bold">{entries.length === 1 ? first : `${first} 等 ${entries.length} 部`}</span>
        <span className="mt-0.5 truncate text-xs text-muted">{sub}</span>
      </span>
    </motion.button>
  )
}

const headerFade = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { ...fade.default, delay: 0.1 } },
  exit: { opacity: 0, transition: fade.fast },
}

function Tray({ lane, day, dayName }: { lane: Lane; day: number; dayName: string }) {
  const id = cellId(lane.id, day)
  const entries = lane.days[day]
  const reduced = useReducedMotion()
  const navigate = useNavigate()
  const setCategory = useLibraryView((s) => s.setCategory)
  const go = () => {
    if (lane.id === 'favorite') {
      setCategory('favorite')
      navigate('/library')
    } else navigate(lane.id === 'updates' ? '/updates' : '/history')
  }
  const n = entries.length
  return (
    <motion.div id={`tray-${id}`} role="region" aria-label={`${dayName} · ${lane.name}`} className="relative mt-2.5 mb-5 ml-[118px] px-[22px] pt-5 pb-6">
      {/* 只动玻璃自身的透明度，不缩放：玻璃的父元素带透明度或缩放会让背景采样失效，也更省 */}
      <MotionGlass
        aria-hidden
        dense
        suspendRefract
        className="absolute inset-0 rounded-3xl"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: fade.default }}
        exit={{ opacity: 0, transition: { ...fade.default, delay: reduced ? 0 : 0.12 } }}
      />
      {/* 标题行不整体淡入：两个按钮是玻璃，透明度只能加在它们自己身上（托盘不在表单里，按钮不必写 type） */}
      <div className="relative mb-[18px] flex items-center gap-2.5">
        <motion.div className="min-w-0 flex-1" {...headerFade}>
          <div className="text-[17px] font-extrabold">{dayName} · {lane.name}</div>
          <div className="mt-1 text-[13px] text-muted">{lane.id === 'recent' ? `读了 ${n} 部` : `${n} 部 · ${lane.chapters[day]} 话新章节`}</div>
        </motion.div>
        <MotionGlass as="button" className="gbtn flex-none rounded-full" onClick={go} {...headerFade}>
          {LANE_LINK[lane.id]}
          <ChevronRight className="size-[18px]" strokeWidth={1.8} />
        </MotionGlass>
        <MotionGlass as="button" className="gicon size-10 flex-none rounded-full" onClick={() => close(id)} aria-label="收起" {...headerFade}>
          <X className="size-4" strokeWidth={2} />
        </MotionGlass>
      </div>
      <div className="relative grid grid-cols-[repeat(auto-fill,minmax(116px,1fr))] gap-x-3.5 gap-y-5">
        {entries.map((e, i) => (
          <TrayItem key={e.manga.id} entry={e} layoutId={i < STACK ? coverId(id, e.manga.id) : undefined} index={i} back={i < STACK ? Math.min(n, STACK) - 1 - i : 0} />
        ))}
      </div>
    </motion.div>
  )
}

/** 叠放里的几张从原位飞出（共享元素，位置实测）；其余的随后淡入，收起时先淡出 */
function TrayItem({ entry, layoutId, index, back }: { entry: Entry; layoutId?: string; index: number; back: number }) {
  const { manga } = entry
  const prefetch = usePrefetchManga(manga.id)
  const late = { delay: Math.min(index, 12) * 0.025 }
  return (
    <Link to={`/manga/${manga.id}`} viewTransition {...prefetch} data-sfw={sfwAttr(manga.source?.displayName)} className="group flex min-w-0 flex-col gap-2 text-text no-underline">
      <motion.span
        layoutId={layoutId}
        layoutCrossfade={false}
        className="cv rounded-[10px] shadow-[0_10px_22px_rgba(0,0,0,.16)]"
        initial={layoutId ? { rotate: back * 3 } : { opacity: 0, scale: 0.92 }}
        animate={{ rotate: 0, opacity: 1, scale: 1, transition: layoutId ? spring.default : { ...spring.fast, ...late } }}
        exit={layoutId ? undefined : { opacity: 0, scale: 0.92, transition: fade.fast }}
        transition={spring.default}
      >
        <CoverImg src={manga.thumbnailUrl} loading="lazy" />
        {entry.badge && <Badge>{entry.badge}</Badge>}
        {entry.pct !== undefined && (
          <span className="absolute inset-x-0 bottom-0 z-[2] h-1 bg-black/30"><i className="block h-full bg-white" style={{ width: `${entry.pct}%` }} /></span>
        )}
      </motion.span>
      <motion.span className="flex min-w-0 flex-col" initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { ...fade.default, delay: 0.15 } }} exit={{ opacity: 0, transition: fade.fast }}>
        <span className="truncate text-sm font-semibold">{manga.title}</span>
        <span className="mt-0.5 truncate text-xs text-muted">{entry.sub}</span>
      </motion.span>
    </Link>
  )
}

function Badge({ children }: { children: ReactNode }) {
  return <span className="absolute top-[7px] left-[7px] z-[2] rounded-full bg-text px-2 py-0.5 text-[11px] font-extrabold text-bg num">{children}</span>
}

/* ───────── 窄屏：按日期切换 ───────── */

function WeekTabs({ days, lanes }: { days: { name: string; date: string }[]; lanes: Lane[] }) {
  const [sel, setSel] = useState(0)
  const counts = days.map((_, i) => lanes.filter((l) => l.id !== 'recent').reduce((n, l) => n + l.days[i].length, 0))
  const shown = lanes.filter((l) => l.days[sel].length)
  return (
    <div>
      <div role="tablist" aria-label="选择日期" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1.5 [scrollbar-width:none]">
        {days.map((d, i) => (
          <button
            key={d.date}
            type="button"
            role="tab"
            aria-selected={i === sel}
            onClick={() => setSel(i)}
            className={cn('flex h-16 w-[62px] flex-none flex-col items-center justify-center gap-1 rounded-[18px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text', i === sel ? 'bg-text text-bg' : 'bg-hover text-text')}
          >
            <span className="text-[13px] font-bold">{d.name}</span>
            <span className="text-[11px] opacity-75 num">{counts[i] ? `${counts[i]} 部更新` : '—'}</span>
          </button>
        ))}
      </div>
      <div role="tabpanel" aria-label={days[sel].name} className="mt-5 flex flex-col gap-6">
        {shown.length === 0 && <p className="m-0 py-10 text-center text-sm text-muted">这一天没有更新，也没有阅读记录</p>}
        {shown.map((lane) => (
          <div key={lane.id}>
            <div className="mb-3 flex items-baseline justify-between">
              <h3 className="m-0 text-[17px] font-extrabold">{lane.name}</h3>
              <span className="text-[13px] text-muted">{lane.id === 'recent' ? `读了 ${lane.days[sel].length} 部` : `${lane.chapters[sel]} 话新章节`}</span>
            </div>
            <div className="-mx-1 grid snap-x auto-cols-[96px] grid-flow-col gap-3 overflow-x-auto px-1 pb-2 [scrollbar-width:none] sm:auto-cols-[120px]">
              {lane.days[sel].map((e) => <RailItem key={e.manga.id} entry={e} />)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function RailItem({ entry }: { entry: Entry }) {
  const { manga } = entry
  const prefetch = usePrefetchManga(manga.id)
  return (
    <Link to={`/manga/${manga.id}`} viewTransition {...prefetch} data-sfw={sfwAttr(manga.source?.displayName)} className="flex min-w-0 snap-start flex-col gap-1.5 text-text no-underline">
      <span className="cv rounded-[10px]">
        <CoverImg src={manga.thumbnailUrl} loading="lazy" />
        {entry.badge && <Badge>{entry.badge}</Badge>}
        {entry.pct !== undefined && (
          <span className="absolute inset-x-0 bottom-0 z-[2] h-[3px] bg-black/25"><i className="block h-full bg-white" style={{ width: `${entry.pct}%` }} /></span>
        )}
      </span>
      <span className="truncate text-[13px] font-semibold">{manga.title}</span>
      <span className="-mt-1 truncate text-[11px] text-muted">{entry.sub}</span>
    </Link>
  )
}
