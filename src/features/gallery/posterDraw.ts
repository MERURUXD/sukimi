import { refreshAccessToken, tokenExpiring, useAuth } from '@/api/auth'
import { BRAND_BLUSH, BRAND_BLUSH_R, BRAND_BODY, BRAND_CENTER, BRAND_DARK, BRAND_EARS, BRAND_EYE, BRAND_EYES, BRAND_INNER, BRAND_LIGHT, BRAND_PINK } from '@/design/brand'
import { NEUTRAL, coverColor, rgbCss } from '@/lib/coverColor'
import { count } from '@/lib/format'
import type { Rgb } from '@/lib/palette'
import { monthLabel } from './GalleryHero'
import { POSTER_H, POSTER_W, fitLines, ringAngle, workHeading, type LibraryPoster, type PosterCover, type PosterModel, type StatsPoster, type WorkPoster } from './poster'
import { bestRun, kpiData, type KpiBar } from './stats'

/*
 * 用画布直接画出分享海报（1080 × 1350 的 PNG），不加依赖。
 * 只用画布 2D 的仿射变换、渐变和阴影：不用透视，也不用 ctx.filter（手机 Safari 不支持）。
 * 字体是应用自带的同源字体，封面和页面同源，画完可以导出。
 */

const SANS = '"Space Grotesk Variable", "Noto Sans SC Variable", "Microsoft YaHei", sans-serif'
const CJK = '"Noto Sans SC Variable", "Microsoft YaHei", sans-serif'
const BG = '#0b0b0d'
const INK = '#f4f4f5'
const ink = (a: number) => `rgba(244,244,245,${a})`
const white = (a: number) => `rgba(255,255,255,${a})`
const RAD = Math.PI / 180

type Ctx = CanvasRenderingContext2D
type Images = ReadonlyMap<string, HTMLImageElement | null>

function setFont(ctx: Ctx, weight: number, size: number, family = SANS, spacing = 0) {
  ctx.font = `${weight} ${size}px ${family}`
  // letterSpacing 较新（Safari 17 起），不支持时不加字距
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${spacing}px`
}

function text(ctx: Ctx, s: string, x: number, y: number, color: string, align: CanvasTextAlign = 'left', baseline: CanvasTextBaseline = 'alphabetic') {
  ctx.fillStyle = color
  ctx.textAlign = align
  ctx.textBaseline = baseline
  ctx.fillText(s, x, y)
}

/**
 * 字体按 unicode-range 分片加载，没在页面上出现过的字所在的分片还没下载：
 * 把海报上要画的字都交给 document.fonts.load，取完再画，否则会先用系统字体画出来
 */
async function loadFonts(strings: readonly string[]) {
  const chars = [...new Set(strings.join(''))].join('')
  const specs = [400, 500, 700, 900].flatMap((w) => [`${w} 40px "Noto Sans SC Variable"`, `${w} 40px "Space Grotesk Variable"`])
  await Promise.all(specs.map((s) => document.fonts.load(s, chars).catch(() => [])))
}

function loadImage(url: string) {
  return new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = url
  })
}

/** 取封面；单张失败画占位。令牌过期时封面 Cookie 也失效（见 CoverImg）：大半失败且令牌快过期时续期一次再取失败的 */
async function loadCovers(urls: readonly string[]): Promise<Images> {
  const uniq = [...new Set(urls)]
  let got = await Promise.all(uniq.map(loadImage))
  const failed = got.filter((x) => !x).length
  if (failed && failed * 2 >= uniq.length && useAuth.getState().status === 'signedIn' && tokenExpiring()) {
    try {
      await refreshAccessToken()
      got = await Promise.all(uniq.map((u, i) => got[i] ?? loadImage(u)))
    } catch {
      // 续期失败就用占位，海报照样能出
    }
  }
  return new Map(uniq.map((u, i) => [u, got[i]]))
}

/** 封面：按 object-fit: cover 裁进圆角框；没有图时画深灰占位，写上书名 */
function cover(ctx: Ctx, imgs: Images, c: PosterCover, x: number, y: number, w: number, h: number, r: number) {
  const img = c.url ? imgs.get(c.url) : null
  ctx.save()
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
  ctx.clip()
  if (img) {
    const s = Math.max(w / img.naturalWidth, h / img.naturalHeight)
    const iw = img.naturalWidth * s
    const ih = img.naturalHeight * s
    ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih)
  } else {
    ctx.fillStyle = '#1c1c20'
    ctx.fillRect(x, y, w, h)
    const size = Math.round(w * 0.09)
    setFont(ctx, 700, size, CJK)
    const lines = fitLines(c.title, w * 0.76, 3, (s) => ctx.measureText(s).width)
    const lh = size * 1.35
    lines.forEach((l, i) => text(ctx, l, x + w / 2, y + h / 2 + (i - (lines.length - 1) / 2) * lh, ink(0.55), 'center', 'middle'))
  }
  ctx.restore()
}

/** 左下角（或居中）的应用标志：圆角方块里的兔耳书签，和 favicon 一致 */
function brand(ctx: Ctx, x: number, y: number, center = false) {
  setFont(ctx, 700, 28)
  const total = 52 + 16 + ctx.measureText('Sukimi').width
  const sx = center ? x - total / 2 : x
  ctx.beginPath()
  ctx.roundRect(sx, y, 52, 52, 15)
  ctx.fillStyle = BRAND_DARK
  ctx.fill()
  ctx.beginPath()
  ctx.roundRect(sx + 0.5, y + 0.5, 51, 51, 14.5)
  ctx.strokeStyle = ink(0.14)
  ctx.lineWidth = 1
  ctx.stroke()
  brandGlyph(ctx, sx, y, 52)
  setFont(ctx, 700, 28)
  text(ctx, 'Sukimi', sx + 68, y + 27, INK, 'left', 'middle')
}

/** 在 size 见方的格子里画兔耳书签（与 public/favicon.svg 同样的位置和缩放） */
function brandGlyph(ctx: Ctx, x: number, y: number, size: number) {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(size / 512, size / 512)
  ctx.translate(256, 262)
  ctx.scale(0.76, 0.76)
  ctx.translate(-BRAND_CENTER.x, -BRAND_CENTER.y)
  ctx.fillStyle = BRAND_LIGHT
  ctx.fill(new Path2D(BRAND_EARS))
  ctx.fillStyle = BRAND_PINK
  ctx.fill(new Path2D(BRAND_INNER))
  ctx.fillStyle = BRAND_LIGHT
  ctx.fill(new Path2D(BRAND_BODY))
  ctx.fillStyle = BRAND_DARK
  for (const e of BRAND_EYES) {
    ctx.save()
    ctx.translate(e.cx, e.cy)
    ctx.rotate(BRAND_EYE.tilt * RAD)
    ctx.beginPath()
    ctx.roundRect(-BRAND_EYE.w / 2, -BRAND_EYE.h / 2, BRAND_EYE.w, BRAND_EYE.h, BRAND_EYE.w / 2)
    ctx.fill()
    ctx.restore()
  }
  ctx.fillStyle = BRAND_PINK
  for (const b of BRAND_BLUSH) {
    ctx.beginPath()
    ctx.ellipse(b.cx, b.cy, BRAND_BLUSH_R.x, BRAND_BLUSH_R.y, 0, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

/** 从圆心往外的一根圆头竖条：deg 从正上方顺时针，r0 是内端半径 */
function spoke(ctx: Ctx, cx: number, cy: number, deg: number, r0: number, len: number, w: number, color: string) {
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(deg * RAD)
  ctx.beginPath()
  ctx.roundRect(-w / 2, -(r0 + len), w, len, w / 2)
  ctx.fillStyle = color
  ctx.fill()
  ctx.restore()
}

const polar = (cx: number, cy: number, deg: number, r: number) => ({ x: cx + Math.sin(deg * RAD) * r, y: cy - Math.cos(deg * RAD) * r })

function ring(ctx: Ctx, cx: number, cy: number, r: number, color: string, dash?: number[]) {
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.strokeStyle = color
  ctx.lineWidth = 1.5
  ctx.setLineDash(dash ?? [])
  ctx.stroke()
  ctx.setLineDash([])
}

/** 椭圆光晕：画布的径向渐变只有正圆，竖向压扁成椭圆 */
function glow(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, color: string) {
  ctx.save()
  ctx.translate(cx, cy)
  ctx.scale(1, ry / rx)
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx)
  g.addColorStop(0, color)
  g.addColorStop(1, 'rgba(11,11,13,0)')
  ctx.fillStyle = g
  ctx.fillRect(-rx, -rx, rx * 2, rx * 2)
  ctx.restore()
}

/* ───── 书库 ───── */

const WALL = { tile: 168, gap: 20, tilt: -12, top: 900 }

function drawLibrary(ctx: Ctx, m: LibraryPoster, imgs: Images) {
  ctx.fillStyle = BG
  ctx.fillRect(0, 0, POSTER_W, POSTER_H)

  // 封面墙：整面墙绕上半部分的中心转一个角度；没有透视，上下两行压暗一点拉开层次
  const th = (WALL.tile * 3) / 2
  const rowH = th + WALL.gap
  const height = m.rows.length * rowH - WALL.gap
  ctx.save()
  ctx.beginPath()
  ctx.rect(0, 0, POSTER_W, WALL.top)
  ctx.clip()
  ctx.translate(POSTER_W / 2, WALL.top * 0.44)
  ctx.rotate(WALL.tilt * RAD)
  m.rows.forEach((row, r) => {
    ctx.globalAlpha = r === 0 || r === m.rows.length - 1 ? 0.7 : 1
    const shift = -((r * 97) % 188)
    row.forEach((c, i) => cover(ctx, imgs, c, -1050 + shift + i * (WALL.tile + WALL.gap), -height / 2 + r * rowH, WALL.tile, th, 10))
  })
  ctx.restore()
  const g = ctx.createLinearGradient(0, 0, 0, WALL.top)
  g.addColorStop(0, 'rgba(11,11,13,.35)')
  g.addColorStop(0.24, 'rgba(11,11,13,0)')
  g.addColorStop(0.66, 'rgba(11,11,13,.55)')
  g.addColorStop(1, BG)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, POSTER_W, WALL.top + 1)

  const L = 88
  const R = POSTER_W - 88
  setFont(ctx, 500, 22, CJK, 6.6)
  text(ctx, monthLabel(new Date(m.now)), L, 625, ink(0.7))
  setFont(ctx, 900, 104, CJK, -2)
  text(ctx, '每一部收藏，', L, 746, INK)
  text(ctx, '都在这面墙上。', L, 862, INK)

  // 左边：已读话数
  setFont(ctx, 500, 24, CJK)
  text(ctx, '已读', L, 980, ink(0.68))
  setFont(ctx, 700, 148, SANS, -4.4)
  const read = count(m.read)
  text(ctx, read, L, 1126, INK)
  const rw = ctx.measureText(read).width
  setFont(ctx, 500, 40, CJK)
  text(ctx, '话', L + rw + 14, 1126, INK)

  // 右边：数字一列右对齐，单位一列左对齐（画布没有等宽数字，靠对齐方式排整齐）
  setFont(ctx, 500, 24, CJK)
  const unitX = R - ctx.measureText('部').width
  const rows: [number, string][] = [
    [m.works, '部'],
    [m.chapters, '话'],
    [m.pages, '页'],
  ]
  rows.forEach(([v, u], i) => {
    const y = 1006 + i * 58
    setFont(ctx, 700, 44)
    text(ctx, count(v), unitX - 14, y, INK, 'right')
    setFont(ctx, 500, 24, CJK)
    text(ctx, u, unitX, y, ink(0.68))
  })

  brand(ctx, L, 1214)
  setFont(ctx, 400, 18, CJK)
  text(ctx, '页数按已知页数估算', R, 1246, ink(0.5), 'right')
}

/* ───── 阅读档案 ───── */

/** 表盘按档案页 StatsDial 的比例放大：刻度内径 112 → 140 */
const K = 1.25

function strip(ctx: Ctx, bars: readonly KpiBar[], x: number, bottom: number, width: number, height: number) {
  const step = width / bars.length
  const max = Math.max(1e-9, ...bars.map((b) => b.v))
  bars.forEach((b, i) => {
    const h = 3 + (b.v / max) * (height - 3)
    ctx.beginPath()
    ctx.roundRect(x + i * step, bottom - h, 3.5, h, 1.75)
    ctx.fillStyle = b.lit ? white(0.95) : b.on ? white(0.5) : white(0.14)
    ctx.fill()
  })
}

function drawStats(ctx: Ctx, m: StatsPoster, imgs: Images, colors: readonly Rgb[]) {
  const s = m.stats
  ctx.fillStyle = BG
  ctx.fillRect(0, 0, POSTER_W, POSTER_H)
  // 背景光晕取读得最多两部的封面主色，和档案页一样
  glow(ctx, POSTER_W * 0.22, POSTER_H * 0.18, POSTER_W * 0.7, POSTER_H * 0.46, rgbCss(colors[0] ?? NEUTRAL, 0.42))
  glow(ctx, POSTER_W * 0.84, POSTER_H * 0.34, POSTER_W * 0.6, POSTER_H * 0.4, rgbCss(colors[1] ?? NEUTRAL, 0.34))

  const L = 88
  const R = POSTER_W - 88
  const d = new Date(m.now)
  setFont(ctx, 500, 22, CJK, 6.6)
  text(ctx, '阅读档案', L, 100, ink(0.7))
  setFont(ctx, 500, 22)
  text(ctx, `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`, R, 100, ink(0.6), 'right')

  const cx = POSTER_W / 2
  const cy = 456
  const base = ctx.createRadialGradient(cx, cy, 0, cx, cy, 180 * K)
  base.addColorStop(0, white(0.07))
  base.addColorStop(0.66, white(0))
  ctx.fillStyle = base
  ctx.fillRect(cx - 180 * K, cy - 180 * K, 360 * K, 360 * K)
  ring(ctx, cx, cy, 188 * K, white(0.09))
  ring(ctx, cx, cy, 116 * K, white(0.07))
  // 每三小时一根辐条，夹在两根刻度之间，从内圈向外淡出
  for (let i = 0; i < 8; i++) {
    const deg = i * 45 + 7.5
    const a = polar(cx, cy, deg, 78 * K)
    const b = polar(cx, cy, deg, 168 * K)
    const g = ctx.createLinearGradient(a.x, a.y, b.x, b.y)
    g.addColorStop(0, white(0))
    g.addColorStop(1, white(0.16))
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.strokeStyle = g
    ctx.lineWidth = 1.5
    ctx.stroke()
  }
  ring(ctx, cx, cy, 166 * K, white(0.1), [6, 5])

  // 年轮：近半年每天一根，从正下方顺时针走到现在；最长连续的那一段点亮
  const run = bestRun(s.days)
  const dmax = Math.max(1, ...s.days.map((x) => x.count))
  s.days.forEach((x, i) => {
    const hot = !!run && i >= run.from && i <= run.to
    const len = (x.count ? 4 + (x.count / dmax) * 22 : 3) * K
    spoke(ctx, cx, cy, ringAngle(i, s.days.length), 204 * K, len, 2.8, x.future ? white(0.05) : !x.count ? white(0.1) : hot ? white(0.92) : white(0.42))
  })
  setFont(ctx, 400, 16, CJK)
  s.days.forEach((x, i) => {
    const day = new Date(x.date)
    if (day.getDate() !== 1) return
    const p = polar(cx, cy, ringAngle(i, s.days.length), 248 * K)
    text(ctx, `${day.getMonth() + 1} 月`, p.x, p.y, white(0.4), 'center', 'middle')
  })
  if (run && run.len > 1) {
    const p = polar(cx, cy, ringAngle((run.from + run.to) / 2, s.days.length), 274 * K)
    setFont(ctx, 700, 17, CJK)
    // 最长连续在最近几天时字落在表盘正下方，往上收一点，别贴着下面的四项数字
    text(ctx, `近半年最长连续 ${run.len} 天`, p.x, Math.min(p.y, 784), '#ffffff', 'center', 'middle')
  }

  // 24 小时刻度：读得最多的那格点亮
  const max = Math.max(1, ...s.hours)
  s.hours.forEach((n, h) => {
    const hot = h === s.peak
    ctx.save()
    if (hot) {
      ctx.shadowColor = white(0.85)
      ctx.shadowBlur = 16
    }
    spoke(ctx, cx, cy, h * 15, 112 * K, (6 + (n / max) * 44) * K, 10, hot ? '#ffffff' : n ? white(0.26) : white(0.1))
    ctx.restore()
  })
  // 生成海报的时刻
  const p = polar(cx, cy, (d.getHours() + d.getMinutes() / 60) * 15, 167 * K)
  ctx.save()
  ctx.shadowColor = '#ffffff'
  ctx.shadowBlur = 16
  ctx.beginPath()
  ctx.arc(p.x, p.y, 6, 0, Math.PI * 2)
  ctx.fillStyle = '#ffffff'
  ctx.fill()
  ctx.restore()
  setFont(ctx, 400, 17)
  for (const h of [0, 6, 12, 18]) {
    const q = polar(cx, cy, h * 15, 178 * K)
    text(ctx, String(h), q.x, q.y, ink(0.45), 'center', 'middle')
  }

  // 中间的大数字不能压到内圈的刻度（内径 140）：六位数时缩小
  let big = 84
  setFont(ctx, 700, big, SANS, -2.5)
  while (big > 48 && ctx.measureText(count(s.read)).width > 250) setFont(ctx, 700, (big -= 4), SANS, -big * 0.03)
  text(ctx, count(s.read), cx, 459, INK, 'center')
  setFont(ctx, 500, 22, CJK)
  text(ctx, '已读话数', cx, 500, ink(0.68), 'center')
  if (s.peak >= 0) {
    setFont(ctx, 400, 18, CJK)
    text(ctx, `${s.peak} 点读得最多`, cx, 530, ink(0.5), 'center')
  }

  // 四项数字，和档案页两侧的一样
  const { progress, rhythm } = kpiData(s, m.works, run)
  const colW = (R - L - 3 * 32) / 4
  ;[...progress, ...rhythm].forEach((k, i) => {
    const x = L + i * (colW + 32)
    setFont(ctx, 700, 52)
    text(ctx, k.text, x, 854, INK)
    const vw = ctx.measureText(k.text).width
    setFont(ctx, 500, 22, CJK)
    text(ctx, k.unit, x + vw + 4, 854, ink(0.7))
    // 书库很大时说明会比一列宽，缩小字号放下
    let size = 17
    setFont(ctx, 500, size, CJK)
    while (size > 12 && ctx.measureText(k.caption).width > colW) setFont(ctx, 500, --size, CJK)
    text(ctx, k.caption, x, 888, ink(0.62))
    strip(ctx, k.bars, x, 935, colW, 26)
  })

  // 读得最多的三部
  const colT = (R - L - 2 * 28) / 3
  m.top.forEach((t, i) => {
    const x = L + i * (colT + 28)
    cover(ctx, imgs, t.cover, x, 1000, 96, 144, 8)
    const tx = x + 114
    setFont(ctx, 400, 18, CJK)
    text(ctx, `${count(t.read)} 话`, tx, 1140, ink(0.6))
    setFont(ctx, 700, 22, CJK)
    const lines = fitLines(t.cover.title, colT - 114, 2, (q) => ctx.measureText(q).width)
    const first = 1112 - (lines.length - 1) * 29
    lines.forEach((l, j) => text(ctx, l, tx, first + j * 29, INK))
    setFont(ctx, 700, 40)
    text(ctx, String(i + 1).padStart(2, '0'), tx, first - 30, ink(0.42))
  })

  if (m.headline) {
    const h = m.headline
    let x = L
    const part = (str: string, weight: number, color: string) => {
      setFont(ctx, weight, 30, CJK)
      text(ctx, str, x, 1200, color)
      x += ctx.measureText(str).width
    }
    part(h.lead, 500, ink(0.86))
    if (h.strong) part(h.strong, 700, '#ffffff')
    part(h.tail, 500, ink(0.86))
  }

  brand(ctx, L, 1234)
  setFont(ctx, 400, 18, CJK)
  text(ctx, '时钟与年轮按每一话的最后阅读时间统计', R, 1266, ink(0.5), 'right')
}

/* ───── 单部 ───── */

function drawWork(ctx: Ctx, m: WorkPoster, imgs: Images, colors: readonly Rgb[]) {
  ctx.fillStyle = BG
  ctx.fillRect(0, 0, POSTER_W, POSTER_H)
  // 顶部底色取封面主色，往下渐渐沉到底色
  const g = ctx.createLinearGradient(0, 0, 0, POSTER_H * 0.72)
  g.addColorStop(0, rgbCss(colors[0] ?? NEUTRAL, 0.6))
  g.addColorStop(1, 'rgba(11,11,13,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, POSTER_W, POSTER_H)

  setFont(ctx, 500, 22, CJK, 6.6)
  text(ctx, workHeading(m.read, m.total), 88, 100, ink(0.72))

  // 封面：先画一块同样大小的底板投出阴影，再把封面裁进去
  const cw = 460
  const ch = 690
  const x = (POSTER_W - cw) / 2
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,.85)'
  ctx.shadowBlur = 120
  ctx.shadowOffsetY = 60
  ctx.beginPath()
  ctx.roundRect(x, 170, cw, ch, 18)
  ctx.fillStyle = BG
  ctx.fill()
  ctx.restore()
  cover(ctx, imgs, m.cover, x, 170, cw, ch, 18)

  // 书名：一行放不下时最多两行，还放不下就缩小字号
  const measure = (q: string) => ctx.measureText(q).width
  const fit = (px: number) => {
    setFont(ctx, 900, px, CJK, -px * 0.01)
    return fitLines(m.cover.title, 860, 2, measure)
  }
  let size = 84
  let lines = fit(size)
  if (lines.length > 1) {
    size = 64
    lines = fit(size)
    if (lines.at(-1)?.endsWith('…')) lines = fit((size = 52))
  }
  const top = 900 + size * 0.92
  lines.forEach((l, i) => text(ctx, l, POSTER_W / 2, top + i * size * 1.2, INK, 'center'))
  if (m.author) {
    setFont(ctx, 400, 28, CJK)
    text(ctx, fitLines(m.author, 860, 1, measure)[0], POSTER_W / 2, top + (lines.length - 1) * size * 1.2 + 52, ink(0.72), 'center')
  }

  // 进度：已读 / 共几话，下面一条细进度条
  const y = 1150
  const L = 180
  const R = POSTER_W - 180
  const pair = (label: string, num: string, tail: string, at: number, align: 'left' | 'right') => {
    setFont(ctx, 500, 26, CJK)
    const lw = ctx.measureText(label).width
    const tw = ctx.measureText(tail).width
    setFont(ctx, 700, 40)
    const nw = ctx.measureText(num).width
    const start = align === 'left' ? at : at - (lw + nw + tw)
    setFont(ctx, 500, 26, CJK)
    text(ctx, label, start, y, ink(0.72))
    setFont(ctx, 700, 40)
    text(ctx, num, start + lw, y, '#ffffff')
    setFont(ctx, 500, 26, CJK)
    text(ctx, tail, start + lw + nw, y, ink(0.72))
  }
  const status = m.status ? ` · ${m.status}` : ''
  if (m.read != null && m.total != null) {
    pair('已读 ', count(m.read), ' 话', L, 'left')
    pair('共 ', count(m.total), ` 话${status}`, R, 'right')
    if (m.total > 0) {
      ctx.beginPath()
      ctx.roundRect(L, y + 18, R - L, 6, 3)
      ctx.fillStyle = ink(0.16)
      ctx.fill()
      ctx.beginPath()
      ctx.roundRect(L, y + 18, Math.max(6, ((R - L) * Math.min(m.read, m.total)) / m.total), 6, 3)
      ctx.fillStyle = INK
      ctx.fill()
    }
  } else if (m.status) {
    setFont(ctx, 500, 26, CJK)
    text(ctx, m.status, POSTER_W / 2, y, ink(0.72), 'center')
  }

  brand(ctx, POSTER_W / 2, POSTER_H - 72 - 52, true)
}

/* ───── 出图 ───── */

function coversOf(m: PosterModel): PosterCover[] {
  if (m.kind === 'library') return m.rows.flat()
  if (m.kind === 'stats') return m.top.map((t) => t.cover)
  return [m.cover]
}

function stringsOf(m: PosterModel) {
  const common = ['Sukimi', '0123456789,./·%…—', '页数按已知页数估算', '时钟与年轮按每一话的最后阅读时间统计']
  const titles = coversOf(m).map((c) => c.title)
  if (m.kind === 'library') return [...common, ...titles, monthLabel(new Date(m.now)), '每一部收藏，都在这面墙上。已读部话页']
  if (m.kind === 'stats') {
    const k = kpiData(m.stats, m.works, null)
    return [...common, ...titles, '阅读档案已读话数点读得最多近半年最长连续天月', ...[...k.progress, ...k.rhythm].flatMap((x) => [x.unit, x.caption]), m.headline ? `${m.headline.lead}${m.headline.strong ?? ''}${m.headline.tail}` : '']
  }
  return [...common, ...titles, m.author ?? '', m.status ?? '', '已读完正在读在我的书库里共话 ']
}

async function colorsOf(m: PosterModel): Promise<Rgb[]> {
  if (m.kind === 'stats') {
    const [a, b] = m.top
    return Promise.all([coverColor(a?.cover.url), coverColor(b?.cover.url ?? a?.cover.url)])
  }
  if (m.kind === 'work') return [await coverColor(m.cover.url)]
  return []
}

/** 画出一张海报，返回 PNG。封面单张失败画占位；画布被污染（跨域封面）或导出失败时抛错 */
export async function renderPoster(m: PosterModel): Promise<Blob> {
  const urls = coversOf(m).flatMap((c) => (c.url ? [c.url] : []))
  const [imgs, colors] = await Promise.all([loadCovers(urls), colorsOf(m), loadFonts(stringsOf(m))])
  const canvas = document.createElement('canvas')
  canvas.width = POSTER_W
  canvas.height = POSTER_H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('无法创建画布')
  if (m.kind === 'library') drawLibrary(ctx, m, imgs)
  else if (m.kind === 'stats') drawStats(ctx, m, imgs, colors)
  else drawWork(ctx, m, imgs, colors)
  return new Promise<Blob>((resolve, reject) => {
    // 画布被跨域图片污染时 toBlob 直接抛 SecurityError，Promise 会转成 reject
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('导出图片失败'))), 'image/png')
  })
}
