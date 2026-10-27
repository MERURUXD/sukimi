/** 纵向列表里一个槽位在滚动内容中的位置（含拆开的半页） */
export interface SlotBox {
  top: number
  bottom: number
}

/**
 * 视口上下各留 overscanPx 时，需要挂上图片的槽位范围（含两端）。
 * 高度还没量出来、没有相交槽位时返回 null。
 */
export function slotsInView(boxes: readonly SlotBox[], scrollTop: number, viewport: number, overscanPx: number) {
  if (!boxes.length || viewport <= 0) return null
  const top = scrollTop - Math.max(0, overscanPx)
  const bottom = scrollTop + viewport + Math.max(0, overscanPx)
  let start = -1
  let end = -1
  for (let i = 0; i < boxes.length; i++) {
    const box = boxes[i]
    if (box.bottom <= top || box.top >= bottom) continue
    if (start < 0) start = i
    end = i
  }
  return start < 0 ? null : { start, end }
}

/** 视口范围外再多留 pad 个槽位，滚进视口之前图就已经挂上 */
export function padRange(range: { start: number; end: number }, pad: number, count: number) {
  if (count <= 0) return { start: 0, end: -1 }
  return {
    start: Math.max(0, range.start - Math.max(0, pad)),
    end: Math.min(count - 1, range.end + Math.max(0, pad)),
  }
}

/** 打开时还没量过滚动位置：先挂上这一页和附近几页，量完再改成视口窗口 */
export function aroundSlot(index: number, count: number, pad: number) {
  if (count <= 0) return { start: 0, end: -1 }
  const i = Math.min(count - 1, Math.max(0, index))
  return padRange({ start: i, end: i }, pad, count)
}

/**
 * 预取下标：当前屏以及前后各 radius 页。
 * 往回翻、往回滚时，上一屏已经在这个窗口里。
 */
export function prefetchIndexes(shown: readonly number[], pageCount: number, radius: number) {
  if (!shown.length || pageCount <= 0 || radius < 0) return []
  const lo = Math.max(0, Math.min(...shown) - radius)
  const hi = Math.min(pageCount - 1, Math.max(...shown) + radius)
  const out: number[] = []
  for (let i = lo; i <= hi; i++) out.push(i)
  return out
}
