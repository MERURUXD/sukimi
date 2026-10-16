/*
 * 阅读器的页面处理：裁白边、宽页拆分、图像滤镜与页面书签。
 * 这里只放纯逻辑（Node 测试直接导入），不依赖 DOM、React、Apollo 或路径别名。
 */

/** 宽高比超过这个值的页当作跨页大图（双页模式独占一屏、单页模式可拆成两半） */
export const WIDE = 1.1

/** 裁剪框，取值是占原图宽 / 高的比例（0–1） */
export interface Box {
  left: number
  top: number
  right: number
  bottom: number
}

export const FULL: Box = { left: 0, top: 0, right: 1, bottom: 1 }

/** 和底色差多少亮度算「有内容」 */
const TOLERANCE = 40
/** 一行 / 一列里有内容的像素超过这个比例，就不再算空白 */
const INK = 0.005
/** 裁完至少要留下原图的这么多，避免把整页几乎空白的页（扉页、留白页）裁成一条 */
const MIN_KEEP = 0.5
/** 一边裁不到这么多就不裁，免得只差一两个像素也换一张图 */
const MIN_CUT = 0.01
/** 裁到内容后往外留一点边，线稿不会贴着屏幕边缘 */
const MARGIN = 0.006

const lum = (px: ArrayLike<number>, i: number) => 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]

/** 底色只认接近白或接近黑的；彩色边框、渐变不当作白边 */
function background(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b)
  const median = sorted[sorted.length >> 1]
  return median >= 200 || median <= 50 ? median : null
}

/**
 * 找出页面四周的白边 / 黑边，返回内容所在的范围（比例）。没有可裁的边返回 null。
 * px 是 RGBA 像素（canvas getImageData 的 data），通常先缩小到一两百像素宽再检测。
 * 每条边各自判断底色，所以只有上下留白、或左右是黑边的页也能裁。
 */
export function contentBox(px: ArrayLike<number>, w: number, h: number): Box | null {
  if (w < 8 || h < 8) return null
  const at = (x: number, y: number) => lum(px, (y * w + x) * 4)
  const row = (y: number) => Array.from({ length: w }, (_, x) => at(x, y))
  const col = (x: number) => Array.from({ length: h }, (_, y) => at(x, y))
  const blank = (values: number[], bg: number) => values.filter((v) => Math.abs(v - bg) > TOLERANCE).length <= values.length * INK

  const scan = (count: number, line: (i: number) => number[], from: number, step: 1 | -1) => {
    const bg = background(line(from))
    if (bg === null) return 0
    let n = 0
    for (let i = from; n < count && blank(line(i), bg); i += step) n++
    return n
  }

  const top = scan(h, row, 0, 1)
  // 整页都是空白（纯色页）：不裁
  if (top >= h) return null
  const bottom = scan(h - top, row, h - 1, -1)
  const left = scan(w, col, 0, 1)
  const right = scan(w - left, col, w - 1, -1)

  let box: Box = {
    left: Math.max(0, left / w - MARGIN),
    top: Math.max(0, top / h - MARGIN),
    right: Math.min(1, 1 - right / w + MARGIN),
    bottom: Math.min(1, 1 - bottom / h + MARGIN),
  }
  // 太小的边不裁
  if (box.left < MIN_CUT) box.left = 0
  if (box.top < MIN_CUT) box.top = 0
  if (1 - box.right < MIN_CUT) box.right = 1
  if (1 - box.bottom < MIN_CUT) box.bottom = 1
  // 留下的部分太少：那一个方向不裁
  if (box.right - box.left < MIN_KEEP) box = { ...box, left: 0, right: 1 }
  if (box.bottom - box.top < MIN_KEEP) box = { ...box, top: 0, bottom: 1 }
  return box.left === 0 && box.top === 0 && box.right === 1 && box.bottom === 1 ? null : box
}

/** 拆分宽页时的一半；0 = 先读的那半（从右往左读时是右半） */
export type Half = 0 | 1

/** 在已裁好的范围里取左半或右半 */
export function halfBox(box: Box, half: Half, rtl: boolean): Box {
  const mid = (box.left + box.right) / 2
  const leftSide = rtl ? half === 1 : half === 0
  return leftSide ? { ...box, right: mid } : { ...box, left: mid }
}

/** 拆分后一半的宽高比；未知时返回 undefined */
export const halfAspect = (aspect: number | undefined) => (aspect === undefined ? undefined : aspect / 2)

export interface FilterSettings {
  /** 亮度百分比，30–100 */
  brightness: number
  /** 暖色（护眼）百分比，0–60 */
  warmth: number
  grayscale: boolean
  invert: boolean
}

/** 页面图片的 CSS filter；全部是默认值时返回 none，免得白白触发合成层 */
export function filterCss({ brightness, warmth, grayscale, invert }: FilterSettings) {
  const parts: string[] = []
  if (invert) parts.push('invert(1)')
  if (grayscale) parts.push('grayscale(1)')
  if (warmth > 0) parts.push(`sepia(${Math.min(60, warmth) / 100})`)
  if (brightness < 100) parts.push(`brightness(${Math.max(30, brightness) / 100})`)
  return parts.length ? parts.join(' ') : 'none'
}

/** 页面书签存在章节元数据里：值是逗号分隔、从 0 开始的页码 */
export const PAGE_BOOKMARK_KEY = 'sukimi.pageBookmarks'

export function parsePageBookmarks(meta: readonly { key: string; value: string }[] = []): number[] {
  const value = meta.find((m) => m.key === PAGE_BOOKMARK_KEY)?.value ?? ''
  const pages = value
    .split(',')
    .map((s) => s.trim())
    .filter((s) => /^\d+$/.test(s))
    .map(Number)
  return [...new Set(pages)].sort((a, b) => a - b)
}

export const formatPageBookmarks = (pages: readonly number[]) => [...new Set(pages)].sort((a, b) => a - b).join(',')

/** 加上或去掉一页书签 */
export function togglePageBookmark(pages: readonly number[], page: number) {
  return pages.includes(page) ? pages.filter((p) => p !== page) : [...pages, page].sort((a, b) => a - b)
}
