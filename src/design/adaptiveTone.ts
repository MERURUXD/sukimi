/**
 * 自适应玻璃底色与对比度保护算法。
 * 基于 kubai087/glasswork adapt.js 与 Lumno 动态玻璃着色理念设计：
 * - 纯函数设计，无 DOM/GPU 读回开销，仅依赖轻量调色板与背景亮度采样
 * - 满足 WCAG AA 级文字对比度下限（tintFloor）
 * - 深色模式下遇浅色背景自动加深底色，保护浅色文字
 * - 浅色模式下遇深色背景自动提亮底色，保护深色文字
 * - 纹理与杂色扩散度（texture）增大时补偿底色，抑制高频噪点干扰
 * - 滞后量与微小变化阈值（Hysteresis & threshold），防止频繁微小抖动
 * - 舒适区间封顶与底线保护（10%–85%）
 */

export type GlassTheme = 'light' | 'dark'

export type Rgb = [number, number, number]

export interface Swatch {
  rgb: Rgb
  /** 在画面里的分量，各色之和为 1 */
  weight: number
}

export interface BackgroundToneSample {
  /** 背景加权感知亮度 (0–1) */
  luminance: number
  /** 背景杂色 / 纹理对比度扩散度 (0–1) */
  texture: number
  /** 平均背景色 (0–1 RGB) */
  color: Rgb
  /** 面积最大的主导色 */
  dominantColor?: Rgb
  /** 采样用的调色板色样 */
  swatches?: Swatch[]
}

export interface AdaptiveToneOptions {
  /** 是否为浮在内容上的密集控件（如操作栏、胶囊按钮） */
  dense?: boolean
  /** 变化阈值（%），低于该阈值的微小变化保持上一次值（默认 1.5%） */
  threshold?: number
}

export type LegibilityLevel = 'normal' | 'boosted' | 'high-contrast'

export interface AdaptiveToneOutput {
  /** 建议的玻璃底色浓度 (0–100)，已钳位至舒适区间 */
  tint: number
  /** 建议的玻璃饱和度调节 (如 1.1–2.0) */
  saturate?: number
  /** 易读性等级：普通 / 增强 / 高对比 */
  legibilityLevel: LegibilityLevel
  /** 相比 previousTint（若无则相比 baseTint）的变化量 */
  delta: number
}

const MIN_TINT = 10
const MAX_TINT = 85
const DEFAULT_THRESHOLD = 1.5

/**
 * 辅助函数：根据封面/背景的 Swatch 调色板生成 BackgroundToneSample 样本
 */
export function sampleFromSwatches(swatches?: Swatch[] | null): BackgroundToneSample {
  if (!swatches || !Array.isArray(swatches) || swatches.length === 0) {
    return {
      luminance: 0.05,
      texture: 0,
      color: [0.04, 0.04, 0.05],
      dominantColor: [0.04, 0.04, 0.05],
      swatches: [],
    }
  }

  let totalWeight = 0
  for (const s of swatches) {
    totalWeight += Math.max(0, s.weight || 0)
  }
  if (totalWeight <= 0) totalWeight = 1

  let sumR = 0
  let sumG = 0
  let sumB = 0
  let sumLuma = 0
  let minLuma = 1
  let maxLuma = 0

  let dominant = swatches[0]
  let maxWeight = -1

  const lumas: { luma: number; w: number }[] = []

  for (const s of swatches) {
    const rawR = s.rgb?.[0] ?? 0
    const rawG = s.rgb?.[1] ?? 0
    const rawB = s.rgb?.[2] ?? 0

    const r = rawR > 1 ? rawR / 255 : Math.max(0, rawR)
    const g = rawG > 1 ? rawG / 255 : Math.max(0, rawG)
    const b = rawB > 1 ? rawB / 255 : Math.max(0, rawB)

    const w = Math.max(0, s.weight || 0) / totalWeight
    const l = 0.2126 * r + 0.7152 * g + 0.0722 * b

    sumR += r * w
    sumG += g * w
    sumB += b * w
    sumLuma += l * w

    if (l < minLuma) minLuma = l
    if (l > maxLuma) maxLuma = l

    lumas.push({ luma: l, w })

    if ((s.weight || 0) > maxWeight) {
      maxWeight = s.weight || 0
      dominant = s
    }
  }

  // 计算亮度方差与标准差，用于杂色/纹理扩散度估计
  let variance = 0
  for (const { luma, w } of lumas) {
    variance += w * Math.pow(luma - sumLuma, 2)
  }
  const stdDev = Math.sqrt(variance)
  const spread = maxLuma >= minLuma ? maxLuma - minLuma : 0
  // 结合明暗落差与离散度得出综合杂色指数 (0–1)
  const texture = Math.min(1, Math.max(0, 0.5 * spread + stdDev))

  const domR = dominant.rgb?.[0] ?? sumR
  const domG = dominant.rgb?.[1] ?? sumG
  const domB = dominant.rgb?.[2] ?? sumB
  const dominantColor: Rgb = [
    domR > 1 ? domR / 255 : Math.max(0, domR),
    domG > 1 ? domG / 255 : Math.max(0, domG),
    domB > 1 ? domB / 255 : Math.max(0, domB),
  ]

  return {
    luminance: Math.min(1, Math.max(0, sumLuma)),
    texture,
    color: [sumR, sumG, sumB],
    dominantColor,
    swatches,
  }
}

export interface AdaptiveToneConfig {
  sample?: BackgroundToneSample | null
  theme?: GlassTheme
  baseTint?: number
  previousTint?: number | null
  options?: AdaptiveToneOptions
}

/**
 * 纯函数计算自适应玻璃底色浓度与对比度保护。
 * 支持两种调用形态：
 * 1. 位置参数：computeAdaptiveTint(sample, theme, baseTint, previousTint, options)
 * 2. 对象参数：computeAdaptiveTint({ sample, theme, baseTint, previousTint, options })
 */
export function computeAdaptiveTint(
  sampleOrConfig?: BackgroundToneSample | AdaptiveToneConfig | null,
  themeArg: GlassTheme = 'dark',
  baseTintArg?: number,
  previousTintOrOptions?: number | AdaptiveToneOptions,
  rawOptions?: AdaptiveToneOptions
): AdaptiveToneOutput {
  let sample: BackgroundToneSample | null | undefined
  let theme: GlassTheme = themeArg
  let baseTint: number | undefined = baseTintArg
  let previousTint: number | undefined
  let options: AdaptiveToneOptions | undefined

  if (
    sampleOrConfig != null &&
    typeof sampleOrConfig === 'object' &&
    'sample' in sampleOrConfig &&
    !('luminance' in sampleOrConfig)
  ) {
    const config = sampleOrConfig as AdaptiveToneConfig
    sample = config.sample
    theme = config.theme ?? themeArg
    baseTint = config.baseTint ?? baseTintArg
    previousTint = config.previousTint != null && Number.isFinite(config.previousTint) ? config.previousTint : undefined
    options = config.options
  } else {
    sample = sampleOrConfig as BackgroundToneSample | null | undefined
    if (typeof previousTintOrOptions === 'number') {
      previousTint = previousTintOrOptions
      options = rawOptions
    } else if (typeof previousTintOrOptions === 'object' && previousTintOrOptions !== null) {
      options = previousTintOrOptions
      previousTint = undefined
    } else {
      options = rawOptions
    }
  }

  const defaultBase = theme === 'light' ? 50 : 20
  const effectiveBase = typeof baseTint === 'number' && Number.isFinite(baseTint) ? baseTint : defaultBase
  const threshold = options?.threshold ?? DEFAULT_THRESHOLD
  const dense = Boolean(options?.dense)

  // 回退：缺少采样数据时保留基础底色
  if (!sample) {
    const clamped = Math.max(MIN_TINT, Math.min(MAX_TINT, effectiveBase))
    const delta = previousTint != null && Number.isFinite(previousTint)
      ? Math.round((clamped - previousTint) * 10) / 10
      : 0
    return {
      tint: clamped,
      saturate: 1.6,
      legibilityLevel: 'normal',
      delta,
    }
  }

  const luma = Math.min(1, Math.max(0, Number.isFinite(sample.luminance) ? sample.luminance : 0.05))
  const texture = Math.min(1, Math.max(0, Number.isFinite(sample.texture) ? sample.texture : 0))

  let contrastTint = effectiveBase

  if (theme === 'dark') {
    // 深色模式：浅色文字（L_text ≈ 0.95）。
    // 背景越亮，对比度越低。根据 WCAG AA 4.5:1 要求，有效背景亮度需低于 0.172。
    // L_eff = L_bg * (1 - tint/100) <= 0.172  =>  tintFloor = (1 - 0.172 / L_bg) * 100
    if (luma > 0.18) {
      const tintFloor = Math.max(0, (1 - 0.172 / Math.max(0.01, luma)) * 100)
      const lumaExcess = (luma - 0.18) / 0.82
      const darkDemand = lumaExcess * 45
      contrastTint = Math.max(effectiveBase, tintFloor, effectiveBase + darkDemand)
    }
  } else {
    // 浅色模式：深色文字（L_text ≈ 0.05）。
    // 背景越暗，对比度越低。根据 WCAG AA 4.5:1 要求，有效背景亮度需高于 0.40。
    // L_eff = L_bg * (1 - tint/100) + 1.0 * (tint/100) >= 0.40 => tintFloor = (0.40 - L_bg) / (1 - L_bg) * 100
    if (luma < 0.65) {
      const tintFloor = Math.max(0, ((0.40 - luma) / Math.max(0.01, 1 - luma)) * 100)
      const lumaDeficit = (0.65 - luma) / 0.65
      const lightDemand = lumaDeficit * 35
      contrastTint = Math.max(effectiveBase, tintFloor, effectiveBase + lightDemand)
    }
  }

  // 纹理与杂色扩散度补偿（抑制高频视觉干扰）
  const textureBoost = texture * 20

  // 密集控件补偿
  const denseBoost = dense ? 8 : 0

  const candidateTint = contrastTint + textureBoost + denseBoost

  // 边界约束：baseTint 为基准底线，输出钳位到舒适区间 [10, 85]
  const minClamp = Math.max(MIN_TINT, Math.min(MAX_TINT, effectiveBase))
  const maxClamp = MAX_TINT
  let clampedTint = Math.max(minClamp, Math.min(maxClamp, candidateTint))
  clampedTint = Math.round(clampedTint * 10) / 10

  // 滞后量与微小波动阈值过滤
  let finalTint = clampedTint
  let delta = 0

  if (previousTint != null && Number.isFinite(previousTint)) {
    if (Math.abs(clampedTint - previousTint) < threshold) {
      finalTint = previousTint
      delta = 0
    } else {
      delta = Math.round((finalTint - previousTint) * 10) / 10
    }
  } else {
    delta = Math.round((finalTint - effectiveBase) * 10) / 10
  }

  // 易读性等级判定
  let legibilityLevel: LegibilityLevel = 'normal'
  const tintBoost = finalTint - effectiveBase
  if (
    finalTint >= 65 ||
    tintBoost >= 25 ||
    (theme === 'dark' && luma >= 0.75) ||
    (theme === 'light' && luma <= 0.20)
  ) {
    legibilityLevel = 'high-contrast'
  } else if (
    tintBoost >= 6 ||
    texture >= 0.35 ||
    dense ||
    (theme === 'dark' && luma >= 0.35) ||
    (theme === 'light' && luma <= 0.50)
  ) {
    legibilityLevel = 'boosted'
  }

  // 随 tint 适度微调饱和度，高浓度下略微收敛避免色彩过溢
  const saturate = Math.round(Math.max(1.1, Math.min(2.0, 1.6 - (finalTint - 20) * 0.004)) * 100) / 100

  return {
    tint: finalTint,
    saturate,
    legibilityLevel,
    delta,
  }
}

export const adaptiveTone = computeAdaptiveTint
export default computeAdaptiveTint
