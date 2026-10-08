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

/** 显示分数换成数字；空串、非数字都当作未评分 */
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

/** 比参照话数大出一截：至少 10 话，长篇按 20% 放宽，容忍来源里轻微的顺序错乱 */
const jumps = (n: number, ref: number) => n - ref > Math.max(10, ref * 0.2)

/**
 * 已读章节里可以同步到追踪网站的话数。
 * 不能直接取最大话数：新年贺图、年份番外常编成「2026 话」，会把进度一下推到 2026。
 * 按来源顺序（越新越大）比较：比后面所有章节都大出一截的视为异常编号；
 * 最新一话后面没有章节可比，改和前面的正常章节比
 */
export function readProgress(chapters: readonly { chapterNumber: number; sourceOrder: number; isRead: boolean }[]) {
  const list = chapters.filter((c) => c.chapterNumber > 0).sort((a, b) => a.sourceOrder - b.sourceOrder)
  const normal = new Array<boolean>(list.length)
  let laterMin = Infinity
  for (let i = list.length - 1; i >= 0; i--) {
    const n = list[i].chapterNumber
    normal[i] = laterMin === Infinity || !jumps(n, laterMin)
    laterMin = Math.min(laterMin, n)
  }
  const last = list.length - 1
  if (last > 0) {
    const before = Math.max(0, ...list.slice(0, last).filter((_, i) => normal[i]).map((c) => c.chapterNumber))
    normal[last] = before === 0 || !jumps(list[last].chapterNumber, before)
  }
  return Math.max(0, ...list.filter((c, i) => c.isRead && normal[i]).map((c) => c.chapterNumber))
}
