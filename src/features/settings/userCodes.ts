import { sec } from '../../lib/format.ts'
import { t } from '../../i18n/core.ts'

const HOUR = 3_600_000
const DAY = 24 * HOUR

/** 码的剩余有效期；expiresAt 是秒（LongString） */
export function codeExpiryText(expiresAt: string, now = Date.now()) {
  const left = sec(expiresAt) - now
  if (left <= 0) return t('cfg.code.expired')
  if (left < HOUR) return t('cfg.code.lessHour')
  if (left < DAY) return t('cfg.code.hours', { count: Math.ceil(left / HOUR), n: Math.ceil(left / HOUR) })
  return t('cfg.code.days', { count: Math.ceil(left / DAY), n: Math.ceil(left / DAY) })
}

/** 注册链接：打开后注册码已预填 */
export const registerLink = (origin: string, code: string) => `${origin}/register?code=${encodeURIComponent(code)}`
