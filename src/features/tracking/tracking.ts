import { httpUrl } from '../../lib/url.ts'
import { t } from '../../i18n/core.ts'

/** 和官方网页界面用同一个回调地址：suwayomi.org 的中转页按 state.redirectUrl 跳回来 */
export const OAUTH_PATH = '/tracker/login/oauth'

/** 这次授权写进 sessionStorage 的随机数；回调对不上就不交给服务端 */
const OAUTH_NONCE_KEY = 'sukimi.oauth.nonce'

/** 虚构验收页用页内锚点跳转，只改网址的 #，不离开当前页 */
function samePageHash(authUrl: string) {
  return /^#[^:?\s\\]*\?/.test(authUrl)
}

/**
 * 授权地址。只接受已经带查询串的 http(s)，或验收页的页内锚点；
 * 其它协议、没有 ? 的地址返回 null，避免把 &state= 接到错误的位置，也不要 location.assign 到 javascript:。
 */
export function oauthUrl(tracker: { id: number; name: string; authUrl: string }, origin: string): string | null {
  const target = samePageHash(tracker.authUrl) ? tracker.authUrl : httpUrl(tracker.authUrl)
  if (!target || !target.includes('?')) return null
  const nonce = crypto.randomUUID()
  try {
    sessionStorage.setItem(OAUTH_NONCE_KEY, nonce)
  } catch {
    return null
  }
  const state = { redirectUrl: `${origin}${OAUTH_PATH}`, clientName: 'Sukimi', trackerId: tracker.id, trackerName: tracker.name, nonce }
  return `${target}&state=${encodeURIComponent(JSON.stringify(state))}`
}

/** 回调地址里的 state；不是合法 JSON、没有 trackerId 或没有随机数时返回 null */
export function parseOAuthState(href: string): { trackerId: number; trackerName: string; nonce: string } | null {
  try {
    const raw = new URL(href).searchParams.get('state')
    const s = raw ? (JSON.parse(raw) as { trackerId?: unknown; trackerName?: unknown; nonce?: unknown }) : null
    if (!s || typeof s.trackerId !== 'number' || typeof s.nonce !== 'string' || !s.nonce) return null
    return { trackerId: s.trackerId, trackerName: typeof s.trackerName === 'string' ? s.trackerName : '', nonce: s.nonce }
  } catch {
    return null
  }
}

/** 随机数和这次跳转前存下的一致才算数，用过即删 */
export function consumeOAuthNonce(nonce: string) {
  try {
    const saved = sessionStorage.getItem(OAUTH_NONCE_KEY)
    if (!saved || saved !== nonce) return false
    sessionStorage.removeItem(OAUTH_NONCE_KEY)
    return true
  } catch {
    return false
  }
}

const STATUS = [
  [/re-?(read|watch)|repeat/i, 'reread'],
  [/plan/i, 'plan'],
  [/complete/i, 'complete'],
  [/hold|paus/i, 'hold'],
  [/drop/i, 'drop'],
  [/read|current|watch/i, 'reading'],
] as const

/** 追踪服务给的状态名是英文，常见的按界面语言换掉，其余照原样 */
export const statusLabel = (name: string) => {
  const hit = STATUS.find(([re]) => re.test(name))
  return hit ? t(`track.status.${hit[1]}`) : name
}

/** 服务端日期是毫秒（LongString），0 表示没有 */
export function toDateInput(ms: string | number) {
  const n = Number(ms)
  if (!n) return ''
  const d = new Date(n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** 日期输入框的值换回毫秒字符串；清空时传 0 */
export function fromDateInput(v: string) {
  if (!v) return '0'
  const [y, m, d] = v.split('-').map(Number)
  return String(new Date(y, m - 1, d).getTime())
}

/**
 * 评分档位能否画成星星：0/1–10 的整数画十分制半星，0/1–5 画五星，
 * 其余（百分制、小数、表情）返回 null，仍用下拉框
 */
export function starScale(scores: readonly string[]): 5 | 10 | null {
  const nums = scores.filter((s) => s !== '' && s !== '0').map(Number)
  if (!nums.length || nums.some((n) => !Number.isInteger(n))) return null
  const max = Math.max(...nums)
  if ((max !== 5 && max !== 10) || nums.length !== max || Math.min(...nums) !== 1) return null
  return max
}

/** 有没有评分：空串、'0' 和档位第一项（各网站的「未评分」）算没有；表情之类非数字也算有 */
export const isRated = (display: string, scores: readonly string[]) => display !== '' && display !== '0' && display !== scores[0]

/** 显示分数换成数字，只用于画星星；空串、非数字都得 0 */
export const scoreValue = (display: string) => Number(display) || 0

/** 星星选中的数字换回服务端要的档位字符串；0 用列表里表示「未评分」的那一项 */
export function scoreString(scores: readonly string[], value: number) {
  if (value <= 0) return scores.find((s) => s === '' || s === '0') ?? '0'
  return scores.find((s) => Number(s) === value) ?? String(value)
}

const BGM_WORDS = ['', 'w1', 'w2', 'w3', 'w4', 'w5', 'w6', 'w7', 'w8', 'w9', 'w10'] as const

/** Bangumi 十分制的评价词，和网站上一致；其他网站不加 */
export const scoreWord = (trackerName: string, value: number) => {
  const key = BGM_WORDS[value]
  return key && /bangumi/i.test(trackerName) ? t(`track.words.${key}`) : ''
}

/** 相邻话数差得太远就断开：至少 10 话，长篇按 20% 放宽，容忍来源里缺几话 */
const far = (n: number, prev: number) => n - prev > Math.max(10, prev * 0.2)

/** 整段都是 1900–2100 的整数，像年份贺图 */
const yearLike = (run: readonly number[]) => run.every((n) => Number.isInteger(n) && n >= 1900 && n <= 2100)

/**
 * 已读章节里可以同步到追踪网站的话数。
 * 不能直接取最大话数：新年贺图、年份番外常编成「2026 话」，会把进度一下推到 2026，
 * 而且可能连着好几张（2024、2025、2026）。做法：把话数从小到大排好，在差得太远的地方断成几段；
 * 最高的一段整段都像年份，就当作贺图丢掉，可以连着丢好几段。
 * 只认年份：多同步会因「只往前推」无法自动纠正，少同步只是暂时没更新；
 * 来源只留第 1 话和最新几话（如 1、50、51）时，短段照常算
 */
export function readProgress(chapters: readonly { chapterNumber: number; isRead: boolean }[]) {
  const nums = [...new Set(chapters.map((c) => c.chapterNumber).filter((n) => n > 0))].sort((a, b) => a - b)
  const runs: number[][] = []
  for (const n of nums) {
    const run = runs.at(-1)
    if (run && !far(n, run.at(-1)!)) run.push(n)
    else runs.push([n])
  }
  while (runs.length > 1 && yearLike(runs.at(-1)!)) runs.pop()
  const cap = runs.at(-1)?.at(-1) ?? 0
  return Math.max(0, ...chapters.filter((c) => c.isRead && c.chapterNumber > 0 && c.chapterNumber <= cap).map((c) => c.chapterNumber))
}
