/*
 * 时间单位（服务端约定）：uploadDate 为毫秒；fetchedAt / lastReadAt / inLibraryAt 为秒。
 * LongString 标量以字符串传输。
 */
export const ms = (v: string | null | undefined) => Number(v ?? 0)
export const sec = (v: string | null | undefined) => Number(v ?? 0) * 1000

const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

export function timeAgo(t: number, now = Date.now()) {
  if (!t) return ''
  const d = now - t
  if (d < MIN) return '刚刚'
  if (d < HOUR) return `${Math.floor(d / MIN)} 分钟前`
  if (d < DAY) return `${Math.floor(d / HOUR)} 小时前`
  if (d < 2 * DAY) return '昨天'
  if (d < 30 * DAY) return `${Math.floor(d / DAY)} 天前`
  return formatDate(t)
}

export function formatDate(t: number) {
  if (!t) return ''
  const d = new Date(t)
  const y = d.getFullYear()
  const md = `${d.getMonth() + 1}/${d.getDate()}`
  return y === new Date().getFullYear() ? md : `${y}/${md}`
}

/** 带年份的完整日期，章节行用：只写月日分不清是哪一年发布的 */
export function formatFullDate(t: number) {
  if (!t) return ''
  const d = new Date(t)
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`
}

/** 按天分组的标题：今天、昨天、本周几，再早显示日期 */
export function dayLabel(t: number, now = new Date()) {
  const d = new Date(t)
  const diff = Math.round((new Date(now.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / DAY)
  if (diff === 0) return '今天'
  if (diff === 1) return '昨天'
  if (diff < 7) return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()]
  return formatDate(t)
}

/** 时:分 */
export function clock(t: number) {
  const d = new Date(t)
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** 章节号：-1 表示源没有提供 */
export function chapterNo(n: number) {
  if (n < 0) return ''
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100)
}

export function count(n: number) {
  return n.toLocaleString('en-US')
}
