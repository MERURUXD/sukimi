import { t } from '../../i18n/core.ts'
/*
 * 按最近几话的发布时间推算下一话大概什么时候出。服务端没有「预计更新」字段，只能在前端算。
 * 纯函数，不依赖路径别名，scripts/verify-update-predict.test.mjs 直接导入。
 */

const DAY = 86_400_000

/** 参与推算的最近发布日数：太多会被早年的节奏带偏，太少一次延期就乱 */
export const RECENT_DAYS = 10
/** 至少要有几天发布过才推算（三天才有两个间隔） */
export const MIN_DAYS = 3
/** 间隔上下限（天）：日更以下按 1 天算，三个月以上的已经谈不上规律 */
export const MIN_INTERVAL = 1
export const MAX_INTERVAL = 90

/** 能推算的连载状态：完结、腰斩、休刊等都不推算 */
const PREDICTABLE_STATUS = new Set(['ONGOING', 'UNKNOWN'])

export interface ChapterTimes {
  /** 毫秒；来源没给时为 0 */
  uploadDate: number
  /** 毫秒（已经过 sec() 换算） */
  fetchedAt: number
}

export type Regularity = 'high' | 'mid' | 'low'

export type Prediction =
  | { kind: 'none'; reason: 'ended' | 'once' | 'few' }
  | {
      kind: 'next'
      /** 预计那天的本地零点 */
      next: number
      /** 间隔天数 */
      interval: number
      regular: Regularity
      /** 来源没给发布日期，改用抓取时间推算，只能参考 */
      approx: boolean
      /** 比预计晚了几天；没晚为 0 */
      late: number
      /** 一天里通常几点发（距零点的分钟数）；来源只给日期时没有 */
      minute?: number
      /** 参与推算的发布日（本地零点，从早到晚），详情页画节奏用 */
      days: number[]
    }

export function startOfDay(t: number) {
  return new Date(t).setHours(0, 0, 0, 0)
}

export function addDays(day: number, n: number) {
  const d = new Date(day)
  d.setDate(d.getDate() + n)
  return d.getTime()
}

/** 两个本地零点之间差几天；四舍五入抵消夏令时 */
export function daysBetween(a: number, b: number) {
  return Math.round((b - a) / DAY)
}

function median(xs: number[]) {
  const s = [...xs].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

/**
 * 一部漫画每话的「发布时间」：用来源给的发布日期；多数章节没有可信日期时整部改用抓取时间（approx）。
 * 推算和日历摆放共用，同一部漫画两处按同一种时间。取不到的记 0。
 */
export function releaseTimes(chapters: readonly ChapterTimes[], now = Date.now()) {
  // 发布日期为 0、早于 2000 年或在明天之后的，都当作来源没给
  const valid = (t: number) => t > 946_684_800_000 && t < now + DAY
  const approx = chapters.filter((c) => valid(c.uploadDate)).length < chapters.length * 0.6
  return { approx, times: chapters.map((c) => (approx ? c.fetchedAt : c.uploadDate)).map((t) => (valid(t) ? t : 0)) }
}

/**
 * 推算一部漫画的下一话。
 * - 同一天出的多话算一次发布；只看最近 RECENT_DAYS 个发布日。
 * - 间隔取中位数，一次延期或补发不会把结果带偏。
 * - 多数章节没有可信的发布日期时改用抓取时间，并标成 approx。
 */
export function predict(
  chapters: readonly ChapterTimes[],
  { status, updateStrategy, now = Date.now() }: { status: string; updateStrategy?: string; now?: number },
): Prediction {
  if (!PREDICTABLE_STATUS.has(status)) return { kind: 'none', reason: 'ended' }
  if (updateStrategy === 'ONLY_FETCH_ONCE') return { kind: 'none', reason: 'once' }

  const { approx, times: all } = releaseTimes(chapters, now)
  const times = all.filter((t) => t > 0)

  const days = [...new Set(times.map(startOfDay))].sort((a, b) => a - b).slice(-RECENT_DAYS)
  if (days.length < MIN_DAYS) return { kind: 'none', reason: 'few' }

  const gaps = days.slice(1).map((d, i) => daysBetween(days[i], d))
  const interval = Math.min(MAX_INTERVAL, Math.max(MIN_INTERVAL, Math.round(median(gaps))))
  // 和间隔相差不到两成（至少容忍一天）算准时
  const slack = Math.max(1, Math.round(interval * 0.2))
  const hits = gaps.filter((g) => Math.abs(g - interval) <= slack).length / gaps.length
  // 抓取时间受服务端检查频率影响，再准也只算「偶尔会晚」
  const regular: Regularity = hits >= 0.75 && !approx ? 'high' : hits >= 0.5 ? 'mid' : 'low'

  const next = addDays(days[days.length - 1], interval)
  const late = Math.max(0, daysBetween(next, startOfDay(now)))

  // 来源只给日期时时间都是零点；有一半以上带了时刻才推算几点
  let minute: number | undefined
  if (!approx) {
    const recent = times.filter((t) => t >= days[0])
    const minutes = recent.map((t) => (t - startOfDay(t)) / 60_000).filter((m) => m > 0)
    if (minutes.length >= recent.length / 2 && minutes.length) minute = Math.round(median(minutes))
  }

  return { kind: 'next', next, interval, regular, approx, late, minute, days }
}

/** 公告、番外这类不在正篇序列里的章节名：来源常把名字里的日期（如「公告250921」）解析成话数 */
const NOT_MAIN = /公告|通知|告知|预告|番外|特别篇|附录|休刊|お知らせ|予告|番外編|notice|announce|extra|special|hiatus/i

/**
 * 预计的下一话该写第几话：正篇最大话数加一；整数凑不出时返回 null。
 * 先去掉公告、番外，再去掉远超其余章节的离群话数，免得一个被误解析的日期把结果带到几十万。
 */
export function nextChapterNumber(chapters: readonly { chapterNumber: number; name: string }[]) {
  const nums = chapters
    .filter((c) => c.chapterNumber >= 0 && !NOT_MAIN.test(c.name))
    .map((c) => c.chapterNumber)
    .sort((a, b) => b - a)
  // 至少还剩三个更小的话数作对照时，比次大值的两倍还多一百的算离群
  while (nums.length > 3 && nums[0] > nums[1] * 2 + 100) nums.shift()
  const max = nums[0]
  return max !== undefined && Number.isInteger(max) ? max + 1 : null
}

/** 从 next 往后、落在 [from, to) 里的每一次预计发布（日历往后翻几周时用） */
export function occurrences(p: Extract<Prediction, { kind: 'next' }>, from: number, to: number) {
  const out: number[] = []
  for (let k = 0; k < 400; k++) {
    const d = addDays(p.next, p.interval * k)
    if (d >= to) break
    if (d >= from) out.push(d)
  }
  return out
}

/* ───────── 文案 ───────── */

const WEEK = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'] as const

/** 周几的短名（「周三」「Wed」） */
export function weekdayName(i: number) {
  return t(`format.weekday.${WEEK[i]}`)
}

export function intervalLabel(n: number) {
  if (n === 1) return t('updates.predict.interval.daily')
  if (n === 7) return t('updates.predict.interval.weekly')
  if (n === 14) return t('updates.predict.interval.biweekly')
  if (n >= 28 && n <= 31) return t('updates.predict.interval.monthly')
  return t('updates.predict.interval.days', { n })
}

export function regularLabel(p: Extract<Prediction, { kind: 'next' }>) {
  if (p.approx) return t('updates.predict.regular.approx')
  return t(`updates.predict.regular.${p.regular}`)
}

export function clockLabel(minute: number) {
  return `${Math.floor(minute / 60)}:${String(minute % 60).padStart(2, '0')}`
}

/** 「今天」「明天」「周三 10/21」；不太规律且间隔较长时只说到上中下旬 */
export function dayText(p: Extract<Prediction, { kind: 'next' }>, now = Date.now()) {
  const d = new Date(p.next)
  if (p.regular === 'low' && p.interval >= 20) {
    const m = d.getMonth() + 1
    const part = t(`updates.predict.day.part.${d.getDate() <= 10 ? 'early' : d.getDate() <= 20 ? 'mid' : 'late'}`)
    return t('updates.predict.day.approxPart', { part, month: t(`updates.predict.day.months.${MONTHS[m - 1]}`) })
  }
  const diff = daysBetween(startOfDay(now), p.next)
  const md = `${d.getMonth() + 1}/${d.getDate()}`
  if (p.regular === 'low') return t('updates.predict.day.approxDay', { md })
  return diff === 0 ? t('updates.predict.day.today') : diff === 1 ? t('updates.predict.day.tomorrow') : t('updates.predict.day.dated', { weekday: weekdayName(d.getDay()), md })
}

/** 详情页元信息里那一小段：「预计周三 10/21 更新」「晚了 3 天」 */
export function shortText(p: Extract<Prediction, { kind: 'next' }>, now = Date.now()) {
  if (p.late > 0) return t('manga.next.late', { n: p.late })
  const day = dayText(p, now)
  const time = p.minute !== undefined && p.regular !== 'low' && daysBetween(startOfDay(now), p.next) <= 1 ? ` ${clockLabel(p.minute)}` : ''
  const text = p.regular === 'low' ? t('updates.predict.short.approx', { day }) : t('updates.predict.short.expected', { day, time })
  // 以数字结尾时空一格，免得「10/21更新」挤在一起
  return t(/\d$/.test(text) ? 'updates.predict.short.suffixNum' : 'updates.predict.short.suffix', { text })
}
