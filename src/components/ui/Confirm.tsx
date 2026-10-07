import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, type ReactNode } from 'react'
import { create } from 'zustand'
import { MotionGlass } from '@/components/glass/Glass'
import { resetOnUserContext } from '@/api/userContext'
import { spring } from '@/design/motion'
import { cn } from '@/lib/cn'

interface Ask {
  title: string
  body?: ReactNode
  ok?: string
  danger?: boolean
  resolve: (v: boolean) => void
}

const useAsk = create<{ ask: Ask | null }>(() => ({ ask: null }))

// 换身份时还没回答的确认框按「取消」处理：它属于上一个身份发起的操作，不能留给下一个身份去点
resetOnUserContext(() => {
  useAsk.getState().ask?.resolve(false)
  useAsk.setState({ ask: null })
})

/** 弹出确认框，用户确认返回 true。危险操作用 danger 把确认按钮标红 */
export function confirm(opts: Omit<Ask, 'resolve'>) {
  return new Promise<boolean>((resolve) => {
    useAsk.getState().ask?.resolve(false)
    useAsk.setState({ ask: { ...opts, resolve } })
  })
}

export function ConfirmHost() {
  const ask = useAsk((s) => s.ask)
  const okRef = useRef<HTMLButtonElement>(null)
  const done = (v: boolean) => {
    ask?.resolve(v)
    useAsk.setState({ ask: null })
  }

  useEffect(() => {
    if (!ask) return
    // 危险操作默认聚焦「取消」，避免回车误触
    if (!ask.danger) okRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && done(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ask])

  return (
    <AnimatePresence>
      {ask && (
        <div className="fixed inset-0 z-[70] grid place-items-center p-4" role="presentation">
          <motion.div
            className="absolute inset-0 bg-black/45"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => done(false)}
          />
          <MotionGlass
            dense
            role="alertdialog"
            aria-modal="true"
            aria-label={ask.title}
            initial={{ opacity: 0, scale: 0.94, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={spring.fast}
            className="relative flex w-[min(440px,100%)] flex-col gap-3 rounded-[26px] p-6 [--g-drop:0_30px_80px_rgba(0,0,0,.5)]"
          >
            <h2 className="m-0 text-lg font-bold">{ask.title}</h2>
            {ask.body && <div className="text-sm leading-relaxed text-muted">{ask.body}</div>}
            <div className="mt-2 flex justify-end gap-2.5">
              <button type="button" className="gbtn rounded-full hover:bg-hover" onClick={() => done(false)}>
                取消
              </button>
              <button
                ref={okRef}
                type="button"
                className={cn('solid min-h-11', ask.danger && 'bg-danger! text-white!')}
                onClick={() => done(true)}
              >
                {ask.ok ?? '确定'}
              </button>
            </div>
          </MotionGlass>
        </div>
      )}
    </AnimatePresence>
  )
}
