/*
 * 更新日历的排布：把近半年的章节按漫画分组、逐部推算，再排进某一周的七天。
 * 纯函数，scripts/verify-update-predict.test.mjs 直接导入。
 */
import { addDays, occurrences, predict, startOfDay, type Prediction } from './predict.ts'

type Next = Extract<Prediction, { kind: 'next' }>

export interface CalendarInput<M> {
  mangaId: number
  /** 毫秒 */
  uploadDate: number
  /** 毫秒 */
  fetchedAt: number
  manga: M & { status: string; updateStrategy?: string }
}

export interface Series<M> {
  manga: M
  mangaId: number
  prediction: Prediction
}

export type DayEntry<M> =
  | { kind: 'done'; mangaId: number; manga: M; count: number }
  | { kind: 'pred'; mangaId: number; manga: M; prediction: Next }

export interface CalendarDay<M> {
  day: number
  entries: DayEntry<M>[]
}

/** 每部漫画一份推算 */
export function seriesOf<M>(chapters: readonly CalendarInput<M>[], now: number): Series<M>[] {
  const groups = new Map<number, CalendarInput<M>[]>()
  for (const c of chapters) {
    const g = groups.get(c.mangaId)
    if (g) g.push(c)
    else groups.set(c.mangaId, [c])
  }
  return [...groups.values()].map((g) => ({
    mangaId: g[0].mangaId,
    manga: g[0].manga,
    prediction: predict(g, { status: g[0].manga.status, updateStrategy: g[0].manga.updateStrategy, now }),
  }))
}

/** 周一零点 */
export function weekStart(t: number) {
  const d = startOfDay(t)
  return addDays(d, -((new Date(d).getDay() + 6) % 7))
}

/** 能排进日历的推算：规律的、没晚的；不太规律的放到「不预测」里，晚了的单独列 */
export const onCalendar = (p: Prediction): p is Next => p.kind === 'next' && p.regular !== 'low' && p.late === 0

/**
 * 某一周的七天。过去和今天放实际抓到的更新（按抓取时间，和「最近」列表一致），
 * 今天及以后放推算；同一天已经抓到的不再重复显示预计。
 */
export function buildWeek<M>(chapters: readonly CalendarInput<M>[], series: readonly Series<M>[], start: number, now: number): CalendarDay<M>[] {
  const today = startOfDay(now)
  const days: CalendarDay<M>[] = Array.from({ length: 7 }, (_, i) => ({ day: addDays(start, i), entries: [] }))
  const end = addDays(start, 7)
  const index = new Map(days.map((d, i) => [d.day, i]))

  const done = new Map<string, Extract<DayEntry<M>, { kind: 'done' }>>()
  for (const c of chapters) {
    const day = startOfDay(c.fetchedAt)
    const i = index.get(day)
    if (i === undefined) continue
    const key = `${day}#${c.mangaId}`
    const hit = done.get(key)
    if (hit) hit.count++
    else {
      const e = { kind: 'done' as const, mangaId: c.mangaId, manga: c.manga, count: 1 }
      done.set(key, e)
      days[i].entries.push(e)
    }
  }

  for (const s of series) {
    if (!onCalendar(s.prediction)) continue
    for (const day of occurrences(s.prediction, Math.max(start, today), end)) {
      if (done.has(`${day}#${s.mangaId}`)) continue
      days[index.get(day)!].entries.push({ kind: 'pred', mangaId: s.mangaId, manga: s.manga, prediction: s.prediction })
    }
  }
  // 实际更新在前，预计的按时间先后
  for (const d of days) d.entries.sort((a, b) => (a.kind === b.kind ? (a.kind === 'pred' && b.kind === 'pred' ? (a.prediction.minute ?? 1e9) - (b.prediction.minute ?? 1e9) : 0) : a.kind === 'done' ? -1 : 1))
  return days
}

/** 晚了多久就不再算「晚了」，当作停更：三个间隔，至少一个月 */
export const isStalled = (p: Next) => p.late > Math.max(p.interval * 3, 30)

/** 晚了的（晚得少的在前）、停更的与不预测的（按原因分组） */
export function leftovers<M>(series: readonly Series<M>[]) {
  const next = series.filter((s): s is Series<M> & { prediction: Next } => s.prediction.kind === 'next')
  const late = next.filter((s) => s.prediction.late > 0 && !isStalled(s.prediction)).sort((a, b) => a.prediction.late - b.prediction.late)
  const stalled = next.filter((s) => isStalled(s.prediction))
  const irregular = next.filter((s) => s.prediction.late === 0 && s.prediction.regular === 'low')
  const few = series.filter((s) => s.prediction.kind === 'none' && s.prediction.reason === 'few')
  const ended = series.filter((s) => s.prediction.kind === 'none' && s.prediction.reason !== 'few')
  return { late, stalled, irregular, few, ended }
}
