import { AnimatePresence, useReducedMotion } from 'motion/react'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { MotionGlass } from '@/components/glass/Glass'
import { spring } from '@/design/motion'

/** 吸底的玻璃批量操作栏 */
export function BatchBar({
  open,
  count,
  unit,
  onSelectAll,
  selectAllLabel = '全选',
  onCancel,
  children,
}: {
  open: boolean
  count: number
  unit: string
  onSelectAll: () => void
  selectAllLabel?: string
  onCancel: () => void
  children: ReactNode
}) {
  const reduced = useReducedMotion()
  return (
    <AnimatePresence>
      {open && (
        <div className="pointer-events-none fixed right-0 bottom-[calc(var(--tabbar-h)+20px)] left-[var(--side-w)] z-40 flex justify-center px-4">
          <MotionGlass
            role="toolbar"
            aria-label="批量操作"
            dense
            initial={reduced ? false : { opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.97 }}
            transition={reduced ? { duration: 0 } : spring.default}
            className="pointer-events-auto flex max-w-full flex-wrap items-center justify-center gap-0.5 rounded-[32px] p-1.5 [--g-drop:0_24px_60px_rgba(0,0,0,.5)]"
          >
            <div className="flex flex-col px-3.5 leading-[1.3]">
              <span className="font-bold num">
                已选 {count} {unit}
              </span>
              <button type="button" onClick={onSelectAll} className="text-left text-xs font-semibold text-muted hover:text-text">
                {selectAllLabel}
              </button>
            </div>
            <span className="mx-1 h-[34px] w-px bg-line" />
            {children}
            <span className="mx-1 h-[34px] w-px bg-line" />
            <button type="button" className="bb" onClick={onCancel}>
              <X className="size-5" strokeWidth={1.8} />
              取消
            </button>
          </MotionGlass>
        </div>
      )}
    </AnimatePresence>
  )
}
