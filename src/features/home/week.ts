import { t } from '../../i18n/core.ts'
/*
 * 首页「这一周」：最近 7 天（今天和前 6 天，按本地日历日）按天分组。
 * 只放纯逻辑（Node 测试直接导入），不依赖 React、Apollo 或路径别名。
 */

export const WEEK_DAYS = 7
const DAY_MS = 86400000
const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const

/** 本地日历日的零点 */
const midnight = (ms: number) => {
  const d = new Date(ms)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/** 第几天前（今天为 0），时间都是毫秒；超出这一周为 -1。时钟稍快导致的「未来」时间算今天。按日历算，跨夏令时也不会差一天 */
export function dayIndex(atMs: number, nowMs: number) {
  if (!(atMs > 0)) return -1
  const d = Math.round((midnight(nowMs) - midnight(atMs)) / DAY_MS)
  return d < 0 ? 0 : d < WEEK_DAYS ? d : -1
}

/** 这一周起点（最早那天本地零点）的秒数，用来按抓取时间筛选更新；按日历算，跨夏令时也对 */
export function weekStartSec(nowMs: number) {
  const d = new Date(midnight(nowMs))
  d.setDate(d.getDate() - (WEEK_DAYS - 1))
  return Math.floor(d.getTime() / 1000)
}

/** 这一周每一天的名字和日期，今天在前 */
export function weekDays(nowMs: number) {
  const today = midnight(nowMs)
  return Array.from({ length: WEEK_DAYS }, (_, i) => {
    const d = new Date(today - i * DAY_MS + DAY_MS / 2)
    return { name: i === 0 ? t('format.today') : i === 1 ? t('format.yesterday') : t(`format.weekday.${WEEKDAYS[d.getDay()]}`), date: `${d.getMonth() + 1}/${d.getDate()}` }
  })
}

export interface DayGroup<T> {
  mangaId: number
  /** 当天这部的记录，最新的在前 */
  items: T[]
}

/**
 * 按天、再按漫画分组：每天里一部漫画只占一项，项按最新记录的时间排，最新的在前。
 * at 返回毫秒；输入不要求有序，超出这一周的记录丢掉。
 */
export function byDay<T>(records: readonly T[], at: (t: T) => number, mangaOf: (t: T) => number, nowMs: number) {
  const days = Array.from({ length: WEEK_DAYS }, () => new Map<number, T[]>())
  const sorted = [...records].sort((a, b) => at(b) - at(a))
  for (const r of sorted) {
    const d = dayIndex(at(r), nowMs)
    if (d < 0) continue
    const map = days[d]
    const id = mangaOf(r)
    const list = map.get(id)
    if (list) list.push(r)
    else map.set(id, [r])
  }
  return days.map((map) => [...map].map(([mangaId, items]): DayGroup<T> => ({ mangaId, items })))
}

/**
 * 更新列表是按抓取时间倒序取的前若干话：还有下一页、且取到的最旧一话仍在这一周里时，
 * 这一周更早的几天并不完整，界面要说明，不能当成那几天没有更新。
 */
export function updatesPartial(fetchedAtMs: readonly number[], hasNextPage: boolean, nowMs: number) {
  if (!hasNextPage || !fetchedAtMs.length) return false
  return dayIndex(Math.min(...fetchedAtMs), nowMs) >= 0
}

/** 窄屏「这一周」日期标签的副标题：区分更新部数与阅读部数，不混加为同一个数字 */
export function weekTabSub(updates: number, reads: number) {
  if (updates > 0 && reads > 0) return t('home.week.tabUpdatesAndReads', { updates, reads })
  if (updates > 0) return t('home.week.tabUpdates', { updates })
  if (reads > 0) return t('home.week.tabReads', { reads })
  return '—'
}
