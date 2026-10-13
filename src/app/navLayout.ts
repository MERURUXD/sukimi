type NavigationSignals = {
  userAgent: string
  maxTouchPoints: number
  coarsePointer: boolean
  hover: boolean
}

/** 宽度只决定放得下哪种导航，不能把放大或缩窄后的电脑窗口当作平板。 */
export function prefersTouchNavigation({ userAgent, maxTouchPoints, coarsePointer, hover }: NavigationSignals): boolean {
  if (/Android|iPad|iPhone|iPod/i.test(userAgent)) return true
  // iPad 的桌面网站模式使用 Mac UA；连接鼠标后仍沿用触控导航。
  if (/Macintosh/i.test(userAgent)) return maxTouchPoints > 1
  // 触屏电脑也有触点，不能只靠 maxTouchPoints 或粗指针判断。
  if (/Windows NT|X11/i.test(userAgent)) return false
  return coarsePointer && !hover
}

export function installTouchNavigation() {
  const pointer = window.matchMedia('(pointer: coarse)')
  const hover = window.matchMedia('(hover: hover)')
  const update = () => {
    document.documentElement.dataset.touchNavigation = String(prefersTouchNavigation({
      userAgent: navigator.userAgent,
      maxTouchPoints: navigator.maxTouchPoints,
      coarsePointer: pointer.matches,
      hover: hover.matches,
    }))
  }
  update()
  pointer.addEventListener('change', update)
  hover.addEventListener('change', update)
  return () => {
    pointer.removeEventListener('change', update)
    hover.removeEventListener('change', update)
  }
}
