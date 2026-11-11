import assert from 'node:assert/strict'
import test from 'node:test'
import {
  computeAdaptiveTint,
  sampleFromSwatches,
  adaptiveTone,
} from '../src/design/adaptiveTone.ts'

test('sampleFromSwatches: 安全回退测试（空/空数组/无权重）', () => {
  for (const empty of [null, undefined, []]) {
    const s = sampleFromSwatches(empty)
    assert.ok(s.luminance >= 0 && s.luminance <= 1)
    assert.equal(s.texture, 0)
    assert.deepEqual(s.color, [0.04, 0.04, 0.05])
    assert.deepEqual(s.dominantColor, [0.04, 0.04, 0.05])
  }
})

test('sampleFromSwatches: 单一纯黑与纯白色块采样', () => {
  const black = sampleFromSwatches([{ rgb: [0, 0, 0], weight: 1 }])
  assert.equal(black.luminance, 0)
  assert.equal(black.texture, 0)
  assert.deepEqual(black.color, [0, 0, 0])
  assert.deepEqual(black.dominantColor, [0, 0, 0])

  const white = sampleFromSwatches([{ rgb: [1, 1, 1], weight: 1 }])
  assert.equal(white.luminance, 1)
  assert.equal(white.texture, 0)
  assert.deepEqual(white.color, [1, 1, 1])
  assert.deepEqual(white.dominantColor, [1, 1, 1])
})

test('sampleFromSwatches: 多主色加权平均与主导色提取', () => {
  const swatches = [
    { rgb: [0.8, 0.2, 0.2], weight: 0.6 },
    { rgb: [0.2, 0.8, 0.2], weight: 0.3 },
    { rgb: [0.2, 0.2, 0.8], weight: 0.1 },
  ]
  const sample = sampleFromSwatches(swatches)
  assert.deepEqual(sample.dominantColor, [0.8, 0.2, 0.2])
  assert.ok(sample.luminance > 0 && sample.luminance < 1)
  assert.ok(sample.color[0] > sample.color[1] && sample.color[0] > sample.color[2])
})

test('sampleFromSwatches: 极大明暗落差激发高纹理指数（texture）', () => {
  // 黑白对半切，极大对比与离散度
  const checker = sampleFromSwatches([
    { rgb: [0, 0, 0], weight: 0.5 },
    { rgb: [1, 1, 1], weight: 0.5 },
  ])
  assert.ok(checker.texture >= 0.7, `预期高杂色/纹理，实际: ${checker.texture}`)
})

test('sampleFromSwatches: 容错处理 0-255 范围输入与异常权重', () => {
  const sample = sampleFromSwatches([{ rgb: [255, 128, 0], weight: 1 }])
  assert.ok(sample.color[0] <= 1 && sample.color[1] <= 1 && sample.color[2] <= 1)
  assert.ok(sample.dominantColor[0] <= 1)

  const negativeWeight = sampleFromSwatches([{ rgb: [0.5, 0.5, 0.5], weight: -5 }])
  assert.ok(Number.isFinite(negativeWeight.luminance))
  assert.ok(Number.isFinite(negativeWeight.texture))
})

test('深色模式：深色背景保持基线底色，普通易读性', () => {
  const darkSample = { luminance: 0.05, texture: 0, color: [0.05, 0.05, 0.05] }
  const out = computeAdaptiveTint(darkSample, 'dark', 20)
  assert.equal(out.tint, 20)
  assert.equal(out.delta, 0)
  assert.equal(out.legibilityLevel, 'normal')
  assert.equal(out.saturate, 1.6)
})

test('深色模式：浅色/白色极端背景大幅加深底色以保护浅色文字', () => {
  const whiteSample = { luminance: 0.95, texture: 0, color: [0.95, 0.95, 0.95] }
  const out = computeAdaptiveTint(whiteSample, 'dark', 20)
  assert.ok(out.tint >= 80, `预期深色模式遇纯白背景 tint >= 80%，实际: ${out.tint}%`)
  assert.equal(out.legibilityLevel, 'high-contrast')
  assert.ok(out.delta > 50)
  assert.ok(out.saturate < 1.45)
})

test('深色模式：WCAG AA 对比度底线验算', () => {
  // 深色模式下，文字为浅白色（L_text ≈ 0.95）。
  // 对比度公式: (L_text + 0.05) / (L_eff + 0.05) >= 4.5:1
  // 检验各个中高亮度下，自适应后的有效透过亮度 L_eff 是否满足 WCAG AA
  const textLuma = 0.95
  for (const bgLuma of [0.4, 0.6, 0.8, 0.95]) {
    const out = computeAdaptiveTint({ luminance: bgLuma, texture: 0, color: [bgLuma, bgLuma, bgLuma] }, 'dark', 20)
    const effectiveBg = bgLuma * (1 - out.tint / 100)
    const contrastRatio = (textLuma + 0.05) / (effectiveBg + 0.05)
    assert.ok(contrastRatio >= 4.5, `背景亮度 ${bgLuma} 下对比度 ${contrastRatio.toFixed(2)} 应 >= 4.5`)
  }
})

test('深色模式：随着背景亮度增加，底色浓度单调不减', () => {
  const baseTint = 20
  let prevTint = baseTint
  for (let luma = 0.1; luma <= 0.95; luma += 0.15) {
    const s = { luminance: luma, texture: 0, color: [luma, luma, luma] }
    const out = computeAdaptiveTint(s, 'dark', baseTint)
    assert.ok(out.tint >= prevTint - 0.01, `亮度 ${luma} 时的 tint ${out.tint} 应不低于 ${prevTint}`)
    prevTint = out.tint
  }
})

test('浅色模式：浅色背景保持基线底色，普通易读性', () => {
  const lightSample = { luminance: 0.9, texture: 0, color: [0.9, 0.9, 0.9] }
  const out = computeAdaptiveTint(lightSample, 'light', 50)
  assert.equal(out.tint, 50)
  assert.equal(out.delta, 0)
  assert.equal(out.legibilityLevel, 'normal')
})

test('浅色模式：纯黑极端背景大幅提亮底色以保护深色文字', () => {
  const blackSample = { luminance: 0.02, texture: 0, color: [0.02, 0.02, 0.02] }
  const out = computeAdaptiveTint(blackSample, 'light', 50)
  assert.ok(out.tint >= 80, `预期浅色模式遇纯黑背景 tint >= 80%，实际: ${out.tint}%`)
  assert.equal(out.legibilityLevel, 'high-contrast')
  assert.ok(out.delta > 25)
})

test('浅色模式：WCAG AA 对比度底线验算', () => {
  // 浅色模式下，文字为深黑（L_text ≈ 0.05）。
  // 对比度公式: (L_eff + 0.05) / (L_text + 0.05) >= 4.5:1
  const textLuma = 0.05
  for (const bgLuma of [0.0, 0.1, 0.2, 0.3]) {
    const out = computeAdaptiveTint({ luminance: bgLuma, texture: 0, color: [bgLuma, bgLuma, bgLuma] }, 'light', 20)
    // 浅色模式底色为近白色（L ≈ 1.0）
    const effectiveBg = bgLuma * (1 - out.tint / 100) + 1.0 * (out.tint / 100)
    const contrastRatio = (effectiveBg + 0.05) / (textLuma + 0.05)
    assert.ok(contrastRatio >= 4.5, `背景亮度 ${bgLuma} 下对比度 ${contrastRatio.toFixed(2)} 应 >= 4.5`)
  }
})

test('高纹理/复杂杂色补偿：杂色增加底色以抑制视觉干扰', () => {
  const smooth = { luminance: 0.2, texture: 0.0, color: [0.2, 0.2, 0.2] }
  const busy = { luminance: 0.2, texture: 0.8, color: [0.2, 0.2, 0.2] }

  const outSmooth = computeAdaptiveTint(smooth, 'dark', 20)
  const outBusy = computeAdaptiveTint(busy, 'dark', 20)

  assert.ok(outBusy.tint > outSmooth.tint + 10, `高纹理应显著提升底色: busy=${outBusy.tint}, smooth=${outSmooth.tint}`)
  assert.ok(['boosted', 'high-contrast'].includes(outBusy.legibilityLevel))
})

test('密集控件补偿（dense: true）', () => {
  const sample = { luminance: 0.3, texture: 0.2, color: [0.3, 0.3, 0.3] }
  const normal = computeAdaptiveTint(sample, 'dark', 20, undefined, { dense: false })
  const dense = computeAdaptiveTint(sample, 'dark', 20, undefined, { dense: true })

  assert.ok(dense.tint > normal.tint, `密集模式应略微提升底色: dense=${dense.tint}, normal=${normal.tint}`)
})

test('滞后量与微小波动阈值过滤（Hysteresis）', () => {
  const sample = { luminance: 0.5, texture: 0, color: [0.5, 0.5, 0.5] }
  const initial = computeAdaptiveTint(sample, 'dark', 20)
  const exactTint = initial.tint

  // 1. 微小波动（< 1.5% 默认阈值）：保持 previousTint，delta 为 0
  const jitterSample = { luminance: 0.505, texture: 0, color: [0.505, 0.505, 0.505] }
  const jittered = computeAdaptiveTint(jitterSample, 'dark', 20, exactTint)
  assert.equal(jittered.tint, exactTint, '波动小于 1.5% 时保持原有 tint')
  assert.equal(jittered.delta, 0)

  // 2. 明显跳变（>= 1.5%）：更新并计算实际 delta
  const jumpSample = { luminance: 0.8, texture: 0, color: [0.8, 0.8, 0.8] }
  const jumped = computeAdaptiveTint(jumpSample, 'dark', 20, exactTint)
  assert.notEqual(jumped.tint, exactTint)
  assert.equal(jumped.delta, Math.round((jumped.tint - exactTint) * 10) / 10)

  // 3. 自定义 threshold
  const customThresholdOut = computeAdaptiveTint(jumpSample, 'dark', 20, exactTint, { threshold: 50 })
  assert.equal(customThresholdOut.tint, exactTint, '大阈值下过滤大跳变')
})

test('边界钳位与基准底线（Bounds Clamping）', () => {
  // baseTint 必须作为基准底线
  const sample = { luminance: 0.01, texture: 0, color: [0.01, 0.01, 0.01] }
  const outHighBase = computeAdaptiveTint(sample, 'dark', 40)
  assert.equal(outHighBase.tint, 40, '不能低于设置的 baseTint 基准')

  // 超出舒适上限（85%）必须封顶
  const extremeWhite = { luminance: 1.0, texture: 1.0, color: [1, 1, 1] }
  const outExtreme = computeAdaptiveTint(extremeWhite, 'dark', 20, undefined, { dense: true })
  assert.equal(outExtreme.tint, 85, '上限严格封顶在 85%')

  // 极低 baseTint 钳位至舒适下限 10%
  const outLowBase = computeAdaptiveTint(sample, 'dark', 0)
  assert.equal(outLowBase.tint, 10, '下限严格限制在 10%')

  // 极高 baseTint 钳位至上限 85%
  const outOverBase = computeAdaptiveTint(sample, 'dark', 99)
  assert.equal(outOverBase.tint, 85)
})

test('容错与缺省回退安全', () => {
  // null / undefined 采样
  const fallbackNull = computeAdaptiveTint(null, 'dark', 25)
  assert.equal(fallbackNull.tint, 25)
  assert.equal(fallbackNull.legibilityLevel, 'normal')
  assert.equal(fallbackNull.delta, 0)
  assert.equal(fallbackNull.saturate, 1.6)

  // 缺少参数时默认值正确（深色 20，浅色 50）
  const fallbackDark = computeAdaptiveTint(null)
  assert.equal(fallbackDark.tint, 20)

  const fallbackLight = computeAdaptiveTint(null, 'light')
  assert.equal(fallbackLight.tint, 50)

  // NaN 或非法数值容错
  const nanSample = { luminance: NaN, texture: NaN, color: [NaN, NaN, NaN] }
  const nanOut = computeAdaptiveTint(nanSample, 'dark', 20)
  assert.ok(Number.isFinite(nanOut.tint))
  assert.ok(Number.isFinite(nanOut.delta))

  // 第 4 参数传递 options 对象形式
  const optForm = computeAdaptiveTint(null, 'dark', 20, { dense: true })
  assert.equal(optForm.tint, 20)

  // 别名导出 adaptiveTone
  assert.equal(adaptiveTone, computeAdaptiveTint)
})
