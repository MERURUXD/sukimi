import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'

export type SliderBox = {
  x: number
  y: number
  width: number
  height: number
}

export type SliderOrientation = 'horizontal' | 'vertical'
export type MaskMode = 'wrapper' | 'items'

export const DRAG_THRESHOLD = 4
export const RUBBER_RANGE = 48
export const RUBBER_MAX = 14
export const STRETCH = 1 / 5000
export const MAX_STRETCH = 0.16
export const LIFT_SCALE = 0.03

const DRAG_STIFFNESS = 680
const DRAG_DAMPING = 38
const SETTLE_STIFFNESS = 340
const SETTLE_DAMPING = 26
const LIFT_STIFFNESS = 420
const LIFT_DAMPING = 30
const SHIFT_FACTOR = 0.008
const MAX_SHIFT = 7
const VELOCITY_LOOKAHEAD = 0.055

/** React useId() 含冒号，作为 SVG <mask id> 与 url(#...) 时先做字符清洗 */
export function sanitizeMaskId(id: string): string {
  const clean = id.replace(/[^a-zA-Z0-9_-]/g, '')
  return clean || 'mask'
}

/** 越界时的平滑橡皮筋阻尼 */
export function rubberBand(value: number, min: number, max: number): number {
  if (value < min) return min - Math.atan((min - value) / RUBBER_RANGE) * RUBBER_MAX
  if (value > max) return max + Math.atan((value - max) / RUBBER_RANGE) * RUBBER_MAX
  return value
}

const boxCenter = (b: SliderBox, orientation: SliderOrientation) =>
  orientation === 'horizontal' ? b.x + b.width / 2 : b.y + b.height / 2

const boxSpan = (b: SliderBox, orientation: SliderOrientation) =>
  orientation === 'horizontal' ? b.width : b.height

/** 按滑块中心在相邻选项中心之间线性插值主轴尺寸 */
export function interpSpanAt(boxes: readonly SliderBox[], center: number, orientation: SliderOrientation): number {
  if (boxes.length === 0) return 0
  if (boxes.length === 1) return boxSpan(boxes[0], orientation)
  const firstCenter = boxCenter(boxes[0], orientation)
  if (center <= firstCenter) return boxSpan(boxes[0], orientation)
  const last = boxes[boxes.length - 1]
  const lastCenter = boxCenter(last, orientation)
  if (center >= lastCenter) return boxSpan(last, orientation)
  for (let i = 0; i < boxes.length - 1; i++) {
    const a = boxes[i]
    const b = boxes[i + 1]
    const ca = boxCenter(a, orientation)
    const cb = boxCenter(b, orientation)
    if (center >= ca && center <= cb) {
      const spanA = boxSpan(a, orientation)
      const spanB = boxSpan(b, orientation)
      if (cb === ca) return spanA
      const t = (center - ca) / (cb - ca)
      return spanA + (spanB - spanA) * t
    }
  }
  return boxSpan(last, orientation)
}

/** 找出沿主轴中心距离给定位置最近的选项索引 */
export function nearestBoxIndex(boxes: readonly SliderBox[], center: number, orientation: SliderOrientation): number {
  let best = -1
  let minDist = Infinity
  for (let i = 0; i < boxes.length; i++) {
    const d = Math.abs(boxCenter(boxes[i], orientation) - center)
    if (d < minDist) {
      minDist = d
      best = i
    }
  }
  return best
}

/** 阻尼谐振子解析解步进：低帧率下无条件稳定且与步长划分无关 */
export function stepSpring(
  val: number,
  vel: number,
  target: number,
  dt: number,
  stiffness: number,
  damping: number,
): [number, number] {
  if (dt <= 0) return [val, vel]
  const x0 = val - target
  if (stiffness <= 0) {
    if (damping > 0) {
      const decay = Math.exp(-damping * dt)
      return [val + (vel * (1 - decay)) / damping, vel * decay]
    }
    return [val + vel * dt, vel]
  }

  const alpha = damping / 2
  const disc = alpha * alpha - stiffness
  if (disc < -1e-9) {
    const wd = Math.sqrt(-disc)
    const decay = Math.exp(-alpha * dt)
    const c = Math.cos(wd * dt)
    const s = Math.sin(wd * dt)
    const b = (vel + alpha * x0) / wd
    const x = decay * (x0 * c + b * s)
    const nextVel = decay * ((b * wd - x0 * alpha) * c - (x0 * wd + b * alpha) * s)
    return [target + x, nextVel]
  }
  if (disc <= 1e-9) {
    const decay = Math.exp(-alpha * dt)
    const k = vel + alpha * x0
    const x = decay * (x0 + k * dt)
    const nextVel = decay * (vel - alpha * k * dt)
    return [target + x, nextVel]
  }
  const gamma = Math.sqrt(disc)
  const r1 = -alpha + gamma
  const r2 = -alpha - gamma
  const c1 = (vel - r2 * x0) / (2 * gamma)
  const c2 = (r1 * x0 - vel) / (2 * gamma)
  const e1 = Math.exp(r1 * dt)
  const e2 = Math.exp(r2 * dt)
  return [target + c1 * e1 + c2 * e2, c1 * r1 * e1 + c2 * r2 * e2]
}

/**
 * 计算光学放大镜克隆层相对于滑块窗口（pill）的位移，
 * 使放大围绕滑块中心径向展开并保持 mag=1 时逐像素对齐。
 */
export function computeLensTransform(
  pill: SliderBox,
  baseOffset: { x: number; y: number },
  mag: number,
  shiftX = 0,
  shiftY = 0,
): { tx: number; ty: number } {
  return {
    tx: (pill.width / 2) * (1 - mag) - (pill.x - baseOffset.x) * mag + shiftX,
    ty: (pill.height / 2) * (1 - mag) - (pill.y - baseOffset.y) * mag + shiftY,
  }
}

/** 由滑块瞬时速度与拖拽抬升量计算形变缩放 */
export function computePillStretch(vx: number, vy: number, lift = 0): { scaleX: number; scaleY: number } {
  const stretch = (v: number) => Math.min(Math.abs(v) * STRETCH, MAX_STRETCH)
  const sx = stretch(vx)
  const sy = stretch(vy)
  const liftScale = 1 + lift * LIFT_SCALE
  return {
    scaleX: (1 + sx - sy / 2) * liftScale,
    scaleY: (1 + sy - sx / 2) * liftScale,
  }
}

/**
 * 计算元素相对于容器（padding box 原点，含滚动内容坐标）的几何位置，
 * 优先累加 offsetParent 以免疫祖先 transform 与页面滚动。
 */
export function relativeBox(track: HTMLElement, item: HTMLElement): SliderBox {
  let x = 0
  let y = 0
  let cur: HTMLElement | null = item
  while (cur && cur !== track) {
    x += cur.offsetLeft
    y += cur.offsetTop
    const parent = cur.offsetParent as HTMLElement | null
    if (parent && parent !== track) {
      x += parent.clientLeft
      y += parent.clientTop
    }
    cur = parent
  }
  if (cur === track) {
    return { x, y, width: item.offsetWidth, height: item.offsetHeight }
  }
  const tr = track.getBoundingClientRect()
  const ir = item.getBoundingClientRect()
  if (tr.width > 0 || tr.height > 0 || ir.width > 0 || ir.height > 0) {
    const scaleX = track.offsetWidth > 0 && tr.width > 0 ? tr.width / track.offsetWidth : 1
    const scaleY = track.offsetHeight > 0 && tr.height > 0 ? tr.height / track.offsetHeight : 1
    return {
      x: (ir.left - tr.left) / scaleX - track.clientLeft + track.scrollLeft,
      y: (ir.top - tr.top) / scaleY - track.clientTop + track.scrollTop,
      width: ir.width / scaleX || item.offsetWidth,
      height: ir.height / scaleY || item.offsetHeight,
    }
  }
  return { x: item.offsetLeft, y: item.offsetTop, width: item.offsetWidth, height: item.offsetHeight }
}

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))

const boxesOverlap = (a: SliderBox, b: SliderBox) =>
  a.x + a.width > b.x + 0.5 &&
  a.x < b.x + b.width - 0.5 &&
  a.y + a.height > b.y + 0.5 &&
  a.y < b.y + b.height - 0.5

export interface UseOpticalSliderOptions {
  orientation?: SliderOrientation
  activeIndex: number
  itemSelector: string
  magnification?: number
  dragMagBoost?: number
  pillRadius?: number
  reduced: boolean
  maskMode: MaskMode
  maskIdPrefix?: string
  measureKey: string | number
  onCommit: (index: number) => void
  onMeasure?: (boxes: SliderBox[], baseOffset: SliderBox, track: HTMLElement) => void
}

type SpringState = {
  x: number
  vx: number
  tx: number
  y: number
  vy: number
  ty: number
  w: number
  vw: number
  tw: number
  h: number
  vh: number
  th: number
  lift: number
  vlift: number
  tlift: number
  initialized: boolean
  visible: boolean
}

type DragState = {
  active: boolean
  moved: boolean
  pointerId: number | null
  pointerType: string
  startClientX: number
  startClientY: number
  grabOffset: number
  startedOnPill: boolean
}

type ItemMaskEntry = {
  mask: SVGMaskElement | null
  bg: SVGRectElement | null
  hole: SVGRectElement | null
}

/**
 * 光学放大镜滑块 + 按住拖拽物理弹簧 Hook。
 * 支持 wrapper 单遮罩（顶栏/底栏/侧栏）与 items 逐项遮罩（Seg）。
 */
export function useOpticalSlider(options: UseOpticalSliderOptions) {
  const {
    orientation = 'horizontal',
    activeIndex,
    itemSelector,
    magnification = 1.08,
    dragMagBoost = 0.04,
    pillRadius = 999,
    reduced,
    maskMode,
    maskIdPrefix,
    measureKey,
    onCommit,
    onMeasure,
  } = options

  const rawId = useId()
  const maskId = sanitizeMaskId(maskIdPrefix ? `${maskIdPrefix}-${rawId}` : `optical-mask-${rawId}`)

  const trackRef = useRef<HTMLElement | null>(null)
  const baseRef = useRef<HTMLDivElement | null>(null)
  const pillBgRef = useRef<HTMLSpanElement | null>(null)
  const lensWinRef = useRef<HTMLDivElement | null>(null)
  const lensCloneRef = useRef<HTMLDivElement | null>(null)
  const maskRef = useRef<SVGMaskElement | null>(null)
  const maskBgRef = useRef<SVGRectElement | null>(null)
  const maskHoleRef = useRef<SVGRectElement | null>(null)
  const itemMasksRef = useRef(new Map<number, ItemMaskEntry>())

  const itemsRef = useRef<HTMLElement[]>([])
  const boxesRef = useRef<SliderBox[]>([])
  const baseOffsetRef = useRef<SliderBox>({ x: 0, y: 0, width: 0, height: 0 })
  const scrollableRef = useRef(false)
  const rafRef = useRef(0)
  const lastTimeRef = useRef(0)
  const suppressClickRef = useRef(false)
  const suppressTimerRef = useRef(0)
  const prevActiveRef = useRef(activeIndex)

  const latestRef = useRef({
    orientation,
    activeIndex,
    itemSelector,
    magnification,
    dragMagBoost,
    pillRadius,
    reduced,
    maskMode,
    maskId,
    onCommit,
    onMeasure,
  })
  useLayoutEffect(() => {
    latestRef.current = {
      orientation,
      activeIndex,
      itemSelector,
      magnification,
      dragMagBoost,
      pillRadius,
      reduced,
      maskMode,
      maskId,
      onCommit,
      onMeasure,
    }
  })

  const springRef = useRef<SpringState>({
    x: 0,
    vx: 0,
    tx: 0,
    y: 0,
    vy: 0,
    ty: 0,
    w: 0,
    vw: 0,
    tw: 0,
    h: 0,
    vh: 0,
    th: 0,
    lift: 0,
    vlift: 0,
    tlift: 0,
    initialized: false,
    visible: false,
  })

  const dragRef = useRef<DragState>({
    active: false,
    moved: false,
    pointerId: null,
    pointerType: '',
    startClientX: 0,
    startClientY: 0,
    grabOffset: 0,
    startedOnPill: false,
  })

  const windowCleanupRef = useRef<(() => void) | null>(null)

  const clearMasks = useCallback(() => {
    const base = baseRef.current
    if (base) {
      base.style.webkitMask = ''
      base.style.mask = ''
    }
    for (const item of itemsRef.current) {
      item.style.webkitMask = ''
      item.style.mask = ''
    }
  }, [])

  const paint = useCallback(() => {
    const {
      orientation: orient,
      activeIndex: idx,
      magnification: mag,
      dragMagBoost: boost,
      pillRadius: radius,
      reduced: isReduced,
      maskMode: mode,
      maskId: id,
    } = latestRef.current
    const pillBg = pillBgRef.current
    const lensWin = lensWinRef.current
    const lensClone = lensCloneRef.current
    const s = springRef.current
    const boxes = boxesRef.current

    if (isReduced) {
      if (lensWin) lensWin.style.display = 'none'
      clearMasks()
      const b = idx >= 0 ? boxes[idx] : undefined
      if (!pillBg) return
      if (!b) {
        pillBg.style.display = 'none'
        return
      }
      pillBg.style.display = ''
      pillBg.style.width = `${b.width.toFixed(2)}px`
      pillBg.style.height = `${b.height.toFixed(2)}px`
      pillBg.style.transform = `translate3d(${b.x.toFixed(2)}px, ${b.y.toFixed(2)}px, 0)`
      return
    }

    if (!s.visible || s.w <= 0 || s.h <= 0) {
      if (pillBg) pillBg.style.display = 'none'
      if (lensWin) lensWin.style.display = 'none'
      clearMasks()
      return
    }

    if (pillBg) {
      pillBg.style.display = ''
      pillBg.style.width = `${s.w.toFixed(2)}px`
      pillBg.style.height = `${s.h.toFixed(2)}px`
      const { scaleX, scaleY } = computePillStretch(s.vx, s.vy, s.lift)
      pillBg.style.transform = `translate3d(${s.x.toFixed(2)}px, ${s.y.toFixed(2)}px, 0) scale(${scaleX.toFixed(4)}, ${scaleY.toFixed(4)})`
    }

    const baseOffset = baseOffsetRef.current
    if (lensWin && lensClone) {
      lensWin.style.display = ''
      lensWin.style.width = `${s.w.toFixed(2)}px`
      lensWin.style.height = `${s.h.toFixed(2)}px`
      lensWin.style.transform = `translate3d(${s.x.toFixed(2)}px, ${s.y.toFixed(2)}px, 0)`

      const activeMag = mag + s.lift * boost
      const shiftX = orient === 'horizontal' ? clamp(s.vx * SHIFT_FACTOR, -MAX_SHIFT, MAX_SHIFT) : 0
      const shiftY = orient === 'vertical' ? clamp(s.vy * SHIFT_FACTOR, -MAX_SHIFT, MAX_SHIFT) : 0
      const { tx, ty } = computeLensTransform(
        { x: s.x, y: s.y, width: s.w, height: s.h },
        mode === 'wrapper' ? baseOffset : { x: 0, y: 0 },
        activeMag,
        shiftX,
        shiftY,
      )
      lensClone.style.transform = `translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, 0) scale(${activeMag.toFixed(4)})`
    }

    const holeR = Math.min(radius, s.w / 2, s.h / 2)
    if (mode === 'wrapper') {
      const base = baseRef.current
      const hole = maskHoleRef.current
      if (base && hole) {
        const maskUrl = `url(#${id})`
        base.style.webkitMask = maskUrl
        base.style.mask = maskUrl
        hole.setAttribute('x', (s.x - baseOffset.x).toFixed(2))
        hole.setAttribute('y', (s.y - baseOffset.y).toFixed(2))
        hole.setAttribute('width', Math.max(0, s.w).toFixed(2))
        hole.setAttribute('height', Math.max(0, s.h).toFixed(2))
        hole.setAttribute('rx', holeR.toFixed(2))
        hole.setAttribute('ry', holeR.toFixed(2))
      }
    } else {
      const pillBox: SliderBox = { x: s.x, y: s.y, width: s.w, height: s.h }
      const items = itemsRef.current
      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        const box = boxes[i]
        const entry = itemMasksRef.current.get(i)
        if (box && entry?.hole && boxesOverlap(pillBox, box)) {
          const itemMaskUrl = `url(#${id}-${i})`
          item.style.webkitMask = itemMaskUrl
          item.style.mask = itemMaskUrl
          entry.hole.setAttribute('x', (s.x - box.x).toFixed(2))
          entry.hole.setAttribute('y', (s.y - box.y).toFixed(2))
          entry.hole.setAttribute('width', Math.max(0, s.w).toFixed(2))
          entry.hole.setAttribute('height', Math.max(0, s.h).toFixed(2))
          entry.hole.setAttribute('rx', holeR.toFixed(2))
          entry.hole.setAttribute('ry', holeR.toFixed(2))
        } else {
          item.style.webkitMask = ''
          item.style.mask = ''
        }
      }
    }
  }, [clearMasks])

  const stopLoop = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = 0
    }
  }, [])

  const startLoop = useCallback(() => {
    if (latestRef.current.reduced) return
    if (rafRef.current) return
    lastTimeRef.current = performance.now()
    const step = (now: number) => {
      rafRef.current = 0
      const dt = now > lastTimeRef.current ? Math.min((now - lastTimeRef.current) / 1000, 0.04) : 1 / 60
      lastTimeRef.current = now

      const s = springRef.current
      const dragging = dragRef.current.moved
      const stiff = dragging ? DRAG_STIFFNESS : SETTLE_STIFFNESS
      const damp = dragging ? DRAG_DAMPING : SETTLE_DAMPING

      ;[s.x, s.vx] = stepSpring(s.x, s.vx, s.tx, dt, stiff, damp)
      ;[s.y, s.vy] = stepSpring(s.y, s.vy, s.ty, dt, stiff, damp)
      ;[s.w, s.vw] = stepSpring(s.w, s.vw, s.tw, dt, stiff, damp)
      ;[s.h, s.vh] = stepSpring(s.h, s.vh, s.th, dt, stiff, damp)
      ;[s.lift, s.vlift] = stepSpring(s.lift, s.vlift, s.tlift, dt, LIFT_STIFFNESS, LIFT_DAMPING)

      const settled =
        !dragRef.current.active &&
        Math.abs(s.tx - s.x) < 0.05 &&
        Math.abs(s.vx) < 0.2 &&
        Math.abs(s.ty - s.y) < 0.05 &&
        Math.abs(s.vy) < 0.2 &&
        Math.abs(s.tw - s.w) < 0.05 &&
        Math.abs(s.vw) < 0.2 &&
        Math.abs(s.th - s.h) < 0.05 &&
        Math.abs(s.vh) < 0.2 &&
        Math.abs(s.tlift - s.lift) < 0.005 &&
        Math.abs(s.vlift) < 0.02

      if (settled) {
        s.x = s.tx
        s.y = s.ty
        s.w = s.tw
        s.h = s.th
        s.lift = s.tlift
        s.vx = 0
        s.vy = 0
        s.vw = 0
        s.vh = 0
        s.vlift = 0
        paint()
        return
      }

      paint()
      rafRef.current = requestAnimationFrame(step)
    }
    rafRef.current = requestAnimationFrame(step)
  }, [paint])

  const snapToBox = useCallback(
    (b: SliderBox) => {
      const s = springRef.current
      s.x = s.tx = b.x
      s.y = s.ty = b.y
      s.w = s.tw = b.width
      s.h = s.th = b.height
      s.vx = s.vy = s.vw = s.vh = 0
      s.initialized = true
      s.visible = true
      stopLoop()
      paint()
    },
    [paint, stopLoop],
  )

  const measure = useCallback(() => {
    const track = trackRef.current
    if (!track) return
    const {
      orientation: orient,
      activeIndex: idx,
      itemSelector: selector,
      maskMode: mode,
      onMeasure: notifyMeasure,
    } = latestRef.current

    const items = Array.from(track.querySelectorAll<HTMLElement>(selector))
    const boxes = items.map((el) => relativeBox(track, el))
    const baseOffset =
      mode === 'wrapper' && baseRef.current
        ? relativeBox(track, baseRef.current)
        : { x: 0, y: 0, width: track.scrollWidth, height: track.scrollHeight }

    itemsRef.current = items
    boxesRef.current = boxes
    baseOffsetRef.current = baseOffset

    const scrollable =
      orient === 'horizontal'
        ? track.scrollWidth > track.clientWidth + 2
        : track.scrollHeight > track.clientHeight + 2
    scrollableRef.current = scrollable
    if (scrollable) track.dataset.scrollable = 'true'
    else delete track.dataset.scrollable

    if (mode === 'wrapper') {
      const base = baseRef.current
      const w = Math.ceil((base ? Math.max(base.scrollWidth, baseOffset.width) : track.scrollWidth) + 32)
      const h = Math.ceil((base ? Math.max(base.scrollHeight, baseOffset.height) : track.scrollHeight) + 32)
      if (maskRef.current) {
        maskRef.current.setAttribute('x', '-16')
        maskRef.current.setAttribute('y', '-16')
        maskRef.current.setAttribute('width', String(w))
        maskRef.current.setAttribute('height', String(h))
      }
      if (maskBgRef.current) {
        maskBgRef.current.setAttribute('x', '-16')
        maskBgRef.current.setAttribute('y', '-16')
        maskBgRef.current.setAttribute('width', String(w))
        maskBgRef.current.setAttribute('height', String(h))
      }
    } else {
      for (let i = 0; i < boxes.length; i++) {
        const entry = itemMasksRef.current.get(i)
        const b = boxes[i]
        if (!entry || !b) continue
        const w = Math.ceil(b.width + 32)
        const h = Math.ceil(b.height + 32)
        if (entry.mask) {
          entry.mask.setAttribute('x', '-16')
          entry.mask.setAttribute('y', '-16')
          entry.mask.setAttribute('width', String(w))
          entry.mask.setAttribute('height', String(h))
        }
        if (entry.bg) {
          entry.bg.setAttribute('x', '-16')
          entry.bg.setAttribute('y', '-16')
          entry.bg.setAttribute('width', String(w))
          entry.bg.setAttribute('height', String(h))
        }
      }
    }

    const cloneEl = lensCloneRef.current
    if (cloneEl) {
      if (mode === 'wrapper' && baseRef.current) {
        const w = Math.max(baseRef.current.scrollWidth, baseRef.current.offsetWidth)
        const h = Math.max(baseRef.current.scrollHeight, baseRef.current.offsetHeight)
        if (w > 0) cloneEl.style.width = `${w}px`
        if (h > 0) cloneEl.style.height = `${h}px`
      } else {
        cloneEl.style.width = `${Math.max(track.scrollWidth, track.clientWidth)}px`
        cloneEl.style.height = `${Math.max(track.scrollHeight, track.clientHeight)}px`
      }
    }

    notifyMeasure?.(boxes, baseOffset, track)

    const s = springRef.current
    const activeBox = idx >= 0 ? boxes[idx] : undefined
    if (!activeBox) {
      s.visible = false
      s.initialized = false
      stopLoop()
      paint()
      return
    }

    if (!dragRef.current.active) {
      if (!s.initialized || prevActiveRef.current === idx) {
        snapToBox(activeBox)
      } else {
        s.tx = activeBox.x
        s.ty = activeBox.y
        s.tw = activeBox.width
        s.th = activeBox.height
        s.visible = true
        startLoop()
      }
    }
  }, [paint, snapToBox, startLoop, stopLoop])

  useLayoutEffect(() => {
    const track = trackRef.current
    if (!track) return
    measure()

    let ro: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(measure)
      ro.observe(track)
      if (baseRef.current) ro.observe(baseRef.current)
      track.querySelectorAll(latestRef.current.itemSelector).forEach((el) => ro?.observe(el))
    }

    const mo = new MutationObserver(() => {
      if (ro) {
        ro.disconnect()
        ro.observe(track)
        if (baseRef.current) ro.observe(baseRef.current)
        track.querySelectorAll(latestRef.current.itemSelector).forEach((el) => ro?.observe(el))
      }
      measure()
    })
    mo.observe(track, { childList: true, subtree: maskMode === 'wrapper' })

    return () => {
      ro?.disconnect()
      mo.disconnect()
    }
  }, [maskMode, measure, measureKey])

  useLayoutEffect(() => {
    const s = springRef.current
    const boxes = boxesRef.current
    const activeBox = activeIndex >= 0 ? boxes[activeIndex] : undefined
    const prev = prevActiveRef.current
    prevActiveRef.current = activeIndex

    if (reduced) {
      stopLoop()
      paint()
      return
    }

    if (!activeBox) {
      s.visible = false
      s.initialized = false
      stopLoop()
      paint()
      return
    }

    if (dragRef.current.active) return

    if (!s.initialized) {
      snapToBox(activeBox)
    } else if (prev !== activeIndex) {
      s.tx = activeBox.x
      s.ty = activeBox.y
      s.tw = activeBox.width
      s.th = activeBox.height
      s.visible = true
      startLoop()
    }
  }, [activeIndex, reduced, magnification, dragMagBoost, pillRadius, paint, snapToBox, startLoop, stopLoop])

  useEffect(() => {
    return () => {
      stopLoop()
      windowCleanupRef.current?.()
      windowCleanupRef.current = null
      if (suppressTimerRef.current) {
        clearTimeout(suppressTimerRef.current)
        suppressTimerRef.current = 0
      }
    }
  }, [stopLoop])

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      const { reduced: isReduced, orientation: orient, activeIndex: idx } = latestRef.current
      if (isReduced) return
      if (e.pointerType === 'mouse' && e.button !== 0) return

      const track = trackRef.current
      if (!track) return
      measure()

      const boxes = boxesRef.current
      const items = itemsRef.current
      if (boxes.length === 0 || idx < 0 || !boxes[idx]) return

      if (scrollableRef.current && e.pointerType === 'touch') {
        const activeEl = items[idx]
        const hitActive = activeEl ? activeEl.contains(e.target as Node) : false
        if (!hitActive) return
      }

      const rect = track.getBoundingClientRect()
      const scaleX = track.offsetWidth > 0 && rect.width > 0 ? rect.width / track.offsetWidth : 1
      const scaleY = track.offsetHeight > 0 && rect.height > 0 ? rect.height / track.offsetHeight : 1
      const localX = (e.clientX - rect.left) / scaleX - track.clientLeft + track.scrollLeft
      const localY = (e.clientY - rect.top) / scaleY - track.clientTop + track.scrollTop

      const s = springRef.current
      const drag = dragRef.current
      drag.active = true
      drag.moved = false
      drag.pointerId = e.pointerId
      drag.pointerType = e.pointerType
      drag.startClientX = e.clientX
      drag.startClientY = e.clientY

      if (orient === 'horizontal') {
        drag.startedOnPill = localX >= s.x - 4 && localX <= s.x + s.w + 4
        drag.grabOffset = drag.startedOnPill ? localX - s.x : s.w / 2
      } else {
        drag.startedOnPill = localY >= s.y - 4 && localY <= s.y + s.h + 4
        drag.grabOffset = drag.startedOnPill ? localY - s.y : s.h / 2
      }

      s.tlift = 1
      startLoop()

      windowCleanupRef.current?.()

      const cleanupListeners = () => {
        window.removeEventListener('pointermove', handleMove)
        window.removeEventListener('pointerup', handleUp)
        window.removeEventListener('pointercancel', handleCancel)
        windowCleanupRef.current = null
      }

      const handleMove = (ev: PointerEvent) => {
        if (!drag.active || ev.pointerId !== drag.pointerId) return
        const { orientation: curOrient } = latestRef.current
        const isHoriz = curOrient === 'horizontal'
        const dx = ev.clientX - drag.startClientX
        const dy = ev.clientY - drag.startClientY
        const mainDelta = isHoriz ? Math.abs(dx) : Math.abs(dy)
        const crossDelta = isHoriz ? Math.abs(dy) : Math.abs(dx)

        if (!drag.moved) {
          if (drag.pointerType === 'touch' && crossDelta > 10 && crossDelta > mainDelta * 1.35) {
            drag.active = false
            drag.pointerId = null
            s.tlift = 0
            cleanupListeners()
            startLoop()
            return
          }
          if (mainDelta <= DRAG_THRESHOLD) return
          drag.moved = true
          track.dataset.dragging = 'true'
          try {
            track.setPointerCapture?.(ev.pointerId)
          } catch {
            // 测试替身或已释放指针时忽略
          }
        }

        const curRect = track.getBoundingClientRect()
        const curBoxes = boxesRef.current
        if (curBoxes.length === 0) return
        const first = curBoxes[0]
        const last = curBoxes[curBoxes.length - 1]

        if (isHoriz) {
          const sx = track.offsetWidth > 0 && curRect.width > 0 ? curRect.width / track.offsetWidth : 1
          const lx = (ev.clientX - curRect.left) / sx - track.clientLeft + track.scrollLeft
          const approxCenter = drag.startedOnPill ? lx - drag.grabOffset + s.w / 2 : lx
          const w = interpSpanAt(curBoxes, approxCenter, 'horizontal')
          const minX = first.x
          const maxX = Math.max(minX, last.x + last.width - w)
          const rawX = drag.startedOnPill ? lx - drag.grabOffset : lx - w / 2
          s.tw = w
          s.tx = rubberBand(rawX, minX, maxX)
          s.ty = first.y
          s.th = first.height
        } else {
          const sy = track.offsetHeight > 0 && curRect.height > 0 ? curRect.height / track.offsetHeight : 1
          const ly = (ev.clientY - curRect.top) / sy - track.clientTop + track.scrollTop
          const approxCenter = drag.startedOnPill ? ly - drag.grabOffset + s.h / 2 : ly
          const h = interpSpanAt(curBoxes, approxCenter, 'vertical')
          const minY = first.y
          const maxY = Math.max(minY, last.y + last.height - h)
          const rawY = drag.startedOnPill ? ly - drag.grabOffset : ly - h / 2
          s.th = h
          s.ty = rubberBand(rawY, minY, maxY)
          s.tx = first.x
          s.tw = first.width
        }
        startLoop()
      }

      const finish = (ev: PointerEvent, cancelled: boolean) => {
        if (!drag.active || ev.pointerId !== drag.pointerId) return
        const wasMoved = drag.moved
        drag.active = false
        drag.moved = false
        drag.pointerId = null
        delete track.dataset.dragging
        try {
          if (track.hasPointerCapture?.(ev.pointerId)) track.releasePointerCapture(ev.pointerId)
        } catch {
          // 忽略测试环境指针捕获差异
        }
        cleanupListeners()

        s.tlift = 0
        if (!wasMoved) {
          startLoop()
          return
        }

        suppressClickRef.current = true
        if (suppressTimerRef.current) clearTimeout(suppressTimerRef.current)
        suppressTimerRef.current = window.setTimeout(() => {
          suppressClickRef.current = false
          suppressTimerRef.current = 0
        }, 80)

        const { orientation: curOrient, activeIndex: curIdx, onCommit: commit } = latestRef.current
        const curBoxes = boxesRef.current
        if (cancelled) {
          const fallback = curIdx >= 0 ? curBoxes[curIdx] : undefined
          if (fallback) {
            s.tx = fallback.x
            s.ty = fallback.y
            s.tw = fallback.width
            s.th = fallback.height
          }
          startLoop()
          return
        }

        const projectedCenter =
          curOrient === 'horizontal'
            ? s.x + s.w / 2 + s.vx * VELOCITY_LOOKAHEAD
            : s.y + s.h / 2 + s.vy * VELOCITY_LOOKAHEAD
        const targetIndex = nearestBoxIndex(curBoxes, projectedCenter, curOrient)
        const targetBox = targetIndex >= 0 ? curBoxes[targetIndex] : undefined
        if (targetBox) {
          s.tx = targetBox.x
          s.ty = targetBox.y
          s.tw = targetBox.width
          s.th = targetBox.height
          if (targetIndex !== curIdx) commit(targetIndex)
        }
        startLoop()
      }

      const handleUp = (ev: PointerEvent) => finish(ev, false)
      const handleCancel = (ev: PointerEvent) => finish(ev, true)

      window.addEventListener('pointermove', handleMove)
      window.addEventListener('pointerup', handleUp)
      window.addEventListener('pointercancel', handleCancel)
      windowCleanupRef.current = cleanupListeners
    },
    [measure, startLoop],
  )

  const onClickCapture = useCallback((e: ReactMouseEvent<HTMLElement>) => {
    if (!suppressClickRef.current) return
    suppressClickRef.current = false
    if (suppressTimerRef.current) {
      clearTimeout(suppressTimerRef.current)
      suppressTimerRef.current = 0
    }
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const onDragStart = useCallback((e: React.DragEvent<HTMLElement>) => {
    e.preventDefault()
  }, [])

  const setItemMaskRef = useCallback(
    (index: number, part: keyof ItemMaskEntry) => (el: SVGMaskElement | SVGRectElement | null) => {
      let entry = itemMasksRef.current.get(index)
      if (!entry) {
        entry = { mask: null, bg: null, hole: null }
        itemMasksRef.current.set(index, entry)
      }
      if (part === 'mask') entry.mask = el as SVGMaskElement | null
      else if (part === 'bg') entry.bg = el as SVGRectElement | null
      else entry.hole = el as SVGRectElement | null
      if (!entry.mask && !entry.bg && !entry.hole) itemMasksRef.current.delete(index)
    },
    [],
  )

  const setTrackRef = useCallback((el: HTMLElement | null) => {
    trackRef.current = el
  }, [])

  return {
    maskId,
    setTrackRef,
    baseRef,
    pillBgRef,
    lensWinRef,
    lensCloneRef,
    maskRef,
    maskBgRef,
    maskHoleRef,
    setItemMaskRef,
    pointerProps: {
      onPointerDown,
      onClickCapture,
      onDragStart,
    },
  }
}
