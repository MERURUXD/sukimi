import { HOME_WALL, cellIndex, centerOn, placeOrder, visibleCells, type Grid } from './canvasMath.ts'
import type { CoverRect } from './readMorph.ts'

/*
 * 画廊那面倾斜的封面墙的共用部分。画廊首页（HeroWall）、画布和首页底部的橱窗（CoverWall）
 * 画的是同一面墙：同样的格子、同样的内容、同样的流动位置，所以放在这里，不依赖任何一个组件。
 */

/**
 * 首页墙的位置，首页和画布之间交接用：首页一直在写，进画布时画布从这里接着画；
 * 倒放回首页时画布写回来，首页从那里继续流动。整个页面会话内有效。
 * 记的是相对屏幕中心的偏移（ox - 宽 / 2）：首页和画布量到的宽度可能差一个滚动条，按左边记会错开半个滚动条宽。
 */
export const wallState: {
  cx: number
  cy: number
  grid: Grid | null
  order: number[] | null
  /**
   * 从书库进来时书库封面落在墙上的哪一块（格子编号）、落地时墙在哪。回书库时墙先倒回这个位置，
   * 原来那一块封面回到屏幕中间，再由这些格子本身飞回书库，不会换成别的封面。from 是当时记下的书库封面位置
   */
  landing: { cx: number; cy: number; keys: ReadonlyMap<string, CoverRect>; from: ReadonlyMap<number, CoverRect> } | null
  /** 首页橱窗换格后写进 order 的那个数组：order 还是它，说明没被书库进画廊改写过，橱窗再挂上时不用重换，封面才一直不变 */
  sampled: number[] | null
} = { cx: NaN, cy: NaN, grid: null, order: null, landing: null, sampled: null }

/** 还没有位置（或换了格子尺寸）时让第 0 列第 0 行的格子正好在中心 */
export function ensureWall(w: number, h: number, grid: Grid) {
  if (wallState.grid === grid && !Number.isNaN(wallState.cx)) return
  const c = centerOn(0, 0, w, h, grid)
  Object.assign(wallState, { cx: c.x - w / 2, cy: c.y - h / 2, grid })
}

/**
 * 第 (c, r) 格放第几部。默认按收藏先后（cellIndex）；从书库进来时换过几格（wallState.order，见 placeOrder），
 * 首页的墙和画布都按它画，进画布时内容才接得上。编号、放映顺序、搜索仍按收藏先后。
 */
export function wallItem(c: number, r: number, n: number) {
  const p = cellIndex(c, r, n)
  const o = wallState.order
  return o && o.length === n && p >= 0 ? o[p] : p
}

/** 第 i 部在墙上的位置（cellIndex 的值），找最近放着它的格子用 */
export function wallPosOf(i: number, n: number) {
  const o = wallState.order
  return o && o.length === n ? o.indexOf(i) : i
}

const PERSPECTIVE = 1800

/** k 倍于画廊首页的倾斜程度：1 就是画廊里墙的姿态（HOME_WALL），0 是平铺 */
export const wallTransform = (k: number) =>
  `perspective(${PERSPECTIVE}px) rotateX(${(HOME_WALL.rotateX * k).toFixed(3)}deg) rotateZ(${(HOME_WALL.rotateZ * k).toFixed(3)}deg) scale(${wallScale(k).toFixed(4)})`

export const wallScale = (k: number) => 1 + (HOME_WALL.scale - 1) * k
const tiltY = (k: number) => Math.cos((HOME_WALL.rotateX * k * Math.PI) / 180)

/*
 * 首页橱窗里的墙比画廊里的更斜、更小，窗里才有好几行封面、像一面墙；指上去 / 按住时往画廊的姿态靠。
 * 橱窗是画廊墙的取景窗：格子编号、内容、流动位置都和画廊一致，只有这个倾斜程度不同。
 */
export const WINDOW_K = 1.6
export const WINDOW_K_ON = 1.15
/** 橱窗墙随指针左右转的最大角度（deg），window.css 里的 rotateY 要和它一致 */
export const WINDOW_TILT = 4

/** 框（w × h）里的墙在 k 倍倾斜下，要生成多大范围的格子（给 visibleCells；旋转后四角要靠外圈盖住） */
export function wallRange(w: number, h: number, k: number) {
  const s = wallScale(k)
  const a = (Math.abs(HOME_WALL.rotateZ * k) * Math.PI) / 180
  // rotateX 把竖向压扁（只看 cos，忽略透视），同样大的框在墙上要盖更高的范围
  const halfW = ((w / 2) * Math.cos(a) + (h / 2) * Math.sin(a)) / s
  const halfH = (((w / 2) * Math.sin(a) + (h / 2) * Math.cos(a)) / s) / tiltY(k)
  return { scale: s, extraX: Math.max(0, halfW - w / 2 / s), extraY: Math.max(0, halfH - h / 2 / s) }
}

/**
 * 框里此刻（k 倍倾斜下）看得见的格子，margin 是往外多留的屏幕像素，sx / sy 是格子中心在框里的位置（相对框中心）。
 * 墙绕中心转了 rotateZ，所以按旋转后的屏幕位置判断（忽略透视的那点误差）。
 */
export function cellsInWindow(w: number, h: number, grid: Grid, k = WINDOW_K, margin = 0) {
  const s = wallScale(k)
  const a = (HOME_WALL.rotateZ * k * Math.PI) / 180
  const cos = Math.cos(a)
  const sin = Math.sin(a)
  const ox = wallState.cx + w / 2 + HOME_WALL.slide
  const oy = wallState.cy + h / 2
  return visibleCells(ox, oy, w, h, grid, wallRange(w, h, k))
    .map((cell) => {
      const px = cell.x + grid.cw / 2 - w / 2
      const py = cell.y + grid.ch / 2 - h / 2
      return { cell, sx: (px * cos - py * sin) * s, sy: (px * sin + py * cos) * s * tiltY(k) }
    })
    .filter(({ sx, sy }) => Math.abs(sx) < w / 2 + margin && Math.abs(sy) < h / 2 + margin)
}

/** 框里看得见的格子，离中心近的在前（给 windowOrder 挑格子用） */
export const windowCells = (w: number, h: number, grid: Grid, k = WINDOW_K) =>
  cellsInWindow(w, h, grid, k)
    .sort((p, q) => p.sx ** 2 + p.sy ** 2 - (q.sx ** 2 + q.sy ** 2))
    .map(({ cell }) => cell)

/**
 * 橱窗里看得见的格子换成 picks（第几部，按优先级排好），离窗口中心近的格子先拿到靠前的。
 * 同一个位置只用一次；picks 不够时其余格子保持原来的排列。返回新的 wallState.order。
 */
export function windowOrder(n: number, cells: readonly { c: number; r: number }[], picks: readonly number[]) {
  const seen = new Set<number>()
  const wants: (readonly [number, number])[] = []
  for (const { c, r } of cells) {
    const p = cellIndex(c, r, n)
    if (p < 0 || seen.has(p)) continue
    if (wants.length >= picks.length) break
    seen.add(p)
    wants.push([p, picks[wants.length]])
  }
  return placeOrder(n, wants).order
}

/**
 * 画廊那面墙（整屏、画廊里的姿态）此刻会用到的封面地址。指到首页橱窗上就先把这些封面取回来：
 * 橱窗里只载入了窗里看得见的几十张，窗口揭开成整屏时其余的封面才第一次要用，等它们现取会在展开时一块块冒出来。
 */
export function wallCoverUrls(items: readonly { thumbnailUrl?: string | null }[], grid: Grid, w: number, h: number) {
  const urls = new Set<string>()
  if (!items.length) return []
  const cells = visibleCells(wallState.cx + w / 2 + HOME_WALL.slide, wallState.cy + h / 2, w, h, grid, wallRange(w, h, WINDOW_K_ON))
  for (const cell of cells) {
    const url = items[wallItem(cell.c, cell.r, items.length)]?.thumbnailUrl
    if (url) urls.add(url)
  }
  return [...urls]
}
