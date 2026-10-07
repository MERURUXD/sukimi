import { AnimatePresence } from 'motion/react'
import { create } from 'zustand'
import { MotionGlass } from '@/components/glass/Glass'
import { spring } from '@/design/motion'
import { errorText } from '@/lib/errorText'

interface Toast {
  id: number
  text: string
  tone: 'info' | 'error'
}

const useToasts = create<{ list: Toast[] }>(() => ({ list: [] }))
let seq = 0

export function toast(text: string, tone: Toast['tone'] = 'info') {
  const id = ++seq
  useToasts.setState((s) => ({ list: [...s.list.slice(-2), { id, text, tone }] }))
  setTimeout(() => useToasts.setState((s) => ({ list: s.list.filter((t) => t.id !== id) })), tone === 'error' ? 6000 : 3200)
}

export function toastError(prefix: string, e: unknown) {
  toast(`${prefix}：${errorText(e)}`, 'error')
}

export function Toaster() {
  const list = useToasts((s) => s.list)
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-[calc(var(--nav-h)+8px)] z-[60] flex flex-col items-center gap-2 px-4">
      <AnimatePresence initial={false}>
        {list.map((t) => (
          <MotionGlass
            key={t.id}
            layout
            dense
            initial={{ opacity: 0, y: -12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={spring.fast}
            suspendRefract
            className={`pointer-events-auto max-w-[min(560px,100%)] rounded-full px-5 py-2.5 text-[13px] font-semibold ${t.tone === 'error' ? 'text-danger' : ''}`}
          >
            {t.text}
          </MotionGlass>
        ))}
      </AnimatePresence>
    </div>
  )
}
