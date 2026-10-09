/*
 * 无限画布的几何计算。纯函数：不碰 DOM，测试直接导入。
 *
 * 画布是一张交错的网格：奇数列下移半格。(ox, oy) 是第 0 列第 0 行格子左上角在屏幕上的位置，
 * 拖动只改这两个数；每帧只算视口附近的格子，按行列取模决定放哪一部，所以能朝任意方向无限拖动。
 */

export interface Grid {
  /** 封面宽高（2:3） */
  cw: number
  ch: number
  /** 列距、行距 */
  px: number
  py: number
}

export const DESKTOP_GRID: Grid = { cw: 208, ch: 312, px: 248, py: 356 }
/** 手机上封面和格距更小，同屏格子也少，减轻 3D 变换的负担 */
export const MOBILE_GRID: Grid = { cw: 124, ch: 186, px: 148, py: 214 }

/** 球面半径（像素）：越小，边上的封面退得越远、转得越厉害 */
export const SPHERE_R = 760

export interface Cell {
  c: number
  r: number
  key: string
  /** 格子左上角在屏幕上的位置（未做 3D 变换） */
  x: number
  y: number
  /** 格子中心相对屏幕中心，按球面半径归一 */
  nx: number
  ny: number
}

const stagger = (c: number, g: Grid) => (Math.abs(c % 2) === 1 ? g.py / 2 : 0)

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a)

/**
 * 横向相邻格子之间的书目步长：取约等于 √n 且与 n 互质的数。
 * 竖向相邻差 1、横向相邻差这个步长，n > 1 时相邻格子不会是同一部，整张网格也会把每一部都用上。
 */
export function columnStep(n: number) {
  if (n <= 2) return 1
  let a = Math.max(2, Math.round(Math.sqrt(n)))
  while (gcd(a, n) !== 1 || a % n === 0) a++
  return a
}

/** 第 c 列第 r 行放第几部 */
export function cellIndex(c: number, r: number, n: number) {
  if (n <= 0) return -1
  const i = (c * columnStep(n) + r) % n
  return i < 0 ? i + n : i
}

/**
 * 视口附近的格子。extraX / extraY 是额外多生成的范围（屏幕像素）：
 * 进入过渡时墙缩小又倾斜，要多一圈才能盖满画面。scale 是整面墙当前的缩放。
 */
export function visibleCells(ox: number, oy: number, w: number, h: number, g: Grid, { scale = 1, extraX = 0, extraY = 0 } = {}): Cell[] {
  const hw = w / 2 / scale + extraX + g.px
  const hh = h / 2 / scale + extraY + g.py / 2
  const cx = w / 2 - ox
  const cy = h / 2 - oy
  const out: Cell[] = []
  const c0 = Math.floor((cx - hw) / g.px)
  const c1 = Math.ceil((cx + hw) / g.px)
  for (let c = c0; c <= c1; c++) {
    const st = stagger(c, g)
    const r0 = Math.floor((cy - hh - st) / g.py)
    const r1 = Math.ceil((cy + hh - st) / g.py)
    for (let r = r0; r <= r1; r++) {
      const x = c * g.px + ox
      const y = r * g.py + oy + st
      out.push({ c, r, key: `${c}:${r}`, x, y, nx: (x + g.cw / 2 - w / 2) / SPHERE_R, ny: (y + g.ch / 2 - h / 2) / SPHERE_R })
    }
  }
  return out
}

/** 离屏幕中心最近的格子 */
export function nearestCell(cells: readonly Cell[]) {
  let best: Cell | undefined
  let d = Infinity
  for (const cell of cells) {
    const dd = cell.nx * cell.nx + cell.ny * cell.ny
    if (dd < d) {
      d = dd
      best = cell
    }
  }
  return best
}

/**
 * 球面上的姿态：离中心越远越往后退、越朝外侧转，透明度越低。
 * curve 0～1 是球面的程度（进入过渡时从 0 鼓起来）；focused 是中心那一格，往前顶一点。
 */
export function domePose(nx: number, ny: number, curve: number, focused: boolean) {
  const d2 = nx * nx + ny * ny
  return {
    z: (focused ? 120 : 50) * curve - d2 * 420 * curve,
    rx: -ny * 34 * curve,
    ry: nx * 34 * curve,
    opacity: focused ? 1 : 1 + (Math.max(0.12, 0.82 - d2 * 0.5) - 1) * curve,
  }
}

/** 停下后吸附到的位置：让最近的一格正好在屏幕中心 */
export function snapTarget(ox: number, oy: number, w: number, h: number, g: Grid) {
  const cc = Math.round((w / 2 - ox - g.cw / 2) / g.px)
  let best = { x: ox, y: oy, d: Infinity }
  for (let c = cc - 1; c <= cc + 1; c++) {
    const st = stagger(c, g)
    const r = Math.round((h / 2 - oy - st - g.ch / 2) / g.py)
    const x = w / 2 - g.cw / 2 - c * g.px
    const y = h / 2 - g.ch / 2 - r * g.py - st
    const d = (x - ox) ** 2 + (y - oy) ** 2
    if (d < best.d) best = { x, y, d }
  }
  return { x: best.x, y: best.y }
}

/** 让第 c 列第 r 行的格子正好在屏幕中心的偏移 */
export function centerOn(c: number, r: number, w: number, h: number, g: Grid) {
  return { x: w / 2 - g.cw / 2 - c * g.px, y: h / 2 - g.ch / 2 - r * g.py - stagger(c, g) }
}

/**
 * 当前中心附近、放着第 index 部的最近格子。只在附近 radius 圈里找（网格按步长循环，总能找到）。
 */
export function nearestCellOf(index: number, n: number, center: { c: number; r: number }, radius = 24) {
  let best: { c: number; r: number } | undefined
  let d = Infinity
  for (let dc = -radius; dc <= radius; dc++) {
    for (let dr = -radius; dr <= radius; dr++) {
      const c = center.c + dc
      const r = center.r + dr
      if (cellIndex(c, r, n) !== index) continue
      const dd = dc * dc + dr * dr
      if (dd < d) {
        d = dd
        best = { c, r }
      }
    }
  }
  return best
}

/** 松手后的惯性：每 16ms 衰减到 0.94 倍 */
export const decay = (v: number, dt: number) => v * 0.94 ** (dt / 16)

/** 甩动速度上限（像素 / 毫秒），太快会一下子跳过半个书库 */
export const MAX_SPEED = 4
export const clampSpeed = (v: number) => Math.max(-MAX_SPEED, Math.min(MAX_SPEED, v))

/** 过渡曲线 */
export const clamp01 = (x: number) => Math.max(0, Math.min(1, x))
export const easeInOut = (x: number) => {
  const t = clamp01(x)
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
}

/**
 * 进入过渡的各段进度（t 从 0 到 1；返回首页时倒着走）：
 * panel 首屏文字淡出 → wall 倾斜的墙转正放大 → dome 鼓成球面 → hud 界面淡入。
 */
export function introPhases(t: number) {
  return {
    panel: clamp01(t / 0.28),
    wall: easeInOut((t - 0.08) / 0.55),
    dome: easeInOut((t - 0.45) / 0.5),
    hud: clamp01((t - 0.7) / 0.3),
  }
}

/**
 * 格子池分配：上一帧就在的格子沿用原来的元素，新出现的格子用空出来的元素。
 * 元素只在换成另一部时才换图，拖动时不会整屏重新加载封面。池子不够时多出的格子不画。
 */
export function assignSlots(prev: ReadonlyMap<string, number>, keys: readonly string[], pool: number) {
  const next = new Map<string, number>()
  const fresh: string[] = []
  for (const key of keys) {
    const slot = prev.get(key)
    if (slot !== undefined && slot < pool) next.set(key, slot)
    else fresh.push(key)
  }
  const used = new Set(next.values())
  let cursor = 0
  for (const key of fresh) {
    while (cursor < pool && used.has(cursor)) cursor++
    if (cursor >= pool) break
    next.set(key, cursor)
    used.add(cursor++)
  }
  return next
}

/** 首页那面墙（过渡起点）的缩放与倾角：画布进入过渡从这里开始，首页按同样的参数画墙 */
export const HOME_WALL = { scale: 0.72, rotateX: 16, rotateZ: -12, slide: 180, drift: 0.035 }

/** 首页那面墙要多生成的范围：缩小又倾斜后，视口四角要靠外圈的格子盖住 */
export const homeWallExtra = (w: number, h: number, wall = 0) => ({
  extraX: (w / 2 / HOME_WALL.scale) * 0.25 * (1 - wall),
  extraY: (h / 2 / HOME_WALL.scale) * 0.5 * (1 - wall),
})

/**
 * 墙上的显示顺序：cellIndex 算出的位置 p 放第 order[p] 部，默认 order[p] = p（按收藏先后）。
 * 从书库进画廊时，书库的封面整块落到墙上一块格子里，要让这些格子正好放着同一部：
 * 把 wants 里的「位置 → 第几部」逐个用交换换进去。交换后仍是一个排列，相邻格子照样不会是同一部；
 * 同一个位置被要两次（书少、格子重复）时后来的作罢。fixed 是实际换上的位置。
 */
export function placeOrder(n: number, wants: readonly (readonly [number, number])[]) {
  const order = Array.from({ length: n }, (_, i) => i)
  const posOf = order.slice()
  const fixed = new Set<number>()
  const placed = new Set<number>()
  for (const [p, item] of wants) {
    if (p < 0 || p >= n || item < 0 || item >= n || fixed.has(p) || placed.has(item)) continue
    const q = posOf[item]
    ;[order[p], order[q]] = [order[q], order[p]]
    posOf[order[p]] = p
    posOf[order[q]] = q
    fixed.add(p)
    placed.add(item)
  }
  return { order, fixed }
}
