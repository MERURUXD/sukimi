/**
 * 复制画布当前画面。WebGL 画布没开 preserveDrawingBuffer，合成后缓冲区就被清空，直接复制只得到空白；
 * 画的一方登记一个重绘函数，复制前在同一任务里先重画一次再读。
 */
const redraws = new WeakMap<HTMLCanvasElement, () => void>()

export function registerRedraw(canvas: HTMLCanvasElement, redraw: () => void) {
  redraws.set(canvas, redraw)
  return () => { redraws.delete(canvas) }
}

/** 复制一张同尺寸、同样式的 2D 画布；读不了（跨域、上下文丢失）时返回空画布，调用方照常使用 */
export function copyCanvas(src: HTMLCanvasElement) {
  const copy = document.createElement('canvas')
  copy.width = src.width
  copy.height = src.height
  copy.style.cssText = src.style.cssText
  copy.className = src.className
  try {
    redraws.get(src)?.()
    copy.getContext('2d')?.drawImage(src, 0, 0)
  } catch {
    /* 复制失败只少一层背景 */
  }
  return copy
}
