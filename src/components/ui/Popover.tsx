import { AnimatePresence, usePresence, useReducedMotion } from 'motion/react'
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
import { MotionGlass, useAdaptiveGlass } from '@/components/glass/Glass'
import { computeMorphUnionBounds, extractGooContourPath } from '@/components/glass/morph/contour'
import {
  PRISM_CONSTANTS,
  type AnchorConfig,
  type GooFrameGeometry,
  type IMorphOverlayRenderer,
  type MenuConfig,
  type MorphPhase,
  type MorphSnapshot,
  type MotionFrameState,
  type Rect,
} from '@/components/glass/morph/contracts'
import { computeMorphGeometry } from '@/components/glass/morph/geometry'
import { createMotionController, resolveOpticalStyle, type MotionController } from '@/components/glass/morph/motion'
import { createMorphOverlayRenderer } from '@/components/glass/morph/overlayRenderer'
import { MorphRefractFilter, type MorphRefractFilterHandle } from '@/components/glass/morph/refractFilter'
import {
  interpolateCssGlassSurfaceToOverlay,
  interpolateVeilOptics,
  parseCssFilterOptics,
  parseCssGlassSurface,
  type ExtractedCssGlassSurface,
  type MorphBackdropVeilOptics,
} from '@/components/glass/morph/refractOptics'
import { autoBezel, supportsRefract } from '@/components/glass/refract'
import { useGlassTuning } from '@/design/glassTuning'
import { useAppearance } from '@/design/settings'
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
            layoutScroll={fitViewport}
            style={fitViewport && bounds ? ({ '--popover-room': `${bounds.room}px`, maxHeight: bounds.room } as CSSProperties) : undefined}
            className={cn(
              'absolute z-50 rounded-[24px] p-3 [--g-drop:0_0_0_transparent]',
              placedSide === 'bottom' ? '-top-2' : '-bottom-2',
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

interface ElementTintVars {
  tint: number | null
  denseTint: number | null
  tintScale: number | null
  isDense: boolean
}

interface MeasuredMorphAnchors {
  triggerEl: HTMLElement | null
  anchorRect: Rect
  restingCardRect: Rect
  transitionBounds: Rect
  restingRadius: number
  hasControlSource: boolean
  bareSource: boolean
  overlapsTrigger: boolean
  startSurface: ExtractedCssGlassSurface
  panelSurface: ExtractedCssGlassSurface
  startVeil: MorphBackdropVeilOptics
  startTintVars: ElementTintVars
  panelTintVars: ElementTintVars
}

function parseCssNumberVar(cs: CSSStyleDeclaration, name: string): number | null {
  const raw = cs.getPropertyValue(name).trim()
  if (!raw) return null
  const parsed = Number.parseFloat(raw)
  return Number.isFinite(parsed) ? parsed : null
}

function readElementGlassSurface(el: HTMLElement): {
  surface: ExtractedCssGlassSurface
  plateVeil: MorphBackdropVeilOptics
  tintVars: ElementTintVars
} {
  const wasMorphing = el.hasAttribute('data-morphing')
  const prevTransition = el.style.transition
  const prevOpacity = el.style.opacity
  if (wasMorphing) {
    el.style.transition = 'none'
    el.removeAttribute('data-morphing')
  }
  const cs = getComputedStyle(el)
  const bf = cs.backdropFilter || cs.getPropertyValue('-webkit-backdrop-filter') || ''
  const surface = parseCssGlassSurface({
    backdropFilter: bf,
    veilFallback: cs.getPropertyValue('--g-veil'),
    borderWidthPx: parseFloat(cs.borderTopWidth) || 0,
    borderColor: cs.borderTopColor,
    boxShadow: cs.boxShadow,
  })
  const plateVeilStr = cs.getPropertyValue('--g-veil-plate').trim()
  const plateVeil = plateVeilStr ? parseCssFilterOptics(plateVeilStr) : surface.veil
  const tintVars: ElementTintVars = {
    tint: parseCssNumberVar(cs, '--refract-tint'),
    denseTint: parseCssNumberVar(cs, '--refract-tint-dense'),
    tintScale: parseCssNumberVar(cs, '--g-tint-scale'),
    isDense: el.classList.contains('dense') || el.classList.contains('glass-legible'),
  }
  if (wasMorphing) {
    el.setAttribute('data-morphing', 'true')
    el.style.transition = prevTransition
    el.style.opacity = prevOpacity
  }
  return { surface, plateVeil, tintVars }
}

const OVERLAY_UNION_PADDING_PX = 48
const MORPH_BACKDROP_MARGIN_PX = 6
const LARGE_TRIGGER_AREA_RATIO = 0.45

function computeClampedBackdropBounds(
  platter: GooFrameGeometry['platter'],
  droplet: GooFrameGeometry['droplet'],
  transitionBounds: Rect,
): Rect {
  const raw = computeMorphUnionBounds(platter, droplet, MORPH_BACKDROP_MARGIN_PX)
  const minX = Math.max(transitionBounds.x, Math.floor(raw.x))
  const minY = Math.max(transitionBounds.y, Math.floor(raw.y))
  const maxX = Math.min(transitionBounds.x + transitionBounds.width, Math.ceil(raw.x + raw.width))
  const maxY = Math.min(transitionBounds.y + transitionBounds.height, Math.ceil(raw.y + raw.height))
  return {
    x: minX,
    y: minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  }
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v))
}

function resolveElementTheme(el: HTMLElement | null): 'light' | 'dark' {
  const scoped = el?.closest('[data-theme]')?.getAttribute('data-theme')
  if (scoped === 'light' || scoped === 'dark') return scoped
  if (typeof document !== 'undefined' && document.documentElement.dataset.theme === 'light') {
    return 'light'
  }
  return 'dark'
}

function findTriggerElement(
  rootEl: HTMLElement,
  morphBackdropEl: HTMLElement | null,
  morphGlassEl: HTMLElement | null,
  glyphHostEl: HTMLElement | null,
  overlayCanvasEl: HTMLElement | null,
  panelEl: HTMLElement,
): HTMLElement | null {
  for (const child of rootEl.children) {
    if (
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
  node.setAttribute('aria-hidden', 'true')
  node.setAttribute('tabindex', '-1')
  node.style.pointerEvents = 'none'
  node.style.margin = '0'
  for (const desc of node.querySelectorAll<HTMLElement>('[id]')) {
    desc.removeAttribute('id')
  }
}

function shiftGeometryByOffset(geometry: GooFrameGeometry, ox: number, oy: number): GooFrameGeometry {
  return {
    ...geometry,
    platter: {
      ...geometry.platter,
      center: {
        x: geometry.platter.center.x - ox,
        y: geometry.platter.center.y - oy,
      },
    },
    droplet: {
      ...geometry.droplet,
      center: {
        x: geometry.droplet.center.x - ox,
        y: geometry.droplet.center.y - oy,
      },
    },
  }
}

function clearPanelMorphStyles(panelEl: HTMLElement, clearTransitionImmediate: boolean): void {
  panelEl.removeAttribute('data-morphing')
  panelEl.style.transform = ''
  panelEl.style.transformOrigin = ''
  panelEl.style.opacity = ''
  panelEl.style.filter = ''
  panelEl.style.clipPath = ''
  panelEl.style.willChange = ''
  if (clearTransitionImmediate) {
    panelEl.style.transition = ''
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
  const systemReduced = Boolean(useReducedMotion())
  const popoverMotion = useAppearance((s) => s.popoverMotion)
  const reduced = systemReduced || !popoverMotion
  const glassMode = useAppearance((s) => s.glass)
  const tuning = useGlassTuning()
  const adaptive = useAdaptiveGlass()
  const refractSupported = supportsRefract()
  const morphFilterId = `morphRefract${useId().replace(/[:«»]/g, '')}`
  const [morphBezel, setMorphBezel] = useState(() => (tuning.bezel > 0 ? tuning.bezel : 20))

  const morphBackdropRef = useRef<HTMLDivElement>(null)
  const morphRefractHandleRef = useRef<MorphRefractFilterHandle>(null)
  const morphGlassRef = useRef<HTMLDivElement>(null)
  const glyphHostRef = useRef<HTMLDivElement>(null)
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null)
  const panelRef = useRef<HTMLElement>(null)

  const motionRef = useRef<MotionController | null>(null)
  const overlayRendererRef = useRef<IMorphOverlayRenderer | null>(null)
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
  const lastGeometryRef = useRef<GooFrameGeometry | null>(null)
  const lastMotionRef = useRef<MotionFrameState | null>(null)
  const lastPhaseRef = useRef<MorphPhase>('closed')
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
    adaptive,
    dense,
    isLegible: className.includes('glass-legible'),
    side,
    align,
  })
  latestVisualRef.current = {
    reduced,
    glassMode,
    tuning,
    adaptive,
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

    const pw = panelEl.offsetWidth
    const ph = panelEl.offsetHeight
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
      parseFloat(getComputedStyle(panelEl).borderTopLeftRadius) || PRISM_CONSTANTS.RESTING_CARD_RADIUS
    const restingRadius = Math.min(radiusRef.current, pw * 0.5, ph * 0.5)

    if (panelEl.dataset.lensRadius !== String(radiusRef.current)) {
      panelEl.dataset.lensRadius = String(radiusRef.current)
    }

    const baseBezel = latestVisualRef.current.tuning.bezel
    const nextBezel = baseBezel > 0 ? Math.min(baseBezel, pw * 0.5, ph * 0.5) : autoBezel(pw, ph)
    setMorphBezel((prev) => (Math.abs(prev - nextBezel) < 0.01 ? prev : nextBezel))

    const triggerEl = findTriggerElement(
      rootEl,
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
    let overlapsTrigger = false

    if (triggerEl) {
      const tBox = triggerEl.getBoundingClientRect()
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

    const dyCenters = Math.abs(
      restingCardRect.y + ph * 0.5 - (anchorRect.y + anchorRect.height * 0.5),
    )
    const pad = OVERLAY_UNION_PADDING_PX + Math.max(64, Math.ceil(dyCenters * 0.25))
    const minX = Math.floor(Math.min(anchorRect.x, restingCardRect.x) - pad)
    const minY = Math.floor(Math.min(anchorRect.y, restingCardRect.y) - pad)
    const maxX = Math.ceil(
      Math.max(anchorRect.x + anchorRect.width, restingCardRect.x + restingCardRect.width) + pad,
    )
    const maxY = Math.ceil(
      Math.max(anchorRect.y + anchorRect.height, restingCardRect.y + restingCardRect.height) + pad,
    )
    const transitionBounds: Rect = {
      x: minX,
      y: minY,
      width: Math.max(1, maxX - minX),
      height: Math.max(1, maxY - minY),
    }

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
    let startVeil: MorphBackdropVeilOptics = plateVeil
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

  const applyFrameToDom = (mState: MotionFrameState) => {
    const panelEl = panelRef.current
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
      adaptive: gAdaptive,
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
    const anchorConfig: AnchorConfig = {
      anchorRect: anchors.anchorRect,
      placement: curAlign === 'right' ? 'overAnchorEnd' : 'overAnchorStart',
      bareSource: anchors.bareSource,
      hasControlSource: anchors.hasControlSource,
      externalTrigger: useExternalTrigger,
      viewportSize: { width: window.innerWidth, height: window.innerHeight },
    }
    const menuConfig: MenuConfig = {
      size: {
        width: anchors.restingCardRect.width,
        height: anchors.restingCardRect.height,
      },
      targetRectOverride: anchors.restingCardRect,
      restingRadius: anchors.restingRadius,
    }

    const closeSnap = motionRef.current?.getCloseSnapshot() ?? null
    const geometry = computeMorphGeometry(mState, anchorConfig, menuConfig, closeSnap)
    lastGeometryRef.current = geometry

    const resolvedTheme = resolveElementTheme(panelEl)
    const ct = geometry.contentTransform
    const safeScale = Math.max(ct.scale, 1e-3)
    const cardW = anchors.restingCardRect.width
    const cardH = anchors.restingCardRect.height
    const clipX = Math.max(0, (cardW - geometry.platter.size.width / safeScale) * 0.5)
    const clipY = Math.max(0, (cardH - geometry.platter.size.height / safeScale) * 0.5)
    const clipR = geometry.platter.radius / safeScale

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
    panelEl.setAttribute('data-morphing', 'true')
    panelEl.style.transformOrigin = 'center center'
    panelEl.style.willChange = 'transform, opacity, clip-path'
    panelEl.style.transform = `translate3d(${ct.translateX.toFixed(2)}px, ${ct.translateY.toFixed(2)}px, 0) scale(${ct.scale.toFixed(4)})`
    panelEl.style.opacity = `${mState.contentOpacity}`
    panelEl.style.filter = mState.contentBlurPx > 0.05 ? `blur(${mState.contentBlurPx.toFixed(2)}px)` : 'none'
    panelEl.style.clipPath = `inset(${clipY.toFixed(2)}px ${clipX.toFixed(2)}px round ${clipR.toFixed(2)}px)`

    // 2. Update sibling Morph Glass Backdrop inside constant transitionBounds (0 layer resizes)
    const bounds = anchors.transitionBounds
    const glassAlpha = anchors.hasControlSource
      ? anchors.bareSource
        ? mState.bareGlassOpacity
        : 1
      : mState.phase === 'closing'
        ? mState.contentOpacity
        : clamp01(mState.settled / 0.2)

    if (morphGlassEl) {
      if (glassAlpha > 0.005) {
        const contourPath = extractGooContourPath(
          geometry.platter,
          geometry.droplet,
          geometry.blendK,
          geometry.isMerged,
          { x: bounds.x, y: bounds.y },
        )
        morphGlassEl.style.visibility = 'visible'
        morphGlassEl.style.transform = `translate3d(${bounds.x}px, ${bounds.y}px, 0)`
        morphGlassEl.style.width = `${bounds.width}px`
        morphGlassEl.style.height = `${bounds.height}px`
        morphGlassEl.style.clipPath = contourPath ? `path("${contourPath}")` : 'none'
        morphGlassEl.style.opacity = `${glassAlpha}`

        const effectiveMode = gMode === 'refract' && !refractSupported ? 'frosted' : gMode
        if (effectiveMode === 'solid') {
          if (morphBackdropEl) morphBackdropEl.style.visibility = 'hidden'
          morphGlassEl.style.removeProperty('--g-tint-scale')
          morphGlassEl.style.backdropFilter = 'none'
          morphGlassEl.style.setProperty('-webkit-backdrop-filter', 'none')
          morphGlassEl.style.background = 'var(--surface)'
        } else if (effectiveMode === 'frosted') {
          if (morphBackdropEl) morphBackdropEl.style.visibility = 'hidden'
          morphGlassEl.style.removeProperty('--g-tint-scale')
          const blurPx = 22 + mState.blurBumpPx
          const bf = `blur(${blurPx.toFixed(2)}px) saturate(1.7)`
          morphGlassEl.style.backdropFilter = bf
          morphGlassEl.style.setProperty('-webkit-backdrop-filter', bf)
          if (resolvedTheme === 'dark' && isLegible) {
            morphGlassEl.style.background = 'color-mix(in srgb, var(--bg) 78%, transparent)'
          } else if (isDense) {
            morphGlassEl.style.background = 'color-mix(in srgb, var(--bg) 55%, transparent)'
          } else {
            morphGlassEl.style.background = 'var(--g-bg)'
          }
        } else {
          // 'refract' mode (refractSupported === true): match resting Glass.tsx blur, saturate, veil, adaptive tint, and --g-tint-scale
          const startBlur = gTuning.blur
          const targetBlur = isDense ? gTuning.denseBlur : gTuning.blur
          const baseBlur = startBlur + (targetBlur - startBlur) * geometry.styleMix
          const activeBlur = baseBlur + (gTuning.preset === 'prism' ? mState.blurBumpPx : 0)

          const fallbackStartTint = anchors.startTintVars.isDense ? gTuning.denseTint : gTuning.tint
          const fallbackTargetTint = isDense || isLegible ? gTuning.denseTint : gTuning.tint
          const adaptiveStartTint = gAdaptive?.enabled
            ? (anchors.startTintVars.isDense
                ? (gAdaptive.denseTint ?? gAdaptive.tint ?? gTuning.denseTint)
                : (gAdaptive.tint ?? gTuning.tint))
            : fallbackStartTint
          const adaptiveTargetTint = gAdaptive?.enabled
            ? (isDense || isLegible
                ? (gAdaptive.denseTint ?? gAdaptive.tint ?? gTuning.denseTint)
                : (gAdaptive.tint ?? gTuning.tint))
            : fallbackTargetTint
          const startCssTint = anchors.startTintVars.isDense
            ? (anchors.startTintVars.denseTint ?? anchors.startTintVars.tint)
            : anchors.startTintVars.tint
          const panelCssTint = isDense || isLegible
            ? (anchors.panelTintVars.denseTint ?? anchors.panelTintVars.tint)
            : anchors.panelTintVars.tint

          const startTint = !anchors.bareSource
            ? (startCssTint ?? adaptiveStartTint)
            : (gAdaptive?.enabled ? (gAdaptive.tint ?? gTuning.tint) : (anchors.panelTintVars.tint ?? gTuning.tint))
          const targetTint = gAdaptive?.enabled
            ? adaptiveTargetTint
            : (panelCssTint ?? adaptiveTargetTint)
          const activeTint = startTint + (targetTint - startTint) * geometry.styleMix

          const themeDefaultScale = resolvedTheme === 'dark' ? (gTuning.preset === 'prism' ? 1.55 : 1.6) : 1
          const startScale = anchors.startTintVars.tintScale ?? anchors.panelTintVars.tintScale ?? themeDefaultScale
          const targetScale = anchors.panelTintVars.tintScale ?? themeDefaultScale
          const activeTintScale = startScale + (targetScale - startScale) * geometry.styleMix

          morphGlassEl.style.setProperty('--g-tint-scale', `${activeTintScale.toFixed(4)}`)
          morphGlassEl.style.background = `color-mix(in srgb, var(--g-neutral) min(100%, calc(${activeTint.toFixed(2)}% * var(--g-tint-scale, ${activeTintScale.toFixed(4)}))), transparent)`

          const refractHandle = morphRefractHandleRef.current
          if (contourPath && morphBackdropEl && refractHandle) {
            // Route B3: place backdrop-filter: url(#svg) on an unclipped sibling while SVG self-masks to shapeAlpha,
            // preventing Chromium's clip-path rectangular bounding-box leak.
            const backdropBounds = computeClampedBackdropBounds(geometry.platter, geometry.droplet, bounds)
            const veilOptics = interpolateVeilOptics(anchors.startVeil, anchors.panelSurface.veil, geometry.styleMix)
            refractHandle.updateFrame({
              bounds: backdropBounds,
              platter: geometry.platter,
              droplet: geometry.droplet,
              blendK: geometry.blendK,
              isMerged: geometry.isMerged,
              blurSigma: activeBlur,
              saturate: gTuning.saturate,
              brightness: veilOptics.brightness,
              contrast: veilOptics.contrast,
              contrastFirst: veilOptics.contrastFirst,
            })
            morphBackdropEl.style.visibility = 'visible'
            morphBackdropEl.style.transform = `translate3d(${backdropBounds.x}px, ${backdropBounds.y}px, 0)`
            morphBackdropEl.style.width = `${backdropBounds.width}px`
            morphBackdropEl.style.height = `${backdropBounds.height}px`
            morphBackdropEl.style.opacity = `${glassAlpha}`
            const refractBf = `url(#${morphFilterId})`
            morphBackdropEl.style.backdropFilter = refractBf
            morphBackdropEl.style.setProperty('-webkit-backdrop-filter', refractBf)
            morphGlassEl.style.backdropFilter = 'none'
            morphGlassEl.style.setProperty('-webkit-backdrop-filter', 'none')
          } else {
            if (morphBackdropEl) morphBackdropEl.style.visibility = 'hidden'
            const veilVar = isDense ? '--g-veil-float' : '--g-veil-plate'
            const bf = `blur(${activeBlur.toFixed(2)}px) saturate(${gTuning.saturate}) var(${veilVar})`
            morphGlassEl.style.backdropFilter = bf
            morphGlassEl.style.setProperty('-webkit-backdrop-filter', bf)
          }
        }
      } else {
        if (morphBackdropEl) morphBackdropEl.style.visibility = 'hidden'
        morphGlassEl.style.visibility = 'hidden'
      }
    }
    // 3. Update sibling Morph Overlay Canvas inside constant transitionBounds (0 canvas reallocations)
    if (overlayCanvasEl) {
      if (glassAlpha > 0.005) {
        overlayCanvasEl.style.visibility = 'visible'
        overlayCanvasEl.style.transform = `translate3d(${bounds.x}px, ${bounds.y}px, 0)`
        overlayCanvasEl.style.width = `${bounds.width}px`
        overlayCanvasEl.style.height = `${bounds.height}px`

        const shiftedGeom = shiftGeometryByOffset(geometry, bounds.x, bounds.y)
        const baseStyle = resolveOpticalStyle(resolvedTheme, geometry.styleMix)
        const opticalStyle = interpolateCssGlassSurfaceToOverlay(
          baseStyle,
          anchors.startSurface,
          anchors.panelSurface,
          geometry.styleMix,
        )
        overlayRendererRef.current?.render({
          viewport: { width: bounds.width, height: bounds.height },
          dpr: typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1,
          theme: resolvedTheme,
          geometry: shiftedGeom,
          style: opticalStyle,
          opacity: glassAlpha,
          blurBumpPx: gTuning.preset === 'prism' ? mState.blurBumpPx : 0,
        })
      } else {
        overlayCanvasEl.style.visibility = 'hidden'
        overlayRendererRef.current?.clear()
      }
    }
  }

  // Create and dispose motion controller + overlay renderer before first paint (StrictMode-safe)
  useLayoutEffect(() => {
    const controller = createMotionController({ reducedMotion: latestVisualRef.current.reduced })
    motionRef.current = controller

    const renderer = createMorphOverlayRenderer()
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

  // Sync reducedMotion changes
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
  }, [style, glassMode, tuning, adaptive, dense, className])

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
      let snapshot: MorphSnapshot | undefined
      if (curState.phase === 'opening' && curState.normalizedT < 1 && lastGeometryRef.current) {
        snapshot = {
          platter: {
            center: { ...lastGeometryRef.current.platter.center },
            size: { ...lastGeometryRef.current.platter.size },
            radius: lastGeometryRef.current.platter.radius,
          },
          droplet: {
            center: { ...lastGeometryRef.current.droplet.center },
            size: { ...lastGeometryRef.current.droplet.size },
            radius: lastGeometryRef.current.droplet.radius,
          },
          platterRadius: lastGeometryRef.current.platter.radius,
          blurPx: lastMotionRef.current?.contentBlurPx ?? curState.contentBlurPx,
          elapsedFraction: curState.normalizedT,
        }
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
        layoutScroll={layoutScroll}
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
          bezel={morphBezel}
          strength={tuning.strength}
          dispersion={tuning.dispersion}
        />
      )}
    </>
  )
}
