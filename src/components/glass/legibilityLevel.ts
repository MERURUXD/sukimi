import { LEGIBILITY_POLICIES, type LegibilityTier } from '@sessile/core'
import type { AdaptiveTintLevel } from '@/design/settings'

const ORDER: readonly LegibilityTier[] = ['clear', 'regular', 'legible']

/** 两端没有下一档时，目标对比度按这个比例放宽 / 收紧 */
const BEYOND = { low: 0.75, high: 1.3 } as const

/**
 * 强度档位换算成 Sessile 的 tier 与目标对比度。
 * 弱 / 强把每块玻璃整体挪一档：tier 决定底膜、降饱和与模糊的上限，对比度决定压暗或提亮到哪里，
 * 两者一起挪才看得出差别。已在两端的（弱档的纯图标、强档的大段文字）没有下一档可挪，只调对比度。
 * 标准档不覆盖对比度，与没有档位时的观感一致。
 */
export function resolveAdaptiveTint(level: AdaptiveTintLevel, tier: LegibilityTier): { tier: LegibilityTier; contrast?: number } {
  if (level === 'standard') return { tier }
  const step = level === 'high' ? 1 : -1
  const next = ORDER[ORDER.indexOf(tier) + step]
  if (next) return { tier: next }
  return { tier, contrast: LEGIBILITY_POLICIES[tier].contrast * BEYOND[level] }
}
