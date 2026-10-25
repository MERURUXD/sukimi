import { AnimatePresence, animate, useMotionValue, useMotionValueEvent, usePresence, useReducedMotion, useTransform } from 'motion/react'
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react'
import { MotionGlass } from '@/components/glass/Glass'
import { fade, morph } from '@/design/motion'
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
  dense = true,
  vtGlass,
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
  /** 面板玻璃更实；顶栏外观菜单沿用普通玻璃 */
  dense?: boolean
  /** 页面转场时把面板和导航玻璃一起提成独立分组（index.css 的 data-vt-glass 规则） */
  vtGlass?: string
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

  return (
    <div ref={root} className={cn('relative', rootClassName)}>
      {trigger}
      <AnimatePresence>
        {open && (
          <MorphPanel
            root={root}
            side={placedSide}
            align={align}
            placement={`${placedSide}|${bounds?.room ?? ''}`}
            id={id}
            label={label}
            dense={dense}
            vtGlass={vtGlass}
            layoutScroll={fitViewport}
            style={fitViewport && bounds ? ({ '--popover-room': `${bounds.room}px`, maxHeight: bounds.room } as CSSProperties) : undefined}
            className={cn(
              'absolute z-50 rounded-[24px] p-3 [--g-drop:0_24px_60px_rgba(0,0,0,.45)]',
              placedSide === 'bottom' ? 'top-[calc(100%+10px)]' : 'bottom-[calc(100%+10px)]',
              align === 'right' ? 'right-0' : 'left-0',
              fitViewport && 'no-scrollbar overflow-y-auto overscroll-contain',
              className,
            )}
          >
            {children}
          </MorphPanel>
        )}
      </AnimatePresence>
    </div>
  )
}

/** 面板相对落定状态的起点：左上角偏移、横竖缩放，以及起点和终点的圆角 */
type Geometry = { x: number; y: number; sx: number; sy: number; from: number; to: number }

const IDENTITY: Geometry = { x: 0, y: 0, sx: 1, sy: 1, from: 0, to: 0 }
const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const mix = (a: number, b: number, t: number) => a + (b - a) * t

/**
 * 仿 iOS 菜单：玻璃从触发按钮的位置和大小长成面板，内容稍后淡入，收起时原路缩回按钮。
 * 全程只动 transform，玻璃的布局尺寸不变，折射位移图（refract.tsx 按 offsetWidth 生成）不会逐帧重画。
 * 触发区域太大（比如长按整张封面）时退回原来的就地轻缩放。
 */
function MorphPanel({
  root,
  side,
  align,
  placement,
  id,
  label,
  dense,
  vtGlass,
  layoutScroll,
  style,
  className,
  children,
}: {
  root: RefObject<HTMLDivElement | null>
  side: 'top' | 'bottom'
  align: 'left' | 'right'
  /** 面板翻到另一侧或可用高度变化时重新量起点 */
  placement: string
  id?: string
  label?: string
  dense: boolean
  vtGlass?: string
  layoutScroll: boolean
  style?: CSSProperties
  className: string
  children: ReactNode
}) {
  const [isPresent, safeToRemove] = usePresence()
  const reduced = useReducedMotion()
  const panel = useRef<HTMLElement>(null)
  const radius = useRef<number | null>(null)
  const progress = useMotionValue(0)
  // 量到之前保持隐藏，避免第一帧在终点闪一下
  const geo = useMotionValue<Geometry | null>(null)

  const at = (g: Geometry | null, v: number) =>
    g ? { x: g.x * (1 - v), y: g.y * (1 - v), sx: mix(g.sx, 1, v), sy: mix(g.sy, 1, v) } : { x: 0, y: 0, sx: 1, sy: 1 }
  // 函数形式的 useTransform 只在第一次计算时登记读到的 motion value，
  // 所以每个函数都要先无条件读 progress 和 geo，不能在读之前提前返回
  const x = useTransform(() => at(geo.get(), progress.get()).x)
  const y = useTransform(() => at(geo.get(), progress.get()).y)
  const scaleX = useTransform(() => at(geo.get(), progress.get()).sx)
  const scaleY = useTransform(() => at(geo.get(), progress.get()).sy)
  // 圆角按缩放反算：缩小时看上去仍是按钮的圆角，而不是被压扁的面板圆角
  const borderRadius = useTransform(() => {
    const g = geo.get()
    const v = progress.get()
    if (!g || g === IDENTITY) return ''
    const r = mix(g.from, g.to, v)
    const { sx, sy } = at(g, v)
    return `${r / sx}px / ${r / sy}px`
  })
  // 玻璃先出现，内容等形状基本长开再淡入；收起时反过来
  const opacity = useTransform(() => {
    const g = geo.get()
    const v = progress.get()
    return g ? clamp01(v / 0.2) : 0
  })
  // 内容透明度直接写在面板的直接子元素上：用继承的 CSS 变量会让整棵子树每帧重算样式。
  // 不能给整个内容包一层：调用方的 className 按直接子元素排布（flex、gap）。
  // 跟着 progress 每帧写：若只在内容透明度变化时写，0～0.3 段一直是 0 不触发，内容会先露一下
  const showContent = (v: number) => {
    const el = panel.current
    if (!el) return
    const o = clamp01((v - 0.3) / 0.65)
    for (const child of el.children) {
      if (child instanceof HTMLElement) child.style.opacity = o >= 1 ? '' : String(o)
    }
  }
  useMotionValueEvent(progress, 'change', showContent)

  const measure = () => {
    const el = panel.current
    const trigger = root.current?.firstElementChild
    if (!el || !trigger || trigger === el) return null
    // 布局尺寸不受 transform 影响；位置要扣掉当前的位移才是落定位置。
    // 位移从计算样式读：motion 下一帧才把新值写进 DOM，按 motion value 推算会和实际画面对不上
    const pw = el.offsetWidth
    const ph = el.offsetHeight
    const shift = new DOMMatrixReadOnly(getComputedStyle(el).transform)
    const box = el.getBoundingClientRect()
    const left = box.left - shift.e
    const top = box.top - shift.f
    // 终点圆角只在第一次量时读：之后面板上挂着动画中的椭圆圆角，读到的不是样式表里的值
    radius.current ??= parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0
    // 折射位移图也按这个圆角画（refract.tsx），否则途中变高时会按椭圆圆角重画，落定后一直不对
    el.dataset.lensRadius = String(radius.current)
    const to = Math.min(radius.current, pw / 2, ph / 2)
    if (reduced || !pw || !ph) return IDENTITY
    const t = trigger.getBoundingClientRect()
    if (!t.width || !t.height || t.width * t.height > pw * ph * 0.35) {
      // 就地轻缩放：以靠近按钮的角为原点缩到 0.94，再往按钮方向偏 6px
      const s = 0.94
      const ox = align === 'right' ? pw : 0
      const oy = side === 'bottom' ? 0 : ph
      return { x: ox * (1 - s), y: oy * (1 - s) + (side === 'bottom' ? -6 : 6), sx: s, sy: s, from: to * s, to }
    }
    const from = Math.min(parseFloat(getComputedStyle(trigger).borderTopLeftRadius) || 0, t.width / 2, t.height / 2)
    return { x: t.left - left, y: t.top - top, sx: t.width / pw, sy: t.height / ph, from, to }
  }

  useLayoutEffect(() => {
    const sync = () => {
      const g = measure()
      if (g) geo.set(g)
    }
    sync()
    showContent(progress.get())
    // 内容异步加载会让面板在展开途中变高，起点比例要跟着重算，否则会从比按钮大得多的形状开始
    const ro = new ResizeObserver(sync)
    if (panel.current) ro.observe(panel.current)
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placement])

  useEffect(() => {
    let live = true
    if (isPresent) {
      const run = animate(progress, 1, reduced ? fade.fast : morph.open)
      return () => {
        live = false
        run.stop()
      }
    }
    // 收起时重新量一次：打开期间页面可能滚过、按钮可能挪了位置
    const g = measure()
    if (g) geo.set(g)
    const run = animate(progress, 0, reduced ? fade.fast : morph.close)
    run.then(() => live && safeToRemove?.())
    return () => {
      live = false
      run.stop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPresent])

  return (
    <MotionGlass
      ref={panel}
      id={id}
      role="dialog"
      aria-label={label}
      data-vt-glass={vtGlass}
      dense={dense}
      layoutScroll={layoutScroll}
      style={{ ...style, x, y, scaleX, scaleY, opacity, borderRadius, transformOrigin: '0 0', pointerEvents: isPresent ? undefined : 'none' }}
      className={className}
    >
      {children}
    </MotionGlass>
  )
}
