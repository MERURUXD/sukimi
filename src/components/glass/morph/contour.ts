/**
 * Clean-room SVG contour extractor for the Live-DOM Hybrid Liquid Glass Morphing Menu.
 * Produces exact rounded-rectangle SVG paths when merged or unblended, and high-precision
 * zero-leak Marching Squares contours (up to 128 cells + 3-iteration bisection refinement)
 * over the smin(platter, droplet, blendK) SDF during the liquid bridge / pinch-off phases.
 *
 * SPDX-License-Identifier: MPL-2.0
 */

import type { GlassShapeState, Point, Rect } from './contracts'

const MAX_GRID_STEPS = 128
const MIN_GRID_STEPS = 24
const MAX_GRID_NODES = MAX_GRID_STEPS + 1
const MAX_CELLS = MAX_GRID_STEPS * MAX_GRID_STEPS

// Preallocated reusable buffers to avoid per-frame GC allocations during 60/120fps morphing.
const fieldBuf = new Float64Array(MAX_GRID_NODES * MAX_GRID_NODES)
const hEdgeX = new Float64Array(MAX_GRID_NODES * MAX_GRID_NODES)
const hEdgeY = new Float64Array(MAX_GRID_NODES * MAX_GRID_NODES)
const vEdgeX = new Float64Array(MAX_GRID_NODES * MAX_GRID_NODES)
const vEdgeY = new Float64Array(MAX_GRID_NODES * MAX_GRID_NODES)

// Directed edge graph over unique edge IDs:
// Horizontal edge (ix, iy) -> id = iy * MAX_GRID_NODES + ix
// Vertical   edge (ix, iy) -> id = TOTAL_H + iy * MAX_GRID_NODES + ix
const TOTAL_H = MAX_GRID_NODES * MAX_GRID_NODES
const TOTAL_EDGES = TOTAL_H * 2
const nextEdgeBuf = new Int32Array(TOTAL_EDGES)
const activeEdgeList = new Int32Array(MAX_CELLS * 2)
const visitedBuf = new Uint8Array(TOTAL_EDGES)

const ZERO_POINT: Point = { x: 0, y: 0 }

function fmt(value: number): number {
  const rounded = Math.round(value * 100) / 100
  return rounded === 0 ? 0 : rounded
}

function clampInt(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function appendRoundedRectPath(
  shape: GlassShapeState,
  offsetX: number,
  offsetY: number,
): string {
  const w = shape.size.width
  const h = shape.size.height
  if (w <= 0.01 || h <= 0.01) {
    return ''
  }

  const x0 = fmt(shape.center.x - w * 0.5 - offsetX)
  const y0 = fmt(shape.center.y - h * 0.5 - offsetY)
  const x1 = fmt(x0 + w)
  const y1 = fmt(y0 + h)
  const r = fmt(Math.max(0, Math.min(shape.radius, w * 0.5, h * 0.5)))

  if (r <= 0.01) {
    return `M${x0} ${y0}L${x1} ${y0}L${x1} ${y1}L${x0} ${y1}Z`
  }

  const xl = fmt(x0 + r)
  const xr = fmt(x1 - r)
  const yt = fmt(y0 + r)
  const yb = fmt(y1 - r)

  const parts: string[] = [`M${xl} ${y0}`]
  if (xr > xl) parts.push(`L${xr} ${y0}`)
  parts.push(`A${r} ${r} 0 0 1 ${x1} ${yt}`)
  if (yb > yt) parts.push(`L${x1} ${yb}`)
  parts.push(`A${r} ${r} 0 0 1 ${xr} ${y1}`)
  if (xr > xl) parts.push(`L${xl} ${y1}`)
  parts.push(`A${r} ${r} 0 0 1 ${x0} ${yb}`)
  if (yb > yt) parts.push(`L${x0} ${yt}`)
  parts.push(`A${r} ${r} 0 0 1 ${xl} ${y0}Z`)
  return parts.join('')
}

function evalSminFieldPoint(
  x: number,
  y: number,
  pCx: number,
  pCy: number,
  pInnerW: number,
  pInnerH: number,
  pR: number,
  dCx: number,
  dCy: number,
  dInnerW: number,
  dInnerH: number,
  dR: number,
  blendK: number,
  inv2K: number,
): number {
  const pqx = Math.abs(x - pCx) - pInnerW
  const pqy = Math.abs(y - pCy) - pInnerH
  const pOut =
    pqx > 0
      ? pqy > 0
        ? Math.sqrt(pqx * pqx + pqy * pqy)
        : pqx
      : pqy > 0
        ? pqy
        : 0
  const pMaxQ = pqx > pqy ? pqx : pqy
  const dA = pOut + (pMaxQ < 0 ? pMaxQ : 0) - pR

  const dqx = Math.abs(x - dCx) - dInnerW
  const dqy = Math.abs(y - dCy) - dInnerH
  const dOut =
    dqx > 0
      ? dqy > 0
        ? Math.sqrt(dqx * dqx + dqy * dqy)
        : dqx
      : dqy > 0
        ? dqy
        : 0
  const dMaxQ = dqx > dqy ? dqx : dqy
  const dB = dOut + (dMaxQ < 0 ? dMaxQ : 0) - dR

  let h = 0.5 + (dB - dA) * inv2K
  if (h < 0) h = 0
  else if (h > 1) h = 1
  const val = dB + (dA - dB) * h - blendK * h * (1 - h)
  // Nudge exact zero crossings slightly inside so every grid crossing lies strictly in (0, 1).
  return val > -1e-6 && val < 1e-6 ? -1e-6 : val
}

function addSegment(
  edgeFrom: number,
  edgeTo: number,
  activeCount: number,
): number {
  nextEdgeBuf[edgeFrom] = edgeTo
  activeEdgeList[activeCount] = edgeFrom
  return activeCount + 1
}

/**
 * Computes the axis-aligned bounding box covering `platter ∪ droplet` expanded by `padding`.
 */
export function computeMorphUnionBounds(
  platter: GlassShapeState,
  droplet: GlassShapeState,
  padding = 0,
): Rect {
  const pHalfW = Math.max(0, platter.size.width * 0.5)
  const pHalfH = Math.max(0, platter.size.height * 0.5)
  let minX = platter.center.x - pHalfW
  let maxX = platter.center.x + pHalfW
  let minY = platter.center.y - pHalfH
  let maxY = platter.center.y + pHalfH

  if (droplet.size.width > 0.01 && droplet.size.height > 0.01) {
    const dHalfW = droplet.size.width * 0.5
    const dHalfH = droplet.size.height * 0.5
    minX = Math.min(minX, droplet.center.x - dHalfW)
    maxX = Math.max(maxX, droplet.center.x + dHalfW)
    minY = Math.min(minY, droplet.center.y - dHalfH)
    maxY = Math.max(maxY, droplet.center.y + dHalfH)
  }

  return {
    x: minX - padding,
    y: minY - padding,
    width: maxX - minX + padding * 2,
    height: maxY - minY + padding * 2,
  }
}

/**
 * Extracts an SVG path string (`M ... Z`) for the fused goo silhouette of `platter` and
 * `droplet`, subtracting `offset` so the path is expressed in local container coordinates.
 */
export function extractGooContourPath(
  platter: GlassShapeState,
  droplet: GlassShapeState,
  blendK: number,
  isMerged: boolean,
  offset: Point = ZERO_POINT,
): string {
  const ox = offset.x
  const oy = offset.y
  const hasPlatter = platter.size.width > 0.01 && platter.size.height > 0.01
  const hasDroplet = droplet.size.width > 0.01 && droplet.size.height > 0.01

  if (!hasPlatter && !hasDroplet) {
    return ''
  }

  if (isMerged || !hasDroplet) {
    return hasPlatter
      ? appendRoundedRectPath(platter, ox, oy)
      : appendRoundedRectPath(droplet, ox, oy)
  }

  if (!hasPlatter) {
    return appendRoundedRectPath(droplet, ox, oy)
  }

  if (blendK <= 0.001) {
    const pPath = appendRoundedRectPath(platter, ox, oy)
    const dPath = appendRoundedRectPath(droplet, ox, oy)
    return pPath && dPath ? `${pPath} ${dPath}` : pPath || dPath
  }

  // Pad by at least 0.25 * blendK (max smin outward bulge) + 4px so all outer grid
  // samples are strictly positive and every contour forms closed loops.
  const msPadding = blendK * 0.25 + 4
  const bounds = computeMorphUnionBounds(platter, droplet, msPadding)
  const longest = Math.max(bounds.width, bounds.height)
  if (longest <= 0.01) {
    return ''
  }

  const targetStep = longest / MAX_GRID_STEPS
  const cols = clampInt(Math.ceil(bounds.width / targetStep), MIN_GRID_STEPS, MAX_GRID_STEPS)
  const rows = clampInt(Math.ceil(bounds.height / targetStep), MIN_GRID_STEPS, MAX_GRID_STEPS)
  const dx = bounds.width / cols
  const dy = bounds.height / rows
  const stride = cols + 1

  const pCx = platter.center.x
  const pCy = platter.center.y
  const pHalfW = Math.max(0, platter.size.width * 0.5)
  const pHalfH = Math.max(0, platter.size.height * 0.5)
  const pR = Math.max(0, Math.min(platter.radius, pHalfW, pHalfH))
  const pInnerW = pHalfW - pR
  const pInnerH = pHalfH - pR

  const dCx = droplet.center.x
  const dCy = droplet.center.y
  const dHalfW = Math.max(0, droplet.size.width * 0.5)
  const dHalfH = Math.max(0, droplet.size.height * 0.5)
  const dR = Math.max(0, Math.min(droplet.radius, dHalfW, dHalfH))
  const dInnerW = dHalfW - dR
  const dInnerH = dHalfH - dR

  const inv2K = 0.5 / blendK

  // 1. Sample SDF field across the (cols+1) x (rows+1) grid.
  for (let iy = 0; iy <= rows; iy++) {
    const y = bounds.y + iy * dy
    const pAbsY = Math.abs(y - pCy) - pInnerH
    const poy = pAbsY > 0 ? pAbsY : 0
    const poySq = poy * poy
    const dAbsY = Math.abs(y - dCy) - dInnerH
    const doy = dAbsY > 0 ? dAbsY : 0
    const doySq = doy * doy
    const rowBase = iy * stride

    for (let ix = 0; ix <= cols; ix++) {
      const x = bounds.x + ix * dx

      const pqx = Math.abs(x - pCx) - pInnerW
      const pOut =
        pqx > 0
          ? poy > 0
            ? Math.sqrt(pqx * pqx + poySq)
            : pqx
          : poy
      const pMaxQ = pqx > pAbsY ? pqx : pAbsY
      const dA = pOut + (pMaxQ < 0 ? pMaxQ : 0) - pR

      const dqx = Math.abs(x - dCx) - dInnerW
      const dOut =
        dqx > 0
          ? doy > 0
            ? Math.sqrt(dqx * dqx + doySq)
            : dqx
          : doy
      const dMaxQ = dqx > dAbsY ? dqx : dAbsY
      const dB = dOut + (dMaxQ < 0 ? dMaxQ : 0) - dR

      let h = 0.5 + (dB - dA) * inv2K
      if (h < 0) h = 0
      else if (h > 1) h = 1
      const val = dB + (dA - dB) * h - blendK * h * (1 - h)
      fieldBuf[rowBase + ix] = val > -1e-6 && val < 1e-6 ? -1e-6 : val
    }
  }

  // 2. Refine active edge crossings via 3-iteration bisection + final linear interpolation.
  for (let iy = 0; iy <= rows; iy++) {
    const yWorld = bounds.y + iy * dy
    const yLocal = yWorld - oy
    const rowBase = iy * stride
    const edgeRowBase = iy * MAX_GRID_NODES
    for (let ix = 0; ix < cols; ix++) {
      const v0 = fieldBuf[rowBase + ix]
      const v1 = fieldBuf[rowBase + ix + 1]
      if ((v0 < 0) !== (v1 < 0)) {
        const x0 = bounds.x + ix * dx
        let lo = 0
        let hi = 1
        let vLo = v0
        let vHi = v1
        for (let iter = 0; iter < 3; iter++) {
          const mid = 0.5 * (lo + hi)
          const vm = evalSminFieldPoint(
            x0 + mid * dx,
            yWorld,
            pCx,
            pCy,
            pInnerW,
            pInnerH,
            pR,
            dCx,
            dCy,
            dInnerW,
            dInnerH,
            dR,
            blendK,
            inv2K,
          )
          if ((vm < 0) === (vLo < 0)) {
            lo = mid
            vLo = vm
          } else {
            hi = mid
            vHi = vm
          }
        }
        const t = lo + (hi - lo) * (vLo / (vLo - vHi))
        const eId = edgeRowBase + ix
        hEdgeX[eId] = x0 + t * dx - ox
        hEdgeY[eId] = yLocal
      }
    }
  }

  for (let iy = 0; iy < rows; iy++) {
    const y0 = bounds.y + iy * dy
    const rowBase = iy * stride
    const nextRowBase = (iy + 1) * stride
    const edgeRowBase = iy * MAX_GRID_NODES
    for (let ix = 0; ix <= cols; ix++) {
      const v0 = fieldBuf[rowBase + ix]
      const v1 = fieldBuf[nextRowBase + ix]
      if ((v0 < 0) !== (v1 < 0)) {
        const xWorld = bounds.x + ix * dx
        let lo = 0
        let hi = 1
        let vLo = v0
        let vHi = v1
        for (let iter = 0; iter < 3; iter++) {
          const mid = 0.5 * (lo + hi)
          const vm = evalSminFieldPoint(
            xWorld,
            y0 + mid * dy,
            pCx,
            pCy,
            pInnerW,
            pInnerH,
            pR,
            dCx,
            dCy,
            dInnerW,
            dInnerH,
            dR,
            blendK,
            inv2K,
          )
          if ((vm < 0) === (vLo < 0)) {
            lo = mid
            vLo = vm
          } else {
            hi = mid
            vHi = vm
          }
        }
        const t = lo + (hi - lo) * (vLo / (vLo - vHi))
        const eId = edgeRowBase + ix
        vEdgeX[eId] = xWorld - ox
        vEdgeY[eId] = y0 + t * dy - oy
      }
    }
  }

  // 3. Build directed edge-to-edge segments per cell (clockwise around interior in Y-down).
  let activeCount = 0
  for (let cy = 0; cy < rows; cy++) {
    const r0 = cy * stride
    const r1 = (cy + 1) * stride
    const eRow = cy * MAX_GRID_NODES
    const eNextRow = (cy + 1) * MAX_GRID_NODES

    for (let cx = 0; cx < cols; cx++) {
      const vTL = fieldBuf[r0 + cx]
      const vTR = fieldBuf[r0 + cx + 1]
      const vBR = fieldBuf[r1 + cx + 1]
      const vBL = fieldBuf[r1 + cx]

      const mask =
        (vTL < 0 ? 8 : 0) |
        (vTR < 0 ? 4 : 0) |
        (vBR < 0 ? 2 : 0) |
        (vBL < 0 ? 1 : 0)

      if (mask === 0 || mask === 15) {
        continue
      }

      const eT = eRow + cx
      const eR = TOTAL_H + eRow + cx + 1
      const eB = eNextRow + cx
      const eL = TOTAL_H + eRow + cx

      switch (mask) {
        case 1:
          activeCount = addSegment(eL, eB, activeCount)
          break
        case 2:
          activeCount = addSegment(eB, eR, activeCount)
          break
        case 3:
          activeCount = addSegment(eL, eR, activeCount)
          break
        case 4:
          activeCount = addSegment(eR, eT, activeCount)
          break
        case 5: {
          const centerVal = evalSminFieldPoint(
            bounds.x + (cx + 0.5) * dx,
            bounds.y + (cy + 0.5) * dy,
            pCx,
            pCy,
            pInnerW,
            pInnerH,
            pR,
            dCx,
            dCy,
            dInnerW,
            dInnerH,
            dR,
            blendK,
            inv2K,
          )
          if (centerVal < 0) {
            activeCount = addSegment(eL, eT, activeCount)
            activeCount = addSegment(eR, eB, activeCount)
          } else {
            activeCount = addSegment(eR, eT, activeCount)
            activeCount = addSegment(eL, eB, activeCount)
          }
          break
        }
        case 6:
          activeCount = addSegment(eB, eT, activeCount)
          break
        case 7:
          activeCount = addSegment(eL, eT, activeCount)
          break
        case 8:
          activeCount = addSegment(eT, eL, activeCount)
          break
        case 9:
          activeCount = addSegment(eT, eB, activeCount)
          break
        case 10: {
          const centerVal = evalSminFieldPoint(
            bounds.x + (cx + 0.5) * dx,
            bounds.y + (cy + 0.5) * dy,
            pCx,
            pCy,
            pInnerW,
            pInnerH,
            pR,
            dCx,
            dCy,
            dInnerW,
            dInnerH,
            dR,
            blendK,
            inv2K,
          )
          if (centerVal < 0) {
            activeCount = addSegment(eT, eR, activeCount)
            activeCount = addSegment(eB, eL, activeCount)
          } else {
            activeCount = addSegment(eT, eL, activeCount)
            activeCount = addSegment(eB, eR, activeCount)
          }
          break
        }
        case 11:
          activeCount = addSegment(eT, eR, activeCount)
          break
        case 12:
          activeCount = addSegment(eR, eL, activeCount)
          break
        case 13:
          activeCount = addSegment(eR, eB, activeCount)
          break
        case 14:
          activeCount = addSegment(eB, eL, activeCount)
          break
      }
    }
  }

  if (activeCount === 0) {
    return ''
  }

  for (let i = 0; i < activeCount; i++) {
    visitedBuf[activeEdgeList[i]] = 0
  }

  // 4. Chain directed edge segments into closed SVG loops.
  const loopStrings: string[] = []
  const loopParts: string[] = []
  const maxLoopSteps = activeCount + 1

  for (let i = 0; i < activeCount; i++) {
    const startEdge = activeEdgeList[i]
    if (visitedBuf[startEdge]) {
      continue
    }

    let cur = startEdge
    let vertexCount = 0
    let lastX = Number.NaN
    let lastY = Number.NaN
    loopParts.length = 0

    for (let step = 0; step < maxLoopSteps; step++) {
      if (visitedBuf[cur]) {
        break
      }
      visitedBuf[cur] = 1

      let px: number
      let py: number
      if (cur < TOTAL_H) {
        px = fmt(hEdgeX[cur])
        py = fmt(hEdgeY[cur])
      } else {
        const vIdx = cur - TOTAL_H
        px = fmt(vEdgeX[vIdx])
        py = fmt(vEdgeY[vIdx])
      }

      if (vertexCount === 0) {
        loopParts.push(`M${px} ${py}`)
        lastX = px
        lastY = py
        vertexCount = 1
      } else if (Math.abs(px - lastX) > 0.02 || Math.abs(py - lastY) > 0.02) {
        loopParts.push(`L${px} ${py}`)
        lastX = px
        lastY = py
        vertexCount++
      }

      cur = nextEdgeBuf[cur]
      if (cur === startEdge || cur < 0) {
        break
      }
    }

    if (vertexCount >= 3) {
      loopParts.push('Z')
      loopStrings.push(loopParts.join(''))
    }
  }

  return loopStrings.join(' ')
}
