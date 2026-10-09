/*
 * 阅读档案的汇总。纯函数：不碰 DOM，测试直接导入。
 *
 * Suwayomi 不记录阅读时长，这里只有每一话的「最后阅读时间」：
 * 时钟、热力图和连续天数都按这个时间、浏览器本地时区来算，页面上要写明。
 * 时间图表套用阅读历史的隐藏规则；Tachiyomi 时期导入的「已读但没有时间」的章节只计入总数。
 */
import { isVisible } from '../history/history.ts'
import { sec } from '../../lib/format.ts'

export interface StatChapter {
  mangaId: number
  isRead: boolean
  pageCount: number
  /** 秒 */
  lastReadAt: string
  meta: readonly { key: string; value: string }[]
}

export interface StatManga {
  id: number
  /** 总话数；还没取到时为 null */
  total: number | null
}

export interface RankEntry {
  id: number
  read: number
  total: number | null
  /** 这部最后一次阅读（毫秒），没有时间的为 0 */
  last: number
}

export interface HeatDay {
  /** 当天本地零点（毫秒） */
  date: number
  count: number
  /** 今天之后的格子（本周还没到的几天） */
  future: boolean
}

export interface ReadingStats {
  /** 已读话数（含没有阅读时间的） */
  read: number
  /** 书库总话数；有作品的总话数还没取到时为 null */
  total: number | null
  /** 已追平的部数：已读等于总话数且总话数大于 0 */
  caughtUp: number
  /** 已读页数，只累加页数大于 0 的已读章节，所以是下限 */
  pages: number
  /** 已读但没有阅读时间的话数（不进时间图表） */
  untimed: number
  /** 0～23 点各读了几话 */
  hours: number[]
  /** 读得最多的钟点，并列取较早的；没有记录时为 -1 */
  peak: number
  /** 近 26 周，按周一对齐，一列一周 */
  days: HeatDay[]
  /** 热力图范围内有阅读的天数 */
  activeDays: number
  /** 全部记录里最长连续阅读的天数 */
  streak: number
  /** 按已读话数从多到少；并列时最近读过的在前，再按 id */
  ranking: RankEntry[]
}

export const HEAT_WEEKS = 26

/** 本地零点 */
export function dayStart(t: number) {
  const d = new Date(t)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/** 加减天数（按日历走，跨夏令时也不会错一天） */
export function addDays(t: number, n: number) {
  const d = new Date(t)
  d.setDate(d.getDate() + n)
  return d.getTime()
}

/** 本周一的本地零点 */
export function mondayOf(t: number) {
  const d = new Date(dayStart(t))
  return addDays(d.getTime(), -((d.getDay() + 6) % 7))
}

/** 一组本地零点里最长的连续天数 */
export function longestStreak(days: Iterable<number>) {
  const sorted = [...new Set(days)].sort((a, b) => a - b)
  let best = 0
  let run = 0
  let prev = NaN
  for (const d of sorted) {
    run = !Number.isNaN(prev) && addDays(prev, 1) === d ? run + 1 : 1
    best = Math.max(best, run)
    prev = d
  }
  return best
}

export function summarize(chapters: readonly StatChapter[], mangas: readonly StatManga[], now = Date.now()): ReadingStats {
  const hours = Array.from({ length: 24 }, () => 0)
  const perDay = new Map<number, number>()
  const perManga = new Map<number, { read: number; last: number }>()
  let read = 0
  let pages = 0
  let untimed = 0

  for (const c of chapters) {
    const at = sec(c.lastReadAt)
    const entry = perManga.get(c.mangaId) ?? { read: 0, last: 0 }
    if (c.isRead) {
      read++
      entry.read++
      if (c.pageCount > 0) pages += c.pageCount
      if (at <= 0) untimed++
    }
    if (at > 0) {
      entry.last = Math.max(entry.last, at)
      // 从历史里删掉的记录不进时间图表（重新读过后又会算上）
      if (isVisible(c)) {
        hours[new Date(at).getHours()]++
        const day = dayStart(at)
        perDay.set(day, (perDay.get(day) ?? 0) + 1)
      }
    }
    perManga.set(c.mangaId, entry)
  }

  let peak = -1
  for (let h = 0; h < 24; h++) if (hours[h] > 0 && (peak < 0 || hours[h] > hours[peak])) peak = h

  const today = dayStart(now)
  const start = addDays(mondayOf(now), -(HEAT_WEEKS - 1) * 7)
  const days: HeatDay[] = []
  let activeDays = 0
  for (let i = 0; i < HEAT_WEEKS * 7; i++) {
    const date = addDays(start, i)
    const count = perDay.get(date) ?? 0
    const future = date > today
    if (!future && count > 0) activeDays++
    days.push({ date, count: future ? 0 : count, future })
  }

  const known = mangas.every((m) => m.total != null)
  let caughtUp = 0
  const ranking: RankEntry[] = mangas.map((m) => {
    const e = perManga.get(m.id) ?? { read: 0, last: 0 }
    if (m.total != null && m.total > 0 && e.read >= m.total) caughtUp++
    return { id: m.id, read: e.read, total: m.total, last: e.last }
  })
  ranking.sort((a, b) => b.read - a.read || b.last - a.last || a.id - b.id)

  return {
    read,
    total: known ? mangas.reduce((n, m) => n + (m.total ?? 0), 0) : null,
    caughtUp,
    pages,
    untimed,
    hours,
    peak,
    days,
    activeDays,
    streak: longestStreak(perDay.keys()),
    ranking,
  }
}

/** 热力图分档：0 没读，1～4 越来越多 */
export const heatLevel = (n: number) => (n <= 0 ? 0 : n <= 3 ? 1 : n <= 6 ? 2 : n <= 10 ? 3 : 4)
