import { AnimatePresence, useReducedMotion } from 'motion/react'
import { useRef } from 'react'
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

interface Pending {
  left: number
  started: number
  timer?: ReturnType<typeof setTimeout>
}

const pending = new Map<number, Pending>()

function schedule(id: number, ms: number) {
  const row = pending.get(id)
  if (!row) return
  if (row.timer) clearTimeout(row.timer)
  row.left = ms
  row.started = Date.now()
  row.timer = setTimeout(() => dismissToast(id), ms)
}

function pauseToast(id: number) {
  const row = pending.get(id)
  if (!row?.timer) return
  clearTimeout(row.timer)
  row.timer = undefined
  row.left = Math.max(0, row.left - (Date.now() - row.started))
}

function resumeToast(id: number) {
  const row = pending.get(id)
  if (!row || row.timer) return
  schedule(id, row.left)
}

export function dismissToast(id: number) {
  const row = pending.get(id)
  if (row?.timer) clearTimeout(row.timer)
  pending.delete(id)
  useToasts.setState((s) => ({ list: s.list.filter((t) => t.id !== id) }))
}

/** 清掉还在显示的提示。测试用来隔离开例，页面上没有入口 */
export function clearToasts() {
  for (const row of pending.values()) if (row.timer) clearTimeout(row.timer)
  pending.clear()
  useToasts.setState({ list: [] })
}

export function toast(text: string, tone: Toast['tone'] = 'info') {
  const id = ++seq
  const ms = tone === 'error' ? 6000 : 3200
  pending.set(id, { left: ms, started: Date.now() })
  useToasts.setState((s) => ({ list: [...s.list.slice(-2), { id, text, tone }] }))
  schedule(id, ms)
}

export function toastError(prefix: string, e: unknown) {
  toast(`${prefix}：${errorText(e)}`, 'error')
}

function ToastCard({ item }: { item: Toast }) {
  const reduced = useReducedMotion()
  const holds = useRef(0)
  const hold = () => {
    holds.current += 1
    pauseToast(item.id)
  }
  const release = () => {
    holds.current = Math.max(0, holds.current - 1)
    if (holds.current === 0) resumeToast(item.id)
  }
  return (
    <MotionGlass
      role={item.tone === 'error' ? 'alert' : 'status'}
      layout={reduced ? false : true}
      dense
      initial={reduced ? false : { opacity: 0, y: -12, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
      transition={reduced ? { duration: 0 } : spring.fast}
      suspendRefract
      onMouseEnter={hold}
      onMouseLeave={release}
      onFocus={hold}
      onBlur={release}
      className={`pointer-events-auto flex max-w-[min(560px,100%)] items-center gap-3 rounded-full px-5 py-2.5 text-[13px] font-semibold ${item.tone === 'error' ? 'text-danger' : ''}`}
    >
      <span>{item.text}</span>
      {item.tone === 'error' && (
        <button type="button" className="font-semibold" onClick={() => dismissToast(item.id)}>
          关闭
        </button>
      )}
    </MotionGlass>
  )
}

export function Toaster() {
  const list = useToasts((s) => s.list)
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[calc(var(--nav-h)+8px)] z-[60] flex flex-col items-center gap-2 px-4">
      <AnimatePresence initial={false}>
        {list.map((item) => (
          <ToastCard key={item.id} item={item} />
        ))}
      </AnimatePresence>
    </div>
  )
}
