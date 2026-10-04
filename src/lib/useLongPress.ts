import { useMemo, useRef } from 'react'

/**
 * 触屏长按（450ms，手指移动超过 8px 取消）。鼠标不触发。
 * 长按成功后会吞掉随后的那次 click 和系统长按菜单，避免松手时又打开了链接。
 */
export function useLongPress(onLongPress: () => void, ms = 450) {
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const start = useRef<{ x: number; y: number } | null>(null)
  const fired = useRef(false)
  const cb = useRef(onLongPress)
  cb.current = onLongPress

  return useMemo(() => {
    const cancel = () => {
      clearTimeout(timer.current)
      start.current = null
    }
    return {
      onPointerDown: (e: React.PointerEvent) => {
        if (e.pointerType === 'mouse') return
        fired.current = false
        start.current = { x: e.clientX, y: e.clientY }
        timer.current = setTimeout(() => {
          fired.current = true
          navigator.vibrate?.(10)
          cb.current()
        }, ms)
      },
      onPointerMove: (e: React.PointerEvent) => {
        const s = start.current
        if (s && Math.hypot(e.clientX - s.x, e.clientY - s.y) > 8) cancel()
      },
      onPointerUp: cancel,
      onPointerCancel: cancel,
      onClickCapture: (e: React.MouseEvent) => {
        if (fired.current) {
          fired.current = false
          e.preventDefault()
          e.stopPropagation()
        }
      },
      onContextMenu: (e: React.MouseEvent) => {
        if (start.current || fired.current) e.preventDefault()
      },
    }
  }, [ms])
}
