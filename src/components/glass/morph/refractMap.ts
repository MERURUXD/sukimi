/**
 * Clean-room 0.5x stored-PNG (`BTYPE=00`) RGBA displacement + inward-AA alpha map generator
 * for Route B3 SVG `feDisplacementMap` liquid glass morphing.
 *
 * Replaces the 9-node SVG blur -> LUT -> Sobel subgraph by evaluating the exact `smin` + rounded-rect
 * SDF analytically at 0.5x resolution and encoding a zero-compression stored PNG data URL with
 * reusable typed buffers, slicing-table CRC32, and chunked Adler32.
 *
 * SPDX-License-Identifier: MPL-2.0
 */

import type { GlassShapeState, Rect } from './contracts'

const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])
const PNG_IEND = new Uint8Array([0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130])
const MAX_DEFLATE_BLOCK = 65535
const DEFAULT_MAP_SCALE = 0.5
const DEFAULT_FALLOFF = 2.6
const SQRT1_2 = Math.SQRT1_2

type Uint8ArrayWithToBase64 = Uint8Array & { toBase64?: () => string }

export interface MorphRefractMapParams {
  bounds: Rect
  platter: GlassShapeState
  droplet: GlassShapeState | null
  blendK: number
  isMerged: boolean
  bezel: number
  falloff?: number
  mapScale?: number
}

export interface MorphRefractMapResult {
  dataUrl: string
  width: number
  height: number
  changed: boolean
}

export interface MorphRefractMapBuilder {
  build(params: MorphRefractMapParams): MorphRefractMapResult
  reset(): void
}

// 4-table slicing IEEE 802.3 CRC32 lookup (1024 x uint32).
const CRC_TABLES = (() => {
  const tables = new Uint32Array(1024)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let k = 0; k < 8; k++) {
      c = (c & 1) !== 0 ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1)
    }
    tables[i] = c >>> 0
  }
  for (let t = 1; t < 4; t++) {
    const prevBase = (t - 1) * 256
    const curBase = t * 256
    for (let i = 0; i < 256; i++) {
      const prev = tables[prevBase + i]
      tables[curBase + i] = ((prev >>> 8) ^ tables[prev & 0xff]) >>> 0
    }
  }
  return tables
})()

function crc32(bytes: Uint8Array, start: number, length: number): number {
  let crc = 0xffffffff
  let i = start
  const end4 = start + (length & ~3)
  while (i < end4) {
    const w =
      (crc ^
        (bytes[i] |
          (bytes[i + 1] << 8) |
          (bytes[i + 2] << 16) |
          (bytes[i + 3] << 24))) >>>
      0
    crc =
      (CRC_TABLES[768 + (w & 0xff)] ^
        CRC_TABLES[512 + ((w >>> 8) & 0xff)] ^
        CRC_TABLES[256 + ((w >>> 16) & 0xff)] ^
        CRC_TABLES[(w >>> 24) & 0xff]) >>>
      0
    i += 4
  }
  const end = start + length
  while (i < end) {
    crc = (CRC_TABLES[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8)) >>> 0
    i++
  }
  return (crc ^ 0xffffffff) >>> 0
}

function adler32(bytes: Uint8Array, length: number): number {
  let s1 = 1
  let s2 = 0
  let i = 0
  while (i < length) {
    let chunkEnd = i + 5550
    if (chunkEnd > length) chunkEnd = length
    while (i < chunkEnd) {
      s1 += bytes[i++]
      s2 += s1
    }
    s1 %= 65521
    s2 %= 65521
  }
  return ((s2 << 16) | s1) >>> 0
}

function writeU32BE(buf: Uint8Array, offset: number, val: number): void {
  buf[offset] = (val >>> 24) & 0xff
  buf[offset + 1] = (val >>> 16) & 0xff
  buf[offset + 2] = (val >>> 8) & 0xff
  buf[offset + 3] = val & 0xff
}

function uint8ToBase64(bytes: Uint8Array, length: number): string {
  const view = bytes.subarray(0, length) as Uint8ArrayWithToBase64
  if (typeof view.toBase64 === 'function') {
    return view.toBase64()
  }
  const chunkSize = 0x2000
  const chunks: string[] = []
  for (let i = 0; i < length; i += chunkSize) {
    const end = Math.min(i + chunkSize, length)
    chunks.push(String.fromCharCode(...view.subarray(i, end)))
  }
  return btoa(chunks.join(''))
}

// Reusable scratch buffers shared across synchronous map builds to avoid GC churn.
let scanlineBuf = new Uint8Array(0)
let pngOutBuf = new Uint8Array(0)

function ensureScanlineCapacity(needed: number): Uint8Array {
  if (scanlineBuf.length < needed) {
    scanlineBuf = new Uint8Array(Math.max(needed, scanlineBuf.length * 2, 16384))
  }
  return scanlineBuf
}

function ensurePngOutCapacity(needed: number): Uint8Array {
  if (pngOutBuf.length < needed) {
    pngOutBuf = new Uint8Array(Math.max(needed, pngOutBuf.length * 2, 32768))
  }
  return pngOutBuf
}

function encodeStoredRgbaPngDataUrl(
  scanlines: Uint8Array,
  pngW: number,
  pngH: number,
): string {
  const rowBytes = 1 + pngW * 4
  const rawLen = pngH * rowBytes
  const numBlocks = Math.max(1, Math.ceil(rawLen / MAX_DEFLATE_BLOCK))
  const zlibLen = 2 + rawLen + numBlocks * 5 + 4
  // 8 (sig) + 25 (IHDR) + 12 + zlibLen (IDAT) + 12 (IEND)
  const totalLen = 57 + zlibLen
  const out = ensurePngOutCapacity(totalLen)

  // PNG Signature (0..7)
  out.set(PNG_SIGNATURE, 0)

  // IHDR Chunk (8..32)
  writeU32BE(out, 8, 13)
  out[12] = 73 // 'I'
  out[13] = 72 // 'H'
  out[14] = 68 // 'D'
  out[15] = 82 // 'R'
  writeU32BE(out, 16, pngW)
  writeU32BE(out, 20, pngH)
  out[24] = 8 // bit depth
  out[25] = 6 // color type RGBA
  out[26] = 0 // compression
  out[27] = 0 // filter
  out[28] = 0 // interlace
  writeU32BE(out, 29, crc32(out, 12, 17))

  // IDAT Chunk header (33..40)
  writeU32BE(out, 33, zlibLen)
  out[37] = 73 // 'I'
  out[38] = 68 // 'D'
  out[39] = 65 // 'A'
  out[40] = 84 // 'T'

  // Zlib header (CMF=0x78, FLG=0x01)
  out[41] = 0x78
  out[42] = 0x01

  let dst = 43
  let src = 0
  let remaining = rawLen
  while (remaining > 0 || src === 0) {
    const blockLen = remaining > MAX_DEFLATE_BLOCK ? MAX_DEFLATE_BLOCK : remaining
    const isFinal = remaining - blockLen <= 0
    out[dst++] = isFinal ? 0x01 : 0x00
    out[dst++] = blockLen & 0xff
    out[dst++] = (blockLen >>> 8) & 0xff
    const nlen = (~blockLen) & 0xffff
    out[dst++] = nlen & 0xff
    out[dst++] = (nlen >>> 8) & 0xff
    if (blockLen > 0) {
      out.set(scanlines.subarray(src, src + blockLen), dst)
      dst += blockLen
      src += blockLen
      remaining -= blockLen
    } else {
      break
    }
  }

  // Adler32 trailer + IDAT CRC32
  writeU32BE(out, dst, adler32(scanlines, rawLen))
  dst += 4
  writeU32BE(out, dst, crc32(out, 37, 4 + zlibLen))
  dst += 4

  // IEND Chunk
  out.set(PNG_IEND, dst)
  dst += 12

  return `data:image/png;base64,${uint8ToBase64(out, dst)}`
}

function clamp01(v: number): number {
  return v <= 0 ? 0 : v >= 1 ? 1 : v
}

function quant4(v: number): number {
  return Math.round(v * 4)
}

function quant100(v: number): number {
  return Math.round(v * 100)
}

function cornerBend(
  x: number,
  y: number,
  radius: number,
  bezel: number,
  falloff: number,
): [number, number] {
  let lo = 0
  let hi = Math.min(x, y, bezel)
  for (let i = 0; i < 10; i++) {
    const distance = (lo + hi) * 0.5
    const u = 1 - distance / bezel
    const centerCoord = bezel - (bezel - radius) * u * u
    const dx = centerCoord - x
    const dy = centerCoord - y
    const cx = dx > 0 ? dx : 0
    const cy = dy > 0 ? dy : 0
    if (Math.hypot(cx, cy) <= centerCoord - distance) {
      lo = distance
    } else {
      hi = distance
    }
  }
  const u = 1 - lo / bezel
  const centerCoord = bezel - (bezel - radius) * u * u
  const nx = centerCoord - x > 0 ? centerCoord - x : 0
  const ny = centerCoord - y > 0 ? centerCoord - y : 0
  const normal = Math.hypot(nx, ny)
  const weight = Math.pow(Math.max(0, 1 - lo / bezel), falloff)
  if (normal <= 1e-6) return x < y ? [weight, 0] : [0, weight]
  return [(nx / normal) * weight, (ny / normal) * weight]
}

function buildQuantizedKey(
  cssW: number,
  cssH: number,
  pngW: number,
  pngH: number,
  bounds: Rect,
  platter: GlassShapeState,
  droplet: GlassShapeState | null,
  blendK: number,
  isMerged: boolean,
  bezel: number,
  falloff: number,
): string {
  const base =
    `${cssW}:${cssH}:${pngW}:${pngH}:${quant4(bounds.x)}:${quant4(bounds.y)}:` +
    `${quant4(platter.center.x)}:${quant4(platter.center.y)}:${quant4(platter.size.width)}:${quant4(platter.size.height)}:${quant4(platter.radius)}:` +
    `${quant4(bezel)}:${quant100(falloff)}`
  if (isMerged || !droplet || droplet.size.width <= 0.01 || droplet.size.height <= 0.01) {
    return `${base}:M`
  }
  return (
    `${base}:${quant4(blendK)}:${quant4(droplet.center.x)}:${quant4(droplet.center.y)}:` +
    `${quant4(droplet.size.width)}:${quant4(droplet.size.height)}:${quant4(droplet.radius)}`
  )
}

function rasterizeSingleRectScanlines(
  scanlines: Uint8Array,
  pngW: number,
  pngH: number,
  originX: number,
  originY: number,
  stepX: number,
  stepY: number,
  platter: GlassShapeState,
  safeBezel: number,
  safeFalloff: number,
): void {
  const cx = platter.center.x
  const cy = platter.center.y
  const halfW = Math.max(0.001, platter.size.width * 0.5)
  const halfH = Math.max(0.001, platter.size.height * 0.5)
  const effBezel = Math.max(1e-3, Math.min(safeBezel, halfW, halfH))
  const rad = Math.max(0, Math.min(platter.radius, halfW, halfH))
  const innerW = halfW - rad
  const innerH = halfH - rad
  const invBezel = 1 / effBezel
  const interiorGate = -Math.max(effBezel, 0.5)
  const bendCorners = rad > 0 && rad < effBezel

  let offset = 0
  for (let py = 0; py < pngH; py++) {
    scanlines[offset++] = 0 // PNG filter type 0 (None)
    const dy = originY + py * stepY - cy
    const absDy = dy < 0 ? -dy : dy
    const sy = dy >= 0 ? 1 : -1
    const qy = absDy - innerH
    const qyPos = qy > 0
    const edgeY = halfH - absDy

    for (let px = 0; px < pngW; px++) {
      const dx = originX + px * stepX - cx
      const absDx = dx < 0 ? -dx : dx
      const sx = dx >= 0 ? 1 : -1
      const qx = absDx - innerW

      let sd: number
      let gx: number
      let gy: number

      if (qx > 0 && qyPos) {
        const outLen = Math.hypot(qx, qy)
        sd = outLen - rad
        if (outLen > 1e-6) {
          const invLen = 1 / outLen
          gx = sx * qx * invLen
          gy = sy * qy * invLen
        } else {
          gx = sx * SQRT1_2
          gy = sy * SQRT1_2
        }
      } else if (qx > qy) {
        sd = qx - rad
        gx = sx
        gy = 0
      } else {
        sd = qy - rad
        gx = 0
        gy = sy
      }

      if (sd >= 0.5) {
        scanlines[offset++] = 128
        scanlines[offset++] = 128
        scanlines[offset++] = 128
        scanlines[offset++] = 0
      } else if (sd <= interiorGate) {
        scanlines[offset++] = 128
        scanlines[offset++] = 128
        scanlines[offset++] = 128
        scanlines[offset++] = 255
      } else {
        const distIn = sd < 0 ? -sd : 0
        const alpha = sd <= -0.5 ? 255 : Math.round((0.5 - sd) * 255)
        const edgeX = halfW - absDx
        if (bendCorners && edgeX < effBezel && edgeY < effBezel) {
          const [ox, oy] = cornerBend(
            edgeX > 0 ? edgeX : 0,
            edgeY > 0 ? edgeY : 0,
            rad,
            effBezel,
            safeFalloff,
          )
          scanlines[offset++] = Math.round(128 - sx * ox * 127)
          scanlines[offset++] = Math.round(128 - sy * oy * 127)
          scanlines[offset++] = 128
          scanlines[offset++] = alpha
        } else if (distIn >= effBezel) {
          scanlines[offset++] = 128
          scanlines[offset++] = 128
          scanlines[offset++] = 128
          scanlines[offset++] = alpha
        } else {
          const m = Math.pow(Math.max(0, 1 - distIn * invBezel), safeFalloff)
          const amp = m * 127
          scanlines[offset++] = Math.round(128 - gx * amp)
          scanlines[offset++] = Math.round(128 - gy * amp)
          scanlines[offset++] = 128
          scanlines[offset++] = alpha
        }
      }
    }
  }
}

function rasterizeDualShapeScanlines(
  scanlines: Uint8Array,
  pngW: number,
  pngH: number,
  originX: number,
  originY: number,
  stepX: number,
  stepY: number,
  platter: GlassShapeState,
  droplet: GlassShapeState,
  blendK: number,
  safeBezel: number,
  safeFalloff: number,
): void {
  const pCx = platter.center.x
  const pCy = platter.center.y
  const pHalfW = Math.max(0.001, platter.size.width * 0.5)
  const pHalfH = Math.max(0.001, platter.size.height * 0.5)
  const effBezel = Math.max(1e-3, Math.min(safeBezel, pHalfW, pHalfH))
  const pRad = Math.max(0, Math.min(platter.radius, pHalfW, pHalfH))
  const pInnerW = pHalfW - pRad
  const pInnerH = pHalfH - pRad

  const dCx = droplet.center.x
  const dCy = droplet.center.y
  const dHalfW = Math.max(0.001, droplet.size.width * 0.5)
  const dHalfH = Math.max(0.001, droplet.size.height * 0.5)
  const dRad = Math.max(0, Math.min(droplet.radius, dHalfW, dHalfH))
  const dInnerW = dHalfW - dRad
  const dInnerH = dHalfH - dRad

  const smoothUnion = blendK > 0.001
  const inv2K = smoothUnion ? 0.5 / blendK : 0
  const invBezel = 1 / effBezel
  const interiorGate = -Math.max(effBezel, 0.5)

  let offset = 0
  for (let py = 0; py < pngH; py++) {
    scanlines[offset++] = 0
    const wy = originY + py * stepY
    const pDy = wy - pCy
    const pSy = pDy >= 0 ? 1 : -1
    const pQy = (pDy < 0 ? -pDy : pDy) - pInnerH
    const pQyPos = pQy > 0

    const dDy = wy - dCy
    const dSy = dDy >= 0 ? 1 : -1
    const dQy = (dDy < 0 ? -dDy : dDy) - dInnerH
    const dQyPos = dQy > 0

    for (let px = 0; px < pngW; px++) {
      const wx = originX + px * stepX
      const pDx = wx - pCx
      const pSx = pDx >= 0 ? 1 : -1
      const pQx = (pDx < 0 ? -pDx : pDx) - pInnerW

      let sdA: number
      let gAx: number
      let gAy: number
      if (pQx > 0 && pQyPos) {
        const outLen = Math.hypot(pQx, pQy)
        sdA = outLen - pRad
        if (outLen > 1e-6) {
          const invLen = 1 / outLen
          gAx = pSx * pQx * invLen
          gAy = pSy * pQy * invLen
        } else {
          gAx = pSx * SQRT1_2
          gAy = pSy * SQRT1_2
        }
      } else if (pQx > pQy) {
        sdA = pQx - pRad
        gAx = pSx
        gAy = 0
      } else {
        sdA = pQy - pRad
        gAx = 0
        gAy = pSy
      }

      const dDx = wx - dCx
      const dSx = dDx >= 0 ? 1 : -1
      const dQx = (dDx < 0 ? -dDx : dDx) - dInnerW

      let sdB: number
      let gBx: number
      let gBy: number
      if (dQx > 0 && dQyPos) {
        const outLen = Math.hypot(dQx, dQy)
        sdB = outLen - dRad
        if (outLen > 1e-6) {
          const invLen = 1 / outLen
          gBx = dSx * dQx * invLen
          gBy = dSy * dQy * invLen
        } else {
          gBx = dSx * SQRT1_2
          gBy = dSy * SQRT1_2
        }
      } else if (dQx > dQy) {
        sdB = dQx - dRad
        gBx = dSx
        gBy = 0
      } else {
        sdB = dQy - dRad
        gBx = 0
        gBy = dSy
      }

      let sd: number
      let gx: number
      let gy: number
      if (smoothUnion) {
        const h = clamp01(0.5 + (sdB - sdA) * inv2K)
        sd = sdB + (sdA - sdB) * h - blendK * h * (1 - h)
        gx = gBx + (gAx - gBx) * h
        gy = gBy + (gAy - gBy) * h
      } else if (sdA <= sdB) {
        sd = sdA
        gx = gAx
        gy = gAy
      } else {
        sd = sdB
        gx = gBx
        gy = gBy
      }

      if (sd >= 0.5) {
        scanlines[offset++] = 128
        scanlines[offset++] = 128
        scanlines[offset++] = 128
        scanlines[offset++] = 0
      } else if (sd <= interiorGate) {
        scanlines[offset++] = 128
        scanlines[offset++] = 128
        scanlines[offset++] = 128
        scanlines[offset++] = 255
      } else {
        const distIn = sd < 0 ? -sd : 0
        const alpha = sd <= -0.5 ? 255 : Math.round((0.5 - sd) * 255)
        if (distIn >= effBezel) {
          scanlines[offset++] = 128
          scanlines[offset++] = 128
          scanlines[offset++] = 128
          scanlines[offset++] = alpha
        } else {
          const gLen = Math.hypot(gx, gy)
          let nx = 0
          let ny = 0
          if (gLen > 1e-6) {
            const invG = -1 / gLen
            nx = gx * invG
            ny = gy * invG
          }
          const m = Math.pow(Math.max(0, 1 - distIn * invBezel), safeFalloff)
          const amp = m * 127
          scanlines[offset++] = Math.round(128 + nx * amp)
          scanlines[offset++] = Math.round(128 + ny * amp)
          scanlines[offset++] = 128
          scanlines[offset++] = alpha
        }
      }
    }
  }
}

export function createMorphRefractMapBuilder(): MorphRefractMapBuilder {
  let prevKey = ''
  let prevDataUrl = ''
  let prevWidth = 0
  let prevHeight = 0

  return {
    build(params: MorphRefractMapParams): MorphRefractMapResult {
      const safeBezel = Math.max(1, params.bezel)
      const safeFalloff =
        params.falloff !== undefined && Number.isFinite(params.falloff) && params.falloff >= 0
          ? params.falloff
          : DEFAULT_FALLOFF
      const mapScale = params.mapScale && params.mapScale > 0 ? params.mapScale : DEFAULT_MAP_SCALE
      const cssW = Math.max(1, Math.round(params.bounds.width))
      const cssH = Math.max(1, Math.round(params.bounds.height))
      const pngW = Math.max(1, Math.round(cssW * mapScale))
      const pngH = Math.max(1, Math.round(cssH * mapScale))

      const key = buildQuantizedKey(
        cssW,
        cssH,
        pngW,
        pngH,
        params.bounds,
        params.platter,
        params.droplet,
        params.blendK,
        params.isMerged,
        safeBezel,
        safeFalloff,
      )

      if (key === prevKey && prevDataUrl) {
        return {
          dataUrl: prevDataUrl,
          width: prevWidth,
          height: prevHeight,
          changed: false,
        }
      }

      const rowBytes = 1 + pngW * 4
      const scanlines = ensureScanlineCapacity(pngH * rowBytes)
      const stepX = cssW / pngW
      const stepY = cssH / pngH
      const originX = params.bounds.x + 0.5 * stepX
      const originY = params.bounds.y + 0.5 * stepY

      const hasDroplet =
        !params.isMerged &&
        params.droplet !== null &&
        params.droplet.size.width > 0.01 &&
        params.droplet.size.height > 0.01

      if (!hasDroplet) {
        rasterizeSingleRectScanlines(
          scanlines,
          pngW,
          pngH,
          originX,
          originY,
          stepX,
          stepY,
          params.platter,
          safeBezel,
          safeFalloff,
        )
      } else {
        rasterizeDualShapeScanlines(
          scanlines,
          pngW,
          pngH,
          originX,
          originY,
          stepX,
          stepY,
          params.platter,
          params.droplet!,
          params.blendK,
          safeBezel,
          safeFalloff,
        )
      }

      const dataUrl = encodeStoredRgbaPngDataUrl(scanlines, pngW, pngH)
      prevKey = key
      prevDataUrl = dataUrl
      prevWidth = cssW
      prevHeight = cssH

      return {
        dataUrl,
        width: cssW,
        height: cssH,
        changed: true,
      }
    },

    reset(): void {
      prevKey = ''
      prevDataUrl = ''
      prevWidth = 0
      prevHeight = 0
    },
  }
}

/** Convenience stateless helper returning a 0.5x stored-PNG RGBA displacement+alpha data URL. */
export function buildMorphRefractMapDataUrl(params: MorphRefractMapParams): string {
  return createMorphRefractMapBuilder().build(params).dataUrl
}
