/**
 * Clean-room Goo Geometry & Placement solver for the Liquid Glass Morphing Menu PoC.
 * Implements anchor placement, open/close platter & droplet morph trajectories,
 * rounded-box SDF evaluation, polynomial smooth-min (smin) union, merge detection,
 * and synced content/glyph transforms from the clean-room specification.
 *
 * SPDX-License-Identifier: MPL-2.0
 */

import {
  PRISM_CONSTANTS,
  type AnchorConfig,
  type ComputeMorphGeometry,
  type ComputeRoundedBoxSdf,
  type ComputeSmin,
  type ComputeTargetCardRect,
  type ContentTransform,
  type GlassShapeState,
  type GlyphTransform,
  type GooFrameGeometry,
  type IGeometryModule,
  type MenuConfig,
  type MorphSnapshot,
  type MotionFrameState,
  type Point,
  type Rect,
  type RoundedBoxSdfSample,
  type Size,
  type SminSample,
} from './contracts'

function clamp(value: number, min: number, max: number): number {
  if (max <= min) return min
  return Math.min(Math.max(value, min), max)
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  if (edge1 <= edge0) return x >= edge1 ? 1 : 0
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1)
  return t * t * (3 - 2 * t)
}

function externalTugEnvelope(progress: number): number {
  const u = clamp(progress, 0, 1)
  if (u <= 0 || u >= 1) return 0
  return Math.pow(u / 0.35, 1.4) * Math.pow((1 - u) / 0.65, 2.6)
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function lerpPoint(a: Point, b: Point, t: number): Point {
  return {
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
  }
}

function rectCenter(rect: Rect): Point {
  return {
    x: rect.x + rect.width * 0.5,
    y: rect.y + rect.height * 0.5,
  }
}

function deflateRect(rect: Rect, inset: number): Rect {
  return {
    x: rect.x + inset,
    y: rect.y + inset,
    width: rect.width - inset * 2,
    height: rect.height - inset * 2,
  }
}

function clampPointToRect(point: Point, rect: Rect): Point {
  return {
    x: clamp(point.x, rect.x, rect.x + rect.width),
    y: clamp(point.y, rect.y, rect.y + rect.height),
  }
}

function normalizeOrZero(v: Point): { dir: Point; len: number } {
  const len = Math.hypot(v.x, v.y)
  if (len <= 1e-5) {
    return { dir: { x: 0, y: 0 }, len: 0 }
  }
  return { dir: { x: v.x / len, y: v.y / len }, len }
}

function normalizeOrFallback(v: Point, fallback: Point): Point {
  const len = Math.hypot(v.x, v.y)
  if (len <= 1e-6) {
    const fbLen = Math.hypot(fallback.x, fallback.y)
    return fbLen > 1e-6 ? { x: fallback.x / fbLen, y: fallback.y / fbLen } : { x: 0, y: -1 }
  }
  return { x: v.x / len, y: v.y / len }
}

function beyondRound(size: Size): { w: number; h: number } {
  return {
    w: Math.max(0, size.width - size.height),
    h: Math.max(0, size.height - size.width),
  }
}

function getEffectiveAnchorRect(anchor: AnchorConfig): Rect {
  const r = anchor.anchorRect
  if (!anchor.bareSource) {
    return r
  }
  const ix = PRISM_CONSTANTS.BARE_ANCHOR_INFLATE_X
  const iy = PRISM_CONSTANTS.BARE_ANCHOR_INFLATE_Y
  return {
    x: r.x - ix,
    y: r.y - iy,
    width: r.width + ix * 2,
    height: r.height + iy * 2,
  }
}

function resolveRestingRadius(menu: MenuConfig): number {
  if (menu.restingRadius !== undefined) {
    return menu.restingRadius
  }
  if (menu.itemRadius !== undefined || menu.cardInset !== undefined) {
    return (menu.itemRadius ?? PRISM_CONSTANTS.ITEM_RADIUS) + (menu.cardInset ?? PRISM_CONSTANTS.CARD_INSET)
  }
  return PRISM_CONSTANTS.RESTING_CARD_RADIUS
}

/**
 * Evaluates the scalar signed distance of an axis-aligned rounded rectangle
 * without allocating a result object (shared hot-path primitive for Marching Squares).
 */
export function computeRoundedBoxDistance(
  pointX: number,
  pointY: number,
  shape: GlassShapeState,
): number {
  const halfW = Math.max(0, shape.size.width * 0.5)
  const halfH = Math.max(0, shape.size.height * 0.5)
  const r = Math.max(0, Math.min(shape.radius, halfW, halfH))
  const qx = Math.abs(pointX - shape.center.x) - halfW + r
  const qy = Math.abs(pointY - shape.center.y) - halfH + r
  const ox = Math.max(qx, 0)
  const oy = Math.max(qy, 0)
  return Math.hypot(ox, oy) + Math.min(Math.max(qx, qy), 0) - r
}

/**
 * Evaluates the scalar quadratic polynomial smooth-minimum (smin) distance.
 */
export function computeSminDistance(distA: number, distB: number, k: number): number {
  if (k <= 1e-6) {
    return distA <= distB ? distA : distB
  }
  const h = clamp(0.5 + (0.5 * (distB - distA)) / k, 0, 1)
  return lerp(distB, distA, h) - k * h * (1 - h)
}

/**
 * Evaluates the exact signed distance and outward unit normal of an axis-aligned
 * rounded rectangle in logical CSS pixels.
 */
export const computeRoundedBoxSdf: ComputeRoundedBoxSdf = (
  point: Point,
  shape: GlassShapeState,
): RoundedBoxSdfSample => {
  const halfW = Math.max(0, shape.size.width * 0.5)
  const halfH = Math.max(0, shape.size.height * 0.5)
  const r = Math.max(0, Math.min(shape.radius, halfW, halfH))

  const dx = point.x - shape.center.x
  const dy = point.y - shape.center.y
  const sx = dx < 0 ? -1 : 1
  const sy = dy < 0 ? -1 : 1

  const qx = Math.abs(dx) - halfW + r
  const qy = Math.abs(dy) - halfH + r

  const ox = Math.max(qx, 0)
  const oy = Math.max(qy, 0)
  const outsideDist = Math.hypot(ox, oy)
  const insideDist = Math.min(Math.max(qx, qy), 0)
  const distance = outsideDist + insideDist - r

  let normal: Point
  if (outsideDist > 1e-6) {
    normal = {
      x: sx * (ox / outsideDist),
      y: sy * (oy / outsideDist),
    }
  } else if (qx > qy) {
    normal = { x: sx, y: 0 }
  } else if (qy > qx) {
    normal = { x: 0, y: sy }
  } else if (Math.abs(dx) > 1e-6 || Math.abs(dy) > 1e-6) {
    normal = { x: sx * Math.SQRT1_2, y: sy * Math.SQRT1_2 }
  } else {
    normal = { x: 0, y: -1 }
  }

  return { distance, normal }
}

/**
 * Evaluates the quadratic polynomial smooth-minimum (smin) union between two SDF samples.
 */
export const computeSmin: ComputeSmin = (
  distA: number,
  distB: number,
  normalA: Point,
  normalB: Point,
  k: number,
): SminSample => {
  if (k <= 1e-6) {
    if (distA <= distB) {
      return {
        distance: distA,
        normal: normalizeOrFallback(normalA, { x: 0, y: -1 }),
        blendH: 1,
      }
    }
    return {
      distance: distB,
      normal: normalizeOrFallback(normalB, { x: 0, y: -1 }),
      blendH: 0,
    }
  }

  const blendH = clamp(0.5 + (0.5 * (distB - distA)) / k, 0, 1)
  const distance = lerp(distB, distA, blendH) - k * blendH * (1 - blendH)
  const blendedNormal = {
    x: lerp(normalB.x, normalA.x, blendH),
    y: lerp(normalB.y, normalA.y, blendH),
  }
  const normal = normalizeOrFallback(blendedNormal, blendH >= 0.5 ? normalA : normalB)

  return { distance, normal, blendH }
}

/**
 * Computes the resting menu card rect for the requested placement mode,
 * flipping above `avoidRect` when `belowPoint` lacks space below and clamping
 * inside `viewportSize` minus `screenMargin + safeInsets`.
 */
export const computeTargetCardRect: ComputeTargetCardRect = (
  anchor: AnchorConfig,
  menu: MenuConfig,
): Rect => {
  if (menu.targetRectOverride) {
    return { ...menu.targetRectOverride }
  }

  const menuW = Math.max(0, menu.size.width)
  const menuH = Math.max(0, menu.size.height)
  const overlapY = menu.overlapY ?? PRISM_CONSTANTS.ANCHOR_OVERLAP_Y
  const avoidGap = menu.avoidGap ?? PRISM_CONSTANTS.AVOID_GAP
  const screenMargin = menu.screenMargin ?? PRISM_CONSTANTS.SCREEN_MARGIN
  const safe = anchor.safeInsets ?? { top: 0, right: 0, bottom: 0, left: 0 }

  const minX = screenMargin + safe.left
  const maxX = anchor.viewportSize.width - screenMargin - safe.right - menuW
  const minY = screenMargin + safe.top
  const maxBottom = anchor.viewportSize.height - screenMargin - safe.bottom
  const maxY = maxBottom - menuH

  const a = anchor.anchorRect
  let rawX = a.x
  let rawY = a.y

  if (anchor.placement === 'overAnchorEnd') {
    rawX = a.x + a.width - menuW
    rawY = a.y - overlapY
  } else if (anchor.placement === 'overAnchorStart') {
    rawX = a.x
    rawY = a.y - overlapY
  } else {
    rawX = a.x
    const refRect = anchor.avoidRect ?? a
    const belowY = refRect.y + refRect.height + avoidGap
    const aboveY = refRect.y - avoidGap - menuH
    if (belowY + menuH <= maxBottom) {
      rawY = belowY
    } else {
      const spaceBelow = maxBottom - belowY
      const spaceAbove = refRect.y - avoidGap - minY
      rawY = spaceAbove >= menuH || spaceAbove >= spaceBelow ? aboveY : belowY
    }
  }

  return {
    x: clamp(rawX, minX, maxX),
    y: clamp(rawY, minY, maxY),
    width: menuW,
    height: menuH,
  }
}

function computeDropletRestingTarget(
  anchorCenter: Point,
  cardCenter: Point,
  targetCardRect: Rect,
  anchorLongest: number,
): Point {
  const deflateInset =
    anchorLongest * 0.125 +
    PRISM_CONSTANTS.DROPPLET_BLEND_K +
    PRISM_CONSTANTS.MERGE_RIM_FADE_DEPTH
  const deflated = deflateRect(targetCardRect, deflateInset)
  if (deflated.width <= 0 || deflated.height <= 0) {
    return cardCenter
  }
  const biasPoint = lerpPoint(anchorCenter, cardCenter, PRISM_CONSTANTS.DROPLET_TARGET_SCALE)
  return clampPointToRect(biasPoint, deflated)
}

function computeGooPairMerge(
  platter: GlassShapeState,
  droplet: GlassShapeState,
  blendK: number,
): { mergeDepth: number; isMerged: boolean; rimOpacity: number } {
  if (droplet.size.width <= 0 || droplet.size.height <= 0) {
    return {
      mergeDepth: PRISM_CONSTANTS.MERGE_RIM_FADE_DEPTH,
      isMerged: true,
      rimOpacity: 1,
    }
  }

  const hw = droplet.size.width * 0.5
  const hh = droplet.size.height * 0.5
  const dTL = computeRoundedBoxSdf({ x: droplet.center.x - hw, y: droplet.center.y - hh }, platter).distance
  const dTR = computeRoundedBoxSdf({ x: droplet.center.x + hw, y: droplet.center.y - hh }, platter).distance
  const dBL = computeRoundedBoxSdf({ x: droplet.center.x - hw, y: droplet.center.y + hh }, platter).distance
  const dBR = computeRoundedBoxSdf({ x: droplet.center.x + hw, y: droplet.center.y + hh }, platter).distance
  const maxCornerDist = Math.max(dTL, dTR, dBL, dBR)

  const mergeDepth = -maxCornerDist - blendK
  const isMerged = mergeDepth >= 0
  const rimOpacity = isMerged
    ? clamp(mergeDepth / PRISM_CONSTANTS.MERGE_RIM_FADE_DEPTH, 0, 1)
    : 0

  return { mergeDepth, isMerged, rimOpacity }
}

function computeContentTransform(
  platter: GlassShapeState,
  cardRect: Rect,
): ContentTransform {
  const cardCenter = rectCenter(cardRect)
  const scale = cardRect.width > 0 ? platter.size.width / cardRect.width : 1
  const halfW = platter.size.width * 0.5
  const halfH = platter.size.height * 0.5

  return {
    originX: cardRect.width * 0.5,
    originY: cardRect.height * 0.5,
    scale,
    translateX: platter.center.x - cardCenter.x,
    translateY: platter.center.y - cardCenter.y,
    clipLeft: platter.center.x - halfW,
    clipTop: platter.center.y - halfH,
    clipRight: platter.center.x + halfW,
    clipBottom: platter.center.y + halfH,
    clipRadius: platter.radius,
  }
}

function computeGlyphTransform(
  droplet: GlassShapeState,
  effectiveAnchor: Rect,
  externalTrigger?: boolean,
): GlyphTransform {
  let scale = 0
  if (effectiveAnchor.width > 0) {
    scale =
      externalTrigger && effectiveAnchor.height > 0
        ? Math.min(droplet.size.width / effectiveAnchor.width, droplet.size.height / effectiveAnchor.height)
        : droplet.size.width / effectiveAnchor.width
  }
  return {
    centerX: droplet.center.x,
    centerY: droplet.center.y,
    scale,
  }
}

/**
 * Computes the complete per-frame goo geometry, SDF merge status, optical style mix,
 * and synchronized content/glyph transforms for the given motion and anchor state.
 */
export const computeMorphGeometry: ComputeMorphGeometry = (
  motion: MotionFrameState,
  anchor: AnchorConfig,
  menu: MenuConfig,
  closeSnapshot?: MorphSnapshot | null,
): GooFrameGeometry => {
  const targetCardRect = computeTargetCardRect(anchor, menu)
  const restingRadius = resolveRestingRadius(menu)
  const targetCardRadius = Math.max(
    0,
    Math.min(restingRadius, targetCardRect.width * 0.5, targetCardRect.height * 0.5),
  )

  const effectiveAnchor = getEffectiveAnchorRect(anchor)
  const anchorCenter = rectCenter(effectiveAnchor)
  const cardCenter = rectCenter(targetCardRect)
  const anchorShortest = Math.min(effectiveAnchor.width, effectiveAnchor.height)
  const anchorLongest = Math.max(effectiveAnchor.width, effectiveAnchor.height)
  const beyond = beyondRound({
    width: effectiveAnchor.width,
    height: effectiveAnchor.height,
  })

  const openDropletTarget = computeDropletRestingTarget(
    anchorCenter,
    cardCenter,
    targetCardRect,
    anchorLongest,
  )

  let platter: GlassShapeState
  let droplet: GlassShapeState
  let blendK: number
  let styleMix: number
  let mergeDepth: number
  let isMerged: boolean
  let rimOpacity: number

  if (motion.phase === 'opening' || motion.phase === 'open') {
    const progress = motion.phase === 'open' ? 1 : motion.morphProgress
    const cardW = targetCardRect.width
    const cardH = targetCardRect.height
    const scale =
      cardW > 0
        ? lerp((PRISM_CONSTANTS.MIN_PLATTER_SCALE_RATIO * anchorShortest) / cardW, 1, progress)
        : 1
    const height = lerp(cardW, cardH, progress)
    const beyondWeight = clamp(1 - progress, 0, 1)

    const platterW = Math.max(0, cardW * scale + beyond.w * beyondWeight)
    const platterH = Math.max(0, height * scale + beyond.h * beyondWeight)

    const dy = cardCenter.y - anchorCenter.y
    const absDy = Math.abs(dy)
    const dip =
      motion.hasControlSource && absDy > 1e-5
        ? Math.sign(dy) *
          (Math.min(1, absDy / PRISM_CONSTANTS.OPEN_DIP_DY_CAP) * PRISM_CONSTANTS.OPEN_DIP_BASE_PX +
            PRISM_CONSTANTS.OPEN_DIP_DY_SCALE * absDy) *
          motion.platterDipEnvelope
        : 0

    const baseCenter = lerpPoint(anchorCenter, cardCenter, progress)
    const platterCenter = {
      x: baseCenter.x,
      y: baseCenter.y + dip,
    }

    const corners =
      restingRadius + cardW * PRISM_CONSTANTS.OPEN_CORNER_WIDTH_FACTOR * motion.cornerProgress
    const platterRadius = Math.max(
      0,
      Math.min(Math.min(height * 0.5, corners) * scale, platterW * 0.5, platterH * 0.5),
    )

    platter = {
      center: platterCenter,
      size: { width: platterW, height: platterH },
      radius: platterRadius,
    }

    if (motion.hasControlSource) {
      if (anchor.externalTrigger) {
        const dropletProgress = clamp(progress, 0, 1)
        const tug = motion.phase === 'open' ? 0 : externalTugEnvelope(dropletProgress)
        const { dir: towardCard, len: distToCard } = normalizeOrZero({
          x: cardCenter.x - anchorCenter.x,
          y: cardCenter.y - anchorCenter.y,
        })
        const tugDist = Math.min(22, distToCard * 0.22) * tug
        const stretchW = 1 + (0.1 * Math.abs(towardCard.x) - 0.05 * Math.abs(towardCard.y)) * tug
        const stretchH = 1 + (0.1 * Math.abs(towardCard.y) - 0.05 * Math.abs(towardCard.x)) * tug
        const dropletW = Math.max(0, effectiveAnchor.width * stretchW)
        const dropletH = Math.max(0, effectiveAnchor.height * stretchH)
        droplet = {
          center: {
            x: anchorCenter.x + towardCard.x * tugDist,
            y: anchorCenter.y + towardCard.y * tugDist,
          },
          size: { width: dropletW, height: dropletH },
          radius: Math.min(dropletW, dropletH) * 0.5,
        }
        const pinch = motion.phase === 'open' ? 0 : 1 - smoothstep(0.38, 0.68, dropletProgress)
        blendK = PRISM_CONSTANTS.DROPPLET_BLEND_K * pinch
        styleMix = clamp(progress, 0, 1)
        isMerged = false
        rimOpacity = motion.phase === 'open' ? 1 : smoothstep(0.35, 0.72, dropletProgress)
        mergeDepth =
          motion.phase === 'open'
            ? PRISM_CONSTANTS.MERGE_RIM_FADE_DEPTH
            : computeGooPairMerge(platter, droplet, blendK).mergeDepth
      } else {
        const dropletProgress = clamp(progress, 0, 1)
        const dropletScale = lerp(1, PRISM_CONSTANTS.DROPLET_TARGET_SCALE, dropletProgress)
        const dropletW = Math.max(0, effectiveAnchor.width * dropletScale)
        const dropletH = Math.max(0, effectiveAnchor.height * dropletScale)
        droplet = {
          center: lerpPoint(anchorCenter, openDropletTarget, dropletProgress),
          size: { width: dropletW, height: dropletH },
          radius: Math.min(dropletW, dropletH) * 0.5,
        }
        blendK = PRISM_CONSTANTS.DROPPLET_BLEND_K
        styleMix = clamp(progress, 0, 1)

        const merge = computeGooPairMerge(platter, droplet, blendK)
        mergeDepth = merge.mergeDepth
        isMerged = merge.isMerged
        rimOpacity = merge.rimOpacity
      }
    } else {
      droplet = {
        center: anchorCenter,
        size: { width: 0, height: 0 },
        radius: 0,
      }
      blendK = 0
      styleMix = 1
      mergeDepth = PRISM_CONSTANTS.MERGE_RIM_FADE_DEPTH
      isMerged = true
      rimOpacity = 1
    }
  } else if (!motion.hasControlSource) {
    // Point-menu close fallback: uniform shrink toward clamped anchor point without goo droplet.
    const pointScale =
      motion.phase === 'closed' ? PRISM_CONSTANTS.POINT_CLOSE_END_SCALE : motion.pointScale
    const pivot = clampPointToRect(anchorCenter, targetCardRect)
    platter = {
      center: {
        x: pivot.x + (cardCenter.x - pivot.x) * pointScale,
        y: pivot.y + (cardCenter.y - pivot.y) * pointScale,
      },
      size: {
        width: targetCardRect.width * pointScale,
        height: targetCardRect.height * pointScale,
      },
      radius: targetCardRadius * pointScale,
    }
    droplet = {
      center: pivot,
      size: { width: 0, height: 0 },
      radius: 0,
    }
    blendK = 0
    styleMix = 1
    mergeDepth = PRISM_CONSTANTS.MERGE_RIM_FADE_DEPTH
    isMerged = true
    rimOpacity = 1
  } else {
    // Control-anchored close (or resting closed state).
    const openDropletW = effectiveAnchor.width * PRISM_CONSTANTS.DROPLET_TARGET_SCALE
    const openDropletH = effectiveAnchor.height * PRISM_CONSTANTS.DROPLET_TARGET_SCALE
    const fromPlatter: GlassShapeState = closeSnapshot?.platter ?? {
      center: cardCenter,
      size: { width: targetCardRect.width, height: targetCardRect.height },
      radius: targetCardRadius,
    }
    const defaultDroplet: GlassShapeState = anchor.externalTrigger
      ? {
          center: anchorCenter,
          size: { width: effectiveAnchor.width, height: effectiveAnchor.height },
          radius: Math.min(effectiveAnchor.width, effectiveAnchor.height) * 0.5,
        }
      : {
          center: openDropletTarget,
          size: { width: openDropletW, height: openDropletH },
          radius: Math.min(openDropletW, openDropletH) * 0.5,
        }
    const fromDroplet: GlassShapeState = closeSnapshot?.droplet ?? defaultDroplet
    const fromRadius = closeSnapshot?.platterRadius ?? targetCardRadius

    const progress = motion.phase === 'closed' ? 1 : motion.morphProgress
    const fromW = fromPlatter.size.width
    const fromH = fromPlatter.size.height
    const fromMaxDim = Math.max(fromW, fromH)

    const scale =
      fromMaxDim > 0
        ? lerp(1, (PRISM_CONSTANTS.MIN_PLATTER_SCALE_RATIO * anchorShortest) / fromMaxDim, progress)
        : 0
    const height = lerp(fromH, fromW, progress)
    const beyondWeight = clamp(progress, 0, 1)

    const platterW = Math.max(0, fromW * scale + beyond.w * beyondWeight)
    const platterH = Math.max(0, height * scale + beyond.h * beyondWeight)

    // Vector from anchor toward card ("away" from anchor).
    // At ~72ms platter anticipates away from anchor (+awayFromAnchor);
    // at ~176ms droplet overshoots past anchor.center away from card (-awayFromAnchor).
    const toCard = {
      x: fromPlatter.center.x - anchorCenter.x,
      y: fromPlatter.center.y - anchorCenter.y,
    }
    const { dir: awayFromAnchor, len: toCardLen } = normalizeOrZero(toCard)

    const dipMag =
      Math.min(
        PRISM_CONSTANTS.CLOSE_PLATTER_DIP_RATIO * toCardLen,
        PRISM_CONSTANTS.CLOSE_PLATTER_DIP_CAP_PX,
      ) * motion.platterDipEnvelope
    const basePlatterCenter = lerpPoint(fromPlatter.center, anchorCenter, progress)
    const platterCenter = {
      x: basePlatterCenter.x + awayFromAnchor.x * dipMag,
      y: basePlatterCenter.y + awayFromAnchor.y * dipMag,
    }
    const platterRadius = Math.max(
      0,
      Math.min(lerp(fromRadius, fromW * 0.5, progress) * scale, platterW * 0.5, platterH * 0.5),
    )

    platter = {
      center: platterCenter,
      size: { width: platterW, height: platterH },
      radius: platterRadius,
    }

    const dropletSizeT = clamp(progress, 0, 1)
    const overshootMag =
      Math.min(
        PRISM_CONSTANTS.CLOSE_DROPLET_OVERSHOOT_RATIO * toCardLen,
        PRISM_CONSTANTS.CLOSE_DROPLET_OVERSHOOT_CAP_PX,
      ) * motion.dropletOvershootEnvelope

    if (anchor.externalTrigger) {
      const catchT = clamp(dropletSizeT / 0.65, 0, 1)
      const catchSin = Math.sin(Math.PI * catchT)
      const catchBell = motion.phase === 'closed' ? 0 : catchSin * catchSin
      const catchMag = Math.min(18, toCardLen * 0.16) * catchBell
      const stretchW =
        1 + (0.06 * Math.abs(awayFromAnchor.x) - 0.04 * Math.abs(awayFromAnchor.y)) * catchBell
      const stretchH =
        1 + (0.06 * Math.abs(awayFromAnchor.y) - 0.04 * Math.abs(awayFromAnchor.x)) * catchBell
      const targetW = effectiveAnchor.width * stretchW
      const targetH = effectiveAnchor.height * stretchH
      const dropletW = Math.max(0, lerp(fromDroplet.size.width, targetW, dropletSizeT))
      const dropletH = Math.max(0, lerp(fromDroplet.size.height, targetH, dropletSizeT))
      const baseDropletCenter = lerpPoint(fromDroplet.center, anchorCenter, dropletSizeT)
      droplet = {
        center: {
          x: baseDropletCenter.x + awayFromAnchor.x * (catchMag - overshootMag),
          y: baseDropletCenter.y + awayFromAnchor.y * (catchMag - overshootMag),
        },
        size: { width: dropletW, height: dropletH },
        radius: Math.min(dropletW, dropletH) * 0.5,
      }
    } else {
      const dropletW = Math.max(0, lerp(fromDroplet.size.width, effectiveAnchor.width, dropletSizeT))
      const dropletH = Math.max(
        0,
        lerp(fromDroplet.size.height, effectiveAnchor.height, dropletSizeT),
      )
      const baseDropletCenter = lerpPoint(fromDroplet.center, anchorCenter, progress)

      droplet = {
        center: {
          x: baseDropletCenter.x - awayFromAnchor.x * overshootMag,
          y: baseDropletCenter.y - awayFromAnchor.y * overshootMag,
        },
        size: { width: dropletW, height: dropletH },
        radius: Math.min(dropletW, dropletH) * 0.5,
      }
    }

    blendK =
      motion.phase === 'closed'
        ? 0
        : PRISM_CONSTANTS.DROPPLET_BLEND_K * motion.closeBlendRamp * (1 - motion.absorbed)

    const minClosedW = PRISM_CONSTANTS.MIN_PLATTER_SCALE_RATIO * anchorShortest
    const startMix = closeSnapshot
      ? clamp(
          (fromW - minClosedW) / Math.max(1, targetCardRect.width - minClosedW),
          0,
          1,
        )
      : 1
    styleMix = motion.phase === 'closed' ? 0 : startMix * (1 - clamp(progress, 0, 1))

    if (anchor.externalTrigger) {
      isMerged = false
      mergeDepth = computeGooPairMerge(platter, droplet, blendK).mergeDepth
      rimOpacity =
        motion.phase === 'closed' ? 0 : startMix * (1 - smoothstep(0, 0.45, dropletSizeT))
    } else {
      const merge = computeGooPairMerge(platter, droplet, blendK)
      mergeDepth = merge.mergeDepth
      isMerged = merge.isMerged
      rimOpacity = merge.rimOpacity
    }
  }

  return {
    targetCardRect,
    targetCardRadius,
    platter,
    droplet,
    blendK,
    mergeDepth,
    isMerged,
    rimOpacity,
    styleMix,
    contentTransform: computeContentTransform(platter, targetCardRect),
    glyphTransform: computeGlyphTransform(
      droplet,
      effectiveAnchor,
      Boolean(anchor.externalTrigger && motion.hasControlSource),
    ),
  }
}

export const geometryModule: IGeometryModule = {
  computeTargetCardRect,
  computeMorphGeometry,
  computeRoundedBoxSdf,
  computeSmin,
}
