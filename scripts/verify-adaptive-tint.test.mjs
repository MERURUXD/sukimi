import assert from 'node:assert/strict'
import test from 'node:test'
import { LEGIBILITY_POLICIES, resolveLegibilityGoal } from '@sessile/core'
import { resolveAdaptiveTint } from '../src/components/glass/legibilityLevel.ts'

const TIERS = ['clear', 'regular', 'legible']
const LEVELS = ['low', 'standard', 'high']
// 深色主题的白字与浅色主题的墨字（index.css 的 --text）
const FOREGROUNDS = { light: [0xf4 / 255, 0xf4 / 255, 0xf5 / 255], dark: [0x14 / 255, 0x14 / 255, 0x16 / 255] }

const goalOf = (level, tier, foreground) => resolveLegibilityGoal({ foreground, ...resolveAdaptiveTint(level, tier) })

test('标准档与没有档位时完全一致', () => {
  for (const tier of TIERS) assert.deepEqual(resolveAdaptiveTint('standard', tier), { tier })
})

test('弱 / 强逐档放宽 / 收紧：对比度和底膜上限都单调，前景极性不变', () => {
  for (const [polarity, foreground] of Object.entries(FOREGROUNDS)) {
    for (const tier of TIERS) {
      const [low, standard, high] = LEVELS.map((level) => goalOf(level, tier, foreground))
      assert.ok(low.contrast < standard.contrast && standard.contrast < high.contrast, `${polarity}/${tier} 对比度应递增`)
      assert.ok(low.policy.filmMax <= standard.policy.filmMax && standard.policy.filmMax <= high.policy.filmMax, `${polarity}/${tier} 底膜上限不应回退`)
      for (const goal of [low, standard, high]) assert.equal(goal.polarity, polarity)
    }
  }
})

test('两端没有下一档时只调对比度，tier 不越界', () => {
  assert.deepEqual(resolveAdaptiveTint('low', 'clear'), { tier: 'clear', contrast: LEGIBILITY_POLICIES.clear.contrast * 0.75 })
  assert.deepEqual(resolveAdaptiveTint('high', 'legible'), { tier: 'legible', contrast: LEGIBILITY_POLICIES.legible.contrast * 1.3 })
  assert.deepEqual(resolveAdaptiveTint('high', 'clear'), { tier: 'regular' })
  assert.deepEqual(resolveAdaptiveTint('low', 'legible'), { tier: 'regular' })
})
