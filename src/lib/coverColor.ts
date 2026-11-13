import { waitUntilAuthChecked } from '@/api/auth'
import { extractPalette, type Rgb, type Swatch } from './palette'

export type { Rgb, Swatch }

/** 取不到颜色时的中性灰 */
export const NEUTRAL: Rgb = [0.2, 0.2, 0.22]

/** 取不到颜色时的中性灰色板 */
export const NEUTRAL_SWATCHES: Swatch[] = Array.from({ length: 4 }, () => ({
  rgb: NEUTRAL,
  weight: 0.25,
}))

const SAMPLE = 24
const paletteCache = new Map<string, Promise<Swatch[]>>()

const chroma = (rgb: Rgb) => Math.max(...rgb) - Math.min(...rgb)

/**
 * 封面的色板（0–1 的 RGB 列表，包含权重），给自适应玻璃色调和背景渐变用。
 * 把封面画到小画布上提取主色。按图片地址缓存 Promise，确保同张封面只加载和提取一次。
 * 读不了（跨域、加载失败、URL 为空）时退回中性灰色板。
 */
export function coverPalette(url: string | null | undefined): Promise<Swatch[]> {
  if (!url) return Promise.resolve(NEUTRAL_SWATCHES)
  const cached = paletteCache.get(url)
  if (cached) return cached
  if (typeof Image === 'undefined' || typeof document === 'undefined') {
    return Promise.resolve(NEUTRAL_SWATCHES)
  }
  const p = waitUntilAuthChecked().then((ready) => {
    if (!ready) {
      if (paletteCache.get(url) === p) paletteCache.delete(url)
      return NEUTRAL_SWATCHES
    }
    return new Promise<Swatch[]>((resolve) => {
      const img = new Image()
      img.decoding = 'async'
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas')
          canvas.width = canvas.height = SAMPLE
          const ctx = canvas.getContext('2d', { willReadFrequently: true })
          if (!ctx) return resolve(NEUTRAL_SWATCHES)
          ctx.drawImage(img, 0, 0, SAMPLE, SAMPLE)
          const swatches = extractPalette(ctx.getImageData(0, 0, SAMPLE, SAMPLE).data, 4)
          resolve(swatches)
        } catch {
          resolve(NEUTRAL_SWATCHES)
        }
      }
      img.onerror = () => {
        if (paletteCache.get(url) === p) paletteCache.delete(url)
        resolve(NEUTRAL_SWATCHES)
      }
      img.src = url
    })
  })
  paletteCache.set(url, p)
  return p
}

/**
 * 封面的主色（0–1 的 RGB），给画廊的背景光晕和详情底色用。
 * 复用 coverPalette 的色板结果，在主色里挑「面积 × 鲜艳度」最高的一种。
 * 按图片地址缓存；封面与页面同源，可以读像素，读不了（跨域、加载失败）时退回中性灰。
 */
export function coverColor(url: string | null | undefined): Promise<Rgb> {
  if (!url) return Promise.resolve(NEUTRAL)
  return coverPalette(url).then((swatches) => {
    if (!swatches.length) return NEUTRAL
    const best = swatches.reduce(
      (a, b) => (b.weight * (0.25 + chroma(b.rgb)) > a.weight * (0.25 + chroma(a.rgb)) ? b : a),
      swatches[0],
    )
    return best?.rgb ?? NEUTRAL
  })
}

export const rgbCss = ([r, g, b]: Rgb, a = 1) => `rgb(${Math.round(r * 255)} ${Math.round(g * 255)} ${Math.round(b * 255)} / ${a})`
