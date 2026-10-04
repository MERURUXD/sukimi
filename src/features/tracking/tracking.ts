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
