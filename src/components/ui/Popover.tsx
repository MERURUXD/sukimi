import { AnimatePresence, motion, usePresence, useReducedMotion } from 'motion/react'
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react'
import {
  clamp,
  createGlassOverlayRenderer,
  interpolateCssGlassSurfaceToMaterial,
  parseCssBoxShadow,
  parseCssRgba,
  resolveOpticalMaterial,
  type BackdropVeilOptics,
  type ExtractedCssGlassSurface,
  type IGlassOverlayRenderer,
  type Rect,
} from '@sessile/core'
import {
  POPOVER_MORPH_DEFAULTS,
  createPopoverMorphController,
  createPopoverMorphSnapshot,
  type PopoverAnchorConfig,
  type PopoverFrameGeometry,
  type PopoverMorphController,
  type PopoverMorphPhase,
  type PopoverMorphSnapshot,
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
  updateMorphOverlayCanvas,
  type ElementTintVars,
} from '@/components/glass/morph/hybridSurface'
import { MorphRefractFilter, type MorphRefractFilterHandle } from '@/components/glass/morph/refractFilter'
import { supportsSvgBackdropRefraction } from '@sessile/dom'
import { GLASS_REFRACT_SCALE_MULTIPLIER, useGlassTuning } from '@/design/glassTuning'
import { useAppearance } from '@/design/settings'
import { cn } from '@/lib/cn'

/** 触发按钮和面板需放在同一个 relative 容器内。 */
export function Popover({
  open,
  onClose,
  trigger,
  children,
  align = 'right',
  side = 'bottom',
  className,
  bodyClassName,
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
  /** 面板的形状与定位（宽度、窄屏 fixed 等） */
  className?: string
  /**
   * 内容的排版与内边距。fitViewport 时写在面板里的滚动层上，否则直接写在面板上：
   * 玻璃宿主自己不能滚动，否则边缘叠加层会被裁到内边距盒并跟着内容滚走。
   */
  bodyClassName?: string
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
      const above = box.bottom - 16
      const below = window.innerHeight - box.top - 16
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
            style={fitViewport && bounds ? ({ '--popover-room': `${bounds.room}px`, maxHeight: bounds.room } as CSSProperties) : undefined}
            className={cn(
              'absolute z-50 rounded-[24px] [--g-drop:0_0_0_transparent]',
              placedSide === 'bottom' ? '-top-2' : '-bottom-2',
              align === 'right' ? 'right-0' : 'left-0',
              fitViewport ? 'flex flex-col' : 'p-3',
              className,
              !fitViewport && bodyClassName,
            )}
          >
            {fitViewport ? (
              <motion.div layoutScroll className={cn('no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-[inherit] p-3', bodyClassName)}>
                {children}
              </motion.div>
            ) : (
              children
            )}
          </MorphPanel>
        )}
      </AnimatePresence>
    </div>
  )
}

interface TriggerSurfaceCss {
  background: string
  border: string
  boxShadow: string
}

interface MeasuredMorphAnchors {
  triggerEl: HTMLElement | null
  anchorRect: Rect
  restingCardRect: Rect
  transitionBounds: Rect
  restingRadius: number
  hasControlSource: boolean
  bareSource: boolean
  inflateBareAnchor: boolean
  bareSurfaceCss: TriggerSurfaceCss | null
  overlapsTrigger: boolean
  startSurface: ExtractedCssGlassSurface
  panelSurface: ExtractedCssGlassSurface
  startVeil: BackdropVeilOptics
  startTintVars: ElementTintVars
  panelTintVars: ElementTintVars
}

const LARGE_TRIGGER_AREA_RATIO = 0.45

function readVisibleTriggerSurface(el: HTMLElement): TriggerSurfaceCss | null {
  const cs = getComputedStyle(el)
  const bgAlpha = parseCssRgba(cs.backgroundColor)[3]
  const borderWidth = parseFloat(cs.borderTopWidth) || 0
  const borderAlpha = borderWidth > 0.05 ? parseCssRgba(cs.borderTopColor)[3] : 0
  const shadowLayers = parseCssBoxShadow(cs.boxShadow)
  const hasShadow = shadowLayers.some((l) => l.rgba[3] > 0.005)
  if (bgAlpha <= 0.005 && borderAlpha <= 0.005 && !hasShadow) {
    return null
  }
  return {
    background: bgAlpha > 0.005 ? cs.backgroundColor : 'transparent',
    border: borderAlpha > 0.005 ? `${borderWidth}px ${cs.borderTopStyle} ${cs.borderTopColor}` : 'none',
    boxShadow: hasShadow ? cs.boxShadow : 'none',
  }
}

function findTriggerElement(
  rootEl: HTMLElement,
  morphSurfaceEl: HTMLElement | null,
  morphBackdropEl: HTMLElement | null,
  morphGlassEl: HTMLElement | null,
  glyphHostEl: HTMLElement | null,
  overlayCanvasEl: HTMLElement | null,
  panelEl: HTMLElement,
): HTMLElement | null {
  for (const child of rootEl.children) {
    if (
      child === morphSurfaceEl ||
      child === morphBackdropEl ||
      child === morphGlassEl ||
      child === glyphHostEl ||
      child === overlayCanvasEl ||
      child === panelEl
    ) {
      break
    }
    if (!(child instanceof HTMLElement)) continue
    const rect = child.getBoundingClientRect()
    if (rect.width > 0 && rect.height > 0) {
      return child
    }
    if (child.firstElementChild instanceof HTMLElement) {
      const innerRect = child.firstElementChild.getBoundingClientRect()
      if (innerRect.width > 0 && innerRect.height > 0) {
        return child.firstElementChild
      }
    }
  }
  return null
}

function stripCloneIdsAndInteractiveAttrs(node: HTMLElement): void {
  node.removeAttribute('id')
  node.removeAttribute('data-refract')
  node.removeAttribute('data-elastic-press')
  node.setAttribute('aria-hidden', 'true')
  node.setAttribute('tabindex', '-1')
  node.style.pointerEvents = 'none'
  node.style.margin = '0'
  node.style.transform = ''
  for (const desc of node.querySelectorAll<HTMLElement>('[id]')) {
    desc.removeAttribute('id')
  }
}

/**
 * Live-DOM Hybrid liquid glass morphing panel:
 * 保持唯一挂载的 `MotionGlass` 承接内容、滚动与交互，在展开/收起过渡期间由
 * `smin` SDF 轮廓裁剪的动态毛玻璃层 + WebGL2/2D 轮廓高光与投影层接管流体形变，
 * 落定后无缝交还给原生 `.glass` + `refract.tsx` 静态透镜。
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
  style?: CSSProperties
  className: string
  children: ReactNode
}) {
  const [isPresent, safeToRemove] = usePresence()
  const systemReduced = Boolean(useReducedMotion())
  const popoverMotion = useAppearance((s) => s.popoverMotion)
  const reduced = systemReduced || !popoverMotion
  const glassMode = useAppearance((s) => s.glass)
  const tuning = useGlassTuning()
  const refractSupported = supportsSvgBackdropRefraction()
  const morphFilterId = `morphRefract${useId().replace(/[:«»]/g, '')}`

  const morphSurfaceRef = useRef<HTMLDivElement>(null)
  const morphBackdropRef = useRef<HTMLDivElement>(null)
  const morphRefractHandleRef = useRef<MorphRefractFilterHandle>(null)
  const morphGlassRef = useRef<HTMLDivElement>(null)
  const glyphHostRef = useRef<HTMLDivElement>(null)
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null)
  const panelRef = useRef<HTMLElement>(null)

  const motionRef = useRef<PopoverMorphController | null>(null)
  const overlayRendererRef = useRef<IGlassOverlayRenderer | null>(null)
  const radiusRef = useRef<number | null>(null)
  const measuredSizeRef = useRef({ width: 0, height: 0 })
  const anchorsRef = useRef<MeasuredMorphAnchors | null>(null)
  const elevatedTriggerRef = useRef<{
    el: HTMLElement
    prevPosition: string
    prevZIndex: string
  } | null>(null)
  const hiddenTriggerRef = useRef<{
    el: HTMLElement
    prevOpacity: string
  } | null>(null)
  const clonedSourceElRef = useRef<HTMLElement | null>(null)
  const lastGeometryRef = useRef<PopoverFrameGeometry | null>(null)
  const lastMotionRef = useRef<PopoverMotionState | null>(null)
  const lastPhaseRef = useRef<PopoverMorphPhase>('closed')
  const isTransitioningRef = useRef(false)
  const transitionRestoreRafRef = useRef<number>(0)
  const safeToRemoveRef = useRef(safeToRemove)
  safeToRemoveRef.current = safeToRemove
  const isPresentRef = useRef(isPresent)
  isPresentRef.current = isPresent

  const latestVisualRef = useRef({
    reduced,
    glassMode,
    tuning,
    dense,
    isLegible: className.includes('glass-legible'),
    side,
    align,
  })
  latestVisualRef.current = {
    reduced,
    glassMode,
    tuning,
    dense,
    isLegible: className.includes('glass-legible'),
    side,
    align,
  }

  const restoreElevatedTrigger = () => {
    const saved = elevatedTriggerRef.current
    if (!saved) return
    saved.el.style.position = saved.prevPosition
    saved.el.style.zIndex = saved.prevZIndex
    elevatedTriggerRef.current = null
  }

  const elevateTrigger = (triggerEl: HTMLElement | null) => {
    if (!triggerEl) {
      restoreElevatedTrigger()
      return
    }
    if (elevatedTriggerRef.current?.el === triggerEl) return
    restoreElevatedTrigger()
    const prevPosition = triggerEl.style.position
    const prevZIndex = triggerEl.style.zIndex
    if (getComputedStyle(triggerEl).position === 'static') {
      triggerEl.style.position = 'relative'
    }
    triggerEl.style.zIndex = '51'
    elevatedTriggerRef.current = { el: triggerEl, prevPosition, prevZIndex }
  }

  const restoreHiddenTrigger = () => {
    const saved = hiddenTriggerRef.current
    if (!saved) return
    saved.el.style.opacity = saved.prevOpacity
    hiddenTriggerRef.current = null
  }

  const hideTrigger = (triggerEl: HTMLElement | null) => {
    if (!triggerEl) {
      restoreHiddenTrigger()
      return
    }
    if (hiddenTriggerRef.current?.el === triggerEl) return
    restoreHiddenTrigger()
    const prevOpacity = triggerEl.style.opacity
    triggerEl.style.opacity = '0'
    hiddenTriggerRef.current = { el: triggerEl, prevOpacity }
  }

  const restoreTriggerVisuals = () => {
    restoreHiddenTrigger()
    restoreElevatedTrigger()
  }

  const clearClonedGlyph = () => {
    const host = glyphHostRef.current
    if (host) {
      host.style.visibility = 'hidden'
      host.style.opacity = '0'
      host.style.filter = 'none'
      host.replaceChildren()
    }
    clonedSourceElRef.current = null
  }

  const syncClonedGlyph = (triggerEl: HTMLElement | null, width: number, height: number) => {
    const host = glyphHostRef.current
    if (!host) return
    if (!triggerEl) {
      clearClonedGlyph()
      return
    }
    if (clonedSourceElRef.current !== triggerEl || host.childElementCount === 0) {
      const clone = triggerEl.cloneNode(true)
      if (clone instanceof HTMLElement) {
        stripCloneIdsAndInteractiveAttrs(clone)
        clone.style.opacity = ''
        clone.style.visibility = 'inherit'
        clone.style.width = `${width}px`
        clone.style.height = `${height}px`
        clone.style.background = 'transparent'
        clone.style.borderColor = 'transparent'
        clone.style.boxShadow = 'none'
        clone.style.backdropFilter = 'none'
        clone.style.setProperty('-webkit-backdrop-filter', 'none')
        clone.style.transition = 'none'
        host.replaceChildren(clone)
        clonedSourceElRef.current = triggerEl
      }
    } else if (host.firstElementChild instanceof HTMLElement) {
      host.firstElementChild.style.width = `${width}px`
      host.firstElementChild.style.height = `${height}px`
    }
  }

  const measureAnchors = (): MeasuredMorphAnchors | null => {
    const rootEl = root.current
    const panelEl = panelRef.current
    if (!rootEl || !panelEl) return null

    const { width: pw, height: ph } = borderBoxSize(panelEl)
    if (!pw || !ph) return null
    measuredSizeRef.current = { width: pw, height: ph }

    const rootRect = rootEl.getBoundingClientRect()
    const shift = new DOMMatrixReadOnly(getComputedStyle(panelEl).transform)
    const pBox = panelEl.getBoundingClientRect()
    const restingCardRect: Rect = {
      x: pBox.left + pBox.width * 0.5 - shift.e - pw * 0.5 - rootRect.left,
      y: pBox.top + pBox.height * 0.5 - shift.f - ph * 0.5 - rootRect.top,
      width: pw,
      height: ph,
    }

    radiusRef.current ??=
      parseFloat(getComputedStyle(panelEl).borderTopLeftRadius) || POPOVER_MORPH_DEFAULTS.restingRadius
    const restingRadius = Math.min(radiusRef.current, pw * 0.5, ph * 0.5)

    if (panelEl.dataset.lensRadius !== String(radiusRef.current)) {
      panelEl.dataset.lensRadius = String(radiusRef.current)
    }

    const triggerEl = findTriggerElement(
      rootEl,
      morphSurfaceRef.current,
      morphBackdropRef.current,
      morphGlassRef.current,
      glyphHostRef.current,
      overlayCanvasRef.current,
      panelEl,
    )

    let anchorRect: Rect = {
      x: restingCardRect.x + (align === 'right' ? pw - 40 : 0),
      y: restingCardRect.y + (side === 'bottom' ? 8 : Math.max(0, ph - 48)),
      width: 40,
      height: 40,
    }
    let hasControlSource = false
    let bareSource = true
    let inflateBareAnchor = true
    let bareSurfaceCss: TriggerSurfaceCss | null = null
    let overlapsTrigger = false

    if (triggerEl) {
      let tBox: DOMRect
      if (triggerEl.hasAttribute('data-elastic-press')) {
        const prevTransform = triggerEl.style.transform
        triggerEl.style.transform = 'none'
        tBox = triggerEl.getBoundingClientRect()
        triggerEl.style.transform = prevTransform
      } else {
        tBox = triggerEl.getBoundingClientRect()
      }
      if (tBox.width > 0 && tBox.height > 0) {
        anchorRect = {
          x: tBox.left - rootRect.left,
          y: tBox.top - rootRect.top,
          width: tBox.width,
          height: tBox.height,
        }
        const isGlassTrigger =
          triggerEl.classList.contains('glass') && !triggerEl.hasAttribute('data-flat')
        bareSource = !isGlassTrigger
        bareSurfaceCss = bareSource ? readVisibleTriggerSurface(triggerEl) : null
        // Never inflate padded buttons (e.g. .plain Dropdown, .gicon, InfoPop) beyond their resting DOM box.
        inflateBareAnchor =
          bareSource && bareSurfaceCss === null && Math.min(tBox.width, tBox.height) < 24
        overlapsTrigger =
          restingCardRect.x < anchorRect.x + anchorRect.width &&
          restingCardRect.x + restingCardRect.width > anchorRect.x &&
          restingCardRect.y < anchorRect.y + anchorRect.height &&
          restingCardRect.y + restingCardRect.height > anchorRect.y
        hasControlSource =
          !latestVisualRef.current.reduced &&
          tBox.width * tBox.height <= pw * ph * LARGE_TRIGGER_AREA_RATIO
      }
    }

    const transitionBounds = computeTransitionBounds(anchorRect, restingCardRect)

    const { surface: panelSurface, plateVeil, tintVars: panelTintVars } = readElementGlassSurface(panelEl)
    let startSurface: ExtractedCssGlassSurface = {
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
    let startVeil: BackdropVeilOptics = plateVeil
    let startTintVars: ElementTintVars = {
      ...panelTintVars,
      isDense: false,
    }

    if (!bareSource && triggerEl) {
      const { surface: triggerSurface, tintVars: triggerTintVars } = readElementGlassSurface(triggerEl)
      startSurface = triggerSurface
      startVeil = triggerSurface.veil
      startTintVars = triggerTintVars
    }

    const measured: MeasuredMorphAnchors = {
      triggerEl,
      anchorRect,
      restingCardRect,
      transitionBounds,
      restingRadius,
      hasControlSource,
      bareSource,
      inflateBareAnchor,
      bareSurfaceCss,
      overlapsTrigger,
      startSurface,
      panelSurface,
      startVeil,
      startTintVars,
      panelTintVars,
    }
    anchorsRef.current = measured
    return measured
  }

  const applyFrameToDom = (mState: PopoverMotionState) => {
    const panelEl = panelRef.current
    const morphSurfaceEl = morphSurfaceRef.current
    const morphBackdropEl = morphBackdropRef.current
    const morphGlassEl = morphGlassRef.current
    const glyphHostEl = glyphHostRef.current
    const overlayCanvasEl = overlayCanvasRef.current
    const anchors = anchorsRef.current
    if (!panelEl || !anchors) return

    const {
      reduced: isReduced,
      glassMode: gMode,
      tuning: gTuning,
      dense: isDense,
      isLegible,
      align: curAlign,
    } = latestVisualRef.current

    lastMotionRef.current = mState

    const isTransitioning = mState.phase === 'opening' || mState.phase === 'closing'
    isTransitioningRef.current = isTransitioning
    if (isTransitioning) {
      cancelAnimationFrame(transitionRestoreRafRef.current)
    }

    if (mState.phase === 'open') {
      lastGeometryRef.current = null
      restoreElevatedTrigger()
      if (anchors.overlapsTrigger && anchors.hasControlSource && anchors.triggerEl) {
        hideTrigger(anchors.triggerEl)
      } else {
        restoreHiddenTrigger()
      }
      clearClonedGlyph()
      if (morphSurfaceEl) {
        morphSurfaceEl.style.visibility = 'hidden'
      }
      if (morphBackdropEl) {
        morphBackdropEl.style.visibility = 'hidden'
      }
      if (morphGlassEl) {
        morphGlassEl.style.visibility = 'hidden'
      }
      if (overlayCanvasEl) {
        overlayCanvasEl.style.visibility = 'hidden'
        overlayRendererRef.current?.clear()
      }
      // Clear inline morph overrides while keeping transition disabled for one frame so .glass snaps cleanly
      panelEl.style.transition = 'none'
      clearPanelMorphStyles(panelEl, false)
      cancelAnimationFrame(transitionRestoreRafRef.current)
      transitionRestoreRafRef.current = requestAnimationFrame(() => {
        if (panelRef.current && !isTransitioningRef.current) {
          panelRef.current.style.transition = ''
        }
      })
      return
    }

    if (mState.phase === 'closed') {
      lastGeometryRef.current = null
      restoreTriggerVisuals()
      clearClonedGlyph()
      if (morphSurfaceEl) {
        morphSurfaceEl.style.visibility = 'hidden'
      }
      if (morphBackdropEl) {
        morphBackdropEl.style.visibility = 'hidden'
      }
      if (morphGlassEl) {
        morphGlassEl.style.visibility = 'hidden'
      }
      if (overlayCanvasEl) {
        overlayCanvasEl.style.visibility = 'hidden'
        overlayRendererRef.current?.clear()
      }
      panelEl.setAttribute('data-morphing', 'true')
      panelEl.style.opacity = '0'
      return
    }

    if (isReduced) {
      // Reduced motion: simple crossfade on panelRef directly, zero spatial displacement/scale
      restoreElevatedTrigger()
      if (anchors.overlapsTrigger && anchors.triggerEl && mState.contentOpacity > 0.05) {
        hideTrigger(anchors.triggerEl)
      } else {
        restoreHiddenTrigger()
      }
      clearClonedGlyph()
      if (morphSurfaceEl) morphSurfaceEl.style.visibility = 'hidden'
      if (morphBackdropEl) morphBackdropEl.style.visibility = 'hidden'
      if (morphGlassEl) morphGlassEl.style.visibility = 'hidden'
      if (overlayCanvasEl) {
        overlayCanvasEl.style.visibility = 'hidden'
        overlayRendererRef.current?.clear()
      }
      clearPanelMorphStyles(panelEl, true)
      panelEl.style.opacity = `${mState.contentOpacity}`
      return
    }

    const useExternalTrigger = anchors.hasControlSource && !anchors.overlapsTrigger
    const anchorConfig: PopoverAnchorConfig = {
      anchorRect: anchors.anchorRect,
      placement: curAlign === 'right' ? 'overAnchorEnd' : 'overAnchorStart',
      bareSource: anchors.bareSource,
      inflateBareAnchor: anchors.inflateBareAnchor,
      externalTrigger: useExternalTrigger,
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
    lastGeometryRef.current = geometry

    const resolvedTheme = resolveElementTheme(panelEl)

    // Unified overAnchor PrismUI morph hides the underlying trigger and fades/blurs the cloned glyph inside the droplet;
    // separated external triggers keep bare icons elevated or clone `.glass` controls at full opacity.
    if (anchors.hasControlSource && anchors.triggerEl && isTransitioning) {
      if (useExternalTrigger && anchors.bareSource) {
        restoreHiddenTrigger()
        clearClonedGlyph()
        elevateTrigger(anchors.triggerEl)
      } else {
        restoreElevatedTrigger()
        syncClonedGlyph(anchors.triggerEl, anchors.anchorRect.width, anchors.anchorRect.height)
        hideTrigger(anchors.triggerEl)
        if (glyphHostEl) {
          const g = geometry.glyphTransform
          const glyphAlpha = useExternalTrigger ? 1 : mState.triggerGlyphOpacity
          if (glyphAlpha > 0.005) {
            glyphHostEl.style.visibility = 'visible'
            glyphHostEl.style.width = `${anchors.anchorRect.width}px`
            glyphHostEl.style.height = `${anchors.anchorRect.height}px`
            glyphHostEl.style.transform = `translate3d(${(g.centerX - anchors.anchorRect.width * 0.5).toFixed(2)}px, ${(g.centerY - anchors.anchorRect.height * 0.5).toFixed(2)}px, 0) scale(${g.scale.toFixed(4)})`
            glyphHostEl.style.opacity = `${glyphAlpha}`
            glyphHostEl.style.filter =
              !useExternalTrigger && mState.triggerGlyphBlurPx > 0.05
                ? `blur(${mState.triggerGlyphBlurPx.toFixed(2)}px)`
                : 'none'
          } else {
            glyphHostEl.style.visibility = 'hidden'
            glyphHostEl.style.opacity = '0'
            glyphHostEl.style.filter = 'none'
          }
        }
      }
    } else {
      restoreTriggerVisuals()
      clearClonedGlyph()
    }

    // 1. Update live-DOM panel transform, clip, blur, opacity, and temporarily suppress its own rectangular glass via data-morphing
    applyPanelMorphFrame(panelEl, geometry, anchors.restingCardRect, mState)

    // 2. Update sibling Morph Glass Backdrop inside constant transitionBounds (0 layer resizes)
    const bareSurfaceAlpha =
      anchors.hasControlSource &&
      anchors.bareSource &&
      anchors.bareSurfaceCss &&
      !useExternalTrigger
        ? clamp(1 - mState.bareGlassOpacity, 0, 1)
        : 0
    if (morphSurfaceEl) {
      if (bareSurfaceAlpha > 0.005 && anchors.bareSurfaceCss) {
        const d = geometry.droplet
        const dw = Math.max(0, d.size.width)
        const dh = Math.max(0, d.size.height)
        morphSurfaceEl.style.visibility = 'visible'
        morphSurfaceEl.style.width = `${dw.toFixed(2)}px`
        morphSurfaceEl.style.height = `${dh.toFixed(2)}px`
        morphSurfaceEl.style.transform = `translate3d(${(d.center.x - dw * 0.5).toFixed(2)}px, ${(d.center.y - dh * 0.5).toFixed(2)}px, 0)`
        morphSurfaceEl.style.borderRadius = `${Math.max(0, d.radius).toFixed(2)}px`
        morphSurfaceEl.style.background = anchors.bareSurfaceCss.background
        morphSurfaceEl.style.border = anchors.bareSurfaceCss.border
        morphSurfaceEl.style.boxShadow = anchors.bareSurfaceCss.boxShadow
        morphSurfaceEl.style.opacity = `${bareSurfaceAlpha}`
      } else {
        morphSurfaceEl.style.visibility = 'hidden'
      }
    }

    const bounds = anchors.transitionBounds
    const glassAlpha = anchors.hasControlSource
      ? anchors.bareSource
        ? mState.bareGlassOpacity
        : 1
      : mState.phase === 'closing'
        ? mState.contentOpacity
        : clamp(mState.settled / 0.2, 0, 1)

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
      dense: isDense,
      isLegible,
      resolvedTheme,
      glassAlpha,
      bounds,
      geometry,
      mState,
      bareSource: anchors.bareSource,
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

    // 3. Update sibling Morph Overlay Canvas inside constant transitionBounds (0 canvas reallocations)
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

  // Create and dispose motion controller + overlay renderer before first paint (StrictMode-safe)
  useLayoutEffect(() => {
    const controller = createPopoverMorphController({ reducedMotion: latestVisualRef.current.reduced })
    motionRef.current = controller

    // 和静态玻璃共用一个 WebGL2 上下文，反复打开也不会挤掉其他上下文
    const renderer = createGlassOverlayRenderer({ context: 'shared' })
    overlayRendererRef.current = renderer
    if (overlayCanvasRef.current) {
      renderer.mount(overlayCanvasRef.current)
    }

    return () => {
      cancelAnimationFrame(transitionRestoreRafRef.current)
      restoreTriggerVisuals()
      clearClonedGlyph()
      controller.dispose()
      if (motionRef.current === controller) {
        motionRef.current = null
      }
      renderer.dispose()
      if (overlayRendererRef.current === renderer) {
        overlayRendererRef.current = null
      }
    }
  }, [])

  useLayoutEffect(() => {
    motionRef.current?.setReducedMotion(reduced)
  }, [reduced])

  // Re-measure resting CSS surface & re-apply inline morph overrides when theme/preset/mode/props change
  useLayoutEffect(() => {
    measureAnchors()
    if (isTransitioningRef.current && motionRef.current && anchorsRef.current) {
      applyFrameToDom(motionRef.current.getState())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [style, glassMode, tuning, dense, className])

  // Measure anchors & react to dynamic content size changes via ResizeObserver
  useLayoutEffect(() => {
    const sync = () => {
      const measured = measureAnchors()
      if (measured && motionRef.current) {
        applyFrameToDom(motionRef.current.getState())
      }
    }
    sync()
    const ro = new ResizeObserver(([entry]) => {
      const size = entry.borderBoxSize[0]
      if (
        size &&
        Math.round(size.inlineSize) === measuredSizeRef.current.width &&
        Math.round(size.blockSize) === measuredSizeRef.current.height
      ) {
        return
      }
      sync()
    })
    if (panelRef.current) ro.observe(panelRef.current)
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placement])

  // Drive open/close transitions and rAF loop from AnimatePresence isPresent (before first paint)
  useLayoutEffect(() => {
    const motion = motionRef.current
    if (!motion) return

    const measured = measureAnchors() ?? anchorsRef.current
    const hasCtrl = measured?.hasControlSource ?? false

    if (isPresent) {
      motion.open(hasCtrl)
    } else {
      const curState = motion.getState()
      // 快照带上当帧的 blendK，收起时液桥从打断处接着缩，中途再打开也能从这里平滑接回
      let snapshot: PopoverMorphSnapshot | undefined
      if (curState.phase === 'opening' && curState.normalizedT < 1 && lastGeometryRef.current) {
        snapshot = createPopoverMorphSnapshot(lastGeometryRef.current, {
          contentBlurPx: lastMotionRef.current?.contentBlurPx ?? curState.contentBlurPx,
          normalizedT: curState.normalizedT,
        })
      }
      motion.close(snapshot)
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
        restoreTriggerVisuals()
        clearClonedGlyph()
        safeToRemoveRef.current?.()
        return
      }

      if (next.isAnimating || next.phase === 'opening' || next.phase === 'closing') {
        rafId = requestAnimationFrame(tick)
      }
    }

    rafId = requestAnimationFrame(tick)
    return () => {
      active = false
      cancelAnimationFrame(rafId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPresent])

  const canUseMorphRefract = !reduced && glassMode === 'refract' && refractSupported

  return (
    <>
      <div
        ref={morphSurfaceRef}
        aria-hidden="true"
        style={{ visibility: 'hidden' }}
        className="pointer-events-none absolute top-0 left-0 z-50 box-border"
      />
      <div
        ref={morphBackdropRef}
        aria-hidden="true"
        style={{ visibility: 'hidden' }}
        className="pointer-events-none absolute top-0 left-0 z-50"
      />
      <div
        ref={morphGlassRef}
        aria-hidden="true"
        style={{ visibility: 'hidden' }}
        className="pointer-events-none absolute top-0 left-0 z-50 isolate"
      />
      <div
        ref={glyphHostRef}
        aria-hidden="true"
        style={{ visibility: 'hidden' }}
        className="pointer-events-none absolute top-0 left-0 z-50 flex items-center justify-center"
      />
      <MotionGlass
        ref={panelRef}
        id={id}
        role="dialog"
        aria-label={label}
        data-vt-glass={vtGlass}
        dense={dense}
        suspendRefract={false}
        style={{
          ...style,
          pointerEvents: isPresent ? undefined : 'none',
        }}
        className={className}
      >
        {children}
      </MotionGlass>
      <canvas
        ref={overlayCanvasRef}
        aria-hidden="true"
        style={{ visibility: 'hidden' }}
        className="pointer-events-none absolute top-0 left-0 z-50"
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
