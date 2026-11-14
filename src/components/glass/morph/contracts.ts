/**
 * Clean-room unified interface contracts for the Liquid Glass Morphing Menu.
 * Single source of truth shared across `motion.ts`, `geometry.ts`,
 * `overlayRenderer.ts`, `refractFilter.tsx`, and `Popover.tsx`.
 *
 * SPDX-License-Identifier: MPL-2.0
 */

export interface Point {
  x: number
  y: number
}

export interface Size {
  width: number
  height: number
}

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface EdgeInsets {
  top: number
  right: number
  bottom: number
  left: number
}

/** A single rounded-rectangle / capsule glass primitive in logical CSS pixels. */
export interface GlassShapeState {
  center: Point
  size: Size
  radius: number
}

export type PlacementMode = 'overAnchorEnd' | 'overAnchorStart' | 'belowPoint'

export interface AnchorConfig {
  /** Trigger control bounds (or point rect) in viewport/canvas CSS coordinates. */
  anchorRect: Rect
  placement: PlacementMode
  /** True when the trigger has no resting glass surface (inflates droplet & fades bare glass). */
  bareSource?: boolean
  /** Whether bareSource inflates anchorRect by BARE_ANCHOR_INFLATE_X/Y (defaults to true). */
  inflateBareAnchor?: boolean
  /** True when anchored to a morphable control; false uses the 200ms point-menu close fallback. */
  hasControlSource?: boolean
  /**
   * True when the menu settles outside an external trigger button (e.g. Popover):
   * droplet anchors at the trigger, stretches elastically into the smin bridge,
   * pinches off, and snaps cleanly back to the resting trigger at scale 1.0.
   */
  externalTrigger?: boolean
  /** Optional rect to avoid when placement === 'belowPoint'. */
  avoidRect?: Rect
  /** Viewport size in CSS pixels used for screen-margin clamping and flip checks. */
  viewportSize: Size
  /** Safe-area insets added to the default 16px screen margin. */
  safeInsets?: EdgeInsets
}

export interface MenuConfig {
  /** Measured resting size of the menu card in CSS pixels. */
  size: Size
  /** Optional explicit resting card rect (e.g. CSS-positioned Popover bounds), bypassing placement calculation. */
  targetRectOverride?: Rect
  itemRadius?: number
  cardInset?: number
  restingRadius?: number
  overlapY?: number
  avoidGap?: number
  screenMargin?: number
}

export type MorphPhase = 'closed' | 'opening' | 'open' | 'closing'

/** Mid-flight state captured when an opening morph is interrupted by close. */
export interface MorphSnapshot {
  platter: GlassShapeState
  droplet: GlassShapeState
  platterRadius: number
  blurPx: number
  elapsedFraction: number
}

export interface MotionFrameState {
  phase: MorphPhase
  hasControlSource: boolean
  elapsedSec: number
  normalizedT: number
  morphProgress: number
  cornerProgress: number
  ringing: number
  absorbed: number
  closeBlendRamp: number
  platterDipEnvelope: number
  dropletOvershootEnvelope: number
  blurBumpPx: number
  settled: number
  contentOpacity: number
  contentBlurPx: number
  triggerGlyphOpacity: number
  triggerGlyphBlurPx: number
  bareGlassOpacity: number
  pointScale: number
  pressScaleX: number
  pressScaleY: number
  pressOffsetX: number
  pressOffsetY: number
  pressLift: number
  isAnimating: boolean
  reducedMotion: boolean
}

export interface ContentTransform {
  originX: number
  originY: number
  scale: number
  translateX: number
  translateY: number
  clipLeft: number
  clipTop: number
  clipRight: number
  clipBottom: number
  clipRadius: number
}

export interface GlyphTransform {
  centerX: number
  centerY: number
  scale: number
}

export interface GooFrameGeometry {
  targetCardRect: Rect
  targetCardRadius: number
  platter: GlassShapeState
  droplet: GlassShapeState
  blendK: number
  mergeDepth: number
  isMerged: boolean
  rimOpacity: number
  styleMix: number
  contentTransform: ContentTransform
  glyphTransform: GlyphTransform
}

export type RimMode = 'control' | 'menu'

export interface GlassOpticalStyle {
  bevel: number
  refraction: number
  blur: number
  dispersion: number
  saturation: number
  brightness: number
  contrast: number
  /** Normalized linear/sRGB RGBA tint color [r, g, b, a] in [0, 1]. */
  tintRgba: readonly [number, number, number, number]
  rimMode: RimMode
  rimOpacity: number
  rimWidth: number
  rimTail: number
  rimFocus: number
  rimAdded: number
  hairlineWidth: number
  hairlineSideAlpha: number
  hairlineCornerAlpha: number
  hairlineFlatAlpha: number
  shadowBlur: number
  shadowOffsetY: number
  shadowAlpha: number
  /** Optional uniform 1px CSS border width matching resting `.glass` (`0` = omitted / directional rim only). */
  borderWidth?: number
  /** Optional normalized RGBA color `[r, g, b, a]` for the uniform inner border. */
  borderRgba?: readonly [number, number, number, number]
  /** Optional bottom-to-top directional catchlight ratio (defaults to 0.72). */
  rimBottomRatio?: number
}

export interface GlassRenderFrame {
  viewport: Size
  dpr: number
  theme: 'light' | 'dark'
  geometry: GooFrameGeometry
  style: GlassOpticalStyle
  /** Overall glass alpha multiplier (e.g. bareGlassOpacity or point-close fade). */
  opacity: number
  /** Extra transient frost blur in CSS px during mid-morph acceleration. */
  blurBumpPx: number
  /** Optional static backdrop hold rect in CSS pixels to reuse pre-blurred capture. */
  holdRect?: Rect
  /** Optional frozen pre-blur sigma in CSS px when closing from mid-flight. */
  holdFrost?: number
}

export interface BackdropSceneHandle {
  /** Logical CSS pixel size of the backdrop scene. */
  size: Size
  dpr: number
  /** Monotonic revision; increment when the underlying backdrop changes. */
  version: number
  /** Source canvas, bitmap, or 2D draw routine rasterized into the WebGL2 backdrop atlas. */
  source:
    | HTMLCanvasElement
    | ImageBitmap
    | ((ctx: CanvasRenderingContext2D, width: number, height: number, dpr: number) => void)
}

export interface RendererCapabilities {
  webgl2: boolean
  floatFbo: boolean
  maxTextureSize: number
  fallbackNotice?: string
}

export interface SpringParams {
  mass: number
  stiffness: number
  dampingRatio: number
}

export const PRISM_CONSTANTS = {
  OPEN_DURATION_SEC: 0.45,
  CLOSE_DURATION_SEC: 0.5,
  POINT_CLOSE_DURATION_SEC: 0.2,
  DROPPLET_BLEND_K: 28,
  GROUP_GOO_BLEND_K: 8,
  CORNER_DELAY_SEC: 0.07,
  ITEM_RADIUS: 16,
  CARD_INSET: 8,
  RESTING_CARD_RADIUS: 24,
  ANCHOR_OVERLAP_Y: 8,
  AVOID_GAP: 8,
  SCREEN_MARGIN: 16,
  BARE_ANCHOR_INFLATE_X: 12,
  BARE_ANCHOR_INFLATE_Y: 6,
  BARE_SOURCE_FADE_IN_SEC: 0.1,
  MIN_PLATTER_SCALE_RATIO: 0.41,
  DROPLET_TARGET_SCALE: 0.25,
  POINT_CLOSE_END_SCALE: 0.8,
  OPEN_CORNER_WIDTH_FACTOR: 0.48,
  MERGE_RIM_FADE_DEPTH: 8,
  CLOSE_BLEND_RAMP_SEC: 0.05,
  CLOSE_RINGING_START_SEC: 0.4,
  CLOSE_RINGING_END_SEC: 0.5,
  CLOSE_CONTENT_OUT_SEC: 0.1,
  CLOSE_GLYPH_BACK_SEC: 0.47,
  CLOSE_ABSORPTION_START: 0.6,
  CLOSE_ABSORPTION_END: 0.9,
  OPEN_SETTLED_GLYPH_END: 0.25,
  OPEN_GLYPH_BLUR_MAX_PX: 4,
  OPEN_CONTENT_BLUR_BASE_PX: 4,
  CLOSE_CONTENT_BLUR_MAX_PX: 8,
  CLOSE_GLYPH_START_OPACITY: 0.2,
  OPEN_DIP_PEAK_SEC: 0.098,
  OPEN_DIP_SHARPNESS: 3.3,
  OPEN_DIP_BASE_PX: 23,
  OPEN_DIP_DY_SCALE: 0.124,
  OPEN_DIP_DY_CAP: 30,
  OPEN_BLUR_BUMP_PEAK_SEC: 0.069,
  OPEN_BLUR_BUMP_SHARPNESS: 2.1,
  OPEN_BLUR_BUMP_AMP_PX: 1.9,
  CLOSE_PLATTER_DIP_PEAK_SEC: 0.072,
  CLOSE_PLATTER_DIP_SHARPNESS: 2.4,
  CLOSE_PLATTER_DIP_RATIO: 0.21,
  CLOSE_PLATTER_DIP_CAP_PX: 22,
  CLOSE_DROPLET_OVERSHOOT_PEAK_SEC: 0.176,
  CLOSE_DROPLET_OVERSHOOT_SHARPNESS: 4.9,
  CLOSE_DROPLET_OVERSHOOT_RATIO: 0.25,
  CLOSE_DROPLET_OVERSHOOT_CAP_PX: 19,
  ELASTIC_MAX_GROWTH_RATIO: 0.25,
  ELASTIC_MAX_GROWTH_PX: 16,
  ELASTIC_DRAG_TRACK_SEC: 0.12,
  ELASTIC_DRAG_MAX_RATIO: 7 / 32,
  SUBMENU_UNFOLD_DURATION_SEC: 0.42,
  SUBMENU_UNFOLD_BOUNCE: 0.15,
  SUBMENU_FOLD_DURATION_SEC: 0.34,
  SUBMENU_FOLD_BOUNCE: 0,
  SUBMENU_DWELL_MS: 400,
  SPRINGS: {
    open: { mass: 1, stiffness: 400, dampingRatio: 0.754 },
    corners: { mass: 1, stiffness: 324, dampingRatio: 0.75 },
    droplet: { mass: 1, stiffness: 165, dampingRatio: 0.8 },
    elasticPress: { mass: 1, stiffness: 311, dampingRatio: 0.593 },
  } satisfies Record<'open' | 'corners' | 'droplet' | 'elasticPress', SpringParams>,
  SHADOW: {
    blur: 29,
    offsetY: 8,
    lightAlpha: 0.118,
    darkAlpha: 0.177,
  },
  OPTICAL: {
    light: {
      regular: {
        bevel: 20,
        refraction: 60,
        blur: 2.5,
        dispersion: 0,
        saturation: 2.08,
        brightness: 1.0,
        contrast: 0.4,
        tintRgba: [253 / 255, 253 / 255, 253 / 255, 0x8a / 255],
        rimMode: 'control',
        rimOpacity: 0.28,
        rimWidth: 1.2,
        rimTail: 0.17,
        rimFocus: 1.0,
        rimAdded: 0.38,
        hairlineWidth: 0.67,
        hairlineSideAlpha: 0.75,
        hairlineCornerAlpha: 0.5,
        hairlineFlatAlpha: 0.25,
        shadowBlur: 29,
        shadowOffsetY: 8,
        shadowAlpha: 0.118,
      },
      menu: {
        bevel: 20,
        refraction: 60,
        blur: 12,
        dispersion: 0,
        saturation: 2.0,
        brightness: 1.1,
        contrast: 0,
        tintRgba: [0.975, 0.975, 0.98, 0.55],
        rimMode: 'menu',
        rimOpacity: 0.16,
        rimWidth: 5.0,
        rimTail: 0,
        rimFocus: 1.0,
        rimAdded: 1.0,
        hairlineWidth: 0.67,
        hairlineSideAlpha: 0.25,
        hairlineCornerAlpha: 0.15,
        hairlineFlatAlpha: 0.09,
        shadowBlur: 29,
        shadowOffsetY: 8,
        shadowAlpha: 0.118,
      },
    },
    dark: {
      regular: {
        bevel: 20,
        refraction: 60,
        blur: 2.5,
        dispersion: 0,
        saturation: 2.84,
        brightness: 1.0,
        contrast: -0.4,
        tintRgba: [0.207, 0.207, 0.220, 0.62],
        rimMode: 'control',
        rimOpacity: 0.28,
        rimWidth: 1.2,
        rimTail: 0.17,
        rimFocus: 1.0,
        rimAdded: 0.38,
        hairlineWidth: 0.67,
        hairlineSideAlpha: 0.75,
        hairlineCornerAlpha: 0.35,
        hairlineFlatAlpha: 0,
        shadowBlur: 29,
        shadowOffsetY: 8,
        shadowAlpha: 0.177,
      },
      menu: {
        bevel: 20,
        refraction: 60,
        blur: 12,
        dispersion: 0,
        saturation: 1.75,
        brightness: 1.8,
        contrast: -0.53,
        tintRgba: [0.207, 0.207, 0.220, 0.63],
        rimMode: 'menu',
        rimOpacity: 0.22,
        rimWidth: 5.0,
        rimTail: 0,
        rimFocus: 1.0,
        rimAdded: 1.0,
        hairlineWidth: 0.67,
        hairlineSideAlpha: 0.27,
        hairlineCornerAlpha: 0.1,
        hairlineFlatAlpha: 0.02,
        shadowBlur: 29,
        shadowOffsetY: 8,
        shadowAlpha: 0.177,
      },
    },
  } satisfies Record<'light' | 'dark', Record<'regular' | 'menu', GlassOpticalStyle>>,
} as const

/** Motion controller contract exported by `./motion`. */
export interface IMotionController {
  getState(): MotionFrameState
  getCloseSnapshot(): MorphSnapshot | null
  setReducedMotion(reduced: boolean): void
  open(hasControlSource?: boolean): void
  close(snapshot?: MorphSnapshot): void
  reset(): void
  pressStart(targetSize: Size): void
  pressMove(delta: Point, targetSize: Size): void
  pressRelease(): void
  step(dtSec: number): MotionFrameState
  subscribe(listener: (state: MotionFrameState) => void): () => void
  dispose(): void
}

export interface RoundedBoxSdfSample {
  distance: number
  normal: Point
}

export interface SminSample {
  distance: number
  normal: Point
  blendH: number
}

/** Function signatures exported by `./geometry`. */
export type ComputeTargetCardRect = (anchor: AnchorConfig, menu: MenuConfig) => Rect

export type ComputeMorphGeometry = (
  motion: MotionFrameState,
  anchor: AnchorConfig,
  menu: MenuConfig,
  closeSnapshot?: MorphSnapshot | null,
) => GooFrameGeometry

export type ComputeRoundedBoxSdf = (point: Point, shape: GlassShapeState) => RoundedBoxSdfSample

export type ComputeSmin = (
  distA: number,
  distB: number,
  normalA: Point,
  normalB: Point,
  k: number,
) => SminSample

export interface IGeometryModule {
  computeTargetCardRect: ComputeTargetCardRect
  computeMorphGeometry: ComputeMorphGeometry
  computeRoundedBoxSdf: ComputeRoundedBoxSdf
  computeSmin: ComputeSmin
}

/** Liquid glass WebGL2 / fallback renderer contract exported by `./renderer`. */
export interface ILiquidGlassRenderer {
  readonly capabilities: RendererCapabilities
  mount(canvas: HTMLCanvasElement): RendererCapabilities
  setBackdrop(scene: BackdropSceneHandle): void
  holdBackdrop(rect: Rect, frostPx?: number): void
  releaseBackdropHold(): void
  render(frame: GlassRenderFrame): void
  clear(): void
  dispose(): void
}

/** Frame input for the Live-DOM Hybrid overlay renderer (`./overlayRenderer`). */
export interface MorphOverlayFrame {
  viewport: Size
  dpr: number
  theme: 'light' | 'dark'
  geometry: GooFrameGeometry
  style: GlassOpticalStyle
  opacity: number
  blurBumpPx?: number
}

/** Live-DOM Hybrid overlay renderer contract exported by `./overlayRenderer`. */
export interface IMorphOverlayRenderer {
  readonly capabilities: RendererCapabilities
  mount(canvas: HTMLCanvasElement): RendererCapabilities
  render(frame: MorphOverlayFrame): void
  clear(): void
  dispose(): void
}
