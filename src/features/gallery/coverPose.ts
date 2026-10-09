/*
 * 大封面和画布格子之间飞来飞去用的姿态。详情层和放映层共用。
 *
 * 透视写在封面自己的变换里、原点放在屏幕中心（和画布格子的透视一模一样），
 * 起止姿态都用同一串变换函数，过渡时逐项插值，中途不会走样，起点和终点也和格子完全重合。
 */

/** 格子在画布上的姿态：左上角位置、球面深度与倾角（都在画布 1100px 透视、以屏幕中心为原点的空间里） */
export interface TilePose {
  x: number
  y: number
  z: number
  rx: number
  ry: number
}

/** 画布的透视距离 */
export const PERSPECTIVE = 1100

export interface Pose {
  dx: number
  dy: number
  z: number
  ry: number
  rx: number
  rz: number
  s: number
}

/** 元素不算自身变换时的屏幕中心。读布局位置：临时去掉变换再量包围盒，会量到正在过渡中的中间值 */
export function layoutCenter(el: HTMLElement) {
  const box = el.offsetParent
  if (!(box instanceof HTMLElement)) return null
  const b = box.getBoundingClientRect()
  return { x: b.left + el.offsetLeft - box.scrollLeft + el.offsetWidth / 2, y: b.top + el.offsetTop - box.scrollTop + el.offsetHeight / 2 }
}

/** 画布的透视原点：画布铺满视口，原点在视口中心 */
export const screenCenter = () => ({ x: document.documentElement.clientWidth / 2, y: document.documentElement.clientHeight / 2 })

/** 完整变换；about 是透视原点（屏幕坐标），省略时以元素自己的中心为原点 */
export function poseTransform(el: HTMLElement, perspective: number, p: Pose, about?: { x: number; y: number }) {
  const c = layoutCenter(el)
  if (!c) return 'none'
  const ax = about ? about.x - c.x : 0
  const ay = about ? about.y - c.y : 0
  return `translate(${ax.toFixed(2)}px, ${ay.toFixed(2)}px) perspective(${perspective}px) translate(${(-ax).toFixed(2)}px, ${(-ay).toFixed(2)}px) translate3d(${p.dx.toFixed(2)}px, ${p.dy.toFixed(2)}px, ${p.z.toFixed(2)}px) rotateY(${p.ry.toFixed(3)}deg) rotateX(${p.rx.toFixed(3)}deg) rotateZ(${p.rz}deg) scale(${p.s.toFixed(5)})`
}

/** 和那一格完全重合：中心移到格子中心、推到同样的深度、同样的倾角、缩到格子宽度 */
export function tileTransform(el: HTMLElement, t: TilePose, tileW: number) {
  const c = layoutCenter(el)
  if (!c) return 'none'
  return poseTransform(el, PERSPECTIVE, { dx: t.x + tileW / 2 - c.x, dy: t.y + (tileW * 1.5) / 2 - c.y, z: t.z, ry: t.ry, rx: t.rx, rz: 0, s: tileW / el.offsetWidth }, screenCenter())
}
