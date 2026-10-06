import { useEffect, useState, type RefObject } from 'react'

/** 滚动超过这个距离后才允许隐藏，页面顶部始终显示 */
const TOP_ZONE = 80
/** 单次方向变化累计到这个距离才切换，避免触摸板抖动时来回闪 */
const THRESHOLD = 8

/**
 * 向下滚动时隐藏顶栏，向上滚动再出现。键盘焦点在顶栏内或有菜单展开时保持显示。
 */
export function useHideOnScroll(enabled: boolean, bar: RefObject<HTMLElement | null>) {
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    if (!enabled) {
      setHidden(false)
      return
    }
    let last = window.scrollY
    let travelled = 0
    const onScroll = () => {
      const y = window.scrollY
      const delta = y - last
      last = y
      if (y < TOP_ZONE) {
        travelled = 0
        setHidden(false)
        return
      }
      // 方向反了就重新累计
      travelled = Math.sign(delta) === Math.sign(travelled) ? travelled + delta : delta
      if (Math.abs(travelled) < THRESHOLD) return
      const el = bar.current
      const pinned = !!el && (el.matches(':focus-within') || !!el.querySelector('[aria-expanded="true"]'))
      setHidden(travelled > 0 && !pinned)
      travelled = 0
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [enabled, bar])

  return hidden
}
