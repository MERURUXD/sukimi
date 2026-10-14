import type { LibraryManga } from '@/features/library/queries'
import { DESKTOP_GRID, HOME_WALL, MOBILE_GRID, assignSlots, visibleCells, type Cell, type Grid } from './canvasMath'
import { WINDOW_K, WINDOW_K_ON, cellsInWindow, ensureWall, wallItem, wallRange, wallScale, wallState, wallTransform, windowCells, windowOrder } from './wall'
import { WINDOW_DUR, WINDOW_EASE, galleryPose, onWindowFinished, onWindowMotionFinished, shadeTransform, windowClip, type WindowPose } from './windowMotion'
import { createWindowCopy } from './windowCopy'

type Kind = 'window' | 'gallery'
interface Anchor {
  kind: Kind
  host: HTMLElement
  items: readonly LibraryManga[]
  mobile: boolean
  picks?: readonly number[]
  shade?: string
}
interface Flight {
  kind: 'open' | 'back'
  from: WindowPose
  w: number
  h: number
  target: Anchor | null
  waiting: boolean
  animations: Animation[]
  cancelFinish?: () => void
  timer: number
  resolve: () => void
  finished: Promise<void>
  copy: ReturnType<typeof createWindowCopy>
}

const activeTransition = () => (document as Document & { activeViewTransition?: ViewTransition | null }).activeViewTransition
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
const anchors = new Map<Kind, Anchor>()
let scene: ReturnType<typeof createScene> | null = null
let flight: Flight | null = null

const make = (className: string, parent?: HTMLElement) => {
  const el = document.createElement('div')
  el.className = className
  parent?.append(el)
  return el
}

/** 两个路由只登记取景位置；封面元素由这一个场景拥有，换页期间不会卸载重建。 */
export function attachWindowWall(anchor: Anchor) {
  anchors.set(anchor.kind, anchor)
  scene ??= createScene()
  if (flight) {
    if ((flight.kind === 'open' ? 'gallery' : 'window') === anchor.kind) {
      flight.target = anchor
      if (!flight.waiting) scene.transfer(flight.from, flight.w, flight.h)
      if (anchor.shade) scene.heroShade.style.background = anchor.shade
      waitForTransition(flight)
    }
  } else scene.attach(anchor)
  return () => {
    if (anchors.get(anchor.kind) === anchor) anchors.delete(anchor.kind)
    // StrictMode 和数据更新先清理再登记，等本次提交完成再决定是否释放场景。
    queueMicrotask(() => {
      if (flight?.copy && (flight.target ? !flight.target.host.isConnected : !anchors.size && !anchor.host.isConnected)) finish(flight)
      if (!flight && !anchors.size) { scene?.destroy(); scene = null }
    })
  }
}

export const windowWallBusy = () => !!flight
export const afterWindowWall = () => flight?.finished ?? Promise.resolve()
export const prepareWindowWall = () => { if (!flight && !reduced()) scene?.prepare() }

function createScene() {
  const root = make('gw-scene')
  root.setAttribute('aria-hidden', 'true')
  const frame = make('gw-frame', root)
  const tone = make('gwin-wall gw-tone', frame)
  const shift = make('gw-shift', tone)
  const plane = make('gwin-plane gw-plane', shift)
  const drift = make('gw-drift', plane)
  const homeShade = make('gwin-shade gw-home-shade', frame)
  const heroShade = make('gw-hero-shade', frame)
  let current: Anchor | null = null
  let assigned = new Map<string, number>()
  const slots: HTMLSpanElement[] = []
  const shown: (string | null | undefined)[] = []
  const placed: string[] = []
  let painted = ''
  let paintedItems: Anchor['items'] | null = null
  let paintedOrder: typeof wallState.order = null
  let raf = 0
  let last = 0
  let near = false
  const size = () => ({ w: root.clientWidth, h: root.clientHeight })

  const fillPool = (count: number) => {
    while (slots.length < count) {
      const s = document.createElement('span')
      s.className = 'cv gw-cover'
      s.style.visibility = 'hidden'
      const img = new Image()
      img.alt = ''; img.draggable = false; img.decoding = 'async'
      img.onerror = () => { img.style.visibility = 'hidden' }
      s.append(img); drift.append(s); slots.push(s)
    }
  }
  const place = (i: number, c: Cell, grid: Grid) => {
    const s = slots[i]
    const m = current!.items[wallItem(c.c, c.r, current!.items.length)]
    const img = s.firstElementChild as HTMLImageElement
    if (shown[i] !== m.thumbnailUrl) {
      shown[i] = m.thumbnailUrl
      img.style.visibility = ''
      if (m.thumbnailUrl) img.src = m.thumbnailUrl
      else img.removeAttribute('src')
    }
    const key = `${grid.cw}:${c.key}`
    if (placed[i] !== key) {
      placed[i] = key
      s.style.width = `${grid.cw}px`
      // 格子的坐标不随取景框和流动位置变化，橱窗揭开时无需重排已有封面。
      const y = c.r * grid.py + (Math.abs(c.c % 2) === 1 ? grid.py / 2 : 0)
      s.style.transform = `translate3d(${c.c * grid.px}px, ${y}px, 0)`
    }
  }
  const paint = (w: number, h: number, full = false) => {
    if (!current?.items.length || !w || !h) return
    const grid = current.mobile ? MOBILE_GRID : DESKTOP_GRID
    ensureWall(w, h, grid)
    const cells = full || current.kind === 'gallery'
      ? visibleCells(wallState.cx + w / 2 + HOME_WALL.slide, wallState.cy + h / 2, w, h, grid, wallRange(w, h, full ? WINDOW_K : 1))
      : cellsInWindow(w, h, grid, WINDOW_K, grid.ch * wallScale(WINDOW_K)).map(p => p.cell)
    const x = wallState.cx + w / 2 + HOME_WALL.slide
    const y = wallState.cy + h / 2
    // 同一批格子一起流动，只在边缘换格、尺寸或内容变化时更新封面。
    // 倾斜与展开仍在外层 plane 上，取景窗和整屏交接时沿用原有封面。
    drift.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`
    const signature = `${grid.cw}:${cells.map(c => c.key).join('|')}`
    if (painted === signature && paintedItems === current.items && paintedOrder === wallState.order) return
    painted = signature; paintedItems = current.items; paintedOrder = wallState.order
    fillPool(cells.length + 8)
    assigned = assignSlots(assigned, cells.map(c => c.key), slots.length)
    const used = new Set(assigned.values())
    slots.forEach((s, i) => { if (!used.has(i)) s.style.visibility = 'hidden' })
    for (const c of cells) {
      const i = assigned.get(c.key)!
      const s = slots[i]
      place(i, c, grid)
      s.style.visibility = ''
    }
  }
  const step = (now: number) => {
    const dt = last ? Math.min(48, now - last) : 0
    last = now
    // 普通换页的目标墙从首帧接着流动；只有橱窗展开、收回时才由飞行时间轴接管。
    if (!flight) {
      wallState.cx -= dt * HOME_WALL.drift
      const { w, h } = size(); paint(w, h)
    }
    raf = requestAnimationFrame(step)
  }
  const sync = () => {
    cancelAnimationFrame(raf); raf = 0; last = 0
    if (flight && reduced()) { if (flight.copy) finish(flight); else activeTransition()?.skipTransition() }
    if (!current || flight || !near || document.hidden) return
    const { w, h } = size(); paint(w, h)
    if (!reduced()) raf = requestAnimationFrame(step)
  }
  const io = new IntersectionObserver(([e]) => { near = e.isIntersecting; sync() }, { rootMargin: '400px 0px' })
  const ro = new ResizeObserver(sync)
  document.addEventListener('visibilitychange', sync)
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
  mq.addEventListener('change', sync)
  const resize = () => { if (flight) { if (flight.copy) finish(flight); else activeTransition()?.skipTransition() } }
  window.addEventListener('resize', resize)

  const attach = (a: Anchor) => {
    current = a
    io.disconnect(); ro.disconnect()
    root.classList.remove('gw-flying')
    root.style.cssText = ''
    frame.style.clipPath = ''
    tone.style.cssText = ''
    shift.style.transform = ''
    plane.style.cssText = ''
    homeShade.style.cssText = ''
    heroShade.style.cssText = ''
    root.dataset.wallKind = a.kind
    if (a.kind === 'gallery') {
      plane.style.transform = `${wallTransform(1)} rotateY(0deg)`
      tone.style.filter = 'grayscale(0)'; tone.style.opacity = '1'
      homeShade.style.opacity = '0'; heroShade.style.opacity = '1'
      heroShade.style.background = a.shade ?? ''
    } else {
      heroShade.style.opacity = '0'
      const grid = a.mobile ? MOBILE_GRID : DESKTOP_GRID
      const r = a.host.getBoundingClientRect()
      if (a.picks && !(wallState.sampled && wallState.sampled === wallState.order && wallState.order.length === a.items.length)) {
        ensureWall(r.width, r.height, grid)
        wallState.order = wallState.sampled = windowOrder(a.items.length, windowCells(r.width, r.height, grid), a.picks)
        wallState.landing = null
      }
    }
    a.host.append(root)
    near = a.kind === 'gallery' || (() => { const r = a.host.getBoundingClientRect(); return r.bottom > -400 && r.top < innerHeight + 400 })()
    io.observe(a.host); ro.observe(a.host)
    sync()
  }
  // 入口预取时只补隐藏元素，已有可见格子的位置和分配保持不动。
  const prepare = () => {
    if (!current || current.kind !== 'window') return
    const grid = current.mobile ? MOBILE_GRID : DESKTOP_GRID
    const cells = visibleCells(wallState.cx + innerWidth / 2 + HOME_WALL.slide, wallState.cy + innerHeight / 2, innerWidth, innerHeight, grid, wallRange(innerWidth, innerHeight, WINDOW_K))
    fillPool(cells.length + 8)
  }
  const transfer = (from: WindowPose, w: number, h: number) => {
    cancelAnimationFrame(raf); raf = 0
    io.disconnect(); ro.disconnect()
    root.classList.add('gw-flying')
    root.style.width = `${w}px`; root.style.height = `${h}px`
    plane.style.transition = 'none'; tone.style.transition = 'none'
    plane.style.transform = from.transform
    shift.style.transform = `translate(${from.x}px, ${from.y}px)`
    tone.style.filter = from.filter; tone.style.opacity = String(from.opacity)
    frame.style.clipPath = windowClip(from.box, from.radius, w, h)
    homeShade.style.opacity = String(from.shade)
    homeShade.style.transform = shadeTransform(from.box, w, h)
    heroShade.style.opacity = String(1 - from.shade)
    const parent = flight?.copy ? document.querySelector('.app-shell') ?? document.body : document.body
    parent.append(root)
    paint(w, h, true)
  }
  const destroy = () => {
    cancelAnimationFrame(raf); root.remove(); io.disconnect(); ro.disconnect()
    document.removeEventListener('visibilitychange', sync); mq.removeEventListener('change', sync)
    window.removeEventListener('resize', resize)
  }
  return { root, frame, tone, shift, plane, homeShade, heroShade, attach, prepare, transfer, destroy }
}

function begin(kind: Flight['kind'], from: WindowPose) {
  if (!scene || flight || reduced() || !document.startViewTransition) return false
  let resolve!: () => void
  const finished = new Promise<void>(r => { resolve = r })
  const copy = !window.matchMedia('(max-width: 767px)').matches ? createWindowCopy(kind) : null
  const f: Flight = { kind, from, w: innerWidth, h: innerHeight, target: null, waiting: false, animations: [], timer: 0, resolve, finished, copy }
  // 返回页会恢复浅色主题；先固定当前暗角颜色，避免途中重新解析 --bg。
  if (kind === 'back') scene.heroShade.style.background = getComputedStyle(scene.heroShade).backgroundImage
  flight = f
  document.documentElement.toggleAttribute(kind === 'open' ? 'data-gallery-window' : 'data-gallery-window-back', true)
  document.documentElement.toggleAttribute('data-gallery-window-live', !!copy)
  f.timer = window.setTimeout(() => finish(f), 8000)
  return true
}

/** 捕获实际 CSS 过渡中的姿态和明暗，快速点击或键盘进入也不会从灰色跳成彩色。 */
export function openWindowWall(win: HTMLElement) {
  if (!scene || !anchors.has('window')) return false
  const b = win.getBoundingClientRect()
  const p = getComputedStyle(scene.plane)
  const t = getComputedStyle(scene.tone)
  return begin('open', {
    box: b, radius: parseFloat(getComputedStyle(win).borderTopLeftRadius) || 0,
    x: b.left + b.width / 2 - innerWidth / 2, y: b.top + b.height / 2 - innerHeight / 2,
    transform: p.transform, filter: t.filter === 'none' ? 'grayscale(0)' : t.filter,
    opacity: parseFloat(t.opacity), shade: 1,
  })
}

export function closeWindowWall() {
  const a = anchors.get('gallery')
  return !!a && begin('back', galleryPose(a.host.getBoundingClientRect(), innerWidth, innerHeight))
}

function waitForTransition(f: Flight) {
  if (f.waiting) return
  f.waiting = true
  if (f.copy) {
    // 等本次路由提交及 ScrollManager 恢复滚动后再测量目标，不必等待浏览器捕获快照。
    queueMicrotask(() => {
      if (flight !== f) return
      play(f)
      f.copy?.play()
      f.cancelFinish = onWindowMotionFinished(f.animations, activeTransition(), () => finish(f))
    })
    return
  }
  const vt = activeTransition()
  if (!vt) { finish(f); return }
  f.cancelFinish = onWindowFinished(vt, () => finish(f))
  void vt.ready.then(() => {
    if (f.w !== innerWidth || f.h !== innerHeight || reduced()) vt.skipTransition()
    else play(f)
  }, () => {})
}

function play(f: Flight) {
  if (flight !== f || !scene || !f.target?.host.isConnected) return
  const a = f.target
  const rect = a.host.getBoundingClientRect()
  const win = a.kind === 'window' ? a.host.closest<HTMLElement>('.gwin') : null
  const up = !!win && (win.matches(':has(:focus-visible)') || (win.matches(':hover') && window.matchMedia('(hover: hover)').matches))
  if (win) { win.dataset.wallBusy = ''; win.toggleAttribute('data-on', up); win.style.setProperty('--tx', '0') }
  const to: WindowPose = a.kind === 'gallery' ? galleryPose(rect, f.w, f.h) : {
    box: rect, radius: parseFloat(getComputedStyle(win!).borderTopLeftRadius) || 0,
    x: rect.left + rect.width / 2 - f.w / 2, y: rect.top + rect.height / 2 - f.h / 2,
    transform: `${wallTransform(up ? WINDOW_K_ON : WINDOW_K)} rotateY(0deg)`,
    filter: `grayscale(${up ? 0 : 1})`, opacity: up ? 1 : 0.5, shade: 1,
  }
  if (a.kind === 'window' && (rect.bottom <= 0 || rect.top >= f.h)) {
    f.animations.push(scene.root.animate({ opacity: [1, 0] }, { duration: 250, fill: 'both' }))
    return
  }
  const opts: KeyframeAnimationOptions = { duration: WINDOW_DUR, easing: WINDOW_EASE, fill: 'both' }
  const from = f.from
  f.animations = [
    scene.frame.animate({ clipPath: [windowClip(from.box, from.radius, f.w, f.h), windowClip(to.box, to.radius, f.w, f.h)] }, opts),
    scene.shift.animate({ transform: [`translate(${from.x}px, ${from.y}px)`, `translate(${to.x}px, ${to.y}px)`] }, opts),
    scene.plane.animate({ transform: [from.transform, to.transform] }, opts),
    scene.tone.animate({ filter: [from.filter, to.filter], opacity: [from.opacity, to.opacity] }, opts),
    scene.homeShade.animate({ transform: [shadeTransform(from.box, f.w, f.h), shadeTransform(to.box, f.w, f.h)], opacity: [from.shade, to.shade] }, opts),
    scene.heroShade.animate({ opacity: [1 - from.shade, 1 - to.shade] }, opts),
  ]
}

function finish(f: Flight) {
  if (flight !== f) return
  window.clearTimeout(f.timer); f.cancelFinish?.()
  f.copy?.dispose()
  // 专用伪元素样式必须保留到整个 VT 结束，再把同一层放回目标页面。
  const target = f.target?.host.isConnected ? f.target : [...anchors.values()].find(a => a.host.isConnected)
  flight = null
  if (target) scene?.attach(target)
  else { scene?.destroy(); scene = null }
  f.animations.forEach(a => a.cancel())
  delete document.documentElement.dataset.galleryWindow
  delete document.documentElement.dataset.galleryWindowBack
  delete document.documentElement.dataset.galleryWindowLive
  document.querySelectorAll<HTMLElement>('[data-wall-busy]').forEach(el => delete el.dataset.wallBusy)
  f.resolve()
}
