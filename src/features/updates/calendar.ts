/*
 * 更新日历的排布：把近半年的章节按漫画分组、逐部推算，再排进某一周的七天。
 * 纯函数，scripts/verify-update-predict.test.mjs 直接导入。
 */
import { addDays, occurrences, predict, releaseTimes, startOfDay, type Prediction } from './predict.ts'

type Next = Extract<Prediction, { kind: 'next' }>

export interface CalendarInput<M> {
  mangaId: number
  /** 毫秒 */
  uploadDate: number
  /** 毫秒 */
  fetchedAt: number
  /** 章节号；来源没给时是 -1 */
  chapterNumber?: number
  /** 章节标题，一般是「第 N 话」 */
  name?: string
  manga: M & { status: string; updateStrategy?: string }
}

export interface Series<M> {
  manga: M
  mangaId: number
  prediction: Prediction
}

export type DayEntry<M> =
  | { kind: 'done'; mangaId: number; manga: M; count: number; /** 当天最新的一话，用来显示标题 */ latest: { name: string; chapterNumber: number } }
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
 * 某一周的七天。过去和今天放实际的更新，按来源的发布日期摆（来源没给日期的整部改按抓取时间），
 * 和推算用的是同一种时间；今天及以后放推算，同一天已经出了的不再重复显示预计。
 */
export function buildWeek<M>(chapters: readonly CalendarInput<M>[], series: readonly Series<M>[], start: number, now: number): CalendarDay<M>[] {
  const today = startOfDay(now)
  const days: CalendarDay<M>[] = Array.from({ length: 7 }, (_, i) => ({ day: addDays(start, i), entries: [] }))
  const end = addDays(start, 7)
  const index = new Map(days.map((d, i) => [d.day, i]))

  const byManga = new Map<number, CalendarInput<M>[]>()
  for (const c of chapters) {
    const g = byManga.get(c.mangaId)
    if (g) g.push(c)
    else byManga.set(c.mangaId, [c])
  }
  const placed: { c: CalendarInput<M>; t: number }[] = []
  for (const g of byManga.values()) {
    const { times } = releaseTimes(g, now)
    g.forEach((c, i) => { if (times[i]) placed.push({ c, t: times[i] }) })
  }

  const done = new Map<string, Extract<DayEntry<M>, { kind: 'done' }>>()
  const latestAt = new Map<string, { n: number; t: number }>()
  for (const { c, t } of placed) {
    const day = startOfDay(t)
    const i = index.get(day)
    if (i === undefined) continue
    const key = `${day}#${c.mangaId}`
    const hit = done.get(key)
    const cur = { name: c.name ?? '', chapterNumber: c.chapterNumber ?? -1 }
    if (hit) {
      hit.count++
      // 最新一话：章节号大的；章节号缺失时按发布时间晚的
      const last = latestAt.get(key)!
      if (cur.chapterNumber >= 0 && last.n >= 0 ? cur.chapterNumber > last.n : t > last.t) {
        hit.latest = cur
        latestAt.set(key, { n: cur.chapterNumber, t })
      }
    } else {
      const e = { kind: 'done' as const, mangaId: c.mangaId, manga: c.manga, count: 1, latest: cur }
      done.set(key, e)
      latestAt.set(key, { n: cur.chapterNumber, t })
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
