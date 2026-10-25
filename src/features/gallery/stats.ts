/*
 * 阅读档案的汇总。纯函数：不碰 DOM，测试直接导入。
 *
 * Suwayomi 不记录阅读时长，这里只有每一话的「最后阅读时间」：
 * 时钟、热力图和连续天数都按这个时间、浏览器本地时区来算，页面上要写明。
 * 时间图表套用阅读历史的隐藏规则；Tachiyomi 时期导入的「已读但没有时间」的章节只计入总数。
 */
import { isVisible } from '../history/history.ts'
import { count, sec } from '../../lib/format.ts'

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
  /** 已读页数估算（取整）：页数已知的话按实际页数，未知的按这部已知话的平均页数补，整部都未知则用全库平均 */
  pages: number
  /** 这部最后一次阅读（毫秒），没有时间的为 0 */
  last: number
}

export interface HeatDay {
  /** 当天本地零点（毫秒） */
  date: number
  count: number
  /** 当天读完的页数估算，口径同 ReadingStats.pages */
  pages: number
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
  /**
   * 已读页数估算（取整）。服务端只在章节页面被取过后才有页数，批量标已读、同步进度的话没有，
   * 这些话按所属作品已知话的平均页数补，整部都没有已知页数的用全库平均
   */
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

export function summarize(chapters: readonly StatChapter[], mangas: readonly StatManga[], now = Date.now(), userId?: number): ReadingStats {
  const hours = Array.from({ length: 24 }, () => 0)
  const perDay = new Map<number, number>()
  const pagesPerDay = new Map<number, number>()
  const perManga = new Map<number, { read: number; pages: number; last: number }>()
  let read = 0
  let pages = 0
  let untimed = 0

  // 先量出每部、全库已读话的平均页数，再给页数未知的话补上
  const sample = new Map<number, { n: number; sum: number }>()
  let allN = 0
  let allSum = 0
  for (const c of chapters) {
    if (!c.isRead || c.pageCount <= 0) continue
    const e = sample.get(c.mangaId) ?? { n: 0, sum: 0 }
    e.n++
    e.sum += c.pageCount
    sample.set(c.mangaId, e)
    allN++
    allSum += c.pageCount
  }
  const pagesOf = (c: StatChapter) => {
    if (c.pageCount > 0) return c.pageCount
    const e = sample.get(c.mangaId)
    return e ? e.sum / e.n : allN ? allSum / allN : 0
  }

  for (const c of chapters) {
    const at = sec(c.lastReadAt)
    const entry = perManga.get(c.mangaId) ?? { read: 0, pages: 0, last: 0 }
    if (c.isRead) {
      read++
      entry.read++
      const p = pagesOf(c)
      pages += p
      entry.pages += p
      if (at <= 0) untimed++
    }
    if (at > 0) {
      entry.last = Math.max(entry.last, at)
      // 从历史里删掉的记录不进时间图表（重新读过后又会算上）
      if (isVisible(c, userId)) {
        hours[new Date(at).getHours()]++
        const day = dayStart(at)
        perDay.set(day, (perDay.get(day) ?? 0) + 1)
        if (c.isRead) pagesPerDay.set(day, (pagesPerDay.get(day) ?? 0) + pagesOf(c))
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
    days.push({ date, count: future ? 0 : count, pages: future ? 0 : (pagesPerDay.get(date) ?? 0), future })
  }

  const known = mangas.every((m) => m.total != null)
  let caughtUp = 0
  const ranking: RankEntry[] = mangas.map((m) => {
    const e = perManga.get(m.id) ?? { read: 0, pages: 0, last: 0 }
    if (m.total != null && m.total > 0 && e.read >= m.total) caughtUp++
    return { id: m.id, read: e.read, total: m.total, pages: Math.round(e.pages), last: e.last }
  })
  ranking.sort((a, b) => b.read - a.read || b.last - a.last || a.id - b.id)

  return {
    read,
    total: known ? mangas.reduce((n, m) => n + (m.total ?? 0), 0) : null,
    caughtUp,
    pages: Math.round(pages),
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

/** 热力图范围内最长的一段连续阅读：起止下标（含）与天数；没有阅读时为 null。并列取较晚的一段 */
export function bestRun(days: readonly HeatDay[]) {
  let best: { from: number; to: number; len: number } | null = null
  let from = -1
  days.forEach((d, i) => {
    if (d.count > 0) {
      if (from < 0) from = i
      const len = i - from + 1
      if (!best || len >= best.len) best = { from, to: i, len }
    } else from = -1
  })
  return best as { from: number; to: number; len: number } | null
}

/** 每周有阅读的天数（0～7），一周一项 */
export const weekActive = (days: readonly HeatDay[]) =>
  Array.from({ length: Math.floor(days.length / 7) }, (_, w) => days.slice(w * 7, w * 7 + 7).filter((d) => d.count > 0).length)

/**
 * 累计页数在热力图范围内怎么涨上来的：把范围等分成 n 段，每段末尾的累计页数。
 * total 是全部记录的页数，范围之前读的（含没有时间的）算作起点，所以最后一段就是 total
 */
export function pageGrowth(days: readonly HeatDay[], total: number, n: number) {
  const inRange = days.reduce((a, d) => a + d.pages, 0)
  let acc = Math.max(0, total - inRange)
  return Array.from({ length: n }, (_, i) => {
    for (const d of days.slice(Math.floor((i * days.length) / n), Math.floor(((i + 1) * days.length) / n))) acc += d.pages
    return acc
  })
}

/** 3.1 万页；不到一万照常写 */
export const pagesText = (n: number) => (n >= 10000 ? { v: (n / 10000).toFixed(1).replace(/\.0$/, ''), u: '万页' } : { v: count(n), u: '页' })

export interface KpiBar {
  v: number
  on?: boolean
  lit?: boolean
}

export interface Kpi {
  key: string
  /** 进场时从 0 数上来的目标值；不数的（页数、还没有总话数）为 null，直接显示 text */
  num: number | null
  text: string
  unit: string
  caption: string
  bars: KpiBar[]
  label: string
}

/**
 * 档案页两侧的四项数字（每项一个大数字、一行说明和一条细竖条小图）。分享海报画同样的四项，
 * 数字和说法放在这里共用，两边才一致
 */
export function kpiData(s: ReadingStats, works: number, run: ReturnType<typeof bestRun>): { progress: [Kpi, Kpi]; rhythm: [Kpi, Kpi] } {
  const ratio = (f: number) => Array.from({ length: 24 }, (_, i) => ({ v: 1, lit: (i + 0.5) / 24 <= f }))
  const frac = s.total ? s.read / s.total : 0
  const growth = pageGrowth(s.days, s.pages, 24)
  const base = s.pages - s.days.reduce((a, d) => a + d.pages, 0)
  const pg = pagesText(s.pages)
  const runWeeks = run ? [Math.floor(run.from / 7), Math.floor(run.to / 7)] : null
  return {
    progress: [
      {
        key: 'read',
        num: s.total ? frac * 100 : null,
        text: s.total ? `${Math.round(frac * 100)}` : '—',
        unit: '%',
        caption: `已读 · ${count(s.read)} / ${s.total == null ? '—' : count(s.total)} 话`,
        bars: ratio(frac),
        label: `书库已读 ${Math.round(frac * 100)}%`,
      },
      {
        key: 'caught',
        num: s.caughtUp,
        text: `${s.caughtUp}`,
        unit: ` / ${works}`,
        caption: '部已追平',
        bars: ratio(works ? s.caughtUp / works : 0),
        label: `已追平 ${s.caughtUp} / ${works} 部`,
      },
    ],
    rhythm: [
      {
        key: 'days',
        num: s.activeDays,
        text: `${s.activeDays}`,
        unit: '天',
        caption: '近半年有阅读 · 按周',
        bars: weekActive(s.days).map((v, w) => ({ v, on: v > 0, lit: !!runWeeks && v > 0 && w >= runWeeks[0] && w <= runWeeks[1] })),
        label: `近半年有 ${s.activeDays} 天阅读记录`,
      },
      {
        key: 'pages',
        num: null,
        text: pg.v,
        unit: pg.u,
        caption: '约翻过 · 近半年累计',
        bars: growth.map((v, i) => ({ v: v - base, on: true, lit: i === growth.length - 1 })),
        label: `约翻过 ${count(s.pages)} 页`,
      },
    ],
  }
}
