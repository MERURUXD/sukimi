import { AnimatePresence, useReducedMotion } from 'motion/react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { MotionGlass } from '@/components/glass/Glass'
import { spring, still } from '@/design/motion'
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

function menuItems(panel: HTMLElement) {
  const named = [...panel.querySelectorAll<HTMLElement>('[role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"]')]
    .filter((el) => !el.hasAttribute('disabled') && el.getAttribute('aria-disabled') !== 'true')
  if (named.length) return named
  return [...panel.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]')]
}

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
  const closeRef = useRef(onClose)
  const returnTo = useRef<HTMLElement | null>(null)
  const reduced = useReducedMotion()
  closeRef.current = onClose

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

  // 打开时记住触发元素。菜单先藏着量尺寸，elementFromPoint 还能点到下面的封面。
  // 点到菜单自己（或焦点已经在菜单里）时退回菜单外的焦点，关闭后才不会把焦点还给即将卸掉的菜单项
  useLayoutEffect(() => {
    if (!at) return
    const active = document.activeElement
    const hit = document.elementFromPoint(at.x, at.y)
    const nearest = hit instanceof Element ? hit.closest('a, button, [tabindex]') : null
    const outside = (el: Element | null) =>
      el instanceof HTMLElement && !panel.current?.contains(el) && el !== document.body && el !== document.documentElement ? el : null
    returnTo.current = outside(nearest) ?? outside(active)
  }, [at])

  // 还焦点放在提交之后。关掉时量位置的那次更新会在变更阶段把焦点扳回菜单项，
  // 若在布局阶段还回去，紧接着就被扳回来，菜单项一卸掉焦点就掉到页面开头
  useEffect(() => {
    if (!at) return
    return () => {
      const back = returnTo.current
      if (back?.isConnected) back.focus({ preventScroll: true })
    }
  }, [at])

  // 量好位置、显示出来之后再把焦点移到第一项（藏着的元素聚焦不了），键盘用户不用再找
  useEffect(() => {
    if (at && pos) panel.current && menuItems(panel.current)[0]?.focus({ preventScroll: true })
  }, [at, pos])

  useEffect(() => {
    if (!at) return
    const move = (dir: 1 | -1 | 'start' | 'end') => {
      const root = panel.current
      if (!root) return
      const list = menuItems(root)
      if (!list.length) return
      if (dir === 'start') return list[0].focus({ preventScroll: true })
      if (dir === 'end') return list.at(-1)?.focus({ preventScroll: true })
      const index = list.indexOf(document.activeElement as HTMLElement)
      const next = dir === 1 ? (index + 1) % list.length : index <= 0 ? list.length - 1 : index - 1
      list[next]?.focus({ preventScroll: true })
    }
    const onDown = (e: PointerEvent) => {
      if (!panel.current?.contains(e.target as Node)) closeRef.current()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        closeRef.current()
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        move(1)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        move(-1)
      } else if (e.key === 'Home') {
        e.preventDefault()
        move('start')
      } else if (e.key === 'End') {
        e.preventDefault()
        move('end')
      } else if (e.key === 'Tab') {
        e.preventDefault()
        move(e.shiftKey ? -1 : 1)
      }
    }
    const dismiss = () => closeRef.current()
    document.addEventListener('pointerdown', onDown, true)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', dismiss, true)
    window.addEventListener('resize', dismiss)
    return () => {
      document.removeEventListener('pointerdown', onDown, true)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', dismiss, true)
      window.removeEventListener('resize', dismiss)
    }
  }, [at])

  return createPortal(
    <AnimatePresence>
      {at && (
        <MotionGlass
          ref={panel}
          role="menu"
          aria-label={label}
          dense
          initial={reduced ? false : { opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
          transition={reduced ? still : spring.fast}
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
