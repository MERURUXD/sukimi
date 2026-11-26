import { readRestingStyles } from '@/components/glass/surface'
import type { GlassPreset, GlassTuning } from '@/design/glassTuning'
import type { GlassMode } from '@/design/settings'
import {
  compensateLegibilityEdges,
  extractFieldContourPath,
  interpolateVeilOptics,
  parseCssFilterOptics,
  parseCssGlassSurface,
  type BackdropVeilOptics,
  type ExtractedCssGlassSurface,
  type GlassFieldState,
  type IGlassOverlayRenderer,
  type LegibilityParams,
  type OpticalMaterial,
  type Point,
  type Rect,
} from '@sessile/core'
import { buildBackdropFilterCss, computeClampedRefractBounds, formatRgbaCss, type RefractFilterFrame } from '@sessile/dom'
import {
  POPOVER_MORPH_DEFAULTS,
  computePopoverTargetRect,
  type PopoverFrameGeometry,
  type PopoverMotionState,
} from '@sessile/presets'

export const OVERLAY_UNION_PADDING_PX = 48
export const CONTEXT_MENU_EDGE_MARGIN = 12

export interface ContextMenuPoint {
  x: number
  y: number
  /** 可选避让区域（例如从触发卡片下方/上方展开） */
  avoidRect?: Rect
}

/** 用 PrismUI `belowPoint` 策略计算右键菜单落点，下方放不下时自动翻到点击位置上方并贴边收紧。 */
export function resolvePointCardRect(
  at: ContextMenuPoint,
  width: number,
  height: number,
  restingRadius?: number,
): Rect {
  const viewportSize = typeof window !== 'undefined'
    ? { width: window.innerWidth, height: window.innerHeight }
    : { width: 1280, height: 800 }
  return computePopoverTargetRect(
    {
      anchorRect: { x: at.x, y: at.y, width: 0, height: 0 },
      avoidRect: at.avoidRect,
      placement: 'belowPoint',
      bareSource: true,
      viewportSize,
    },
    {
      size: { width: Math.max(0, width), height: Math.max(0, height) },
      avoidGap: at.avoidRect ? POPOVER_MORPH_DEFAULTS.avoidGap : 0,
      screenMargin: CONTEXT_MENU_EDGE_MARGIN,
      restingRadius,
    },
  )
}

/** 计算点击位置相对菜单卡片内部的缩放锚点（px）。 */
export function computePointPivot(
  at: ContextMenuPoint,
  card: { left: number; top: number; width: number; height: number },
): Point {
  return {
    x: Math.max(0, Math.min(card.width, at.x - card.left)),
    y: Math.max(0, Math.min(card.height, at.y - card.top)),
  }
}

export interface ElementTintVars {
  tint: number | null
  denseTint: number | null
  tintScale: number | null
  isDense: boolean
}

function parseCssNumberVar(cs: CSSStyleDeclaration, name: string): number | null {
  const raw = cs.getPropertyValue(name).trim()
  if (!raw) return null
  const parsed = Number.parseFloat(raw)
  return Number.isFinite(parsed) ? parsed : null
}

export function resolveElementTheme(el: HTMLElement | null): 'light' | 'dark' {
  const scoped = el?.closest('[data-theme]')?.getAttribute('data-theme')
  if (scoped === 'light' || scoped === 'dark') return scoped
  if (typeof document !== 'undefined' && document.documentElement.dataset.theme === 'light') {
    return 'light'
  }
  return 'dark'
}

/** Reads live computed `.glass` backdrop optics, border, shadow, and tint vars for an element at rest. */
export function readElementGlassSurface(el: HTMLElement): {
  surface: ExtractedCssGlassSurface
  plateVeil: BackdropVeilOptics
  tintVars: ElementTintVars
} {
  return readRestingStyles(el, () => readRestingSurface(el))
}

function readRestingSurface(el: HTMLElement) {
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
  return { surface, plateVeil, tintVars }
}

/** Computes padded bounding box covering both the anchor and resting menu card. */
export function computeTransitionBounds(anchorBox: Rect, restingCardRect: Rect): Rect {
  const dyCenters = Math.abs(
    restingCardRect.y + restingCardRect.height * 0.5 - (anchorBox.y + anchorBox.height * 0.5),
  )
  const pad = OVERLAY_UNION_PADDING_PX + Math.max(64, Math.ceil(dyCenters * 0.25))
  const minX = Math.floor(Math.min(anchorBox.x, restingCardRect.x) - pad)
  const minY = Math.floor(Math.min(anchorBox.y, restingCardRect.y) - pad)
  const maxX = Math.ceil(
    Math.max(anchorBox.x + anchorBox.width, restingCardRect.x + restingCardRect.width) + pad,
  )
  const maxY = Math.ceil(
    Math.max(anchorBox.y + anchorBox.height, restingCardRect.y + restingCardRect.height) + pad,
  )
  return {
    x: minX,
    y: minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  }
}

/** 叠加层画布以 transitionBounds 左上角为原点，图元要平移到画布坐标里再交给渲染器。 */
function shiftField(field: GlassFieldState, ox: number, oy: number): GlassFieldState {
  return {
    ...field,
    primitives: field.primitives.map((p) => ({ ...p, center: { x: p.center.x - ox, y: p.center.y - oy } })),
  }
}

export function clearPanelMorphStyles(panelEl: HTMLElement, clearTransitionImmediate: boolean): void {
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

/** Updates live-DOM panel transform, clip-path, blur, and opacity while morphing. */
export function applyPanelMorphFrame(
  panelEl: HTMLElement,
  geometry: PopoverFrameGeometry,
  restingCardSize: { width: number; height: number },
  mState: PopoverMotionState,
): void {
  const ct = geometry.contentTransform
  const safeScale = Math.max(ct.scale, 1e-3)
  const clipX = Math.max(0, (restingCardSize.width - geometry.platter.size.width / safeScale) * 0.5)
  const clipY = Math.max(0, (restingCardSize.height - geometry.platter.size.height / safeScale) * 0.5)
  const clipR = geometry.platter.radius / safeScale

  panelEl.setAttribute('data-morphing', 'true')
  panelEl.style.transformOrigin = 'center center'
  panelEl.style.willChange = 'transform, opacity, clip-path'
  panelEl.style.transform = `translate3d(${ct.translateX.toFixed(2)}px, ${ct.translateY.toFixed(2)}px, 0) scale(${ct.scale.toFixed(4)})`
  panelEl.style.opacity = `${mState.contentOpacity}`
  panelEl.style.filter = mState.contentBlurPx > 0.05 ? `blur(${mState.contentBlurPx.toFixed(2)}px)` : 'none'
  panelEl.style.clipPath = `inset(${clipY.toFixed(2)}px ${clipX.toFixed(2)}px round ${clipR.toFixed(2)}px)`
}

export interface MorphBackdropStyleOptions {
  morphGlassEl: HTMLElement | null
  morphBackdropEl: HTMLElement | null
  morphFilterId: string
  refractSupported: boolean
  hasRefractHandle: boolean
  glassMode: GlassMode
  tuning: GlassTuning & { preset: GlassPreset }
  /** 静息面板的可读性响应（宿主开启自适应底色时），过渡沿用它，收尾交接不跳变 */
  legibility: Readonly<LegibilityParams> | null
  /** 静态玻璃的折射倍率；可读性响应再乘上 refractionScale，和静态宿主一致 */
  refractScaleMultiplier: number
  dense: boolean
  isLegible: boolean
  resolvedTheme: 'light' | 'dark'
  glassAlpha: number
  bounds: Rect
  geometry: PopoverFrameGeometry
  mState: PopoverMotionState
  bareSource: boolean
  startTintVars: ElementTintVars
  panelTintVars: ElementTintVars
  startVeil: BackdropVeilOptics
  panelSurface: ExtractedCssGlassSurface
  onUpdateRefractFrame?: (frame: RefractFilterFrame, legibility: Readonly<LegibilityParams> | null) => void
}

/** Updates clipped glass veil and Route B3 unclipped refraction backdrop siblings during morphing. */
export function applyMorphBackdropLayers({
  morphGlassEl,
  morphBackdropEl,
  morphFilterId,
  refractSupported,
  hasRefractHandle,
  glassMode,
  tuning,
  legibility,
  refractScaleMultiplier,
  dense,
  isLegible,
  resolvedTheme,
  glassAlpha,
  bounds,
  geometry,
  mState,
  bareSource,
  startTintVars,
  panelTintVars,
  startVeil,
  panelSurface,
  onUpdateRefractFrame,
}: MorphBackdropStyleOptions): void {
  if (!morphGlassEl) return

  if (glassAlpha <= 0.005) {
    if (morphBackdropEl) morphBackdropEl.style.visibility = 'hidden'
    morphGlassEl.style.visibility = 'hidden'
    return
  }

  const contourPath = extractFieldContourPath(geometry.field, { x: bounds.x, y: bounds.y })
  morphGlassEl.style.visibility = 'visible'
  morphGlassEl.style.transform = `translate3d(${bounds.x}px, ${bounds.y}px, 0)`
  morphGlassEl.style.width = `${bounds.width}px`
  morphGlassEl.style.height = `${bounds.height}px`
  morphGlassEl.style.clipPath = contourPath ? `path("${contourPath}")` : 'none'
  morphGlassEl.style.opacity = `${glassAlpha}`

  const effectiveMode = glassMode === 'refract' && !refractSupported ? 'frosted' : glassMode
  if (effectiveMode === 'solid') {
    if (morphBackdropEl) morphBackdropEl.style.visibility = 'hidden'
    morphGlassEl.style.removeProperty('--g-tint-scale')
    morphGlassEl.style.backdropFilter = 'none'
    morphGlassEl.style.setProperty('-webkit-backdrop-filter', 'none')
    morphGlassEl.style.background = 'var(--surface)'
    return
  }

  if (effectiveMode === 'frosted') {
    if (morphBackdropEl) morphBackdropEl.style.visibility = 'hidden'
    morphGlassEl.style.removeProperty('--g-tint-scale')
    const bf = buildBackdropFilterCss({
      blurPx: 22 + mState.blurBumpPx + (legibility?.blurBoostPx ?? 0),
      saturation: 1.7 * (legibility?.saturationScale ?? 1),
      correction: legibility?.fallbackVeil,
    })
    morphGlassEl.style.backdropFilter = bf
    morphGlassEl.style.setProperty('-webkit-backdrop-filter', bf)
    if (legibility) {
      morphGlassEl.style.background = formatRgbaCss(legibility.veilRgba)
    } else if (resolvedTheme === 'dark' && isLegible) {
      morphGlassEl.style.background = 'color-mix(in srgb, var(--bg) 78%, transparent)'
    } else if (dense) {
      morphGlassEl.style.background = 'color-mix(in srgb, var(--bg) 55%, transparent)'
    } else {
      morphGlassEl.style.background = 'var(--g-bg)'
    }
    return
  }

  // 'refract' mode (refractSupported === true): match resting Glass.tsx blur, saturate, veil, adaptive tint, and --g-tint-scale
  const startBlur = !bareSource && startTintVars.isDense ? tuning.denseBlur : tuning.blur
  const targetBlur = dense ? tuning.denseBlur : tuning.blur
  const baseBlur = startBlur + (targetBlur - startBlur) * geometry.styleMix
  const activeBlur =
    baseBlur + (tuning.preset === 'prism' ? mState.blurBumpPx : 0) + (legibility?.blurBoostPx ?? 0)

  const fallbackStartTint = startTintVars.isDense ? tuning.denseTint : tuning.tint
  const fallbackTargetTint = dense || isLegible ? tuning.denseTint : tuning.tint
  const startCssTint = startTintVars.isDense
    ? (startTintVars.denseTint ?? startTintVars.tint)
    : startTintVars.tint
  const panelCssTint = dense || isLegible
    ? (panelTintVars.denseTint ?? panelTintVars.tint)
    : panelTintVars.tint

  const startTint = !bareSource ? (startCssTint ?? fallbackStartTint) : (panelTintVars.tint ?? tuning.tint)
  const targetTint = panelCssTint ?? fallbackTargetTint
  const activeTint = startTint + (targetTint - startTint) * geometry.styleMix

  const themeDefaultScale = resolvedTheme === 'dark' ? (tuning.preset === 'prism' ? 1.55 : 1.6) : 1
  const startScale = startTintVars.tintScale ?? panelTintVars.tintScale ?? themeDefaultScale
  const targetScale = panelTintVars.tintScale ?? themeDefaultScale
  const activeTintScale = startScale + (targetScale - startScale) * geometry.styleMix

  morphGlassEl.style.setProperty('--g-tint-scale', `${activeTintScale.toFixed(4)}`)
  morphGlassEl.style.background = legibility
    ? formatRgbaCss(legibility.veilRgba)
    : `color-mix(in srgb, var(--g-neutral) min(100%, calc(${activeTint.toFixed(2)}% * var(--g-tint-scale, ${activeTintScale.toFixed(4)}))), transparent)`

  if (contourPath && morphBackdropEl && hasRefractHandle && onUpdateRefractFrame) {
    // Route B3: place backdrop-filter: url(#svg) on an unclipped sibling while SVG self-masks to shapeAlpha,
    // preventing Chromium's clip-path rectangular bounding-box leak.
    const backdropBounds = computeClampedRefractBounds(geometry.field, bounds)
    const veilOptics = interpolateVeilOptics(startVeil, panelSurface.veil, geometry.styleMix)
    onUpdateRefractFrame({
      bounds: backdropBounds,
      field: geometry.field,
      blurSigma: activeBlur,
      saturate: tuning.saturate * (legibility?.saturationScale ?? 1),
      scaleMultiplier: refractScaleMultiplier * (legibility?.refractionScale ?? 1),
      brightness: veilOptics.brightness,
      contrast: veilOptics.contrast,
      contrastFirst: veilOptics.contrastFirst,
    }, legibility)
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
    const veilVar = dense ? '--g-veil-float' : '--g-veil-plate'
    const correction = legibility ? ` ${buildBackdropFilterCss({ blurPx: 0, correction: legibility.fallbackVeil }).replace('none', '')}` : ''
    const bf = `blur(${activeBlur.toFixed(2)}px) saturate(${tuning.saturate * (legibility?.saturationScale ?? 1)}) var(${veilVar})${correction}`
    morphGlassEl.style.backdropFilter = bf
    morphGlassEl.style.setProperty('-webkit-backdrop-filter', bf)
  }
}

const edgeMaterial = {} as OpticalMaterial

/** Updates WebGL2/2D perimeter specular highlight and shadow overlay canvas for the current morph frame. */
export function updateMorphOverlayCanvas(
  overlayCanvasEl: HTMLCanvasElement | null,
  renderer: IGlassOverlayRenderer | null,
  bounds: Rect,
  resolvedTheme: 'light' | 'dark',
  geometry: PopoverFrameGeometry,
  material: OpticalMaterial,
  glassAlpha: number,
  blurBumpPx: number,
  legibility: Readonly<LegibilityParams> | null,
): void {
  if (!overlayCanvasEl) return
  if (glassAlpha <= 0.005) {
    overlayCanvasEl.style.visibility = 'hidden'
    renderer?.clear()
    return
  }

  overlayCanvasEl.style.visibility = 'visible'
  overlayCanvasEl.style.transform = `translate3d(${bounds.x}px, ${bounds.y}px, 0)`
  overlayCanvasEl.style.width = `${bounds.width}px`
  overlayCanvasEl.style.height = `${bounds.height}px`

  renderer?.render({
    viewport: { width: bounds.width, height: bounds.height },
    dpr: typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1,
    theme: resolvedTheme,
    field: shiftField(geometry.field, bounds.x, bounds.y),
    // 静态宿主的控制器对边缘做同样的补偿，交接时细线与高光不跳
    material: legibility ? compensateLegibilityEdges(material, legibility, edgeMaterial) : material,
    opacity: glassAlpha,
    blurBumpPx,
  })
}
