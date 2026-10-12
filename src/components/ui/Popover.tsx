import { AnimatePresence } from 'motion/react'
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { MotionGlass } from '@/components/glass/Glass'
import { spring } from '@/design/motion'
import { cn } from '@/lib/cn'

/**
 * 锚定在触发按钮旁的玻璃弹出层。点外部或按 Esc 关闭。
 * 触发按钮和弹出层都放在 children / panel 里，由外层 relative 容器包住。
 */
export function Popover({
  open,
  onClose,
  trigger,
  children,
  align = 'right',
  side = 'bottom',
  className,
  rootClassName,
  label,
  id,
  fitViewport = false,
}: {
  open: boolean
  onClose: () => void
  trigger: ReactNode
  children: ReactNode
  align?: 'left' | 'right'
  side?: 'top' | 'bottom'
  className?: string
  /** 外层定位容器的类名；放进网格当格子时用来补 min-w-0 */
  rootClassName?: string
  label?: string
  id?: string
  /** 长筛选面板按可用高度滚动，按钮靠近底部时向上展开。 */
  fitViewport?: boolean
}) {
  const root = useRef<HTMLDivElement>(null)
  const [bounds, setBounds] = useState<{ side: 'top' | 'bottom'; room: number } | null>(null)

  useEffect(() => {
    if (!open || !fitViewport) return
    const mobile = window.matchMedia('(max-width: 767px)')
    const page = document.documentElement
    const previous = page.style.overflow
    const sync = () => { page.style.overflow = mobile.matches ? 'hidden' : previous }
    sync()
    mobile.addEventListener('change', sync)
    return () => {
      page.style.overflow = previous
      mobile.removeEventListener('change', sync)
    }
  }, [open, fitViewport])

  useLayoutEffect(() => {
    if (!open || !fitViewport) return
    const update = (next: { side: 'top' | 'bottom'; room: number }) =>
      setBounds((previous) => previous?.side === next.side && previous.room === next.room ? previous : next)
    const measure = () => {
      const box = root.current?.getBoundingClientRect()
      if (!box) return
      if (window.innerWidth < 768) {
        update({ side: 'bottom', room: window.innerHeight - 32 })
        return
      }
      const above = box.top - 26
      const below = window.innerHeight - box.bottom - 26
      const preferred = side === 'bottom' ? below : above
      const opposite = side === 'bottom' ? above : below
      const placed = preferred < 480 && opposite > preferred ? (side === 'bottom' ? 'top' : 'bottom') : side
      update({ side: placed, room: Math.max(160, placed === 'bottom' ? below : above) })
    }
    measure()
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [open, fitViewport, side])

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  const placedSide = fitViewport ? bounds?.side ?? side : side
  const origin = `${placedSide === 'bottom' ? 'top' : 'bottom'} ${align}`

  return (
    <div ref={root} className={cn('relative', rootClassName)}>
      {trigger}
      <AnimatePresence>
        {open && (
          <MotionGlass
            id={id}
            role="dialog"
            aria-label={label}
            dense
            layoutScroll={fitViewport}
            initial={{ opacity: 0, scale: 0.94, y: placedSide === 'bottom' ? -6 : 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={spring.fast}
            style={{ transformOrigin: origin, ...(fitViewport && bounds ? { '--popover-room': `${bounds.room}px`, maxHeight: bounds.room } : {}) } as CSSProperties}
            className={cn(
              'absolute z-50 rounded-[24px] p-3 [--g-drop:0_24px_60px_rgba(0,0,0,.45)]',
              placedSide === 'bottom' ? 'top-[calc(100%+10px)]' : 'bottom-[calc(100%+10px)]',
              align === 'right' ? 'right-0' : 'left-0',
              fitViewport && 'no-scrollbar overflow-y-auto overscroll-contain',
              className,
            )}
          >
            {children}
          </MotionGlass>
        )}
      </AnimatePresence>
    </div>
  )
}
