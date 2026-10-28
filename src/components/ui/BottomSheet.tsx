import { motion, useReducedMotion } from 'motion/react'
import { X } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'
import { MotionGlass } from '@/components/glass/Glass'
import { spring } from '@/design/motion'
import { cn } from '@/lib/cn'
import './BottomSheet.css'
import { t } from '@/i18n'

/** 手机底部浮层：使用全局玻璃外观，内容过长时在面板内滚动。 */
export function BottomSheet({ id, label, closeLabel = t('common.closeMoreActions'), onClose, className, children }: {
  id: string
  label: string
  closeLabel?: string
  onClose: () => void
  className?: string
  children: ReactNode
}) {
  const panel = useRef<HTMLElement>(null)
  const close = useRef(onClose)
  const reducedMotion = useReducedMotion()
  useEffect(() => { close.current = onClose }, [onClose])

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const page = document.documentElement
    const previousOverflow = page.style.overflow
    page.style.overflow = 'hidden'
    const controls = () => [...(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), [tabindex="0"]') ?? [])]
      .filter((el) => el.getClientRects().length > 0)
    panel.current?.focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close.current() }
      if (e.key !== 'Tab') return
      const items = controls()
      const next = e.shiftKey ? items.at(-1) : items[0]
      if (document.activeElement === panel.current || !panel.current?.contains(document.activeElement) || document.activeElement === (e.shiftKey ? items[0] : items.at(-1))) {
        e.preventDefault()
        next?.focus({ preventScroll: true })
      }
    }
    const onFocus = (e: FocusEvent) => {
      if (!panel.current?.contains(e.target as Node)) controls()[0]?.focus({ preventScroll: true })
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('focusin', onFocus)
    return () => {
      page.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('focusin', onFocus)
      const nextDialog = document.querySelector<HTMLElement>('[role="dialog"][aria-modal="true"]')
      if (nextDialog) nextDialog.querySelector<HTMLElement>('button:not(:disabled), a[href]')?.focus({ preventScroll: true })
      else if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true })
    }
  }, [])

  return (
    <div className="manga-bottom-sheet-root fixed inset-0 z-[70] flex items-end justify-center" role="presentation">
      <motion.div className="absolute inset-0 bg-black/25" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
      <MotionGlass
        ref={panel}
        id={id}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        initial={{ opacity: 0, y: reducedMotion ? 0 : 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: reducedMotion ? 0 : 16 }}
        transition={reducedMotion ? { duration: 0 } : spring.fast}
        className={cn('manga-bottom-sheet relative flex min-h-0 w-full max-w-[480px] flex-col rounded-[26px] p-3 outline-none', className)}
      >
        <div className="flex shrink-0 items-center gap-3 pl-3">
          <h2 className="m-0 flex-1 text-base font-semibold">{label}</h2>
          <button type="button" className="gicon rounded-full hover:bg-hover" aria-label={closeLabel} onClick={onClose}><X className="size-5" /></button>
        </div>
        <div className="no-scrollbar min-h-0 overflow-y-auto overscroll-contain">{children}</div>
      </MotionGlass>
    </div>
  )
}
