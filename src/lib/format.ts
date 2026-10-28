/*
 * 时间单位（服务端约定）：uploadDate 为毫秒；fetchedAt / lastReadAt / inLibraryAt 为秒。
 * LongString 标量以字符串传输。
 */
import { t } from '../i18n/core.ts'

export const ms = (v: string | null | undefined) => Number(v ?? 0)
export const sec = (v: string | null | undefined) => Number(v ?? 0) * 1000

const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR
const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const

export function timeAgo(at: number, now = Date.now()) {
  if (!at) return ''
  const d = now - at
  if (d < MIN) return t('format.justNow')
  if (d < HOUR) return t('format.minutesAgo', { count: Math.floor(d / MIN) })
  if (d < DAY) return t('format.hoursAgo', { count: Math.floor(d / HOUR) })
  if (d < 2 * DAY) return t('format.yesterday')
  if (d < 30 * DAY) return t('format.daysAgo', { count: Math.floor(d / DAY) })
  return formatDate(at)
}

export function formatDate(at: number) {
  if (!at) return ''
  const d = new Date(at)
  const y = d.getFullYear()
  const md = `${d.getMonth() + 1}/${d.getDate()}`
  return y === new Date().getFullYear() ? md : `${y}/${md}`
}

/** 带年份的完整日期，章节行用：只写月日分不清是哪一年发布的 */
export function formatFullDate(at: number) {
  if (!at) return ''
  const d = new Date(at)
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`
}

/** 按天分组的标题：今天、昨天、本周几，再早显示日期 */
export function dayLabel(at: number, now = new Date()) {
  const d = new Date(at)
  const diff = Math.round((new Date(now.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / DAY)
  if (diff === 0) return t('format.today')
  if (diff === 1) return t('format.yesterday')
  if (diff < 7) return t(`format.weekday.${WEEKDAYS[d.getDay()]}`)
  return formatDate(at)
}

/** 时:分 */
export function clock(at: number) {
  const d = new Date(at)
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** 章节号：-1 表示源没有提供 */
export function chapterNo(n: number) {
  if (n < 0) return ''
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100)
}

/** 章节显示名：直接用来源给的章节名；来源没给名字时才用话数拼一个 */
export function chapterLabel(c: { chapterNumber: number; name: string }) {
  const name = c.name.trim()
  if (name) return name
  const n = chapterNo(c.chapterNumber)
  return n ? t('format.chapterNo', { n }) : t('format.untitledChapter')
}

export function count(n: number) {
  return n.toLocaleString('en-US')
}
