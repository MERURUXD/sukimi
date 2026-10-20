import { useLayoutEffect, useRef, useState } from 'react'

export type PillBox = { x: number; y: number; width: number; height: number }

/**
 * 量出导航容器里当前链接（NavLink 自带 aria-current="page"）的位置，给 <NavPill> 用。
 * 坐标是容器内的 offsetLeft / offsetTop，和页面滚动无关。
 */
export function useNavPill(pathname: string) {
  const ref = useRef<HTMLElement>(null)
  const boxes = useRef(new Map<HTMLElement, PillBox>())
  const select = useRef<() => void>(() => {})
  const [box, setBox] = useState<PillBox | null>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const choose = () => {
      const a = el.querySelector<HTMLElement>('[aria-current="page"]')
      const next = a ? boxes.current.get(a) ?? null : null
      setBox((prev) => (prev && next && prev.x === next.x && prev.y === next.y && prev.width === next.width && prev.height === next.height ? prev : next))
    }
    select.current = choose
    // ResizeObserver 在布局完成后批量缓存所有链接，换路由时只选缓存，不同步强制布局。
    const measure = () => {
      const next = new Map<HTMLElement, PillBox>()
      el.querySelectorAll<HTMLElement>('a').forEach((a) => next.set(a, { x: a.offsetLeft, y: a.offsetTop, width: a.offsetWidth, height: a.offsetHeight }))
      boxes.current = next
      choose()
    }
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    const observe = () => { el.querySelectorAll('a').forEach((a) => ro.observe(a)) }
    observe()
    const mo = new MutationObserver(observe)
    mo.observe(el, { childList: true, subtree: true })
    return () => { ro.disconnect(); mo.disconnect(); boxes.current.clear(); select.current = () => {} }
  }, [])
  useLayoutEffect(() => select.current(), [pathname])
  return { ref, box }
}
