/** 0–1 的 RGB */
export type Rgb = [number, number, number]
export interface Swatch {
  rgb: Rgb
  /** 在画面里的分量，各色之和为 1 */
  weight: number
}

const luma = ([r, g, b]: Rgb) => 0.2126 * r + 0.7152 * g + 0.0722 * b
const dist = (a: Rgb, b: Rgb) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
const mixRgb = (a: Rgb, b: Rgb, k: number): Rgb => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]
const MAX_LUMA = 0.72
/** 补出的变体之间至少差这么多，否则流动时看着像同一块颜色 */
const MIN_GAP = 0.1
const cap = (rgb: Rgb): Rgb => {
  const l = luma(rgb)
  return l > MAX_LUMA ? mixRgb(rgb, [0, 0, 0], 1 - MAX_LUMA / l) : rgb
}

/**
 * 从封面像素（RGBA）里取 n 种主色，给首页动态背景用。
 * 第一种是面积最大的颜色；之后按「面积 × 鲜艳度」挑与已选颜色差得够远的，
 * 让背景既有封面的主调，又不会被大片留白或线稿灰压成单色。
 * 封面颜色不够时用已有颜色的明暗变体补齐，保证色块之间始终有层次。
 * 结果按亮度从暗到亮排序，换封面时同序号的颜色互相过渡更自然。
 */
export function extractPalette(px: ArrayLike<number>, n = 4): Swatch[] {
  // 每通道量化成 16 级，统计每个格子的像素数与颜色和
  const buckets = new Map<number, { count: number; r: number; g: number; b: number }>()
  let total = 0
  for (let i = 0; i + 3 < px.length; i += 4) {
    if (px[i + 3] < 128) continue
    const key = ((px[i] >> 4) << 8) | ((px[i + 1] >> 4) << 4) | (px[i + 2] >> 4)
    const s = buckets.get(key) ?? { count: 0, r: 0, g: 0, b: 0 }
    s.count++
    s.r += px[i]
    s.g += px[i + 1]
    s.b += px[i + 2]
    buckets.set(key, s)
    total++
  }
  if (!total) return Array.from({ length: n }, () => ({ rgb: [0.04, 0.04, 0.05] as Rgb, weight: 1 / n }))

  const cands = [...buckets.values()].map((s) => {
    const rgb: Rgb = [s.r / s.count / 255, s.g / s.count / 255, s.b / s.count / 255]
    const chroma = Math.max(...rgb) - Math.min(...rgb)
    return { rgb, share: s.count / total, score: (s.count / total) * (0.2 + chroma) }
  })
  cands.sort((a, b) => b.share - a.share)
  const picked = [cands[0]]
  const rest = cands.slice(1).sort((a, b) => b.score - a.score)
  for (const c of rest) {
    if (picked.length >= n) break
    if (picked.every((p) => dist(p.rgb, c.rgb) > 0.22)) picked.push(c)
  }
  // 相近颜色的面积并入最近的已选颜色，面积比例才反映真实观感
  const share = picked.map(() => 0)
  for (const c of cands) {
    let best = 0
    for (let j = 1; j < picked.length; j++) if (dist(c.rgb, picked[j].rgb) < dist(c.rgb, picked[best].rgb)) best = j
    share[best] += c.share
  }

  // 大片留白会把背景冲成一片灰白、压住文字，亮度封顶
  const out: Swatch[] = picked.map((p, i) => ({ rgb: cap(p.rgb), weight: share[i] }))
  // 颜色不够时交替补一深一浅的变体，每轮加大程度。纯黑再压暗、纯白提亮（封顶后）都还是原色，
  // 和已有颜色太近的跳过，换另一个方向继续补，保证色块之间始终有层次
  for (let i = 0; out.length < n; i++) {
    const base = out[i % picked.length]
    const round = Math.floor(i / 2)
    const dark = i % 2 === 0
    const rgb = cap(dark ? mixRgb(base.rgb, [0, 0, 0], Math.min(1, 0.4 + 0.25 * round)) : mixRgb(base.rgb, [1, 1, 1], Math.min(1, 0.25 + 0.2 * round)))
    // 几轮之后两个方向都到头了，就不再挑剔，按亮度阶梯硬补
    const forced = round >= 6
    if (!forced && out.some((s) => dist(s.rgb, rgb) < MIN_GAP)) continue
    base.weight *= 0.6
    out.push({ rgb: forced ? cap(mixRgb([0, 0, 0], [1, 1, 1], out.length / n)) : rgb, weight: base.weight * 0.6 })
  }

  // 面积开方后再归一，避免主色独占画面
  for (const s of out) s.weight = Math.sqrt(s.weight)
  const sum = out.reduce((a, s) => a + s.weight, 0)
  for (const s of out) s.weight /= sum
  out.sort((a, b) => luma(a.rgb) - luma(b.rgb))
  // 颜色明暗太接近时色块流动看不出来：把最暗的压暗、最亮的提亮，拉开至少 0.3 的亮度差
  const spread = luma(out[n - 1].rgb) - luma(out[0].rgb)
  if (spread < 0.3) {
    const gap = 0.3 - spread
    out[0].rgb = mixRgb(out[0].rgb, [0, 0, 0], Math.min(0.8, gap / Math.max(luma(out[0].rgb), 0.01) / 2))
    const top = luma(out[n - 1].rgb)
    out[n - 1].rgb = mixRgb(out[n - 1].rgb, [1, 1, 1], Math.min(0.6, gap / 2 / Math.max(1 - top, 0.01)))
  }
  return out
}
