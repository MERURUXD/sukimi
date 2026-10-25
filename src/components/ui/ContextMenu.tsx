import { AnimatePresence } from 'motion/react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { MotionGlass } from '@/components/glass/Glass'
import { spring } from '@/design/motion'
import { cn } from '@/lib/cn'

const EDGE = 12

/**
 * 右键 / 长按菜单的状态：一页只放一个菜单，打开时记下点在哪、对哪一项。
 * 长列表里不用给每一格挂弹出层，只有打开的那一个在渲染。
 */
export function useContextMenu<T>() {
  const [menu, setMenu] = useState<{ x: number; y: number; target: T } | null>(null)
  const close = useCallback(() => setMenu(null), [])
  const open = useCallback((x: number, y: number, target: T) => setMenu({ x, y, target }), [])
  return { menu, open, close }
}

/** 鼠标右键才接管；触屏长按留给页面自己的长按逻辑（书库长按是多选），不弹两次 */
export const isMouseContext = (e: React.MouseEvent) => (e.nativeEvent as PointerEvent).pointerType !== 'touch'

/**
 * 出现在点击位置的玻璃菜单，贴近边缘时往里收。点外部、按 Esc、滚动或改窗口大小时关闭。
 * 挂到 body 上，避开网格格子的裁切和层叠。
 */
export function ContextMenu({ at, onClose, label, children, className }: {
  at: { x: number; y: number } | null
  onClose: () => void
  label: string
  children: ReactNode
  className?: string
}) {
  const panel = useRef<HTMLElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)

  useLayoutEffect(() => {
    if (!at) return setPos(null)
    // 用布局尺寸：进场动画从 0.94 倍缩放开始，getBoundingClientRect 量到的偏小
    const w = panel.current?.offsetWidth ?? 0
    const h = panel.current?.offsetHeight ?? 0
    setPos({
      left: Math.max(EDGE, Math.min(at.x, window.innerWidth - w - EDGE)),
      // 下面放不下就翻到点击位置上方，再不行贴着窗口底边
      top: Math.max(EDGE, Math.min(at.y + h + EDGE > window.innerHeight ? at.y - h : at.y, window.innerHeight - h - EDGE)),
    })
  }, [at])

  // 量好位置、显示出来之后再把焦点移到第一项（藏着的元素聚焦不了），键盘用户不用再找
  useEffect(() => {
    if (pos) panel.current?.querySelector<HTMLElement>('button:not(:disabled), a')?.focus({ preventScroll: true })
  }, [pos])

  useEffect(() => {
    if (!at) return
    const onDown = (e: PointerEvent) => {
      if (!panel.current?.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('pointerdown', onDown, true)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onClose, true)
    window.addEventListener('resize', onClose)
    return () => {
      document.removeEventListener('pointerdown', onDown, true)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onClose, true)
      window.removeEventListener('resize', onClose)
    }
  }, [at, onClose])

  return createPortal(
    <AnimatePresence>
      {at && (
        <MotionGlass
          ref={panel}
          role="menu"
          aria-label={label}
          dense
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={spring.fast}
          // 量好尺寸之前先藏着，免得在角落闪一下
          style={{ left: pos?.left ?? at.x, top: pos?.top ?? at.y, visibility: pos ? 'visible' : 'hidden', transformOrigin: 'top left' }}
          className={cn('fixed z-[70] w-[220px] rounded-[24px] p-3 [--g-drop:0_24px_60px_rgba(0,0,0,.45)]', className)}
          onContextMenu={(e: React.MouseEvent) => e.preventDefault()}
        >
          {children}
        </MotionGlass>
      )}
    </AnimatePresence>,
    document.body,
  )
}
