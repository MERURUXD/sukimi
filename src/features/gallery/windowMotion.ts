import { wallTransform } from './wall.ts'

export const WINDOW_DUR = 850
export const WINDOW_EASE = 'cubic-bezier(0.4, 0, 0.2, 1)'

export interface WindowBox {
  left: number
  top: number
  width: number
  height: number
}

/** 同一面墙的取景、姿态与明暗；两个方向使用同一组量，不再变换整页快照。 */
export interface WindowPose {
  box: WindowBox
  radius: number
  x: number
  y: number
  transform: string
  filter: string
  opacity: number
  shade: number
}

export const windowClip = (box: WindowBox, radius: number, w: number, h: number) =>
  `inset(${box.top}px ${w - box.left - box.width}px ${h - box.top - box.height}px ${box.left}px round ${radius}px)`

export const galleryPose = (box: WindowBox, w: number, h: number): WindowPose => ({
  box: { left: 0, top: 0, width: w, height: h },
  radius: 0,
  x: box.left + box.width / 2 - w / 2,
  y: box.top + box.height / 2 - h / 2,
  transform: `${wallTransform(1)} rotateY(0deg)`,
  filter: 'grayscale(0)',
  opacity: 1,
  shade: 0,
})

/** 遮罩多铺 2px，让外层独自裁边；缩放边缘和圆角重叠抗锯齿会露出一圈亮线。 */
export const shadeTransform = (box: WindowBox, w: number, h: number) =>
  `translate(${box.left - 2}px, ${box.top - 2}px) scale(${(box.width + 4) / w}, ${(box.height + 4) / h})`

/** 墙落定不等于换页结束；跳过、失败也要清理，已取消的旧过渡不能清理下一次。 */
export function onWindowFinished(vt: Pick<ViewTransition, 'finished'>, done: () => void) {
  let alive = true
  void vt.finished.then(() => alive && done(), () => alive && done())
  return () => { alive = false }
}

/** 历史返回可能沿用此前导航的 VT；墙先落定也要等它结束，才能撤掉专用换页样式。 */
export function onWindowMotionFinished(animations: readonly Pick<Animation, 'finished'>[], vt: Pick<ViewTransition, 'finished'> | null | undefined, done: () => void) {
  const finished = Promise.allSettled([...animations.map(animation => animation.finished), ...(vt ? [vt.finished] : [])]).then(() => {})
  return onWindowFinished({ finished }, done)
}
