import { AnimatePresence } from 'motion/react'
import { useRef, type ReactNode } from 'react'
import { create } from 'zustand'
import { MotionGlass } from '@/components/glass/Glass'
import { resetOnUserContext } from '@/api/userContext'
import { writesSharedServer } from '@/lib/channel'
import { cn } from '@/lib/cn'
import { Dialog, usePopMotion } from './Dialog'

interface Ask {
  id: number
  title: string
  body?: ReactNode
  ok?: string
  danger?: boolean
  /** 只改本浏览器的状态（如退出登录）；Preview 下不追加「写入真实数据」的提醒 */
  local?: boolean
  resolve: (v: boolean) => void
}

const useAsk = create<{ ask: Ask | null }>(() => ({ ask: null }))
let seq = 0

// 换身份时还没回答的确认框按「取消」处理：它属于上一个身份发起的操作，不能留给下一个身份去点
resetOnUserContext(() => {
  useAsk.getState().ask?.resolve(false)
  useAsk.setState({ ask: null })
})

/** 弹出确认框，用户确认返回 true。危险操作用 danger 把确认按钮标红 */
export function confirm(opts: Omit<Ask, 'resolve' | 'id'>) {
  return new Promise<boolean>((resolve) => {
    useAsk.getState().ask?.resolve(false)
    useAsk.setState({ ask: { ...opts, resolve, id: ++seq } })
  })
}

/** 测试隔离开例：还没回答的确认按取消收掉 */
export function resetConfirm() {
  useAsk.getState().ask?.resolve(false)
  useAsk.setState({ ask: null })
}

export function ConfirmHost() {
  const ask = useAsk((s) => s.ask)
  const okRef = useRef<HTMLButtonElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const pop = usePopMotion()
  const done = (v: boolean) => {
    ask?.resolve(v)
    useAsk.setState({ ask: null })
  }

  return (
    <AnimatePresence>
      {ask && (
        <Dialog
          key={ask.id}
          alert
          label={ask.title}
          onClose={() => done(false)}
          // 危险操作聚焦「取消」，避免回车误触；其余操作聚焦确定，回车就能确认
          initialFocus={ask.danger ? cancelRef : okRef}
        >
          <MotionGlass
            dense
            {...pop}
            className="relative flex w-[min(440px,100%)] flex-col gap-3 rounded-[26px] p-6 [--g-drop:0_30px_80px_rgba(0,0,0,.5)]"
          >
            <h2 className="m-0 text-lg font-bold">{ask.title}</h2>
            {ask.body && <div className="text-sm leading-relaxed text-muted">{ask.body}</div>}
            {/* Preview 与日用版共用同一个服务端，这里的确认几乎都会写入真实数据 */}
            {writesSharedServer && !ask.local && (
              <p className="m-0 text-sm leading-relaxed font-semibold text-danger">Preview 环境：此操作会写入与日用版共用的真实服务端数据。</p>
            )}
            <div className="mt-2 flex justify-end gap-2.5">
              <button ref={cancelRef} type="button" className="gbtn rounded-full hover:bg-hover" onClick={() => done(false)}>
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
        </Dialog>
      )}
    </AnimatePresence>
  )
}
