import { extractPalette, type Rgb } from './palette'

/** 取不到颜色时的中性灰 */
export const NEUTRAL: Rgb = [0.2, 0.2, 0.22]

const SAMPLE = 24
const cache = new Map<string, Promise<Rgb>>()

const chroma = (rgb: Rgb) => Math.max(...rgb) - Math.min(...rgb)

/**
 * 封面的主色（0–1 的 RGB），给画廊的背景光晕和详情底色用。
 * 照 CoverFlow 的做法把封面画到小画布上取像素，在主色里挑「面积 × 鲜艳度」最高的一种。
 * 按图片地址缓存；封面与页面同源，可以读像素，读不了（跨域、加载失败）时退回中性灰。
 */
export function coverColor(url: string | null | undefined): Promise<Rgb> {
  if (!url) return Promise.resolve(NEUTRAL)
  let p = cache.get(url)
  if (!p) {
    p = new Promise<Rgb>((resolve) => {
      const img = new Image()
      img.decoding = 'async'
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas')
          canvas.width = canvas.height = SAMPLE
          const ctx = canvas.getContext('2d', { willReadFrequently: true })
          if (!ctx) return resolve(NEUTRAL)
          ctx.drawImage(img, 0, 0, SAMPLE, SAMPLE)
          const swatches = extractPalette(ctx.getImageData(0, 0, SAMPLE, SAMPLE).data, 4)
          const best = swatches.reduce((a, b) => (b.weight * (0.25 + chroma(b.rgb)) > a.weight * (0.25 + chroma(a.rgb)) ? b : a))
          resolve(best.rgb)
        } catch {
          resolve(NEUTRAL)
        }
      }
      img.onerror = () => resolve(NEUTRAL)
      img.src = url
    })
    cache.set(url, p)
  }
  return p
}

export const rgbCss = ([r, g, b]: Rgb, a = 1) => `rgb(${Math.round(r * 255)} ${Math.round(g * 255)} ${Math.round(b * 255)} / ${a})`
