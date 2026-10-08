/** 和官方网页界面用同一个回调地址：suwayomi.org 的中转页按 state.redirectUrl 跳回来 */
export const OAUTH_PATH = '/tracker/login/oauth'

/** 授权地址：带上回调地址和追踪服务，回来时才知道是哪个服务 */
export function oauthUrl(tracker: { id: number; name: string; authUrl: string }, origin: string) {
  const state = { redirectUrl: `${origin}${OAUTH_PATH}`, clientName: 'Sukimi', trackerId: tracker.id, trackerName: tracker.name }
  return `${tracker.authUrl}&state=${encodeURIComponent(JSON.stringify(state))}`
}

/** 回调地址里的 state；不是合法 JSON 或没有 trackerId 时返回 null */
export function parseOAuthState(href: string): { trackerId: number; trackerName: string } | null {
  try {
    const raw = new URL(href).searchParams.get('state')
    const s = raw ? (JSON.parse(raw) as { trackerId?: unknown; trackerName?: unknown }) : null
    if (!s || typeof s.trackerId !== 'number') return null
    return { trackerId: s.trackerId, trackerName: typeof s.trackerName === 'string' ? s.trackerName : '' }
  } catch {
    return null
  }
}

const STATUS: [RegExp, string][] = [
  [/re-?(read|watch)|repeat/i, '重读'],
  [/plan/i, '想读'],
  [/complete/i, '读完'],
  [/hold|paus/i, '搁置'],
  [/drop/i, '弃坑'],
  [/read|current|watch/i, '在读'],
]

/** 追踪服务给的状态名是英文，常见的换成中文，其余照原样 */
export const statusLabel = (name: string) => STATUS.find(([re]) => re.test(name))?.[1] ?? name

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

const BGM_WORDS = ['', '不忍直视', '很差', '差', '较差', '不过不失', '还行', '推荐', '力荐', '神作', '超神作']

/** Bangumi 十分制的评价词，和网站上一致；其他网站不加 */
export const scoreWord = (trackerName: string, value: number) =>
  /bangumi/i.test(trackerName) ? (BGM_WORDS[value] ?? '') : ''

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
