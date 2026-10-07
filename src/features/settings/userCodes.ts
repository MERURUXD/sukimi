import { sec } from '../../lib/format.ts'

const HOUR = 3_600_000
const DAY = 24 * HOUR

/** 码的剩余有效期；expiresAt 是秒（LongString） */
export function codeExpiryText(expiresAt: string, now = Date.now()) {
  const left = sec(expiresAt) - now
  if (left <= 0) return '已过期'
  if (left < HOUR) return '不到 1 小时后过期'
  if (left < DAY) return `${Math.ceil(left / HOUR)} 小时后过期`
  return `${Math.ceil(left / DAY)} 天后过期`
}

/** 注册链接：打开后注册码已预填 */
export const registerLink = (origin: string, code: string) => `${origin}/register?code=${encodeURIComponent(code)}`
