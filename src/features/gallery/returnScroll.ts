/** 返回途中禁止用户滚动，但保留 ScrollManager 恢复目标页位置的能力。 */
export function lockGalleryReturnScroll() {
  const page = document.documentElement
  const overflow = page.style.overflow
  page.style.overflow = 'hidden'
  const stop = (e: Event) => {
    e.preventDefault()
    // 画廊自己用滚轮、触摸和按键驱动翻页，也必须在捕获阶段拦住。
    e.stopImmediatePropagation()
  }
  const onKey = (e: KeyboardEvent) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(e.key)) stop(e)
  }
  window.addEventListener('wheel', stop, { capture: true, passive: false })
  window.addEventListener('touchmove', stop, { capture: true, passive: false })
  window.addEventListener('keydown', onKey, true)
  let released = false
  return () => {
    if (released) return
    released = true
    page.style.overflow = overflow
    window.removeEventListener('wheel', stop, true)
    window.removeEventListener('touchmove', stop, true)
    window.removeEventListener('keydown', onKey, true)
  }
}
