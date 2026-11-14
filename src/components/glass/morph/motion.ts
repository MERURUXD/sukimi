/**
 * Clean-room deterministic motion & spring physics controller for the
 * Liquid Glass Morphing Menu PoC.
 *
 * Implements analytical damped-harmonic-oscillator springs, rise-and-fall
 * impulse envelopes, mid-flight interruption continuity, ElasticPress drag
 * tracking, reduced-motion crossfade fallbacks, and optical style interpolation.
 *
 * SPDX-License-Identifier: MPL-2.0
 */

import {
  PRISM_CONSTANTS,
  type GlassOpticalStyle,
  type IMotionController,
  type MorphPhase,
  type MorphSnapshot,
  type MotionFrameState,
  type Point,
  type Size,
  type SpringParams,
} from './contracts'

const REDUCED_MOTION_DURATION_SEC = 0.15
const ZETA_CRITICAL_EPSILON = 1e-6
const PRESS_SETTLE_POS_EPS = 1e-4
const PRESS_SETTLE_VEL_EPS = 1e-3

/**
 * Critically damped tracking spring (~95% settled in ELASTIC_DRAG_TRACK_SEC = 0.12s).
 * Derived from 1 - exp(-w0 * t) * (1 + w0 * t) = 0.95 at w0 * t ≈ 4.744 -> w0 ≈ 39.53.
 */
const DRAG_TRACK_SPRING: SpringParams = {
  mass: 1,
  stiffness: Math.pow(4.744 / PRISM_CONSTANTS.ELASTIC_DRAG_TRACK_SEC, 2),
  dampingRatio: 1,
}

export interface SpringSample {
  value: number
  velocity: number
}

export interface MotionInterruptStart {
  contentOpacity?: number
  contentBlurPx?: number
  triggerGlyphOpacity?: number
  bareGlassOpacity?: number
}

export interface EvaluateMotionFrameOptions {
  hasControlSource?: boolean
  reducedMotion?: boolean
  press?: {
    scaleX?: number
    scaleY?: number
    offsetX?: number
    offsetY?: number
    lift?: number
  }
  interruptStart?: MotionInterruptStart
}

export interface MotionController extends IMotionController {
  /** Seek deterministically to a phase and normalized progress in [0, 1] for scrubbing. */
  seek(phase: MorphPhase, normalizedT: number, hasControlSource?: boolean): MotionFrameState
}

export function clamp(value: number, min: number, max: number): number {
  if (value <= min) return min
  if (value >= max) return max
  return value
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export function easeInQuad(t: number): number {
  const u = clamp(t, 0, 1)
  return u * u
}

export function easeOutCubic(t: number): number {
  const u = clamp(t, 0, 1)
  const inv = 1 - u
  return 1 - inv * inv * inv
}

export function easeInOutCubic(t: number): number {
  const u = clamp(t, 0, 1)
  if (u < 0.5) {
    return 4 * u * u * u
  }
  const k = -2 * u + 2
  return 1 - (k * k * k) / 2
}

/**
 * Evaluates a standard 1D cubic Bézier timing curve B_y(s) where B_x(s) = t.
 * Uses bracketed Newton-Raphson with bisection fallback for guaranteed convergence.
 */
export function cubicBezier(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  t: number,
): number {
  if (t <= 0) return 0
  if (t >= 1) return 1

  const cx = 3 * x1
  const bx = 3 * (x2 - x1) - cx
  const ax = 1 - cx - bx

  const cy = 3 * y1
  const by = 3 * (y2 - y1) - cy
  const ay = 1 - cy - by

  let lo = 0
  let hi = 1
  let s = t

  for (let i = 0; i < 12; i += 1) {
    const x = ((ax * s + bx) * s + cx) * s - t
    if (Math.abs(x) < 1e-7) {
      break
    }
    if (x < 0) {
      lo = s
    } else {
      hi = s
    }
    const dx = (3 * ax * s + 2 * bx) * s + cx
    if (Math.abs(dx) > 1e-6) {
      const next = s - x / dx
      s = next > lo && next < hi ? next : 0.5 * (lo + hi)
    } else {
      s = 0.5 * (lo + hi)
    }
  }

  return ((ay * s + by) * s + cy) * s
}

/**
 * Normalized impulse envelope peaking at 1.0 when t === peak.
 * Formula: (t / peak)^sharpness * exp(sharpness * (1 - t / peak)).
 */
export function riseAndFall(t: number, peak: number, sharpness: number): number {
  if (t <= 0 || peak <= 0 || !Number.isFinite(t)) {
    return 0
  }
  const ratio = t / peak
  return Math.pow(ratio, sharpness) * Math.exp(sharpness * (1 - ratio))
}

/**
 * Analytical damped-harmonic-oscillator solver returning both position and velocity.
 * Supports underdamped (zeta < 1), critically damped (zeta == 1), and overdamped (zeta > 1)
 * regimes for arbitrary initial state (initialValue, initialVelocity) toward targetValue.
 */
export function evaluateSpringState(
  timeSec: number,
  params: SpringParams,
  initialValue = 0,
  initialVelocity = 0,
  targetValue = 1,
): SpringSample {
  if (timeSec <= 0) {
    return { value: initialValue, velocity: initialVelocity }
  }
  if (!Number.isFinite(timeSec) || params.mass <= 0 || params.stiffness <= 0) {
    return { value: targetValue, velocity: 0 }
  }

  const omega0 = Math.sqrt(params.stiffness / params.mass)
  const zeta = Math.max(0, params.dampingRatio)
  const y0 = initialValue - targetValue
  const v0 = initialVelocity

  if (y0 === 0 && v0 === 0) {
    return { value: targetValue, velocity: 0 }
  }

  if (Math.abs(zeta - 1) <= ZETA_CRITICAL_EPSILON) {
    const decay = Math.exp(-omega0 * timeSec)
    const b = v0 + omega0 * y0
    const y = decay * (y0 + b * timeSec)
    const v = decay * (v0 - omega0 * b * timeSec)
    return { value: targetValue + y, velocity: v }
  }

  if (zeta < 1) {
    const omegaD = omega0 * Math.sqrt(1 - zeta * zeta)
    const decay = Math.exp(-zeta * omega0 * timeSec)
    const a = y0
    const b = (v0 + zeta * omega0 * y0) / omegaD
    const cos = Math.cos(omegaD * timeSec)
    const sin = Math.sin(omegaD * timeSec)
    const y = decay * (a * cos + b * sin)
    const v =
      decay *
      ((-zeta * omega0 * a + omegaD * b) * cos + (-zeta * omega0 * b - omegaD * a) * sin)
    return { value: targetValue + y, velocity: v }
  }

  const gamma = omega0 * Math.sqrt(zeta * zeta - 1)
  const r1 = -omega0 * zeta + gamma
  const r2 = -omega0 * zeta - gamma
  const c1 = (v0 - r2 * y0) / (2 * gamma)
  const c2 = y0 - c1
  const e1 = Math.exp(r1 * timeSec)
  const e2 = Math.exp(r2 * timeSec)
  return {
    value: targetValue + c1 * e1 + c2 * e2,
    velocity: c1 * r1 * e1 + c2 * r2 * e2,
  }
}

/**
 * Analytical damped-harmonic-oscillator spring evaluator returning x(t).
 */
export function evaluateSpring(
  timeSec: number,
  params: SpringParams,
  initialValue = 0,
  initialVelocity = 0,
  targetValue = 1,
): number {
  return evaluateSpringState(timeSec, params, initialValue, initialVelocity, targetValue).value
}

/**
 * Linearly interpolates two GlassOpticalStyle presets (e.g. regular control <-> menu).
 */
export function interpolateOpticalStyle(
  from: GlassOpticalStyle,
  to: GlassOpticalStyle,
  t: number,
): GlassOpticalStyle {
  const u = clamp(t, 0, 1)
  return {
    bevel: lerp(from.bevel, to.bevel, u),
    refraction: lerp(from.refraction, to.refraction, u),
    blur: lerp(from.blur, to.blur, u),
    dispersion: lerp(from.dispersion, to.dispersion, u),
    saturation: lerp(from.saturation, to.saturation, u),
    brightness: lerp(from.brightness, to.brightness, u),
    contrast: lerp(from.contrast, to.contrast, u),
    tintRgba: [
      lerp(from.tintRgba[0], to.tintRgba[0], u),
      lerp(from.tintRgba[1], to.tintRgba[1], u),
      lerp(from.tintRgba[2], to.tintRgba[2], u),
      lerp(from.tintRgba[3], to.tintRgba[3], u),
    ],
    rimMode: u < 0.5 ? from.rimMode : to.rimMode,
    rimOpacity: lerp(from.rimOpacity, to.rimOpacity, u),
    rimWidth: lerp(from.rimWidth, to.rimWidth, u),
    rimTail: lerp(from.rimTail, to.rimTail, u),
    rimFocus: lerp(from.rimFocus, to.rimFocus, u),
    rimAdded: lerp(from.rimAdded, to.rimAdded, u),
    hairlineWidth: lerp(from.hairlineWidth, to.hairlineWidth, u),
    hairlineSideAlpha: lerp(from.hairlineSideAlpha, to.hairlineSideAlpha, u),
    hairlineCornerAlpha: lerp(from.hairlineCornerAlpha, to.hairlineCornerAlpha, u),
    hairlineFlatAlpha: lerp(from.hairlineFlatAlpha, to.hairlineFlatAlpha, u),
    shadowBlur: lerp(from.shadowBlur, to.shadowBlur, u),
    shadowOffsetY: lerp(from.shadowOffsetY, to.shadowOffsetY, u),
    shadowAlpha: lerp(from.shadowAlpha, to.shadowAlpha, u),
  }
}

/**
 * Convenience resolver interpolating between regular control and menu presets for a theme.
 */
export function resolveOpticalStyle(
  theme: 'light' | 'dark',
  styleMix: number,
): GlassOpticalStyle {
  const presets = PRISM_CONSTANTS.OPTICAL[theme]
  return interpolateOpticalStyle(presets.regular, presets.menu, styleMix)
}

export function getPhaseDurationSec(
  phase: MorphPhase,
  hasControlSource = true,
  reducedMotion = false,
): number {
  if (phase === 'closed' || phase === 'open') {
    return 0
  }
  if (reducedMotion) {
    return REDUCED_MOTION_DURATION_SEC
  }
  if (phase === 'opening') {
    return PRISM_CONSTANTS.OPEN_DURATION_SEC
  }
  return hasControlSource
    ? PRISM_CONSTANTS.CLOSE_DURATION_SEC
    : PRISM_CONSTANTS.POINT_CLOSE_DURATION_SEC
}

/**
 * Pure deterministic frame evaluator for any morph phase and normalized progress in [0, 1].
 *
 * Note on `morphProgress` convention:
 * - During `opening`: `0` (at anchor) -> `1` (at target card).
 * - During `closing`: `0` (at from/card) -> `1` (back at anchor), so geometry can lerp `from -> anchor`.
 * - In `closed`: resting collapsed state at anchor (`morphProgress = 1`, `absorbed = 1`, `bareGlassOpacity = 0`).
 * - In `open`: resting expanded state at card (`morphProgress = 1`, `settled = 1`, `contentOpacity = 1`).
 */
export function evaluateMotionFrame(
  phase: MorphPhase,
  normalizedT: number,
  options: EvaluateMotionFrameOptions = {},
): MotionFrameState {
  const hasControlSource = options.hasControlSource ?? true
  const reducedMotion = options.reducedMotion ?? false
  const pressScaleX = options.press?.scaleX ?? 1
  const pressScaleY = options.press?.scaleY ?? 1
  const pressOffsetX = options.press?.offsetX ?? 0
  const pressOffsetY = options.press?.offsetY ?? 0
  const pressLift = options.press?.lift ?? 0
  const u = clamp(Number.isFinite(normalizedT) ? normalizedT : 0, 0, 1)

  if (phase === 'closed') {
    return {
      phase: 'closed',
      hasControlSource,
      elapsedSec: 0,
      normalizedT: 0,
      morphProgress: 1,
      cornerProgress: 1,
      ringing: 0,
      absorbed: 1,
      closeBlendRamp: 1,
      platterDipEnvelope: 0,
      dropletOvershootEnvelope: 0,
      blurBumpPx: 0,
      settled: 0,
      contentOpacity: 0,
      contentBlurPx: 0,
      triggerGlyphOpacity: 1,
      triggerGlyphBlurPx: 0,
      bareGlassOpacity: 0,
      pointScale: 1,
      pressScaleX,
      pressScaleY,
      pressOffsetX,
      pressOffsetY,
      pressLift,
      isAnimating: false,
      reducedMotion,
    }
  }

  if (phase === 'open') {
    return {
      phase: 'open',
      hasControlSource,
      elapsedSec: getPhaseDurationSec('opening', hasControlSource, reducedMotion),
      normalizedT: 1,
      morphProgress: 1,
      cornerProgress: 0,
      ringing: 0,
      absorbed: 0,
      closeBlendRamp: 0,
      platterDipEnvelope: 0,
      dropletOvershootEnvelope: 0,
      blurBumpPx: 0,
      settled: 1,
      contentOpacity: 1,
      contentBlurPx: 0,
      triggerGlyphOpacity: 0,
      triggerGlyphBlurPx: reducedMotion ? 0 : PRISM_CONSTANTS.OPEN_GLYPH_BLUR_MAX_PX,
      bareGlassOpacity: 1,
      pointScale: 1,
      pressScaleX,
      pressScaleY,
      pressOffsetX,
      pressOffsetY,
      pressLift,
      isAnimating: false,
      reducedMotion,
    }
  }

  if (phase === 'opening') {
    const duration = getPhaseDurationSec('opening', hasControlSource, reducedMotion)
    const elapsedSec = u * duration

    if (reducedMotion) {
      const fade = easeOutCubic(u)
      return {
        phase: 'opening',
        hasControlSource,
        elapsedSec,
        normalizedT: u,
        morphProgress: 1,
        cornerProgress: 0,
        ringing: 0,
        absorbed: 0,
        closeBlendRamp: 0,
        platterDipEnvelope: 0,
        dropletOvershootEnvelope: 0,
        blurBumpPx: 0,
        settled: fade,
        contentOpacity: fade,
        contentBlurPx: 0,
        triggerGlyphOpacity: 1 - fade,
        triggerGlyphBlurPx: 0,
        bareGlassOpacity: fade,
        pointScale: 1,
        pressScaleX,
        pressScaleY,
        pressOffsetX,
        pressOffsetY,
        pressLift,
        isAnimating: u < 1,
        reducedMotion: true,
      }
    }

    const morphProgress = evaluateSpring(elapsedSec, PRISM_CONSTANTS.SPRINGS.open)
    const cornerDelay = PRISM_CONSTANTS.CORNER_DELAY_SEC
    const cornerProgress =
      elapsedSec <= cornerDelay
        ? 1
        : 1 - evaluateSpring(elapsedSec - cornerDelay, PRISM_CONSTANTS.SPRINGS.corners)
    const platterDipEnvelope = hasControlSource
      ? riseAndFall(
          elapsedSec,
          PRISM_CONSTANTS.OPEN_DIP_PEAK_SEC,
          PRISM_CONSTANTS.OPEN_DIP_SHARPNESS,
        )
      : 0
    const blurBumpPx =
      PRISM_CONSTANTS.OPEN_BLUR_BUMP_AMP_PX *
      riseAndFall(
        elapsedSec,
        PRISM_CONSTANTS.OPEN_BLUR_BUMP_PEAK_SEC,
        PRISM_CONSTANTS.OPEN_BLUR_BUMP_SHARPNESS,
      )
    const settled = clamp(morphProgress, 0, 1)
    const glyphT = clamp(settled / PRISM_CONSTANTS.OPEN_SETTLED_GLYPH_END, 0, 1)

    return {
      phase: 'opening',
      hasControlSource,
      elapsedSec,
      normalizedT: u,
      morphProgress,
      cornerProgress,
      ringing: 0,
      absorbed: 0,
      closeBlendRamp: 0,
      platterDipEnvelope,
      dropletOvershootEnvelope: 0,
      blurBumpPx,
      settled,
      contentOpacity: settled,
      contentBlurPx: Math.hypot(
        PRISM_CONSTANTS.OPEN_CONTENT_BLUR_BASE_PX * (1 - settled),
        blurBumpPx,
      ),
      triggerGlyphOpacity: 1 - glyphT,
      triggerGlyphBlurPx: PRISM_CONSTANTS.OPEN_GLYPH_BLUR_MAX_PX * glyphT,
      bareGlassOpacity: clamp(elapsedSec / PRISM_CONSTANTS.BARE_SOURCE_FADE_IN_SEC, 0, 1),
      pointScale: 1,
      pressScaleX,
      pressScaleY,
      pressOffsetX,
      pressOffsetY,
      pressLift,
      isAnimating: u < 1,
      reducedMotion: false,
    }
  }

  // phase === 'closing'
  const duration = getPhaseDurationSec('closing', hasControlSource, reducedMotion)
  const elapsedSec = u * duration
  const startContentOpacity = options.interruptStart?.contentOpacity ?? 1
  const startContentBlurPx = options.interruptStart?.contentBlurPx ?? 0
  const startBareGlassOpacity = options.interruptStart?.bareGlassOpacity ?? 1

  if (reducedMotion) {
    const fade = easeOutCubic(u)
    const startGlyphOpacity = options.interruptStart?.triggerGlyphOpacity ?? 0
    return {
      phase: 'closing',
      hasControlSource,
      elapsedSec,
      normalizedT: u,
      morphProgress: 0,
      cornerProgress: 0,
      ringing: 0,
      absorbed: 1,
      closeBlendRamp: 0,
      platterDipEnvelope: 0,
      dropletOvershootEnvelope: 0,
      blurBumpPx: 0,
      settled: 1 - fade,
      contentOpacity: startContentOpacity * (1 - fade),
      contentBlurPx: 0,
      triggerGlyphOpacity: lerp(startGlyphOpacity, 1, fade),
      triggerGlyphBlurPx: 0,
      bareGlassOpacity: startBareGlassOpacity * (1 - fade),
      pointScale: 1,
      pressScaleX,
      pressScaleY,
      pressOffsetX,
      pressOffsetY,
      pressLift,
      isAnimating: u < 1,
      reducedMotion: true,
    }
  }

  if (!hasControlSource) {
    const eased = easeOutCubic(u)
    return {
      phase: 'closing',
      hasControlSource: false,
      elapsedSec,
      normalizedT: u,
      morphProgress: eased,
      cornerProgress: 0,
      ringing: 0,
      absorbed: eased,
      closeBlendRamp: 0,
      platterDipEnvelope: 0,
      dropletOvershootEnvelope: 0,
      blurBumpPx: 0,
      settled: 1 - eased,
      contentOpacity: startContentOpacity * (1 - eased),
      contentBlurPx: 0,
      triggerGlyphOpacity: 1,
      triggerGlyphBlurPx: 0,
      bareGlassOpacity: startBareGlassOpacity * (1 - eased),
      pointScale: lerp(1.0, PRISM_CONSTANTS.POINT_CLOSE_END_SCALE, eased),
      pressScaleX,
      pressScaleY,
      pressOffsetX,
      pressOffsetY,
      pressLift,
      isAnimating: u < 1,
      reducedMotion: false,
    }
  }

  const ringingSpan =
    PRISM_CONSTANTS.CLOSE_RINGING_END_SEC - PRISM_CONSTANTS.CLOSE_RINGING_START_SEC
  const ringing =
    1 -
    easeInQuad(
      clamp((elapsedSec - PRISM_CONSTANTS.CLOSE_RINGING_START_SEC) / ringingSpan, 0, 1),
    )
  const dropletSpring = evaluateSpring(elapsedSec, PRISM_CONSTANTS.SPRINGS.droplet)
  const morphProgress = 1 + (dropletSpring - 1) * ringing
  const closeBlendRamp = clamp(elapsedSec / PRISM_CONSTANTS.CLOSE_BLEND_RAMP_SEC, 0, 1)
  const absStartSec = PRISM_CONSTANTS.CLOSE_ABSORPTION_START * duration
  const absSpanSec =
    (PRISM_CONSTANTS.CLOSE_ABSORPTION_END - PRISM_CONSTANTS.CLOSE_ABSORPTION_START) * duration
  const absorbed = easeInOutCubic(clamp((elapsedSec - absStartSec) / absSpanSec, 0, 1))
  const platterDipEnvelope =
    riseAndFall(
      elapsedSec,
      PRISM_CONSTANTS.CLOSE_PLATTER_DIP_PEAK_SEC,
      PRISM_CONSTANTS.CLOSE_PLATTER_DIP_SHARPNESS,
    ) * ringing
  const dropletOvershootEnvelope =
    riseAndFall(
      elapsedSec,
      PRISM_CONSTANTS.CLOSE_DROPLET_OVERSHOOT_PEAK_SEC,
      PRISM_CONSTANTS.CLOSE_DROPLET_OVERSHOOT_SHARPNESS,
    ) * ringing

  const contentOut = easeOutCubic(clamp(elapsedSec / PRISM_CONSTANTS.CLOSE_CONTENT_OUT_SEC, 0, 1))
  const startGlyphOpacity =
    options.interruptStart?.triggerGlyphOpacity ?? PRISM_CONSTANTS.CLOSE_GLYPH_START_OPACITY
  const glyphCurveT = cubicBezier(
    0.25,
    0.1,
    0.25,
    1,
    clamp(elapsedSec / PRISM_CONSTANTS.CLOSE_GLYPH_BACK_SEC, 0, 1),
  )

  return {
    phase: 'closing',
    hasControlSource: true,
    elapsedSec,
    normalizedT: u,
    morphProgress,
    cornerProgress: 0,
    ringing,
    absorbed,
    closeBlendRamp,
    platterDipEnvelope,
    dropletOvershootEnvelope,
    blurBumpPx: 0,
    settled: clamp(1 - morphProgress, 0, 1),
    contentOpacity: startContentOpacity * (1 - contentOut),
    contentBlurPx: lerp(startContentBlurPx, PRISM_CONSTANTS.CLOSE_CONTENT_BLUR_MAX_PX, contentOut),
    triggerGlyphOpacity: lerp(startGlyphOpacity, 1.0, glyphCurveT),
    triggerGlyphBlurPx: 0,
    bareGlassOpacity: startBareGlassOpacity * (1 - absorbed),
    pointScale: 1,
    pressScaleX,
    pressScaleY,
    pressOffsetX,
    pressOffsetY,
    pressLift,
    isAnimating: u < 1,
    reducedMotion: false,
  }
}

interface SpringChannel {
  value: number
  velocity: number
  target: number
}

function stepSpringChannel(
  channel: SpringChannel,
  dtSec: number,
  params: SpringParams,
): boolean {
  const atTarget =
    Math.abs(channel.value - channel.target) < PRESS_SETTLE_POS_EPS &&
    Math.abs(channel.velocity) < PRESS_SETTLE_VEL_EPS
  if (atTarget) {
    channel.value = channel.target
    channel.velocity = 0
    return false
  }
  const next = evaluateSpringState(dtSec, params, channel.value, channel.velocity, channel.target)
  const settled =
    Math.abs(next.value - channel.target) < PRESS_SETTLE_POS_EPS &&
    Math.abs(next.velocity) < PRESS_SETTLE_VEL_EPS
  if (settled) {
    channel.value = channel.target
    channel.velocity = 0
    return false
  }
  channel.value = next.value
  channel.velocity = next.velocity
  return true
}

function isChannelActive(channel: SpringChannel): boolean {
  return (
    Math.abs(channel.value - channel.target) >= PRESS_SETTLE_POS_EPS ||
    Math.abs(channel.velocity) >= PRESS_SETTLE_VEL_EPS
  )
}

function solveOpenElapsedForProgress(targetProgress: number): number {
  const target = clamp(targetProgress, 0, 0.999)
  if (target <= 0) return 0

  // SPRINGS.open climbs monotonically from 0 -> 1 on [0, ~0.185s] before its peak.
  let lo = 0
  let hi = Math.min(0.2, PRISM_CONSTANTS.OPEN_DURATION_SEC)
  while (
    hi < PRISM_CONSTANTS.OPEN_DURATION_SEC &&
    evaluateSpring(hi, PRISM_CONSTANTS.SPRINGS.open) < target
  ) {
    hi = Math.min(PRISM_CONSTANTS.OPEN_DURATION_SEC, hi + 0.05)
  }

  for (let i = 0; i < 24; i += 1) {
    const mid = 0.5 * (lo + hi)
    if (evaluateSpring(mid, PRISM_CONSTANTS.SPRINGS.open) < target) {
      lo = mid
    } else {
      hi = mid
    }
  }
  return 0.5 * (lo + hi)
}

export function createMotionController(options?: { reducedMotion?: boolean }): MotionController {
  let reducedMotion = options?.reducedMotion ?? false
  let phase: MorphPhase = 'closed'
  let hasControlSource = true
  let elapsedSec = 0
  let closeSnapshot: MorphSnapshot | null = null
  let interruptStart: MotionInterruptStart | undefined
  let disposed = false

  // ElasticPress state
  let pressActive = false
  let pressTargetSize: Size = { width: 44, height: 44 }
  const liftChannel: SpringChannel = { value: 0, velocity: 0, target: 0 }
  const offsetXChannel: SpringChannel = { value: 0, velocity: 0, target: 0 }
  const offsetYChannel: SpringChannel = { value: 0, velocity: 0, target: 0 }

  const listeners = new Set<(state: MotionFrameState) => void>()

  function computePressValues() {
    if (reducedMotion) {
      return { scaleX: 1, scaleY: 1, offsetX: 0, offsetY: 0, lift: 0 }
    }
    const longestSide = Math.max(1, pressTargetSize.width, pressTargetSize.height)
    const maxGrowth = Math.min(
      PRISM_CONSTANTS.ELASTIC_MAX_GROWTH_RATIO,
      PRISM_CONSTANTS.ELASTIC_MAX_GROWTH_PX / longestSide,
    )
    const scale = 1 + maxGrowth * liftChannel.value
    return {
      scaleX: scale,
      scaleY: scale,
      offsetX: offsetXChannel.value,
      offsetY: offsetYChannel.value,
      lift: liftChannel.value,
    }
  }

  function isPressAnimating(): boolean {
    if (reducedMotion) return false
    return (
      isChannelActive(liftChannel) ||
      isChannelActive(offsetXChannel) ||
      isChannelActive(offsetYChannel)
    )
  }

  function buildState(): MotionFrameState {
    const duration = getPhaseDurationSec(phase, hasControlSource, reducedMotion)
    const normalizedT = duration > 0 ? clamp(elapsedSec / duration, 0, 1) : phase === 'open' ? 1 : 0
    const frame = evaluateMotionFrame(phase, normalizedT, {
      hasControlSource,
      reducedMotion,
      press: computePressValues(),
      interruptStart: phase === 'closing' ? interruptStart : undefined,
    })
    return {
      ...frame,
      isAnimating: frame.isAnimating || isPressAnimating(),
    }
  }

  function notify(): void {
    if (disposed || listeners.size === 0) return
    const snapshot = buildState()
    for (const listener of [...listeners]) {
      listener(snapshot)
    }
  }

  return {
    getState(): MotionFrameState {
      return buildState()
    },

    getCloseSnapshot(): MorphSnapshot | null {
      return closeSnapshot
    },

    setReducedMotion(reduced: boolean): void {
      if (reducedMotion === reduced) return
      reducedMotion = reduced
      if (reducedMotion) {
        liftChannel.value = 0
        liftChannel.velocity = 0
        liftChannel.target = 0
        offsetXChannel.value = 0
        offsetXChannel.velocity = 0
        offsetXChannel.target = 0
        offsetYChannel.value = 0
        offsetYChannel.velocity = 0
        offsetYChannel.target = 0
      }
      if (phase === 'opening' || phase === 'closing') {
        const nextDuration = getPhaseDurationSec(phase, hasControlSource, reducedMotion)
        elapsedSec = Math.min(elapsedSec, nextDuration)
      }
      notify()
    },

    open(controlSource = true): void {
      if (disposed) return
      let nextElapsedSec = 0
      if (phase === 'closing') {
        const current = buildState()
        const openFraction = reducedMotion
          ? clamp(current.settled, 0, 0.95)
          : clamp(1 - current.morphProgress, 0, 0.95)
        if (openFraction > 0) {
          if (reducedMotion) {
            const u = 1 - Math.cbrt(1 - openFraction)
            nextElapsedSec = u * REDUCED_MOTION_DURATION_SEC
          } else {
            nextElapsedSec = solveOpenElapsedForProgress(openFraction)
          }
        }
      }
      hasControlSource = controlSource
      closeSnapshot = null
      interruptStart = undefined
      phase = 'opening'
      elapsedSec = nextElapsedSec
      notify()
    },

    close(snapshot?: MorphSnapshot): void {
      if (disposed) return
      const current = buildState()
      closeSnapshot = snapshot ?? null

      if (phase === 'opening' && current.normalizedT < 1) {
        // Capture current optical values so interrupting mid-open never pops
        interruptStart = {
          contentOpacity: current.contentOpacity,
          contentBlurPx: snapshot ? snapshot.blurPx : current.contentBlurPx,
          triggerGlyphOpacity: Math.max(
            reducedMotion ? 0 : PRISM_CONSTANTS.CLOSE_GLYPH_START_OPACITY,
            current.triggerGlyphOpacity,
          ),
          bareGlassOpacity: current.bareGlassOpacity,
        }
      } else {
        interruptStart = undefined
      }

      phase = 'closing'
      elapsedSec = 0
      notify()
    },

    reset(): void {
      if (disposed) return
      phase = 'closed'
      hasControlSource = true
      elapsedSec = 0
      closeSnapshot = null
      interruptStart = undefined
      pressActive = false
      liftChannel.value = 0
      liftChannel.velocity = 0
      liftChannel.target = 0
      offsetXChannel.value = 0
      offsetXChannel.velocity = 0
      offsetXChannel.target = 0
      offsetYChannel.value = 0
      offsetYChannel.velocity = 0
      offsetYChannel.target = 0
      notify()
    },

    pressStart(targetSize: Size): void {
      if (disposed) return
      pressTargetSize = {
        width: Math.max(1, targetSize.width),
        height: Math.max(1, targetSize.height),
      }
      pressActive = true
      if (!reducedMotion) {
        liftChannel.target = 1
      }
      notify()
    },

    pressMove(delta: Point, targetSize: Size): void {
      if (disposed) return
      pressTargetSize = {
        width: Math.max(1, targetSize.width),
        height: Math.max(1, targetSize.height),
      }
      if (reducedMotion || !pressActive) return
      const shortestSide = Math.max(1, Math.min(pressTargetSize.width, pressTargetSize.height))
      const dragLimit = PRISM_CONSTANTS.ELASTIC_DRAG_MAX_RATIO * shortestSide
      const mag = Math.hypot(delta.x, delta.y)
      const bandedMag = mag > 0 ? (dragLimit * mag) / (dragLimit + mag) : 0
      offsetXChannel.target = mag > 0 ? (delta.x / mag) * bandedMag : 0
      offsetYChannel.target = mag > 0 ? (delta.y / mag) * bandedMag : 0
      notify()
    },

    pressRelease(): void {
      if (disposed) return
      pressActive = false
      liftChannel.target = 0
      offsetXChannel.target = 0
      offsetYChannel.target = 0
      notify()
    },

    seek(targetPhase: MorphPhase, normalizedT: number, controlSource?: boolean): MotionFrameState {
      if (controlSource !== undefined) {
        hasControlSource = controlSource
      }
      phase = targetPhase
      interruptStart = undefined
      if (targetPhase === 'closed' || targetPhase === 'open') {
        elapsedSec = 0
        if (targetPhase === 'closed') {
          closeSnapshot = null
        }
      } else {
        const duration = getPhaseDurationSec(targetPhase, hasControlSource, reducedMotion)
        elapsedSec = clamp(normalizedT, 0, 1) * duration
      }
      const next = buildState()
      notify()
      return next
    },

    step(dtSec: number): MotionFrameState {
      if (disposed || !Number.isFinite(dtSec) || dtSec <= 0) {
        return buildState()
      }

      let changed = false

      if (phase === 'opening' || phase === 'closing') {
        const duration = getPhaseDurationSec(phase, hasControlSource, reducedMotion)
        elapsedSec += dtSec
        changed = true
        if (elapsedSec >= duration) {
          if (phase === 'opening') {
            phase = 'open'
            elapsedSec = duration
          } else {
            phase = 'closed'
            elapsedSec = 0
            closeSnapshot = null
            interruptStart = undefined
          }
        }
      }

      if (!reducedMotion) {
        const offsetSpring = pressActive
          ? DRAG_TRACK_SPRING
          : PRISM_CONSTANTS.SPRINGS.elasticPress
        const liftMoved = stepSpringChannel(
          liftChannel,
          dtSec,
          PRISM_CONSTANTS.SPRINGS.elasticPress,
        )
        const oxMoved = stepSpringChannel(offsetXChannel, dtSec, offsetSpring)
        const oyMoved = stepSpringChannel(offsetYChannel, dtSec, offsetSpring)
        if (liftMoved || oxMoved || oyMoved) {
          changed = true
        }
      }

      const next = buildState()
      if (changed) {
        notify()
      }
      return next
    },

    subscribe(listener: (state: MotionFrameState) => void): () => void {
      if (disposed) {
        return () => {}
      }
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },

    dispose(): void {
      disposed = true
      listeners.clear()
    },
  }
}
