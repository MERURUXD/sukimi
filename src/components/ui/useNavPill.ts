import { useLayoutEffect, useRef, useState } from 'react'

export type PillBox = { x: number; y: number; width: number; height: number }

/**
 * 量出导航容器里当前链接（NavLink 自带 aria-current="page"）的位置，给 <NavPill> 用。
 * 坐标是容器内的 offsetLeft / offsetTop，和页面滚动无关。
 */
export function useNavPill(pathname: string) {
  const ref = useRef<HTMLElement>(null)
  const [box, setBox] = useState<PillBox | null>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      const a = el.querySelector<HTMLElement>('[aria-current="page"]')
      const next = a ? { x: a.offsetLeft, y: a.offsetTop, width: a.offsetWidth, height: a.offsetHeight } : null
      setBox((prev) => (prev && next && prev.x === next.x && prev.y === next.y && prev.width === next.width && prev.height === next.height ? prev : next))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [pathname])
  return { ref, box }
}
