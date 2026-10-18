import { useSyncExternalStore } from 'react'
import { rememberAspect } from './pageCache'
import { FULL, contentBox, halfBox, type Box, type Half } from './pageTools'

/**
 * 裁白边、拆半页后的图片。处理在浏览器里完成：用画布读出原图像素找白边，
 * 再把要显示的部分画成一张新图（Blob 地址），阅读器拿它当 <img> 的地址，排版和缩放都不用改。
 * 页面图片与前端同源（Cookie 鉴权），画布读像素不受跨域限制；读不了或图太大时退回原图。
 */
export interface Variant {
  crop: boolean
  /** 拆分宽页时显示哪一半；不拆为 undefined */
  half?: Half
  rtl: boolean
}

/** 检测白边时先缩到这么宽，几毫秒就能扫完 */
const SAMPLE = 200
/** 画布超过这么多像素不处理：手机浏览器画布有面积上限，超长条漫画也没必要裁 */
const MAX_PIXELS = 16_000_000
/** 处理结果最多留这么多张，旧的释放掉 */
const KEEP = 60
/** 原图对象只留最近几张（同一页的两半、裁与不裁要用），整页解码后的位图很占内存 */
const KEEP_SOURCES = 12

const keyOf = (url: string, v: Variant) => `${v.crop ? 'c' : ''}${v.half === undefined ? '' : `h${v.half}${v.rtl ? 'r' : 'l'}`}|${url}`

/** 原图与白边检测结果，同一张图的两半、裁与不裁共用 */
const sources = new Map<string, Promise<{ img: HTMLImageElement; box: Box | null } | null>>()
/** 处理好的图：Blob 地址，或 null（处理不了，用原图） */
const done = new Map<string, string | null>()
const running = new Set<string>()
let version = 0
const listeners = new Set<() => void>()
const notify = () => {
  version++
  for (const l of listeners) l()
}

function load(url: string) {
  let p = sources.get(url)
  if (!p) {
    p = new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.decoding = 'async'
      img.onload = () => resolve(img)
      img.onerror = reject
      img.src = url
    })
      .then((img) => {
        rememberAspect(url, img)
        return { img, box: detect(img) }
      })
      .catch(() => null)
    sources.set(url, p)
    if (sources.size > KEEP_SOURCES) sources.delete(sources.keys().next().value!)
  }
  return p
}

function detect(img: HTMLImageElement): Box | null {
  const w = img.naturalWidth
  const h = img.naturalHeight
  if (!w || !h || w * h > MAX_PIXELS) return null
  const sw = Math.min(SAMPLE, w)
  const sh = Math.max(1, Math.round((h / w) * sw))
  const canvas = document.createElement('canvas')
  canvas.width = sw
  canvas.height = sh
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  ctx.drawImage(img, 0, 0, sw, sh)
  try {
    return contentBox(ctx.getImageData(0, 0, sw, sh).data, sw, sh)
  } catch {
    // 画布被跨域图片污染：不裁
    return null
  }
}

async function render(url: string, v: Variant): Promise<string | null> {
  const src = await load(url)
  if (!src) return null
  const { img, box } = src
  let area = v.crop && box ? box : FULL
  if (v.half !== undefined) area = halfBox(area, v.half, v.rtl)
  if (area === FULL) return null
  const w = img.naturalWidth
  const h = img.naturalHeight
  const sx = Math.round(area.left * w)
  const sy = Math.round(area.top * h)
  const sw = Math.max(1, Math.round((area.right - area.left) * w))
  const sh = Math.max(1, Math.round((area.bottom - area.top) * h))
  // 只看画出来的那部分：超大的双页扫描拆成两半后通常就在上限内
  if (sw * sh > MAX_PIXELS) return null
  const canvas = document.createElement('canvas')
  canvas.width = sw
  canvas.height = sh
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh)
  // WebP 体积小、编码快；不支持编码 WebP 的浏览器（Safari）会自动给出 PNG
  const blob = await new Promise<Blob | null>((resolve) => {
    try {
      canvas.toBlob(resolve, 'image/webp', 0.92)
    } catch {
      resolve(null)
    }
  })
  return blob ? URL.createObjectURL(blob) : null
}

/** 开始处理（已在处理或已完成则什么也不做） */
export function requestPage(url: string, v: Variant) {
  if (!v.crop && v.half === undefined) return
  const key = keyOf(url, v)
  if (done.has(key) || running.has(key)) return
  running.add(key)
  void render(url, v)
    .catch(() => null)
    .then((out) => {
      running.delete(key)
      done.set(key, out)
      // 只留最近的一批；被挤掉的 Blob 地址释放，正在显示的图已解码，不受影响
      while (done.size > KEEP) {
        const [oldKey, oldUrl] = done.entries().next().value!
        done.delete(oldKey)
        if (oldUrl) URL.revokeObjectURL(oldUrl)
      }
      notify()
    })
}

/**
 * 要显示的地址。不需要处理时就是原图；处理中（或还没开始）时：只裁白边先显示原图，
 * 拆半页返回 undefined（先显示整张再换成半张会闪），由调用方占位。
 */
export function pageSrc(url: string, v: Variant, start = true): string | undefined {
  if (!v.crop && v.half === undefined) return url
  const key = keyOf(url, v)
  if (!done.has(key)) {
    // start = false：离当前页还远，只看有没有现成结果，不开始处理（纵向模式一话的页一次全渲染出来）
    if (start) requestPage(url, v)
    if (v.half === undefined) return url
    // 拆半页处理中：如果有只拆不裁的结果也先不用，等这一份
    return undefined
  }
  const out = done.get(key)
  if (out) return out
  // 处理不了（读不了像素或太大）：裁白边退回原图；拆半页也只能退回整张
  return url
}

/** 这张宽页拆不了（读不了或太大）：调用方让它整页显示、不再分两屏，免得同一张整页看两遍 */
export const splitFailed = (url: string, v: Variant) => v.half !== undefined && done.get(keyOf(url, v)) === null

/** 首屏要等最终地址确定；处理失败或无需裁边时，原图就是最终结果。 */
export const pageReady = (url: string, v: Variant) => (!v.crop && v.half === undefined) || done.has(keyOf(url, v))

/** 处理结果变化时重新渲染 */
export function usePageImages() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => version,
  )
}
