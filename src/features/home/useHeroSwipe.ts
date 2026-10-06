import { useRef, type MouseEvent, type PointerEvent } from 'react'

/** 只识别手机横滑；纵向滚动、双指缩放和操作按钮交给浏览器。 */
export function useHeroSwipe(onSwipe: (direction: -1 | 1) => void) {
  const gesture = useRef<{ id: number; x: number; y: number; horizontal: boolean } | null>(null)
  const suppressClick = useRef(false)

  const reset = () => { gesture.current = null }

  return {
    onPointerDown(e: PointerEvent<HTMLDivElement>) {
      suppressClick.current = false
      if (!e.isPrimary) { reset(); return }
      if (e.pointerType !== 'touch' || !window.matchMedia('(max-width: 767px)').matches ||
          (e.target as Element).closest('[data-home-actions]')) return
      gesture.current = { id: e.pointerId, x: e.clientX, y: e.clientY, horizontal: false }
    },
    onPointerMove(e: PointerEvent<HTMLDivElement>) {
      const g = gesture.current
      if (!g || g.id !== e.pointerId) return
      const dx = e.clientX - g.x, dy = e.clientY - g.y
      if (!g.horizontal) {
        if (Math.abs(dy) > 12 && Math.abs(dy) >= Math.abs(dx)) { reset(); return }
        if (Math.abs(dx) < 12 || Math.abs(dx) < Math.abs(dy) * 1.3) return
        g.horizontal = true
        // 确认横滑后才捕获指针，封面轻点仍能正常进入详情。
        e.currentTarget.setPointerCapture(e.pointerId)
      }
      suppressClick.current = true
    },
    onPointerUp(e: PointerEvent<HTMLDivElement>) {
      const g = gesture.current
      reset()
      if (!g || g.id !== e.pointerId || !g.horizontal) return
      const dx = e.clientX - g.x
      if (Math.abs(dx) >= Math.max(48, e.currentTarget.clientWidth * 0.18)) onSwipe(dx < 0 ? 1 : -1)
    },
    onPointerCancel: reset,
    onLostPointerCapture(e: PointerEvent<HTMLDivElement>) {
      // 触摸最初由封面或标题捕获；转移到容器时会冒泡一次子元素的失去捕获事件。
      if (e.target === e.currentTarget) reset()
    },
    onClickCapture(e: MouseEvent<HTMLDivElement>) {
      if (!suppressClick.current) return
      suppressClick.current = false
      e.preventDefault()
      e.stopPropagation()
    },
  }
}
