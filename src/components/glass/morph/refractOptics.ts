/**
 * Shared Route B3 pure optical math & computed-CSS extraction utilities for Live-DOM Hybrid Liquid Glass morphing.
 *
 * All visual border, outline, inset catchlight, veil brightness/contrast, and shadow values are derived
 * mathematically or parsed from live DOM computed CSS so every glass preset, theme, and custom override
 * stays automatically parity-matched without hardcoded preset branches.
 *
 * SPDX-License-Identifier: MPL-2.0
 */

import type { GlassOpticalStyle } from './contracts'

export interface CircularBevelTable {
  tableValues: string
  peakSobelEffective: number
  blurStd: number
  divisor: number
}

export interface MorphBackdropVeilOptics {
  brightness: number
  contrast: number
  contrastFirst: boolean
}

export interface ExtractedCssGlassSurface {
  veil: MorphBackdropVeilOptics
  borderWidth: number
  borderRgba: [number, number, number, number]
  outlineWidth: number
  outlineAlpha: number
  rimOpacity: number
  rimWidth: number
  rimTail: number
  rimFocus: number
  rimBottomRatio: number
  shadowBlur: number
  shadowOffsetY: number
  shadowAlpha: number
}

interface ParsedBoxShadowLayer {
  inset: boolean
  offsetX: number
  offsetY: number
  blur: number
  spread: number
  rgba: [number, number, number, number]
}

function erfApprox(x: number): number {
  const sign = x < 0 ? -1 : 1
  const ax = Math.abs(x)
  const t = 1 / (1 + 0.3275911 * ax)
  const y =
    1 -
    (((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t) *
      Math.exp(-ax * ax)
  return sign * y
}

function inverseHalfPlaneGaussian(a: number, sigma: number): number {
  const clamped = Math.min(0.9999, Math.max(0.0001, a))
  let lo = -sigma * 4.5
  let hi = sigma * 4.5
  const invRoot2Sigma = 1 / (Math.SQRT2 * sigma)
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) * 0.5
    const v = 0.5 + 0.5 * erfApprox(mid * invRoot2Sigma)
    if (v < clamped) lo = mid
    else hi = mid
  }
  return (lo + hi) * 0.5
}

/**
 * Integrates the circular-bevel curve `1 - sqrt(1 - rise^2)` wrt distance `d`,
 * mapped onto Gaussian blur alpha `A(d)` so discrete Sobel produces continuous inward rim gradients.
 */
export function buildCircularBevelTable(
  bezel: number,
  blurStd?: number,
  steps = 21,
): CircularBevelTable {
  const safeBezel = Math.max(1, bezel)
  const effectiveBlurStd = blurStd ?? Math.max(4, Math.min(12.5, safeBezel * 0.425))

  const integrateHalf = (dMax: number): number => {
    const n = 48
    const absD = Math.abs(dMax)
    const sign = dMax < 0 ? -1 : 1
    let sum = 0
    for (let i = 0; i < n; i++) {
      const d = ((i + 0.5) / n) * absD
      const rise = Math.max(0, 1 - d / safeBezel)
      const m = 1 - Math.sqrt(Math.max(0, 1 - rise * rise))
      sum += m * (absD / n)
    }
    return sign * sum
  }

  const maxIntegral = integrateHalf(safeBezel)
  const raw: number[] = []
  for (let i = 0; i < steps; i++) {
    const a = i / (steps - 1)
    const d = inverseHalfPlaneGaussian(a, effectiveBlurStd)
    const clampedD = Math.max(-safeBezel, Math.min(safeBezel, d))
    const val = 0.5 + 0.5 * (integrateHalf(clampedD) / maxIntegral)
    raw.push(Math.min(1, Math.max(0, val)))
  }

  // Average Sobel over [-1px, +1px] around d=0 is ~0.78x of theoretical cusp derivative
  const peakSobelEffective = (4 / maxIntegral) * 0.78
  const divisor = Number((peakSobelEffective / 0.48).toFixed(2))

  return {
    tableValues: raw.map((v) => v.toFixed(4)).join(' '),
    peakSobelEffective,
    blurStd: effectiveBlurStd,
    divisor,
  }
}

/**
 * Combines Rec.709 `saturate`, `brightness`, and `contrast` into one SVG `feColorMatrix` string,
 * matching either CSS `contrast() brightness()` (`contrastFirst=true`) or `brightness() contrast()`.
 */
export function buildColorOpticsMatrix(
  saturate: number,
  brightness: number,
  contrast: number,
  contrastFirst = false,
): string {
  const lr = 0.2126
  const lg = 0.7152
  const lb = 0.0722
  const invS = 1 - saturate
  const k = brightness * contrast
  const offset = contrastFirst ? brightness * 0.5 * (1 - contrast) : 0.5 * (1 - contrast)

  const rr = k * (lr * invS + saturate)
  const rg = k * (lg * invS)
  const rb = k * (lb * invS)

  const gr = k * (lr * invS)
  const gg = k * (lg * invS + saturate)
  const gb = k * (lb * invS)

  const br = k * (lr * invS)
  const bg = k * (lg * invS)
  const bb = k * (lb * invS + saturate)

  const f = (n: number) => n.toFixed(4)
  return `${f(rr)} ${f(rg)} ${f(rb)} 0 ${f(offset)}  ${f(gr)} ${f(gg)} ${f(gb)} 0 ${f(offset)}  ${f(br)} ${f(bg)} ${f(bb)} 0 ${f(offset)}  0 0 0 1 0`
}

export function buildContourAlphaDataUrl(contourPath: string, width: number, height: number): string {
  const w = Math.max(1, Math.round(width))
  const h = Math.max(1, Math.round(height))
  const svgDoc = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><path d="${contourPath}" fill="white"/></svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgDoc)}`
}

/** Parses browser-computed `rgb(...)`, `rgba(...)`, or `color(srgb ...)` strings into normalized `[0..1]` RGBA. */
export function parseCssRgba(color: string): [number, number, number, number] {
  const trimmed = color.trim().toLowerCase()
  if (!trimmed || trimmed === 'none' || trimmed === 'transparent') {
    return [0, 0, 0, 0]
  }

  const srgbMatch = trimmed.match(/^color\(\s*srgb\s+([^\s/]+)\s+([^\s/]+)\s+([^\s/]+)(?:\s*\/\s*([^\s)]+))?\s*\)$/)
  if (srgbMatch) {
    const r = Number(srgbMatch[1])
    const g = Number(srgbMatch[2])
    const b = Number(srgbMatch[3])
    const aRaw = srgbMatch[4]
    const a = aRaw !== undefined ? (aRaw.endsWith('%') ? parseFloat(aRaw) / 100 : Number(aRaw)) : 1
    if (Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b) && Number.isFinite(a)) {
      return [r, g, b, Math.min(1, Math.max(0, a))]
    }
  }

  const rgbMatch = trimmed.match(/^rgba?\(\s*([^)]+)\s*\)$/)
  if (rgbMatch) {
    const body = rgbMatch[1].replace(/\//g, ' ').trim()
    const parts = body.split(/[\s,]+/)
    if (parts.length >= 3) {
      const parseChannel = (token: string) =>
        token.endsWith('%') ? (parseFloat(token) / 100) : (parseFloat(token) / 255)
      const r = parseChannel(parts[0])
      const g = parseChannel(parts[1])
      const b = parseChannel(parts[2])
      const a = parts[3] !== undefined
        ? (parts[3].endsWith('%') ? parseFloat(parts[3]) / 100 : parseFloat(parts[3]))
        : 1
      if (Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b) && Number.isFinite(a)) {
        return [
          Math.min(1, Math.max(0, r)),
          Math.min(1, Math.max(0, g)),
          Math.min(1, Math.max(0, b)),
          Math.min(1, Math.max(0, a)),
        ]
      }
    }
  }

  return [0, 0, 0, 0]
}

/** Extracts CSS `brightness(...)` and `contrast(...)` veil optics and their application order from any filter string. */
export function parseCssFilterOptics(filterStr: string): MorphBackdropVeilOptics {
  if (!filterStr || filterStr === 'none') {
    return { brightness: 1, contrast: 1, contrastFirst: false }
  }
  let brightness = 1
  let contrast = 1
  let firstBrightnessIdx = -1
  let firstContrastIdx = -1

  const regex = /(brightness|contrast)\(\s*([^)]+)\s*\)/gi
  let match: RegExpExecArray | null
  while ((match = regex.exec(filterStr)) !== null) {
    const fn = match[1].toLowerCase()
    const raw = match[2].trim()
    const val = raw.endsWith('%') ? parseFloat(raw) / 100 : parseFloat(raw)
    if (!Number.isFinite(val)) continue
    if (fn === 'brightness') {
      brightness *= val
      if (firstBrightnessIdx < 0) firstBrightnessIdx = match.index
    } else {
      contrast *= val
      if (firstContrastIdx < 0) firstContrastIdx = match.index
    }
  }

  return {
    brightness,
    contrast,
    contrastFirst: firstContrastIdx >= 0 && firstBrightnessIdx >= 0 && firstContrastIdx < firstBrightnessIdx,
  }
}

export function interpolateVeilOptics(
  from: MorphBackdropVeilOptics,
  to: MorphBackdropVeilOptics,
  t: number,
): MorphBackdropVeilOptics {
  const u = Math.min(1, Math.max(0, t))
  return {
    brightness: from.brightness + (to.brightness - from.brightness) * u,
    contrast: from.contrast + (to.contrast - from.contrast) * u,
    contrastFirst: u >= 0.5 ? to.contrastFirst : from.contrastFirst,
  }
}

function splitTopLevelCommas(input: string): string[] {
  const parts: string[] = []
  let depth = 0
  let start = 0
  for (let i = 0; i < input.length; i++) {
    const ch = input[i]
    if (ch === '(') depth++
    else if (ch === ')') depth = Math.max(0, depth - 1)
    else if (ch === ',' && depth === 0) {
      parts.push(input.slice(start, i).trim())
      start = i + 1
    }
  }
  const tail = input.slice(start).trim()
  if (tail) parts.push(tail)
  return parts
}

/** Parses computed `box-shadow` string into structured layers (handles leading or trailing color tokens). */
export function parseCssBoxShadow(boxShadowStr: string): ParsedBoxShadowLayer[] {
  if (!boxShadowStr || boxShadowStr === 'none') return []
  const layers: ParsedBoxShadowLayer[] = []

  for (const rawLayer of splitTopLevelCommas(boxShadowStr)) {
    let rest = rawLayer
    let colorStr = ''
    const colorMatch = rest.match(/(?:rgba?|color)\([^)]+\)/i)
    if (colorMatch) {
      colorStr = colorMatch[0]
      rest = rest.replace(colorMatch[0], '').trim()
    }
    const tokens = rest.split(/\s+/).filter(Boolean)
    let inset = false
    const nums: number[] = []
    for (const tok of tokens) {
      if (tok === 'inset') {
        inset = true
        continue
      }
      if (/^-?\d*\.?\d+(?:px)?$/i.test(tok)) {
        nums.push(parseFloat(tok))
      }
    }
    if (nums.length < 2) continue
    layers.push({
      inset,
      offsetX: nums[0] ?? 0,
      offsetY: nums[1] ?? 0,
      blur: nums[2] ?? 0,
      spread: nums[3] ?? 0,
      rgba: colorStr ? parseCssRgba(colorStr) : [0, 0, 0, 1],
    })
  }
  return layers
}

/** Normal CDF Phi(z) approximating CSS Gaussian shadow blur falloff across blur/spread/offset. */
function normalCdf(z: number): number {
  const x = z / Math.SQRT2
  const ax = Math.abs(x)
  const t = 1 / (1 + 0.3275911 * ax)
  const poly =
    (((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t)
  const erfVal = 1 - poly * Math.exp(-ax * ax)
  return 0.5 * (1 + (x < 0 ? -erfVal : erfVal))
}

/**
 * Computes effective peak alpha at the padding edge and inward decay span for a CSS
 * `box-shadow: inset ox oy blur spread color` layer (accounting for negative spread attenuation).
 */
function resolveCssInsetShadowMetrics(
  layer: ParsedBoxShadowLayer,
  edgePush: number,
): { effectiveAlpha: number; spanPx: number; hasTail: boolean } {
  const netReach = edgePush + layer.spread
  const rawAlpha = layer.rgba[3]
  if (layer.blur <= 0.1) {
    return netReach > 0.05
      ? { effectiveAlpha: rawAlpha, spanPx: Math.min(4.8, Math.max(0.8, netReach)), hasTail: false }
      : { effectiveAlpha: 0, spanPx: 0, hasTail: false }
  }
  const sigma = Math.max(layer.blur * 0.5, 0.5)
  const peakFactor = normalCdf(netReach / sigma)
  const spanPx =
    netReach < 0
      ? Math.min(4.8, Math.max(1.2, sigma + netReach * 0.5))
      : Math.min(4.8, Math.max(1.4, netReach + sigma * 1.1))
  return {
    effectiveAlpha: rawAlpha * peakFactor,
    spanPx,
    hasTail: netReach >= 0 && layer.blur >= 2.5,
  }
}

/**
 * Extracts normalized overlay metrics from live computed CSS of a `.glass` / resting panel element.
 * Works generically for any preset, theme, slider configuration, or `[--g-drop:...]` override.
 */
export function parseCssGlassSurface({
  backdropFilter,
  veilFallback,
  borderWidthPx,
  borderColor,
  boxShadow,
}: {
  backdropFilter: string
  veilFallback?: string
  borderWidthPx: number
  borderColor: string
  boxShadow: string
}): ExtractedCssGlassSurface {
  const veil = parseCssFilterOptics(
    backdropFilter && /(brightness|contrast)\(/i.test(backdropFilter)
      ? backdropFilter
      : (veilFallback ?? ''),
  )
  const borderRgba = parseCssRgba(borderColor)
  // Keep uniform-border shader path active whenever CSS declares a border box (even if transparent on data-flat)
  const borderWidth = borderWidthPx > 0.05 ? borderWidthPx : 0

  const layers = parseCssBoxShadow(boxShadow)
  let outlineWidth = 0
  let outlineAlpha = 0
  let shadowBlur = 0
  let shadowOffsetY = 0
  let shadowAlpha = 0

  let topAlpha = 0
  let botAlpha = 0
  let isoAlpha = 0
  let maxRimSpan = 0
  let rimHasTail = false

  for (const layer of layers) {
    const a = layer.rgba[3]
    if (a <= 0.001) continue

    if (!layer.inset) {
      if (layer.blur <= 0.1 && Math.abs(layer.offsetX) <= 0.1 && Math.abs(layer.offsetY) <= 0.1 && layer.spread > 0) {
        outlineWidth = Math.max(outlineWidth, layer.spread)
        outlineAlpha = Math.max(outlineAlpha, a)
      } else if (layer.blur >= shadowBlur) {
        shadowBlur = layer.blur
        shadowOffsetY = layer.offsetY
        shadowAlpha = a
      }
    } else if (Math.abs(layer.offsetY) <= 0.1 && Math.abs(layer.offsetX) <= 0.1) {
      const m = resolveCssInsetShadowMetrics(layer, 0)
      if (m.effectiveAlpha > 0.001) {
        isoAlpha = Math.max(isoAlpha, m.effectiveAlpha)
        maxRimSpan = Math.max(maxRimSpan, m.spanPx)
        rimHasTail = rimHasTail || m.hasTail
      }
    } else if (layer.offsetY > 0.1) {
      const m = resolveCssInsetShadowMetrics(layer, layer.offsetY)
      if (m.effectiveAlpha > 0.001) {
        topAlpha = Math.max(topAlpha, m.effectiveAlpha)
        maxRimSpan = Math.max(maxRimSpan, m.spanPx)
        rimHasTail = rimHasTail || m.hasTail
      }
    } else if (layer.offsetY < -0.1) {
      const m = resolveCssInsetShadowMetrics(layer, -layer.offsetY)
      if (m.effectiveAlpha > 0.001) {
        botAlpha = Math.max(botAlpha, m.effectiveAlpha)
        maxRimSpan = Math.max(maxRimSpan, m.spanPx)
        rimHasTail = rimHasTail || m.hasTail
      }
    }
  }

  const isIsotropic = isoAlpha > 0 && topAlpha === 0 && botAlpha === 0
  const rimOpacity = isIsotropic ? isoAlpha : Math.max(topAlpha, botAlpha)
  const rimFocus = isIsotropic ? 0 : 1
  const rimBottomRatio = isIsotropic
    ? 1
    : topAlpha > 0.001
      ? Math.min(1, botAlpha / topAlpha)
      : 1

  return {
    veil,
    borderWidth,
    borderRgba,
    outlineWidth,
    outlineAlpha,
    rimOpacity,
    rimWidth: rimOpacity > 0.001 ? Math.min(4.8, Math.max(1.2, maxRimSpan)) : 0,
    rimTail: rimOpacity > 0.001 && rimHasTail ? 0.14 : 0,
    rimFocus,
    rimBottomRatio,
    shadowBlur,
    shadowOffsetY,
    shadowAlpha,
  }
}

/** Interpolates between measured trigger and panel CSS surfaces over `styleMix` for jump-free landing. */
export function interpolateCssGlassSurfaceToOverlay(
  baseStyle: GlassOpticalStyle,
  from: ExtractedCssGlassSurface,
  to: ExtractedCssGlassSurface,
  styleMix: number,
): GlassOpticalStyle {
  const t = Math.min(1, Math.max(0, styleMix))
  const lerp = (a: number, b: number) => a + (b - a) * t
  const outlineAlpha = lerp(from.outlineAlpha, to.outlineAlpha)

  return {
    ...baseStyle,
    borderWidth: Math.max(from.borderWidth, to.borderWidth),
    borderRgba: [
      lerp(from.borderRgba[0], to.borderRgba[0]),
      lerp(from.borderRgba[1], to.borderRgba[1]),
      lerp(from.borderRgba[2], to.borderRgba[2]),
      lerp(from.borderRgba[3], to.borderRgba[3]),
    ],
    rimOpacity: lerp(from.rimOpacity, to.rimOpacity),
    rimWidth: lerp(from.rimWidth || to.rimWidth, to.rimWidth || from.rimWidth),
    rimTail: lerp(from.rimTail, to.rimTail),
    rimFocus: t >= 0.5 ? to.rimFocus : from.rimFocus,
    rimBottomRatio: lerp(from.rimBottomRatio, to.rimBottomRatio),
    hairlineWidth: lerp(from.outlineWidth || to.outlineWidth, to.outlineWidth || from.outlineWidth),
    hairlineSideAlpha: outlineAlpha,
    hairlineCornerAlpha: outlineAlpha,
    hairlineFlatAlpha: outlineAlpha,
    shadowBlur: lerp(from.shadowBlur, to.shadowBlur),
    shadowOffsetY: lerp(from.shadowOffsetY, to.shadowOffsetY),
    shadowAlpha: lerp(from.shadowAlpha, to.shadowAlpha),
  }
}
