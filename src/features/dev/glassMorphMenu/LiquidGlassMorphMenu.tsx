/**
 * Clean-room React orchestrator for the Liquid Glass Morphing Menu PoC.
 *
 * Bridges the deterministic motion controller (`./motion`), goo geometry solver
 * (`./geometry`), WebGL2 SDF glass renderer (`./renderer`), and procedural backdrop
 * (`./backdropScene`) with semantic DOM menu items, press-and-drag-to-select,
 * mid-flight interruption snapshots, deferred selection callbacks, and CSS fallback.
 *
 * SPDX-License-Identifier: MPL-2.0
 */

import { useReducedMotion } from 'motion/react'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { cn } from '@/lib/cn'
import { drawBackdropScene, type BackdropPreset } from './backdropScene'
import {
  PRISM_CONSTANTS,
  type AnchorConfig,
  type BackdropSceneHandle,
  type GlassOpticalStyle,
  type GlassShapeState,
  type GooFrameGeometry,
  type MenuConfig,
  type MorphPhase,
  type MorphSnapshot,
  type MotionFrameState,
  type PlacementMode,
  type Point,
  type Rect,
  type RendererCapabilities,
  type Size,
} from './contracts'
import { computeMorphGeometry, computeTargetCardRect } from './geometry'
import { createMotionController, evaluateMotionFrame, resolveOpticalStyle } from './motion'
import { createLiquidGlassRenderer, type GlassDebugMode, type ILiquidGlassRendererWithDebug } from './renderer'

export type TriggerStyleMode = 'glass-pill' | 'bare-icon' | 'point-context'

export interface LiquidGlassMenuItem {
  id: string
  label: string
  icon?: ReactNode
  shortcut?: string
  destructive?: boolean
  disabled?: boolean
}

export interface ScrubState {
  active: boolean
  phase: MorphPhase
  normalizedT: number
}

export interface MenuTelemetry {
  phase: MorphPhase
  normalizedT: number
  morphProgress: number
  mergeDepth: number
  isMerged: boolean
  blendK: number
  settled: number
  blurBumpPx: number
  styleMix: number
  rimOpacity: number
  fps: number
  capabilities: RendererCapabilities
}

export interface LiquidGlassMorphMenuProps {
  items: readonly LiquidGlassMenuItem[]
  triggerLabel: string
  triggerIcon?: ReactNode
  triggerStyle: TriggerStyleMode
  placement: PlacementMode
  theme: 'light' | 'dark'
  backdropPreset: BackdropPreset
  backdropScroll: Point
  onBackdropScrollChange?: (next: Point) => void
  animateBackdrop?: boolean
  playbackSpeed?: number
  paused?: boolean
  scrubState?: ScrubState
  debugMode?: GlassDebugMode
  dispersion?: number
  reducedMotion?: boolean
  /** Normalized trigger center in [0..1] across the stage. */
  anchorNormalized?: Point
  onAnchorNormalizedChange?: (next: Point) => void
  onSelect?: (item: LiquidGlassMenuItem) => void
  onTelemetry?: (telemetry: MenuTelemetry) => void
  className?: string
}

const MENU_WIDTH = 248
const MENU_ROW_HEIGHT = 40
const MENU_ROW_GAP = 2
const DRAG_HIT_SLOP_PX = 8
const TELEMETRY_INTERVAL_MS = 80

const EMPTY_CAPABILITIES: RendererCapabilities = {
  webgl2: false,
  floatFbo: false,
  maxTextureSize: 0,
  fallbackNotice: 'Initializing WebGL2 renderer…',
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max)
}

function computeMenuSize(itemCount: number): Size {
  const count = Math.max(1, itemCount)
  const height =
    PRISM_CONSTANTS.CARD_INSET * 2 +
    count * MENU_ROW_HEIGHT +
    Math.max(0, count - 1) * MENU_ROW_GAP
  return { width: MENU_WIDTH, height }
}

function computeUnionHoldRect(anchorRect: Rect, cardRect: Rect): Rect {
  const minX = Math.min(anchorRect.x, cardRect.x)
  const minY = Math.min(anchorRect.y, cardRect.y)
  const maxX = Math.max(anchorRect.x + anchorRect.width, cardRect.x + cardRect.width)
  const maxY = Math.max(anchorRect.y + anchorRect.height, cardRect.y + cardRect.height)
  const w = maxX - minX
  const h = maxY - minY
  const pad = Math.max(w, h) * 0.1
  return {
    x: minX - pad,
    y: minY - pad,
    width: w + pad * 2,
    height: h + pad * 2,
  }
}

function applyOpticalDispersion(style: GlassOpticalStyle, dispersion: number): GlassOpticalStyle {
  if (Math.abs(style.dispersion - dispersion) < 1e-4) {
    return style
  }
  return {
    ...style,
    dispersion,
  }
}

function buildRestingTriggerGeometry(
  anchorRect: Rect,
  motion: MotionFrameState,
  anchorConfig: AnchorConfig,
  menuConfig: MenuConfig,
): GooFrameGeometry {
  const pressedW = Math.max(1, anchorRect.width * motion.pressScaleX)
  const pressedH = Math.max(1, anchorRect.height * motion.pressScaleY)
  const platter: GlassShapeState = {
    center: {
      x: anchorRect.x + anchorRect.width * 0.5 + motion.pressOffsetX,
      y: anchorRect.y + anchorRect.height * 0.5 + motion.pressOffsetY,
    },
    size: { width: pressedW, height: pressedH },
    radius: Math.min(pressedW, pressedH) * 0.5,
  }
  const targetCardRect = computeTargetCardRect(anchorConfig, menuConfig)
  return {
    targetCardRect,
    targetCardRadius: PRISM_CONSTANTS.RESTING_CARD_RADIUS,
    platter,
    droplet: {
      center: { ...platter.center },
      size: { width: 0, height: 0 },
      radius: 0,
    },
    blendK: 0,
    mergeDepth: PRISM_CONSTANTS.MERGE_RIM_FADE_DEPTH,
    isMerged: true,
    rimOpacity: 1,
    styleMix: 0,
    contentTransform: {
      originX: targetCardRect.width * 0.5,
      originY: targetCardRect.height * 0.5,
      scale: 1,
      translateX: 0,
      translateY: 0,
      clipLeft: targetCardRect.x,
      clipTop: targetCardRect.y,
      clipRight: targetCardRect.x + targetCardRect.width,
      clipBottom: targetCardRect.y + targetCardRect.height,
      clipRadius: PRISM_CONSTANTS.RESTING_CARD_RADIUS,
    },
    glyphTransform: {
      centerX: platter.center.x,
      centerY: platter.center.y,
      scale: 1,
    },
  }
}

export function LiquidGlassMorphMenu({
  items,
  triggerLabel,
  triggerIcon,
  triggerStyle,
  placement,
  theme,
  backdropPreset,
  backdropScroll,
  onBackdropScrollChange,
  animateBackdrop = false,
  playbackSpeed = 1,
  paused = false,
  scrubState,
  debugMode = 'off',
  dispersion = 0,
  reducedMotion: reducedMotionOverride,
  anchorNormalized = { x: 0.78, y: 0.16 },
  onSelect,
  onTelemetry,
  className,
}: LiquidGlassMorphMenuProps) {
  const systemReducedMotion = useReducedMotion()
  const reducedMotion = Boolean(reducedMotionOverride ?? systemReducedMotion)
  const bareSource = triggerStyle === 'bare-icon'
  const hasControlSource = triggerStyle !== 'point-context'

  const stageRef = useRef<HTMLDivElement>(null)
  const bgCanvasRef = useRef<HTMLCanvasElement>(null)
  const glassCanvasRef = useRef<HTMLCanvasElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const glyphPortalRef = useRef<HTMLDivElement>(null)
  const clipWrapperRef = useRef<HTMLDivElement>(null)
  const menuCardRef = useRef<HTMLDivElement>(null)
  const cssFallbackRef = useRef<HTMLDivElement>(null)

  const [stageSize, setStageSize] = useState<Size>({ width: 960, height: 600 })
  const [phase, setPhase] = useState<MorphPhase>('closed')
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const [pointAnchorOverride, setPointAnchorOverride] = useState<Point | null>(null)
  const [capabilities, setCapabilities] = useState<RendererCapabilities>(EMPTY_CAPABILITIES)

  const motionRef = useRef<ReturnType<typeof createMotionController> | null>(null)
  const rendererRef = useRef<ILiquidGlassRendererWithDebug | null>(null)
  const pendingSelectRef = useRef<LiquidGlassMenuItem | null>(null)
  const lastGeometryRef = useRef<GooFrameGeometry | null>(null)
  const lastMotionRef = useRef<MotionFrameState>(evaluateMotionFrame('closed', 0, { reducedMotion }))
  const lastPhaseRef = useRef<MorphPhase>('closed')
  const backdropVersionRef = useRef(1)
  const backdropTimeRef = useRef(0)
  const prevHoldActiveRef = useRef(false)

  // Pointer tracking for press-and-drag-to-select & backdrop panning
  const triggerDragRef = useRef<{
    pointerId: number
    startClient: Point
    dragOpened: boolean
    wasClosedOnDown: boolean
  } | null>(null)
  const handledPointerClickRef = useRef(false)

  const backdropPanRef = useRef<{
    pointerId: number
    startClient: Point
    startScroll: Point
    moved: boolean
  } | null>(null)

  // Keep latest props in refs for the rAF loop so we never tear down the loop on prop changes.
  const latestRef = useRef({
    items,
    triggerStyle,
    bareSource,
    hasControlSource,
    placement,
    theme,
    backdropPreset,
    backdropScroll,
    animateBackdrop,
    playbackSpeed,
    paused,
    scrubState,
    dispersion,
    stageSize,
    anchorNormalized,
    pointAnchorOverride,
    onSelect,
    onTelemetry,
    capabilities,
  })
  latestRef.current = {
    items,
    triggerStyle,
    bareSource,
    hasControlSource,
    placement,
    theme,
    backdropPreset,
    backdropScroll,
    animateBackdrop,
    playbackSpeed,
    paused,
    scrubState,
    dispersion,
    stageSize,
    anchorNormalized,
    pointAnchorOverride,
    onSelect,
    onTelemetry,
    capabilities,
  }

  const menuSize = useMemo(() => computeMenuSize(items.length), [items.length])

  const triggerSize = useMemo<Size>(() => {
    if (triggerStyle === 'bare-icon') return { width: 40, height: 40 }
    if (triggerStyle === 'point-context') return { width: 132, height: 38 }
    return { width: 118, height: 40 }
  }, [triggerStyle])

  const anchorRect = useMemo<Rect>(() => {
    const margin = PRISM_CONSTANTS.SCREEN_MARGIN
    if (triggerStyle === 'point-context' && pointAnchorOverride) {
      return {
        x: clamp(pointAnchorOverride.x - 1, margin, Math.max(margin, stageSize.width - margin - 2)),
        y: clamp(pointAnchorOverride.y - 1, margin, Math.max(margin, stageSize.height - margin - 2)),
        width: 2,
        height: 2,
      }
    }
    const cx = clamp(
      anchorNormalized.x * stageSize.width,
      margin + triggerSize.width * 0.5,
      Math.max(margin + triggerSize.width * 0.5, stageSize.width - margin - triggerSize.width * 0.5),
    )
    const cy = clamp(
      anchorNormalized.y * stageSize.height,
      margin + triggerSize.height * 0.5,
      Math.max(margin + triggerSize.height * 0.5, stageSize.height - margin - triggerSize.height * 0.5),
    )
    return {
      x: cx - triggerSize.width * 0.5,
      y: cy - triggerSize.height * 0.5,
      width: triggerSize.width,
      height: triggerSize.height,
    }
  }, [anchorNormalized, pointAnchorOverride, stageSize.height, stageSize.width, triggerSize, triggerStyle])

  const anchorConfig = useMemo<AnchorConfig>(
    () => ({
      anchorRect,
      placement,
      bareSource,
      hasControlSource,
      viewportSize: stageSize,
      avoidRect: triggerStyle === 'point-context' ? anchorRect : undefined,
    }),
    [anchorRect, bareSource, hasControlSource, placement, stageSize, triggerStyle],
  )

  const menuConfig = useMemo<MenuConfig>(
    () => ({
      size: menuSize,
      itemRadius: PRISM_CONSTANTS.ITEM_RADIUS,
      cardInset: PRISM_CONSTANTS.CARD_INSET,
      restingRadius: PRISM_CONSTANTS.RESTING_CARD_RADIUS,
    }),
    [menuSize],
  )

  const configRefs = useRef({ anchorRect, anchorConfig, menuConfig })
  configRefs.current = { anchorRect, anchorConfig, menuConfig }

  // Create and dispose motion controller in effect lifecycle (StrictMode-safe)
  useEffect(() => {
    const controller = createMotionController({ reducedMotion })
    motionRef.current = controller
    return () => {
      controller.dispose()
      if (motionRef.current === controller) {
        motionRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sync reducedMotion into controller
  useEffect(() => {
    motionRef.current?.setReducedMotion(reducedMotion)
  }, [reducedMotion])

  // Sync debugMode into renderer
  useEffect(() => {
    rendererRef.current?.setDebugMode(debugMode)
  }, [debugMode])

  // Measure stage dimensions via ResizeObserver
  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const updateSize = () => {
      const rect = el.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0) {
        setStageSize((prev) =>
          Math.abs(prev.width - rect.width) < 0.5 && Math.abs(prev.height - rect.height) < 0.5
            ? prev
            : { width: rect.width, height: rect.height },
        )
      }
    }
    updateSize()
    const observer = new ResizeObserver(updateSize)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Mount WebGL2 renderer once
  useEffect(() => {
    const glassCanvas = glassCanvasRef.current
    if (!glassCanvas) return
    const renderer = createLiquidGlassRenderer()
    rendererRef.current = renderer
    renderer.setDebugMode(debugMode)
    const caps = renderer.mount(glassCanvas)
    setCapabilities(caps)

    return () => {
      renderer.dispose()
      rendererRef.current = null
    }
    // Mount once on canvas creation; debugMode is synced in separate effect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Bump backdrop version whenever visual backdrop props change
  useEffect(() => {
    backdropVersionRef.current += 1
  }, [theme, backdropPreset, backdropScroll.x, backdropScroll.y, stageSize.width, stageSize.height])

  // Apply deterministic scrub state when active
  useEffect(() => {
    const motion = motionRef.current
    if (!motion || !scrubState?.active) return
    motion.seek(scrubState.phase, scrubState.normalizedT, hasControlSource)
  }, [hasControlSource, scrubState?.active, scrubState?.normalizedT, scrubState?.phase])

  const openMenu = useCallback(
    (pointOverride?: Point) => {
      const motion = motionRef.current
      if (!motion) return
      pendingSelectRef.current = null
      if (pointOverride && triggerStyle === 'point-context') {
        setPointAnchorOverride(pointOverride)
      }
      motion.open(hasControlSource)
      setActiveIndex(null)
    },
    [hasControlSource, triggerStyle],
  )

  const closeMenu = useCallback(() => {
    const motion = motionRef.current
    if (!motion) return
    const currentState = motion.getState()
    if (currentState.phase === 'closed' || currentState.phase === 'closing') return

    let snapshot: MorphSnapshot | undefined
    if (currentState.phase === 'opening' && currentState.normalizedT < 1 && lastGeometryRef.current) {
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
        blurPx: currentState.contentBlurPx,
        elapsedFraction: currentState.normalizedT,
      }
    }

    motion.close(snapshot)
    setActiveIndex(null)
  }, [])

  const selectItem = useCallback(
    (item: LiquidGlassMenuItem) => {
      if (item.disabled) return
      pendingSelectRef.current = item
      closeMenu()
    },
    [closeMenu],
  )

  // Hit-test menu rows by client coordinates during press-and-drag-to-select
  const hitTestMenuRow = useCallback((clientX: number, clientY: number): number | null => {
    const card = menuCardRef.current
    if (!card) return null
    const rowEls = card.querySelectorAll<HTMLElement>('[data-menu-item-index]')
    for (const el of rowEls) {
      const r = el.getBoundingClientRect()
      if (clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom) {
        const idx = Number(el.dataset.menuItemIndex)
        return Number.isFinite(idx) ? idx : null
      }
    }
    return null
  }, [])

  // Keyboard dismissal (Escape)
  useEffect(() => {
    if (phase === 'closed' || phase === 'closing') return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        closeMenu()
        triggerRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [closeMenu, phase])

  // Main 60/120fps rAF render + DOM transform loop
  useEffect(() => {
    let rafId = 0
    let lastTs = performance.now()
    let lastTelemetryTs = 0
    let fpsSmoothed = 60
    let lastRenderedBackdropVersion = -1

    const tick = (now: number) => {
      const rawDt = Math.min(0.05, Math.max(0, (now - lastTs) / 1000))
      lastTs = now
      if (rawDt > 0.0005) {
        const instFps = 1 / rawDt
        fpsSmoothed = fpsSmoothed * 0.9 + instFps * 0.1
      }

      const {
        animateBackdrop: animBg,
        playbackSpeed: speed,
        paused: isPaused,
        scrubState: scrub,
        theme: curTheme,
        backdropPreset: preset,
        backdropScroll: scroll,
        dispersion: disp,
        stageSize: vp,
        bareSource: isBare,
        hasControlSource: hasCtrl,
        onSelect: selectCb,
        onTelemetry: telemetryCb,
        capabilities: caps,
      } = latestRef.current

      const { anchorRect: aRect, anchorConfig: aCfg, menuConfig: mCfg } = configRefs.current
      const motion = motionRef.current
      const renderer = rendererRef.current

      if (!motion) {
        rafId = requestAnimationFrame(tick)
        return
      }

      if (animBg && !isPaused) {
        backdropTimeRef.current += rawDt
        backdropVersionRef.current += 1
      }

      const dt = scrub?.active || isPaused ? 0 : rawDt * Math.max(0.05, speed)
      const prevPhase = lastPhaseRef.current
      const mState = dt > 0 ? motion.step(dt) : motion.getState()
      lastMotionRef.current = mState

      // Phase transition handling & deferred selection execution
      if (mState.phase !== prevPhase) {
        lastPhaseRef.current = mState.phase
        setPhase(mState.phase)

        if (mState.phase === 'closed') {
          setPointAnchorOverride(null)
          if (pendingSelectRef.current) {
            const chosen = pendingSelectRef.current
            pendingSelectRef.current = null
            selectCb?.(chosen)
          }
        }
      }

      // Compute geometry
      const closeSnap = motion.getCloseSnapshot()
      const geometry: GooFrameGeometry =
        mState.phase === 'closed'
          ? buildRestingTriggerGeometry(aRect, mState, aCfg, mCfg)
          : computeMorphGeometry(mState, aCfg, mCfg, closeSnap)

      lastGeometryRef.current = geometry

      // Manage backdrop hold during static morphing transitions; keep Drift live when animateBackdrop is on
      const holdActive = !animBg && (mState.phase === 'opening' || mState.phase === 'closing')
      if (renderer) {
        if (holdActive && !prevHoldActiveRef.current) {
          renderer.holdBackdrop(computeUnionHoldRect(aRect, geometry.targetCardRect))
        } else if (!holdActive && prevHoldActiveRef.current) {
          renderer.releaseBackdropHold()
        }
      }
      prevHoldActiveRef.current = holdActive

      const dpr = window.devicePixelRatio || 1

      // Draw background 2D canvas & sync WebGL2 backdrop texture when version changes (and not held)
      const bgCanvas = bgCanvasRef.current
      const shouldRedrawBackdrop =
        lastRenderedBackdropVersion !== backdropVersionRef.current && (!holdActive || lastRenderedBackdropVersion < 0)
      if (bgCanvas && shouldRedrawBackdrop) {
        const backingW = Math.max(1, Math.round(vp.width * dpr))
        const backingH = Math.max(1, Math.round(vp.height * dpr))
        if (bgCanvas.width !== backingW || bgCanvas.height !== backingH) {
          bgCanvas.width = backingW
          bgCanvas.height = backingH
        }
        const ctx = bgCanvas.getContext('2d')
        if (ctx) {
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
          drawBackdropScene(ctx, vp.width, vp.height, {
            theme: curTheme,
            preset,
            scrollOffset: scroll,
            timeSec: backdropTimeRef.current,
          })
        }

        const sceneHandle: BackdropSceneHandle = {
          size: vp,
          dpr,
          version: backdropVersionRef.current,
          source: bgCanvas,
        }
        renderer?.setBackdrop(sceneHandle)
        lastRenderedBackdropVersion = backdropVersionRef.current
      }

      // Compute optical style & glass opacity
      const baseStyle = resolveOpticalStyle(curTheme, geometry.styleMix)
      const activeStyle = applyOpticalDispersion(baseStyle, disp)

      let glassOpacity = 1
      if (mState.phase === 'closed') {
        glassOpacity = !isBare && hasCtrl ? 1 : 0
      } else if (mState.reducedMotion) {
        glassOpacity = mState.phase === 'open' ? 1 : mState.bareGlassOpacity
      } else if (!hasCtrl) {
        glassOpacity = mState.phase === 'closing' ? mState.contentOpacity : 1
      } else if (isBare) {
        glassOpacity = mState.bareGlassOpacity
      }

      // Render WebGL2 glass
      if (renderer && caps.webgl2) {
        renderer.render({
          viewport: vp,
          dpr,
          theme: curTheme,
          geometry,
          style: activeStyle,
          opacity: glassOpacity,
          blurBumpPx: mState.blurBumpPx,
        })
      }

      // Update CSS fallback surface when WebGL2 is unavailable
      const fallbackEl = cssFallbackRef.current
      if (fallbackEl) {
        if (!caps.webgl2 && glassOpacity > 0.01) {
          const p = geometry.platter
          fallbackEl.style.opacity = `${glassOpacity}`
          fallbackEl.style.transform = `translate3d(${p.center.x - p.size.width * 0.5}px, ${p.center.y - p.size.height * 0.5}px, 0)`
          fallbackEl.style.width = `${p.size.width}px`
          fallbackEl.style.height = `${p.size.height}px`
          fallbackEl.style.borderRadius = `${p.radius}px`
          fallbackEl.style.backdropFilter = `blur(${Math.round(activeStyle.blur + mState.blurBumpPx)}px) saturate(${activeStyle.saturation})`
        } else {
          fallbackEl.style.opacity = '0'
        }
      }

      // Update resting trigger button ElasticPress transform & visibility
      const triggerEl = triggerRef.current
      if (triggerEl) {
        const showRestingTrigger = mState.phase === 'closed'
        triggerEl.style.opacity = showRestingTrigger ? '1' : '0'
        triggerEl.style.pointerEvents = showRestingTrigger || triggerDragRef.current ? 'auto' : 'none'
        triggerEl.style.transform = showRestingTrigger
          ? `translate3d(${mState.pressOffsetX}px, ${mState.pressOffsetY}px, 0) scale(${mState.pressScaleX}, ${mState.pressScaleY})`
          : 'none'
      }

      // Update trigger glyph handoff portal during morph
      const glyphEl = glyphPortalRef.current
      if (glyphEl) {
        const showGlyph = mState.phase !== 'closed' && hasCtrl && mState.triggerGlyphOpacity > 0.005
        if (showGlyph) {
          const g = geometry.glyphTransform
          glyphEl.style.opacity = `${mState.triggerGlyphOpacity}`
          glyphEl.style.transform = `translate3d(${g.centerX}px, ${g.centerY}px, 0) translate(-50%, -50%) scale(${g.scale})`
          glyphEl.style.filter =
            mState.triggerGlyphBlurPx > 0.05 ? `blur(${mState.triggerGlyphBlurPx.toFixed(2)}px)` : 'none'
        } else {
          glyphEl.style.opacity = '0'
        }
      }

      // Update menu clip wrapper & semantic card transform in lockstep
      const clipEl = clipWrapperRef.current
      const cardEl = menuCardRef.current
      if (clipEl && cardEl) {
        const ct = geometry.contentTransform
        const clipW = Math.max(0, ct.clipRight - ct.clipLeft)
        const clipH = Math.max(0, ct.clipBottom - ct.clipTop)
        const visible = mState.phase !== 'closed' && mState.contentOpacity > 0.005

        clipEl.style.transform = `translate3d(${ct.clipLeft}px, ${ct.clipTop}px, 0)`
        clipEl.style.width = `${clipW}px`
        clipEl.style.height = `${clipH}px`
        clipEl.style.borderRadius = `${ct.clipRadius}px`
        clipEl.style.visibility = visible ? 'visible' : 'hidden'
        clipEl.style.pointerEvents = mState.phase === 'open' || mState.phase === 'opening' ? 'auto' : 'none'

        const cardRect = geometry.targetCardRect
        cardEl.style.width = `${cardRect.width}px`
        cardEl.style.height = `${cardRect.height}px`
        cardEl.style.transformOrigin = `${ct.originX}px ${ct.originY}px`
        cardEl.style.transform = `translate3d(${cardRect.x - ct.clipLeft + ct.translateX}px, ${cardRect.y - ct.clipTop + ct.translateY}px, 0) scale(${ct.scale})`
        cardEl.style.opacity = `${mState.contentOpacity}`
        cardEl.style.filter = mState.contentBlurPx > 0.05 ? `blur(${mState.contentBlurPx.toFixed(2)}px)` : 'none'
      }

      // Emit throttled telemetry for the lab HUD
      if (telemetryCb && now - lastTelemetryTs >= TELEMETRY_INTERVAL_MS) {
        lastTelemetryTs = now
        telemetryCb({
          phase: mState.phase,
          normalizedT: mState.normalizedT,
          morphProgress: mState.morphProgress,
          mergeDepth: geometry.mergeDepth,
          isMerged: geometry.isMerged,
          blendK: geometry.blendK,
          settled: mState.settled,
          blurBumpPx: mState.blurBumpPx,
          styleMix: geometry.styleMix,
          rimOpacity: geometry.rimOpacity,
          fps: Math.round(fpsSmoothed),
          capabilities: caps,
        })
      }

      rafId = requestAnimationFrame(tick)
    }

    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [])

  // Trigger button pointer interactions (Click + Press-and-drag-to-select + ElasticPress)
  const handleTriggerPointerDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return
    e.stopPropagation()
    handledPointerClickRef.current = true

    const motion = motionRef.current
    if (!motion) return

    const curPhase = motion.getState().phase
    if (curPhase === 'open' || curPhase === 'opening') {
      closeMenu()
      return
    }

    e.currentTarget.setPointerCapture(e.pointerId)
    motion.pressStart(triggerSize)
    triggerDragRef.current = {
      pointerId: e.pointerId,
      startClient: { x: e.clientX, y: e.clientY },
      dragOpened: false,
      wasClosedOnDown: curPhase === 'closed' || curPhase === 'closing',
    }
  }

  const handleTriggerPointerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = triggerDragRef.current
    const motion = motionRef.current
    if (!drag || drag.pointerId !== e.pointerId || !motion) return

    const dx = e.clientX - drag.startClient.x
    const dy = e.clientY - drag.startClient.y
    motion.pressMove({ x: dx, y: dy }, triggerSize)

    if (!drag.dragOpened && Math.hypot(dx, dy) >= DRAG_HIT_SLOP_PX) {
      drag.dragOpened = true
      openMenu()
    }

    if (drag.dragOpened) {
      const hitIdx = hitTestMenuRow(e.clientX, e.clientY)
      setActiveIndex(hitIdx)
    }
  }

  const handleTriggerPointerUp = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = triggerDragRef.current
    const motion = motionRef.current
    if (!drag || drag.pointerId !== e.pointerId || !motion) return
    triggerDragRef.current = null
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    motion.pressRelease()

    if (!drag.dragOpened) {
      if (drag.wasClosedOnDown) {
        openMenu()
      }
      return
    }

    const hitIdx = hitTestMenuRow(e.clientX, e.clientY)
    if (hitIdx !== null) {
      const item = items[hitIdx]
      if (item && !item.disabled) {
        selectItem(item)
        return
      }
    }

    // Released outside menu items: keep open if still over trigger, else close
    const triggerBox = triggerRef.current?.getBoundingClientRect()
    const overTrigger =
      triggerBox &&
      e.clientX >= triggerBox.left &&
      e.clientX <= triggerBox.right &&
      e.clientY >= triggerBox.top &&
      e.clientY <= triggerBox.bottom

    if (!overTrigger) {
      closeMenu()
    }
  }

  const handleTriggerPointerCancel = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (triggerDragRef.current?.pointerId === e.pointerId) {
      triggerDragRef.current = null
      motionRef.current?.pressRelease()
    }
  }

  const handleTriggerKeyDown = (e: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      if (phase === 'closed' || phase === 'closing') {
        e.preventDefault()
        handledPointerClickRef.current = true
        openMenu()
        setActiveIndex(0)
      }
    }
  }

  const handleTriggerClick = () => {
    if (handledPointerClickRef.current) {
      handledPointerClickRef.current = false
      return
    }
    const curPhase = motionRef.current?.getState().phase
    if (curPhase === 'open' || curPhase === 'opening') {
      closeMenu()
    } else {
      openMenu()
    }
  }

  // Stage backdrop interactions: outside click dismisses, point-context click opens at pointer, drag pans backdrop
  const handleStagePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return

    if (phase === 'open' || phase === 'opening') {
      closeMenu()
      return
    }

    backdropPanRef.current = {
      pointerId: e.pointerId,
      startClient: { x: e.clientX, y: e.clientY },
      startScroll: { ...backdropScroll },
      moved: false,
    }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const handleStagePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const pan = backdropPanRef.current
    if (!pan || pan.pointerId !== e.pointerId) return
    const dx = e.clientX - pan.startClient.x
    const dy = e.clientY - pan.startClient.y
    if (!pan.moved && Math.hypot(dx, dy) > 4) {
      pan.moved = true
    }
    if (pan.moved && onBackdropScrollChange) {
      onBackdropScrollChange({
        x: pan.startScroll.x + dx,
        y: pan.startScroll.y + dy,
      })
    }
  }

  const handleStagePointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const pan = backdropPanRef.current
    if (!pan || pan.pointerId !== e.pointerId) return
    backdropPanRef.current = null
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }

    // In point-context mode, a clean tap/click on empty stage opens the point menu at that position
    if (!pan.moved && triggerStyle === 'point-context' && phase === 'closed') {
      const stageBox = stageRef.current?.getBoundingClientRect()
      if (stageBox) {
        openMenu({
          x: e.clientX - stageBox.left,
          y: e.clientY - stageBox.top,
        })
      }
    }
  }

  // Menu card keyboard navigation
  const handleMenuKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const enabledIndices = items.map((it, idx) => (it.disabled ? -1 : idx)).filter((idx) => idx >= 0)
    if (enabledIndices.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      const cur = activeIndex === null ? -1 : enabledIndices.indexOf(activeIndex)
      const next = enabledIndices[(cur + 1) % enabledIndices.length]
      setActiveIndex(next)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      const cur = activeIndex === null ? 0 : enabledIndices.indexOf(activeIndex)
      const next = enabledIndices[(cur - 1 + enabledIndices.length) % enabledIndices.length]
      setActiveIndex(next)
    } else if (e.key === 'Home') {
      e.preventDefault()
      setActiveIndex(enabledIndices[0])
    } else if (e.key === 'End') {
      e.preventDefault()
      setActiveIndex(enabledIndices[enabledIndices.length - 1])
    } else if (e.key === 'Enter' || e.key === ' ') {
      if (activeIndex !== null && items[activeIndex] && !items[activeIndex].disabled) {
        e.preventDefault()
        selectItem(items[activeIndex])
      }
    }
  }

  const isDark = theme === 'dark'
  const triggerContent = (
    <span className="flex items-center justify-center gap-2 whitespace-nowrap px-3.5 text-[13px] font-semibold tracking-tight">
      {triggerIcon}
      {triggerStyle !== 'bare-icon' && <span>{triggerLabel}</span>}
    </span>
  )

  return (
    <div
      ref={stageRef}
      data-testid="glass-morph-stage"
      onPointerDown={handleStagePointerDown}
      onPointerMove={handleStagePointerMove}
      onPointerUp={handleStagePointerUp}
      onContextMenu={(e) => {
        if (triggerStyle === 'point-context') {
          e.preventDefault()
          const stageBox = stageRef.current?.getBoundingClientRect()
          if (stageBox) {
            openMenu({ x: e.clientX - stageBox.left, y: e.clientY - stageBox.top })
          }
        }
      }}
      className={cn(
        'relative h-full w-full overflow-hidden select-none touch-none',
        className,
      )}
    >
      {/* Procedural Canvas Backdrop */}
      <canvas
        ref={bgCanvasRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 h-full w-full"
      />

      {/* WebGL2 Liquid Glass Overlay Canvas */}
      <canvas
        ref={glassCanvasRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-10 h-full w-full"
      />

      {/* CSS Fallback Glass Surface (only visible when WebGL2 is unavailable) */}
      <div
        ref={cssFallbackRef}
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute top-0 left-0 z-10 opacity-0 transition-none',
          isDark
            ? 'border border-white/20 bg-neutral-900/65 shadow-2xl'
            : 'border border-black/10 bg-white/65 shadow-xl',
        )}
      />

      {/* Resting Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={phase === 'open' || phase === 'opening'}
        aria-label={triggerLabel}
        onPointerDown={handleTriggerPointerDown}
        onPointerMove={handleTriggerPointerMove}
        onPointerUp={handleTriggerPointerUp}
        onPointerCancel={handleTriggerPointerCancel}
        onKeyDown={handleTriggerKeyDown}
        onClick={handleTriggerClick}
        style={{
          left: anchorRect.x,
          top: anchorRect.y,
          width: triggerSize.width,
          height: triggerSize.height,
        }}
        className={cn(
          'absolute z-20 flex cursor-pointer items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70',
          isDark ? 'text-white' : 'text-neutral-950',
          triggerStyle === 'point-context' &&
            (isDark
              ? 'border border-white/20 bg-black/45 backdrop-blur-md hover:bg-black/60'
              : 'border border-black/15 bg-white/75 backdrop-blur-md hover:bg-white/90'),
          triggerStyle === 'bare-icon' && 'hover:bg-current/8',
        )}
      >
        {triggerContent}
      </button>

      {/* Trigger Glyph Handoff Portal (lives inside the morphing droplet) */}
      <div
        ref={glyphPortalRef}
        aria-hidden="true"
        style={{
          width: triggerSize.width,
          height: triggerSize.height,
        }}
        className={cn(
          'pointer-events-none absolute top-0 left-0 z-20 flex items-center justify-center opacity-0',
          isDark ? 'text-white' : 'text-neutral-950',
        )}
      >
        {triggerContent}
      </div>

      {/* Platter-Synced Clipping Wrapper + Semantic DOM Menu Card */}
      <div
        ref={clipWrapperRef}
        style={{ visibility: 'hidden' }}
        className="absolute top-0 left-0 z-30 overflow-hidden"
      >
        <div
          ref={menuCardRef}
          role="menu"
          tabIndex={-1}
          onKeyDown={handleMenuKeyDown}
          style={{ padding: PRISM_CONSTANTS.CARD_INSET }}
          className={cn(
            'absolute top-0 left-0 flex flex-col outline-none',
            isDark ? 'text-white' : 'text-neutral-950',
          )}
          onPointerMove={(e) => {
            if (e.buttons > 0 || e.pointerType === 'mouse') {
              setActiveIndex(hitTestMenuRow(e.clientX, e.clientY))
            }
          }}
          onPointerLeave={() => setActiveIndex(null)}
          onPointerUp={(e) => {
            const hitIdx = hitTestMenuRow(e.clientX, e.clientY)
            if (hitIdx !== null) {
              const item = items[hitIdx]
              if (item && !item.disabled) {
                e.stopPropagation()
                selectItem(item)
              }
            }
          }}
        >
          {items.map((item, idx) => {
            const highlighted = activeIndex === idx && !item.disabled
            return (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                data-menu-item-index={idx}
                style={{
                  height: MENU_ROW_HEIGHT,
                  marginBottom: idx < items.length - 1 ? MENU_ROW_GAP : 0,
                  borderRadius: PRISM_CONSTANTS.ITEM_RADIUS,
                }}
                onMouseEnter={() => {
                  if (!item.disabled) setActiveIndex(idx)
                }}
                onClick={(e) => {
                  e.stopPropagation()
                  if (!item.disabled) selectItem(item)
                }}
                className={cn(
                  'flex w-full cursor-pointer items-center justify-between gap-2 px-3 text-left text-[13.5px] font-medium transition-colors duration-75 outline-none',
                  item.disabled && 'cursor-not-allowed opacity-40',
                  item.destructive
                    ? isDark
                      ? 'text-rose-400'
                      : 'text-rose-600'
                    : isDark
                      ? 'text-white/95'
                      : 'text-neutral-900',
                  highlighted &&
                    (item.destructive
                      ? isDark
                        ? 'bg-rose-500/20'
                        : 'bg-rose-500/12'
                      : isDark
                        ? 'bg-white/14'
                        : 'bg-black/8'),
                )}
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  {item.icon && <span className="shrink-0 opacity-85">{item.icon}</span>}
                  <span className="truncate">{item.label}</span>
                </span>
                {item.shortcut && (
                  <span
                    className={cn(
                      'shrink-0 text-[11px] font-medium tracking-wide',
                      isDark ? 'text-white/45' : 'text-black/45',
                    )}
                  >
                    {item.shortcut}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
