import { motion, useReducedMotion } from 'motion/react'
import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { spring, still } from '@/design/motion'
import { cn } from '@/lib/cn'

/** 从先打开到后打开。只有最上面一层接收键盘，下面的层和页面都 inert */
const layers: HTMLElement[] = []

function syncInert() {
  const top = layers.at(-1) ?? null
  const root = document.getElementById('root')
  if (root) root.inert = layers.length > 0
  for (const node of layers) node.inert = node !== top
}

function labelOf(el: HTMLElement) {
  return (el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim()
}

function isDismiss(el: HTMLElement) {
  const name = labelOf(el)
  return name === '取消' || name === '关闭'
}

function focusableIn(panel: HTMLElement) {
  return [...panel.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]')].filter((el) => {
    if (el.getAttribute('aria-hidden') === 'true') return false
    const style = getComputedStyle(el)
    return style.display !== 'none' && style.visibility !== 'hidden'
  })
}

/** 显式指定的元素优先，否则「取消 / 关闭」，再否则第一个按钮 */
function pickFocus(panel: HTMLElement, explicit: HTMLElement | null) {
  if (explicit && panel.contains(explicit) && !explicit.hasAttribute('disabled')) return explicit
  const items = focusableIn(panel)
  return items.find((el) => el.tagName === 'BUTTON' && isDismiss(el))
    ?? items.find((el) => el.tagName === 'BUTTON')
    ?? items[0]
    ?? panel
}

/** 玻璃面板的进场。减少动态时直接出现在终点，不从缩小和位移开始 */
export function usePopMotion() {
  const reduced = useReducedMotion()
  return {
    initial: reduced ? false : { opacity: 0, scale: 0.94, y: 8 },
    animate: { opacity: 1, scale: 1, y: 0 },
    exit: reduced ? { opacity: 0 } : { opacity: 0, scale: 0.96 },
    transition: reduced ? still : spring.fast,
  }
}

/**
 * 模态层。打开时把焦点放进面板，Tab 在面板内循环，
 * 背后的页面设为 inert，关闭后焦点回到打开前的元素。
 * 挂到 body 上，这样可以把 #root 标成 inert，而对话框本身还在外面。
 */
export function Dialog({
  label,
  labelledBy,
  onClose,
  alert = false,
  initialFocus,
  closeOnBackdrop = true,
  backdropClassName = 'bg-black/45',
  className,
  fill = false,
  children,
}: {
  label?: string
  labelledBy?: string
  onClose: () => void
  /** 确认框用 alertdialog */
  alert?: boolean
  /** 打开时聚焦这个元素；不传则聚焦「取消」或「关闭」，都没有就聚焦第一个按钮 */
  initialFocus?: { readonly current: HTMLElement | null }
  closeOnBackdrop?: boolean
  backdropClassName?: string
  className?: string
  /** 整层就是对话框（封面放大），点空白处也关闭 */
  fill?: boolean
  children: ReactNode
}) {
  const reduced = useReducedMotion()
  const layerRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  const backdropRef = useRef(closeOnBackdrop)
  const explicitRef = useRef(initialFocus)
  closeRef.current = onClose
  backdropRef.current = closeOnBackdrop
  explicitRef.current = initialFocus

  useLayoutEffect(() => {
    const layer = layerRef.current
    const panel = panelRef.current
    if (!layer || !panel) return
    const previous = document.activeElement
    layers.push(layer)
    syncInert()
    pickFocus(panel, explicitRef.current?.current ?? null)?.focus({ preventScroll: true })

    const onKey = (e: KeyboardEvent) => {
      if (layers.at(-1) !== layer) return
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        closeRef.current()
        return
      }
      if (e.key !== 'Tab') return
      const items = focusableIn(panel)
      if (!items.length) {
        e.preventDefault()
        panel.focus({ preventScroll: true })
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement
      if (e.shiftKey) {
        if (active === first || !panel.contains(active)) {
          e.preventDefault()
          last.focus({ preventScroll: true })
        }
      } else if (active === last || !panel.contains(active)) {
        e.preventDefault()
        first.focus({ preventScroll: true })
      }
    }
    const onFocus = (e: FocusEvent) => {
      if (layers.at(-1) !== layer) return
      if (panel.contains(e.target as Node)) return
      pickFocus(panel, explicitRef.current?.current ?? null)?.focus({ preventScroll: true })
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('focusin', onFocus)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('focusin', onFocus)
      const index = layers.indexOf(layer)
      if (index >= 0) layers.splice(index, 1)
      syncInert()
      if (previous instanceof HTMLElement && previous.isConnected && !layer.contains(previous)) {
        previous.focus({ preventScroll: true })
      }
    }
    // 只在打开时记一次焦点。关掉时的清理会把焦点还回去，不能因为 onClose 换了身份就重跑
  }, [])

  const dialogProps = {
    role: alert ? 'alertdialog' as const : 'dialog' as const,
    'aria-modal': true as const,
    'aria-label': label,
    'aria-labelledby': labelledBy,
    tabIndex: -1 as const,
  }
  const backdrop = (
    <motion.div
      aria-hidden
      className={cn('absolute inset-0', backdropClassName)}
      initial={reduced ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={reduced ? still : { duration: 0.2 }}
      onClick={(e) => {
        e.stopPropagation()
        if (backdropRef.current) closeRef.current()
      }}
    />
  )

  const tree = fill ? (
    <div
      ref={(el) => {
        layerRef.current = el
        panelRef.current = el
      }}
      {...dialogProps}
      className={cn('fixed inset-0 z-[70] grid place-items-center p-4 outline-none', className)}
      onClick={() => {
        if (backdropRef.current) closeRef.current()
      }}
    >
      {backdrop}
      {children}
    </div>
  ) : (
    <div ref={layerRef} className={cn('fixed inset-0 z-[70] grid place-items-center p-4', className)} role="presentation">
      {backdrop}
      <div ref={panelRef} {...dialogProps} className="relative outline-none">
        {children}
      </div>
    </div>
  )

  return createPortal(tree, document.body)
}
