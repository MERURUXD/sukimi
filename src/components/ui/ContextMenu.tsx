import { AnimatePresence, usePresence, useReducedMotion } from 'motion/react'
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react'
import { createPortal } from 'react-dom'
import {
  clamp,
  createGlassOverlayRenderer,
  interpolateCssGlassSurfaceToMaterial,
  resolveOpticalMaterial,
  type BackdropVeilOptics,
  type ExtractedCssGlassSurface,
  type IGlassOverlayRenderer,
  type Rect,
} from '@sessile/core'
import { cancelAnimationFrameSafe, scheduleAnimationFrame, supportsSvgBackdropRefraction } from '@sessile/dom'
import {
  POPOVER_MORPH_DEFAULTS,
  createPopoverMorphController,
  type PopoverAnchorConfig,
  type PopoverMorphController,
  type PopoverMorphPhase,
  type PopoverMotionState,
  type PopoverPanelConfig,
} from '@sessile/presets'
import { MotionGlass } from '@/components/glass/Glass'
import { borderBoxSize, getGlassSurface } from '@/components/glass/surface'
import {
  applyMorphBackdropLayers,
  applyPanelMorphFrame,
  clearPanelMorphStyles,
  computeTransitionBounds,
  readElementGlassSurface,
  resolveElementTheme,
  resolvePointCardRect,
  updateMorphOverlayCanvas,
  type ContextMenuPoint,
  type ElementTintVars,
} from '@/components/glass/morph/hybridSurface'
import { MorphRefractFilter, type MorphRefractFilterHandle } from '@/components/glass/morph/refractFilter'
import { GLASS_REFRACT_SCALE_MULTIPLIER, useGlassTuning } from '@/design/glassTuning'
import { fade, still } from '@/design/motion'
import { useAppearance } from '@/design/settings'
import { cn } from '@/lib/cn'

export type { ContextMenuPoint }

/**
 * 右键 / 长按菜单的状态：一页只放一个菜单，打开时记下点在哪、对哪一项。
 * 长列表里不用给每一格挂弹出层，只有打开的那一个在渲染。
 */
export function useContextMenu<T>() {
  const [menu, setMenu] = useState<{ x: number; y: number; avoidRect?: Rect; target: T } | null>(null)
  const close = useCallback(() => setMenu(null), [])
  const open = useCallback((x: number, y: number, target: T, avoidRect?: Rect) => setMenu({ x, y, avoidRect, target }), [])
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

interface PlacedCard {
  left: number
  top: number
  width: number
  height: number
}

function sameCard(a: PlacedCard | null, b: PlacedCard): boolean {
  return Boolean(a && a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height)
}

/** 统一维护右键菜单的焦点借还、第一项自动聚焦、键盘游走和外部关闭监听。 */
function useContextMenuBehavior({
  panelRef,
  at,
  active,
  ready,
  onClose,
}: {
  panelRef: RefObject<HTMLElement | null>
  at: ContextMenuPoint
  active: boolean
  ready: boolean
  onClose: () => void
}) {
  const closeRef = useRef(onClose)
  const returnTo = useRef<HTMLElement | null>(null)
  useLayoutEffect(() => {
    closeRef.current = onClose
  }, [onClose])

  // 打开时记住触发元素。菜单先藏着量尺寸（或叠加层 pointer-events-none），elementFromPoint 还能点到下面的封面。
  // 点到菜单自己（或焦点已经在菜单里）时退回菜单外的焦点，关闭后才不会把焦点还给即将卸掉的菜单项
  useLayoutEffect(() => {
    if (!active) return
    const activeEl = document.activeElement
    const hit = document.elementFromPoint(at.x, at.y)
    const nearest = hit instanceof Element ? hit.closest('a, button, [tabindex]') : null
    const outside = (el: Element | null) =>
      el instanceof HTMLElement && !panelRef.current?.contains(el) && el !== document.body && el !== document.documentElement
        ? el
        : null
    returnTo.current = outside(nearest) ?? outside(activeEl)
  }, [active, at.x, at.y, panelRef])

  // 还焦点放在提交之后。关闭时立刻把焦点还回触发处，避免等退出动画卸掉后丢失焦点。
  useEffect(() => {
    if (!active) return
    return () => {
      const back = returnTo.current
      if (back?.isConnected) back.focus({ preventScroll: true })
    }
  }, [active, at])

  // 量好位置、显示出来之后再把焦点移到第一项（藏着的元素聚焦不了），键盘用户不用再找
  useEffect(() => {
    if (active && ready && panelRef.current) {
      menuItems(panelRef.current)[0]?.focus({ preventScroll: true })
    }
  }, [active, ready, at, panelRef])

  useEffect(() => {
    if (!active) return
    const move = (dir: 1 | -1 | 'start' | 'end') => {
      const root = panelRef.current
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
      if (!panelRef.current?.contains(e.target as Node)) closeRef.current()
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
  }, [active, panelRef])
}

/** 关闭「菜单液态形变」或系统减弱动态时的菜单：复用 `belowPoint` 定位，只淡入淡出（减弱动态时直接出现），零逐帧折射开销。 */
function LiteContextMenuPanel({
  at,
  onClose,
  label,
  className,
  reduced,
  children,
}: {
  at: ContextMenuPoint
  onClose: () => void
  label: string
  className?: string
  reduced: boolean
  children: ReactNode
}) {
  const [isPresent] = usePresence()
  const panelRef = useRef<HTMLElement>(null)
  const [pos, setPos] = useState<PlacedCard | null>(null)

  useLayoutEffect(() => {
    if (!isPresent) return
    const sync = () => {
      const panelEl = panelRef.current
      if (!panelEl) return
      const { width: w, height: h } = borderBoxSize(panelEl)
      const card = resolvePointCardRect(at, w, h)
      const next: PlacedCard = { left: card.x, top: card.y, width: w, height: h }
      setPos((prev) => (sameCard(prev, next) ? prev : next))
    }
    sync()
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(sync) : null
    if (ro && panelRef.current) ro.observe(panelRef.current)
    return () => ro?.disconnect()
  }, [isPresent, at])

  useContextMenuBehavior({
    panelRef,
    at,
    active: isPresent,
    ready: pos !== null,
    onClose,
  })

  return (
    <MotionGlass
      ref={panelRef}
      role="menu"
      aria-label={label}
      dense
      initial={reduced ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={reduced ? still : fade.fast}
      // 量好尺寸之前先藏着，免得在角落闪一下
      style={{
        left: pos?.left ?? at.x,
        top: pos?.top ?? at.y,
        visibility: pos ? 'visible' : 'hidden',
        pointerEvents: isPresent ? undefined : 'none',
      }}
      className={cn('fixed z-[70] w-[220px] rounded-[24px] p-3 [--g-drop:0_24px_60px_rgba(0,0,0,.45)]', className)}
      onContextMenu={(e: React.MouseEvent) => e.preventDefault()}
    >
      {children}
    </MotionGlass>
  )
}

interface MeasuredPointAnchors {
  anchorRect: Rect
  avoidRect?: Rect
  restingCardRect: Rect
  transitionBounds: Rect
  restingRadius: number
  startSurface: ExtractedCssGlassSurface
  panelSurface: ExtractedCssGlassSurface
  startVeil: BackdropVeilOptics
  startTintVars: ElementTintVars
  panelTintVars: ElementTintVars
}

/** 液态形变路径：复用 PrismUI `belowPoint` 几何与 `hasControlSource = false` 点菜单物理闭合。 */
function PointMorphMenuPanel({
  at,
  onClose,
  label,
  className,
  children,
}: {
  at: ContextMenuPoint
  onClose: () => void
  label: string
  className?: string
  children: ReactNode
}) {
  const [isPresent, safeToRemove] = usePresence()
  const glassMode = useAppearance((s) => s.glass)
  const tuning = useGlassTuning()
  const refractSupported = supportsSvgBackdropRefraction()
  const morphFilterId = `ctxMorphRefract${useId().replace(/[:«»]/g, '')}`

  const panelRef = useRef<HTMLElement>(null)
  const morphBackdropRef = useRef<HTMLDivElement>(null)
  const morphGlassRef = useRef<HTMLDivElement>(null)
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null)
  const morphRefractHandleRef = useRef<MorphRefractFilterHandle>(null)

  const [pos, setPos] = useState<PlacedCard | null>(null)
  const motionRef = useRef<PopoverMorphController | null>(null)
  const overlayRendererRef = useRef<IGlassOverlayRenderer | null>(null)
  const radiusRef = useRef<number | null>(null)
  const anchorsRef = useRef<MeasuredPointAnchors | null>(null)
  const lastPhaseRef = useRef<PopoverMorphPhase>('closed')
  const isTransitioningRef = useRef(false)
  const transitionRestoreRafRef = useRef(0)
  const safeToRemoveRef = useRef(safeToRemove)
  safeToRemoveRef.current = safeToRemove
  const isPresentRef = useRef(isPresent)
  isPresentRef.current = isPresent
  const atRef = useRef(at)
  atRef.current = at

  const isLegible = Boolean(className?.includes('glass-legible'))
  const latestVisualRef = useRef({
    glassMode,
    tuning,
    isLegible,
  })
  latestVisualRef.current = {
    glassMode,
    tuning,
    isLegible,
  }

  useContextMenuBehavior({
    panelRef,
    at,
    active: isPresent,
    ready: pos !== null,
    onClose,
  })

  const measurePointAnchors = (point: ContextMenuPoint): MeasuredPointAnchors | null => {
    const panelEl = panelRef.current
    if (!panelEl) return null

    const { width: pw, height: ph } = borderBoxSize(panelEl)
    const measuredRadius = parseFloat(getComputedStyle(panelEl).borderTopLeftRadius)
    radiusRef.current ??= Number.isFinite(measuredRadius) && measuredRadius > 0
      ? measuredRadius
      : POPOVER_MORPH_DEFAULTS.restingRadius
    const restingCardRect = resolvePointCardRect(point, pw, ph, radiusRef.current)
    const restingRadius = Math.min(radiusRef.current, pw * 0.5, ph * 0.5)

    if (panelEl.dataset.lensRadius !== String(radiusRef.current)) {
      panelEl.dataset.lensRadius = String(radiusRef.current)
    }

    const nextPos: PlacedCard = {
      left: restingCardRect.x,
      top: restingCardRect.y,
      width: pw,
      height: ph,
    }
    panelEl.style.left = `${restingCardRect.x}px`
    panelEl.style.top = `${restingCardRect.y}px`
    setPos((prev) => (sameCard(prev, nextPos) ? prev : nextPos))

    const anchorRect: Rect = { x: point.x, y: point.y, width: 0, height: 0 }
    const inflatedAnchor: Rect = {
      x: point.x - POPOVER_MORPH_DEFAULTS.bareAnchorInflateX,
      y: point.y - POPOVER_MORPH_DEFAULTS.bareAnchorInflateY,
      width: POPOVER_MORPH_DEFAULTS.bareAnchorInflateX * 2,
      height: POPOVER_MORPH_DEFAULTS.bareAnchorInflateY * 2,
    }
    const transitionBounds = computeTransitionBounds(inflatedAnchor, restingCardRect)

    const { surface: panelSurface, plateVeil, tintVars: panelTintVars } = readElementGlassSurface(panelEl)
    const startSurface: ExtractedCssGlassSurface = {
      ...panelSurface,
      veil: plateVeil,
      borderRgba: [
        panelSurface.borderRgba[0],
        panelSurface.borderRgba[1],
        panelSurface.borderRgba[2],
        0,
      ],
      outlineAlpha: 0,
      rimOpacity: 0,
      shadowBlur: 0,
      shadowOffsetY: 0,
      shadowAlpha: 0,
    }
    const startTintVars: ElementTintVars = {
      ...panelTintVars,
      isDense: false,
    }

    const measured: MeasuredPointAnchors = {
      anchorRect,
      avoidRect: point.avoidRect,
      restingCardRect,
      transitionBounds,
      restingRadius,
      startSurface,
      panelSurface,
      startVeil: plateVeil,
      startTintVars,
      panelTintVars,
    }
    anchorsRef.current = measured
    return measured
  }

  const applyFrameToDom = (mState: PopoverMotionState) => {
    const panelEl = panelRef.current
    const morphGlassEl = morphGlassRef.current
    const morphBackdropEl = morphBackdropRef.current
    const overlayCanvasEl = overlayCanvasRef.current
    const anchors = anchorsRef.current
    if (!panelEl || !anchors) return

    const isTransitioning = mState.phase === 'opening' || mState.phase === 'closing'
    isTransitioningRef.current = isTransitioning
    if (isTransitioning) {
      cancelAnimationFrameSafe(transitionRestoreRafRef.current)
    }

    if (mState.phase === 'open') {
      if (morphBackdropEl) morphBackdropEl.style.visibility = 'hidden'
      if (morphGlassEl) morphGlassEl.style.visibility = 'hidden'
      if (overlayCanvasEl) {
        overlayCanvasEl.style.visibility = 'hidden'
        overlayRendererRef.current?.clear()
      }
      panelEl.style.transition = 'none'
      clearPanelMorphStyles(panelEl, { keepLayer: true })
      cancelAnimationFrameSafe(transitionRestoreRafRef.current)
      transitionRestoreRafRef.current = scheduleAnimationFrame(() => {
        if (panelRef.current && !isTransitioningRef.current) {
          panelRef.current.style.transition = ''
        }
      })
      return
    }

    if (mState.phase === 'closed') {
      if (morphBackdropEl) morphBackdropEl.style.visibility = 'hidden'
      if (morphGlassEl) morphGlassEl.style.visibility = 'hidden'
      if (overlayCanvasEl) {
        overlayCanvasEl.style.visibility = 'hidden'
        overlayRendererRef.current?.clear()
      }
      panelEl.setAttribute('data-morphing', 'true')
      panelEl.style.opacity = '0'
      return
    }

    const { glassMode: gMode, tuning: gTuning, isLegible: legible } = latestVisualRef.current

    const anchorConfig: PopoverAnchorConfig = {
      anchorRect: anchors.anchorRect,
      avoidRect: anchors.avoidRect,
      placement: 'belowPoint',
      bareSource: true,
      inflateBareAnchor: true,
      viewportSize: { width: window.innerWidth, height: window.innerHeight },
    }
    const panelConfig: PopoverPanelConfig = {
      size: {
        width: anchors.restingCardRect.width,
        height: anchors.restingCardRect.height,
      },
      targetRectOverride: anchors.restingCardRect,
      restingRadius: anchors.restingRadius,
    }

    const motion = motionRef.current
    if (!motion) return
    const geometry = motion.evaluateGeometry(anchorConfig, panelConfig)
    const resolvedTheme = resolveElementTheme(panelEl)

    applyPanelMorphFrame(panelEl, geometry, anchors.restingCardRect, mState)

    const bounds = anchors.transitionBounds
    const glassAlpha = mState.phase === 'closing' ? mState.contentOpacity : clamp(mState.settled / 0.2, 0, 1)
    const refractHandle = morphRefractHandleRef.current
    const legibility = getGlassSurface(panelEl)?.getLegibilityParams() ?? null

    applyMorphBackdropLayers({
      morphGlassEl,
      morphBackdropEl,
      morphFilterId,
      refractSupported,
      hasRefractHandle: Boolean(refractHandle),
      glassMode: gMode,
      tuning: gTuning,
      dense: true,
      isLegible: legible,
      resolvedTheme,
      glassAlpha,
      bounds,
      geometry,
      mState,
      bareSource: true,
      startTintVars: anchors.startTintVars,
      panelTintVars: anchors.panelTintVars,
      startVeil: anchors.startVeil,
      panelSurface: anchors.panelSurface,
      legibility,
      refractScaleMultiplier: GLASS_REFRACT_SCALE_MULTIPLIER,
      onUpdateRefractFrame: (frame, legibility) => {
        refractHandle?.updateFrame(frame)
        refractHandle?.updateLegibility(legibility)
      },
    })

    const material = interpolateCssGlassSurfaceToMaterial(
      resolveOpticalMaterial(resolvedTheme, geometry.styleMix),
      anchors.startSurface,
      anchors.panelSurface,
      geometry.styleMix,
    )
    updateMorphOverlayCanvas(
      overlayCanvasEl,
      overlayRendererRef.current,
      bounds,
      resolvedTheme,
      geometry,
      material,
      glassAlpha,
      gTuning.preset === 'prism' ? mState.blurBumpPx : 0,
      legibility,
    )
  }

  useLayoutEffect(() => {
    const controller = createPopoverMorphController({ reducedMotion: false })
    motionRef.current = controller

    // 和静态玻璃共用一个 WebGL2 上下文，反复打开也不会挤掉其他上下文
    const renderer = createGlassOverlayRenderer({ context: 'shared' })
    overlayRendererRef.current = renderer
    if (overlayCanvasRef.current) {
      renderer.mount(overlayCanvasRef.current)
    }

    return () => {
      cancelAnimationFrameSafe(transitionRestoreRafRef.current)
      controller.dispose()
      if (motionRef.current === controller) motionRef.current = null
      renderer.dispose()
      if (overlayRendererRef.current === renderer) overlayRendererRef.current = null
    }
  }, [])

  // 外观设置变化时同步重新采样表面光学
  useLayoutEffect(() => {
    measurePointAnchors(atRef.current)
    if (isTransitioningRef.current && motionRef.current && anchorsRef.current) {
      applyFrameToDom(motionRef.current.getState())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [glassMode, tuning, className])

  // 菜单内容尺寸变化时更新 `belowPoint` 落点
  useLayoutEffect(() => {
    const ro = typeof ResizeObserver === 'function'
      ? new ResizeObserver(() => {
          const panelEl = panelRef.current
          if (!panelEl) return
          const cur = anchorsRef.current?.restingCardRect
          const size = borderBoxSize(panelEl)
          if (cur && size.width === cur.width && size.height === cur.height) return
          const measured = measurePointAnchors(atRef.current)
          if (measured && motionRef.current) applyFrameToDom(motionRef.current.getState())
        })
      : null
    if (ro && panelRef.current) ro.observe(panelRef.current)
    return () => ro?.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 由 isPresent 和点击坐标驱动 `belowPoint` 展开与 200ms 点菜单闭合
  useLayoutEffect(() => {
    const motion = motionRef.current
    if (!motion) return

    measurePointAnchors(at)

    if (isPresent) {
      // 打开着或正在展开时换了点击位置：从头在新位置重放展开，和换位置前的观感一致。
      // Sessile 的 open() 在这两个阶段是幂等的，不重置就会让面板直接跳到新位置。
      // 收起中途重新打开仍交给 open() 从当前形态接回。
      const { phase } = motion.getState()
      if (phase === 'open' || phase === 'opening') motion.reset('closed')
      motion.open(false)
    } else {
      motion.close()
    }

    lastPhaseRef.current = motion.getState().phase
    applyFrameToDom(motion.getState())

    let rafId = 0
    let lastTs = performance.now()
    let active = true

    const tick = (now: number) => {
      if (!active) return
      const dt = Math.min(0.05, Math.max(0, (now - lastTs) / 1000))
      lastTs = now
      const next = dt > 0 ? motion.step(dt) : motion.getState()
      applyFrameToDom(next)

      if (next.phase !== lastPhaseRef.current) {
        lastPhaseRef.current = next.phase
      }

      if (next.phase === 'closed' && !isPresentRef.current) {
        safeToRemoveRef.current?.()
        return
      }

      if (next.isAnimating || next.phase === 'opening' || next.phase === 'closing') {
        rafId = scheduleAnimationFrame(tick)
      }
    }

    rafId = scheduleAnimationFrame(tick)
    return () => {
      active = false
      cancelAnimationFrameSafe(rafId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPresent, at.x, at.y, at.avoidRect?.x, at.avoidRect?.y, at.avoidRect?.width, at.avoidRect?.height])

  const canUseMorphRefract = glassMode === 'refract' && refractSupported

  return (
    <>
      <div
        ref={morphBackdropRef}
        aria-hidden="true"
        style={{ visibility: 'hidden' }}
        className="pointer-events-none fixed top-0 left-0 z-[70]"
      />
      <div
        ref={morphGlassRef}
        aria-hidden="true"
        style={{ visibility: 'hidden' }}
        className="pointer-events-none fixed top-0 left-0 z-[70] isolate"
      />
      <MotionGlass
        ref={panelRef}
        role="menu"
        aria-label={label}
        dense
        style={{
          left: pos?.left ?? at.x,
          top: pos?.top ?? at.y,
          visibility: pos ? 'visible' : 'hidden',
          pointerEvents: isPresent ? undefined : 'none',
        }}
        className={cn('fixed z-[70] w-[220px] rounded-[24px] p-3 [--g-drop:0_24px_60px_rgba(0,0,0,.45)]', className)}
        onContextMenu={(e: React.MouseEvent) => e.preventDefault()}
      >
        {children}
      </MotionGlass>
      <canvas
        ref={overlayCanvasRef}
        aria-hidden="true"
        style={{ visibility: 'hidden' }}
        className="pointer-events-none fixed top-0 left-0 z-[70]"
      />
      {canUseMorphRefract && (
        <MorphRefractFilter
          ref={morphRefractHandleRef}
          id={morphFilterId}
          bezel={tuning.bezel}
          strength={tuning.strength}
          dispersion={tuning.dispersion}
          scaleMultiplier={GLASS_REFRACT_SCALE_MULTIPLIER}
          profile={tuning.profile}
          ior={tuning.ior}
        />
      )}
    </>
  )
}

/** 挂到 body 上，避开网格格子的裁切和层叠；通过 `belowPoint` 策略定位与展开。 */
export function ContextMenu({ at, onClose, label, children, className }: {
  at: ContextMenuPoint | null
  onClose: () => void
  label: string
  children: ReactNode
  className?: string
}) {
  const systemReduced = Boolean(useReducedMotion())
  const popoverMotion = useAppearance((s) => s.popoverMotion)
  const useFullMorph = !systemReduced && popoverMotion

  return createPortal(
    <AnimatePresence>
      {at && (
        useFullMorph ? (
          <PointMorphMenuPanel
            key="morph"
            at={at}
            onClose={onClose}
            label={label}
            className={className}
          >
            {children}
          </PointMorphMenuPanel>
        ) : (
          <LiteContextMenuPanel
            key="lite"
            at={at}
            onClose={onClose}
            label={label}
            className={className}
            reduced={systemReduced}
          >
            {children}
          </LiteContextMenuPanel>
        )
      )}
    </AnimatePresence>,
    document.body,
  )
}
