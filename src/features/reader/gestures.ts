/*
 * 翻页视图的手势计算（纯函数，方便测试）。
 * 内容用 translate(x, y) scale(s) 变换，变换原点在内容中心。
 */

export interface Zoom {
  s: number
  x: number
  y: number
}

export const NO_ZOOM: Zoom = { s: 1, x: 0, y: 0 }
export const MAX_ZOOM = 4
/** 双击放大到的倍数 */
export const TAP_ZOOM = 2.5

/** 放大后最多能平移多远：内容放大后超出视口部分的一半（没超出就不能移） */
export function panBounds(content: { w: number; h: number }, view: { w: number; h: number }, s: number) {
  return { x: Math.max(0, (content.w * s - view.w) / 2), y: Math.max(0, (content.h * s - view.h) / 2) }
}

export const clampPan = (z: Zoom, b: { x: number; y: number }): Zoom => ({
  s: z.s,
  x: Math.min(b.x, Math.max(-b.x, z.x)),
  y: Math.min(b.y, Math.max(-b.y, z.y)),
})

/**
 * 以某一点为中心缩放：p 是该点相对内容中心的屏幕坐标（已含当前平移），
 * 让它在缩放前后停在屏幕同一位置。
 */
export function zoomAround(from: Zoom, p: { x: number; y: number }, s: number): Zoom {
  const k = s / from.s
  return { s, x: p.x - (p.x - from.x) * k, y: p.y - (p.y - from.y) * k }
}

/** 缩小到接近原大就直接复位，免得留下 1.02 倍这种看不出来又锁住翻页的状态 */
export const settle = (z: Zoom): Zoom => (z.s < 1.05 ? NO_ZOOM : z)

/** 这个倍数是否锁住滚轮翻页。settle 会复位的范围（含 Ctrl+滚轮停在 1.02）不算放大 */
export const blocksWheelTurn = (scale: number) => settle({ s: scale, x: 0, y: 0 }).s > 1

/** 轻扫翻页的序号加一。键盘、点击、滚轮或新的一次拖动都要加，旧定时器到点就对不上 */
export const invalidateFlip = (generation: number) => generation + 1

/** 定时器记下的序号还是不是当前这一次 */
export const flipStillCurrent = (generation: number, scheduled: number) => generation === scheduled

/**
 * 横向拖动结束时是否翻页：快速轻扫，或拖过视口宽度的 22%。
 * 返回手指移动的方向：1 = 向右（看左边那页），-1 = 向左，0 = 弹回。
 */
export function swipeResult(movementX: number, swipeX: number, width: number): 1 | -1 | 0 {
  if (swipeX !== 0) return swipeX > 0 ? 1 : -1
  if (Math.abs(movementX) > width * 0.22) return movementX > 0 ? 1 : -1
  return 0
}
