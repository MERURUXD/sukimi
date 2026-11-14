/**
 * Clean-room procedural canvas backdrop generator for the Sukimi Liquid Glass Morphing Menu PoC.
 *
 * Provides three rich visual presets (`'manga-shelf'`, `'editorial-contrast'`, `'vivid-mesh'`)
 * in both `'light'` and `'dark'` themes with draggable/animated scroll offset so bevel refraction,
 * frosted blur, rim highlights, and behind-luma adaptive contrast are clearly observable.
 *
 * All manga titles and artwork are 100% fictional and procedurally drawn.
 *
 * SPDX-License-Identifier: MPL-2.0
 */

import type { BackdropSceneHandle, Point, Size } from './contracts'

export type BackdropPreset = 'manga-shelf' | 'editorial-contrast' | 'vivid-mesh'

export interface BackdropPresetMeta {
  readonly id: BackdropPreset
  readonly labelEn: string
  readonly labelZh: string
}

export const BACKDROP_PRESETS: readonly BackdropPresetMeta[] = [
  { id: 'manga-shelf', labelEn: 'Manga Shelf', labelZh: '漫画书架' },
  { id: 'editorial-contrast', labelEn: 'Editorial Contrast', labelZh: '高对比刊页' },
  { id: 'vivid-mesh', labelEn: 'Vivid Mesh', labelZh: '流体渐变' },
] as const

export interface BackdropDrawOptions {
  theme: 'light' | 'dark'
  preset: BackdropPreset
  scrollOffset?: Point
  timeSec?: number
}

export interface BackdropSceneOptions extends BackdropDrawOptions {
  size: Size
  dpr: number
  version: number
}

interface FictionalMangaCard {
  readonly jpTitle: string
  readonly zhTitle: string
  readonly enTitle: string
  readonly volume: string
  readonly unread: number
  readonly palette: readonly [string, string, string]
  readonly motif: 'sun' | 'crescent' | 'grid' | 'wave' | 'diamond' | 'spiral'
}

const FICTIONAL_CARDS: readonly FictionalMangaCard[] = [
  {
    jpTitle: '蒼穹の残響',
    zhTitle: '苍穹回响',
    enTitle: 'ECHOES OF AZURE',
    volume: 'VOL. 04',
    unread: 12,
    palette: ['#0ea5e9', '#6366f1', '#1e1b4b'],
    motif: 'sun',
  },
  {
    jpTitle: '硝子と月影',
    zhTitle: '玻璃月影',
    enTitle: 'GLASS & MOONSHADOW',
    volume: 'VOL. 09',
    unread: 3,
    palette: ['#f43f5e', '#fb923c', '#4c0519'],
    motif: 'crescent',
  },
  {
    jpTitle: '鉄路の果て',
    zhTitle: '铁道尽头',
    enTitle: 'END OF THE LINE',
    volume: 'VOL. 11',
    unread: 7,
    palette: ['#10b981', '#14b8a6', '#064e3b'],
    motif: 'grid',
  },
  {
    jpTitle: '星屑図書館',
    zhTitle: '星屑图书馆',
    enTitle: 'STARDUST ARCHIVE',
    volume: 'VOL. 02',
    unread: 19,
    palette: ['#a855f7', '#ec4899', '#3b0764'],
    motif: 'spiral',
  },
  {
    jpTitle: '白夜の旋律',
    zhTitle: '白夜旋律',
    enTitle: 'MIDNIGHT CHORD',
    volume: 'VOL. 07',
    unread: 0,
    palette: ['#f59e0b', '#ef4444', '#451a03'],
    motif: 'wave',
  },
  {
    jpTitle: '風待ち港',
    zhTitle: '候风港',
    enTitle: 'WINDWARD HARBOR',
    volume: 'VOL. 06',
    unread: 5,
    palette: ['#3b82f6', '#06b6d4', '#172554'],
    motif: 'diamond',
  },
  {
    jpTitle: '紅蓮の書架',
    zhTitle: '红莲书架',
    enTitle: 'CRIMSON FOLIO',
    volume: 'VOL. 14',
    unread: 24,
    palette: ['#ef4444', '#f97316', '#450a0a'],
    motif: 'sun',
  },
  {
    jpTitle: '霧雨喫茶店',
    zhTitle: '雾雨咖啡馆',
    enTitle: 'DRIZZLE CAFE',
    volume: 'VOL. 03',
    unread: 2,
    palette: ['#84cc16', '#10b981', '#14532d'],
    motif: 'crescent',
  },
]

const FONT_STACK =
  '"Space Grotesk Variable", "Noto Sans SC Variable", "Hiragino Sans", "PingFang SC", system-ui, sans-serif'

function fillRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rad = Math.max(0, Math.min(r, w * 0.5, h * 0.5))
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, rad)
  ctx.fill()
}

function strokeRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rad = Math.max(0, Math.min(r, w * 0.5, h * 0.5))
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, rad)
  ctx.stroke()
}

function drawHalftoneGrid(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  step: number,
  radius: number,
  color: string,
): void {
  ctx.save()
  ctx.fillStyle = color
  const startCol = Math.floor(x / step)
  const endCol = Math.ceil((x + w) / step)
  const startRow = Math.floor(y / step)
  const endRow = Math.ceil((y + h) / step)

  ctx.beginPath()
  for (let row = startRow; row <= endRow; row++) {
    const cy = row * step
    const shift = (row & 1) === 0 ? 0 : step * 0.5
    for (let col = startCol; col <= endCol; col++) {
      const cx = col * step + shift
      ctx.moveTo(cx + radius, cy)
      ctx.arc(cx, cy, radius, 0, Math.PI * 2)
    }
  }
  ctx.fill()
  ctx.restore()
}

function drawCardMotif(
  ctx: CanvasRenderingContext2D,
  motif: FictionalMangaCard['motif'],
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  ctx.save()
  ctx.beginPath()
  ctx.rect(x, y, w, h)
  ctx.clip()

  const cx = x + w * 0.52
  const cy = y + h * 0.36
  const minDim = Math.min(w, h)

  if (motif === 'sun') {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.22)'
    ctx.beginPath()
    ctx.arc(cx, cy, minDim * 0.24, 0, Math.PI * 2)
    ctx.fill()

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)'
    ctx.lineWidth = 2
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2
      ctx.beginPath()
      ctx.moveTo(cx + Math.cos(a) * minDim * 0.29, cy + Math.sin(a) * minDim * 0.29)
      ctx.lineTo(cx + Math.cos(a) * minDim * 0.45, cy + Math.sin(a) * minDim * 0.45)
      ctx.stroke()
    }
  } else if (motif === 'crescent') {
    const outerR = minDim * 0.23
    const innerR = minDim * 0.2
    const dx = minDim * 0.09
    const dy = -minDim * 0.06
    const d = Math.hypot(dx, dy)
    const a = (outerR * outerR - innerR * innerR + d * d) / (2 * d)
    const phi = Math.atan2(dy, dx)
    const delta = Math.acos(Math.max(-1, Math.min(1, a / outerR)))
    const p1x = cx + outerR * Math.cos(phi + delta)
    const p1y = cy + outerR * Math.sin(phi + delta)
    const p2x = cx + outerR * Math.cos(phi - delta)
    const p2y = cy + outerR * Math.sin(phi - delta)
    const ix = cx + dx
    const iy = cy + dy
    const theta1 = Math.atan2(p1y - iy, p1x - ix)
    const theta2 = Math.atan2(p2y - iy, p2x - ix)

    ctx.fillStyle = 'rgba(255, 248, 220, 0.85)'
    ctx.beginPath()
    ctx.arc(cx, cy, outerR, phi + delta, phi - delta, false)
    ctx.arc(ix, iy, innerR, theta2, theta1, true)
    ctx.closePath()
    ctx.fill()
  } else if (motif === 'grid') {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)'
    ctx.lineWidth = 1.5
    for (let i = -3; i <= 3; i++) {
      ctx.beginPath()
      ctx.moveTo(cx + i * 24, y)
      ctx.lineTo(cx + i * 8, y + h)
      ctx.stroke()
    }
    for (let j = 1; j <= 5; j++) {
      const py = y + (j / 6) * h
      ctx.beginPath()
      ctx.moveTo(x, py)
      ctx.lineTo(x + w, py)
      ctx.stroke()
    }
  } else if (motif === 'spiral') {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.32)'
    ctx.lineWidth = 2
    for (let r = 14; r < minDim * 0.48; r += 13) {
      ctx.beginPath()
      ctx.arc(cx, cy, r, r * 0.08, r * 0.08 + Math.PI * 1.45)
      ctx.stroke()
    }
  } else if (motif === 'wave') {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.34)'
    ctx.lineWidth = 2.5
    for (let row = 0; row < 5; row++) {
      const baseY = y + h * 0.2 + row * 18
      ctx.beginPath()
      for (let px = x; px <= x + w; px += 8) {
        const py = baseY + Math.sin((px - x) * 0.08 + row * 0.9) * 8
        if (px === x) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.stroke()
    }
  } else {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)'
    ctx.lineWidth = 2
    ctx.translate(cx, cy)
    ctx.rotate(Math.PI / 4)
    for (let s = 22; s <= 76; s += 18) {
      ctx.strokeRect(-s * 0.5, -s * 0.5, s, s)
    }
  }

  ctx.restore()
}

function drawMangaCard(
  ctx: CanvasRenderingContext2D,
  card: FictionalMangaCard,
  x: number,
  y: number,
  w: number,
  h: number,
  isDark: boolean,
): void {
  ctx.save()

  // Cover art gradient
  const grad = ctx.createLinearGradient(x, y, x + w, y + h)
  grad.addColorStop(0, card.palette[0])
  grad.addColorStop(0.55, card.palette[1])
  grad.addColorStop(1, card.palette[2])
  ctx.fillStyle = grad
  fillRoundedRect(ctx, x, y, w, h, 14)

  // Screentone dot overlay in upper corner
  ctx.save()
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, 14)
  ctx.clip()
  drawHalftoneGrid(ctx, x, y, w, h * 0.65, 10, 1.3, 'rgba(255, 255, 255, 0.14)')
  ctx.restore()

  // Artwork motif
  drawCardMotif(ctx, card.motif, x, y, w, h)

  // Bottom legibility band
  const bandGrad = ctx.createLinearGradient(x, y + h * 0.45, x, y + h)
  bandGrad.addColorStop(0, 'rgba(10, 12, 18, 0)')
  bandGrad.addColorStop(1, 'rgba(8, 10, 15, 0.86)')
  ctx.fillStyle = bandGrad
  ctx.save()
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, 14)
  ctx.clip()
  ctx.fillRect(x, y + h * 0.45, w, h * 0.55)
  ctx.restore()

  // Volume tag
  ctx.fillStyle = 'rgba(255, 255, 255, 0.88)'
  ctx.font = `700 10px ${FONT_STACK}`
  ctx.fillText(card.volume, x + 12, y + 22)

  // Unread badge
  if (card.unread > 0) {
    const badgeW = card.unread >= 10 ? 28 : 22
    ctx.fillStyle = isDark ? 'rgba(15, 23, 42, 0.82)' : 'rgba(255, 255, 255, 0.92)'
    fillRoundedRect(ctx, x + w - badgeW - 10, y + 10, badgeW, 18, 9)
    ctx.fillStyle = isDark ? '#f8fafc' : '#0f172a'
    ctx.font = `700 10px ${FONT_STACK}`
    ctx.textAlign = 'center'
    ctx.fillText(String(card.unread), x + w - badgeW * 0.5 - 10, y + 22.5)
    ctx.textAlign = 'left'
  }

  // Titles (Japanese + Chinese + English)
  ctx.fillStyle = '#ffffff'
  ctx.font = `800 16px ${FONT_STACK}`
  ctx.fillText(card.jpTitle, x + 12, y + h - 38)

  ctx.fillStyle = 'rgba(255, 255, 255, 0.88)'
  ctx.font = `600 12px ${FONT_STACK}`
  ctx.fillText(card.zhTitle, x + 12, y + h - 21)

  ctx.fillStyle = 'rgba(255, 255, 255, 0.65)'
  ctx.font = `600 9px ${FONT_STACK}`
  ctx.fillText(card.enTitle, x + 12, y + h - 8)

  // Crisp inner stroke
  ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(15, 23, 42, 0.12)'
  ctx.lineWidth = 1
  strokeRoundedRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, 14)

  ctx.restore()
}

function drawMangaShelfPreset(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  isDark: boolean,
  scroll: Point,
  timeSec: number,
): void {
  // Base canvas surface
  ctx.fillStyle = isDark ? '#0b0d13' : '#f3f4f7'
  ctx.fillRect(0, 0, width, height)

  // Subtle ambient wash behind the bookshelf
  const wash = ctx.createRadialGradient(
    width * 0.35,
    height * 0.25,
    20,
    width * 0.5,
    height * 0.5,
    Math.max(width, height) * 0.85,
  )
  wash.addColorStop(0, isDark ? 'rgba(56, 189, 248, 0.13)' : 'rgba(59, 130, 246, 0.10)')
  wash.addColorStop(0.5, isDark ? 'rgba(236, 72, 153, 0.09)' : 'rgba(244, 63, 94, 0.07)')
  wash.addColorStop(1, 'rgba(0, 0, 0, 0)')
  ctx.fillStyle = wash
  ctx.fillRect(0, 0, width, height)

  // Editorial grid lines
  ctx.save()
  ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(15, 23, 42, 0.05)'
  ctx.lineWidth = 1
  const gridStep = 48
  const gxOffset = ((scroll.x % gridStep) + gridStep) % gridStep
  const gyOffset = ((scroll.y % gridStep) + gridStep) % gridStep
  ctx.beginPath()
  for (let gx = gxOffset; gx < width; gx += gridStep) {
    ctx.moveTo(gx + 0.5, 0)
    ctx.lineTo(gx + 0.5, height)
  }
  for (let gy = gyOffset; gy < height; gy += gridStep) {
    ctx.moveTo(0, gy + 0.5)
    ctx.lineTo(width, gy + 0.5)
  }
  ctx.stroke()
  ctx.restore()

  // Shelf cards
  const padX = 28
  const gap = 18
  const cardW = width < 540 ? 144 : 168
  const cardH = Math.round(cardW * 1.42)
  const cols = Math.max(2, Math.floor((width - padX * 2 + gap) / (cardW + gap)))
  const totalGridW = cols * cardW + (cols - 1) * gap
  const startX = (width - totalGridW) * 0.5 + (scroll.x % (cardW + gap))

  const rowStride = cardH + gap + 36
  const driftY = timeSec * 14
  const baseShiftY = ((scroll.y + driftY) % rowStride + rowStride) % rowStride

  for (let row = -1; row <= Math.ceil(height / rowStride) + 1; row++) {
    const ry = row * rowStride + baseShiftY - 40
    for (let col = -1; col <= cols; col++) {
      const rx = startX + col * (cardW + gap)
      const cardIndex = Math.abs(row * cols + col) % FICTIONAL_CARDS.length
      drawMangaCard(ctx, FICTIONAL_CARDS[cardIndex], rx, ry, cardW, cardH, isDark)
    }
  }

  // Top editorial header strip to create bright/dark transitions under top-anchored triggers
  const headerH = 68
  ctx.fillStyle = isDark ? 'rgba(15, 18, 26, 0.84)' : 'rgba(255, 255, 255, 0.86)'
  ctx.fillRect(0, 0, width, headerH)
  ctx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.08)'
  ctx.fillRect(0, headerH - 1, width, 1)

  ctx.fillStyle = isDark ? '#f8fafc' : '#0f172a'
  ctx.font = `800 18px ${FONT_STACK}`
  ctx.fillText('SUKIMI // 书库 SHELF', 28, 38)
  ctx.fillStyle = isDark ? 'rgba(248, 250, 252, 0.55)' : 'rgba(15, 23, 42, 0.55)'
  ctx.font = `500 11px ${FONT_STACK}`
  ctx.fillText('LIQUID GLASS OPTICS LAB · DRAG BACKDROP TO TEST REFRACTION', 28, 55)
}

function drawEditorialContrastPreset(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  isDark: boolean,
  scroll: Point,
): void {
  ctx.fillStyle = isDark ? '#09090b' : '#fafafa'
  ctx.fillRect(0, 0, width, height)

  const bandH = 112
  const shiftY = ((scroll.y % (bandH * 4)) + bandH * 4) % (bandH * 4)

  const specimens = [
    { bg: '#ffffff', fg: '#09090b', accent: '#ef4444', jp: '白黒コントラスト', zh: '极高对比黑白测试带', en: 'HIGH-KEY SPECIMEN 01' },
    { bg: '#09090b', fg: '#fafafa', accent: '#38bdf8', jp: '暗部適応透過率', zh: '暗底自适应对比度校验', en: 'LOW-KEY SPECIMEN 02' },
    { bg: '#f4f4f5', fg: '#18181b', accent: '#10b981', jp: 'ベベル屈折境界線', zh: '圆弧倒角折射与边缘高光', en: 'BEVEL REFRACTION 03' },
    { bg: '#18181b', fg: '#f4f4f5', accent: '#f59e0b', jp: '網点トーンパターン', zh: '漫画网点与细线可见性', en: 'HALFTONE & HAIRLINE 04' },
  ]

  for (let row = -4; row <= Math.ceil(height / bandH) + 4; row++) {
    const spec = specimens[((row % specimens.length) + specimens.length) % specimens.length]
    const y = row * bandH + shiftY - bandH * 2

    ctx.fillStyle = spec.bg
    ctx.fillRect(0, y, width, bandH)

    // Halftone screentone strip on the right side
    drawHalftoneGrid(ctx, width * 0.56, y, width * 0.44, bandH, 11, 2.2, spec.accent + '44')

    // Bold accent bar
    ctx.fillStyle = spec.accent
    ctx.fillRect(28 + (scroll.x % 40), y + 20, 6, bandH - 40)

    // Crisp multi-script typography
    ctx.fillStyle = spec.fg
    ctx.font = `900 28px ${FONT_STACK}`
    ctx.fillText(`${spec.jp} · ${spec.zh}`, 48, y + 52)

    ctx.fillStyle = spec.fg
    ctx.globalAlpha = 0.72
    ctx.font = `700 13px ${FONT_STACK}`
    ctx.fillText(`${spec.en}  //  0123456789  //  BEVEL 20 · REFRACTION 60 · BLUR 12`, 48, y + 80)
    ctx.globalAlpha = 1

    // Crisp hairline divider
    ctx.fillStyle = spec.accent
    ctx.fillRect(0, y + bandH - 2, width, 2)
  }
}

function drawVividMeshPreset(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  isDark: boolean,
  scroll: Point,
  timeSec: number,
): void {
  ctx.fillStyle = isDark ? '#070812' : '#eef2ff'
  ctx.fillRect(0, 0, width, height)

  const ox = scroll.x * 0.45 + Math.sin(timeSec * 0.5) * 18
  const oy = scroll.y * 0.45 + Math.cos(timeSec * 0.4) * 18

  const blobs: ReadonlyArray<{ x: number; y: number; r: number; c1: string; c2: string }> = isDark
    ? [
        { x: 0.22, y: 0.26, r: 0.48, c1: 'rgba(14, 165, 233, 0.72)', c2: 'rgba(14, 165, 233, 0)' },
        { x: 0.78, y: 0.24, r: 0.44, c1: 'rgba(236, 72, 153, 0.68)', c2: 'rgba(236, 72, 153, 0)' },
        { x: 0.52, y: 0.68, r: 0.52, c1: 'rgba(139, 92, 246, 0.65)', c2: 'rgba(139, 92, 246, 0)' },
        { x: 0.25, y: 0.82, r: 0.42, c1: 'rgba(16, 185, 129, 0.58)', c2: 'rgba(16, 185, 129, 0)' },
      ]
    : [
        { x: 0.22, y: 0.26, r: 0.48, c1: 'rgba(56, 189, 248, 0.82)', c2: 'rgba(56, 189, 248, 0)' },
        { x: 0.78, y: 0.24, r: 0.44, c1: 'rgba(251, 113, 133, 0.78)', c2: 'rgba(251, 113, 133, 0)' },
        { x: 0.52, y: 0.68, r: 0.52, c1: 'rgba(167, 139, 250, 0.72)', c2: 'rgba(167, 139, 250, 0)' },
        { x: 0.25, y: 0.82, r: 0.42, c1: 'rgba(52, 211, 153, 0.68)', c2: 'rgba(52, 211, 153, 0)' },
      ]

  const baseDim = Math.max(width, height)
  for (let i = 0; i < blobs.length; i++) {
    const b = blobs[i]
    const cx = width * b.x + ox * (i % 2 === 0 ? 1 : -0.7)
    const cy = height * b.y + oy * (i % 2 === 0 ? 0.8 : -0.9)
    const rad = baseDim * b.r
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad)
    g.addColorStop(0, b.c1)
    g.addColorStop(1, b.c2)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, width, height)
  }

  // Diagonal prismatic ribbons & dot matrix to make refraction bending dramatic
  ctx.save()
  ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.20)' : 'rgba(15, 23, 42, 0.14)'
  ctx.lineWidth = 2
  const stripeGap = 54
  const phase = ((scroll.x + scroll.y) % stripeGap + stripeGap) % stripeGap
  for (let x = -height + phase; x < width + height; x += stripeGap) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x + height * 0.55, height)
    ctx.stroke()
  }
  ctx.restore()

  drawHalftoneGrid(
    ctx,
    0,
    0,
    width,
    height,
    24,
    1.5,
    isDark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(15, 23, 42, 0.12)',
  )

  // Large display typography across the center
  ctx.save()
  ctx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.88)' : 'rgba(15, 23, 42, 0.86)'
  ctx.font = `900 44px ${FONT_STACK}`
  const textOffsetX = ((scroll.x % 240) + 240) % 240 - 120
  const textOffsetY = ((scroll.y % 180) + 180) % 180 - 90
  ctx.fillText('液態硝子 · LIQUID GLASS', 48 + textOffsetX * 0.25, height * 0.44 + textOffsetY * 0.25)
  ctx.font = `700 20px ${FONT_STACK}`
  ctx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.65)' : 'rgba(15, 23, 42, 0.65)'
  ctx.fillText('SDFS · CIRCULAR BEVEL · SMOOTH-MIN K=28 · ADAPTIVE CONTRAST', 50 + textOffsetX * 0.25, height * 0.44 + 34 + textOffsetY * 0.25)
  ctx.restore()
}

export function drawBackdropScene(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  options: BackdropDrawOptions,
): void {
  const isDark = options.theme === 'dark'
  const scroll = options.scrollOffset ?? { x: 0, y: 0 }
  const timeSec = options.timeSec ?? 0

  if (options.preset === 'editorial-contrast') {
    drawEditorialContrastPreset(ctx, width, height, isDark, scroll)
    return
  }

  if (options.preset === 'vivid-mesh') {
    drawVividMeshPreset(ctx, width, height, isDark, scroll, timeSec)
    return
  }

  drawMangaShelfPreset(ctx, width, height, isDark, scroll, timeSec)
}

export function createBackdropSceneHandle(options: BackdropSceneOptions): BackdropSceneHandle {
  const { size, dpr, version, theme, preset, scrollOffset, timeSec } = options
  return {
    size,
    dpr,
    version,
    source: (ctx, width, height) => {
      drawBackdropScene(ctx, width, height, { theme, preset, scrollOffset, timeSec })
    },
  }
}
