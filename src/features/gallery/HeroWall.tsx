import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { LibraryManga } from '@/features/library/queries'
import { cn } from '@/lib/cn'
import { DESKTOP_GRID, HOME_WALL, MOBILE_GRID, assignSlots, cellIndex, clamp01, easeInOut, homeWallExtra, placeOrder, visibleCells } from './canvasMath'
import { useReducedMotionPref } from './hooks'
import { libraryCoversForReturn, type CoverRect } from './readMorph'
import { libraryRewind } from './coverLayout'
import { cellsInWindow, ensureWall, wallItem, wallScale, wallState, wallTransform } from './wall'

/** 从书库进来的过场：先停一下（书库的标题和工具栏在上面淡出），再飞上墙 */
const ENTRY_HOLD = 260
const ENTRY_DUR = 1500
/** 回书库的倒放稍快一点 */
const EXIT_DUR = 1100
/** 首页墙挂着时可用：把中间那块封面飞回书库的原位、墙转平，放完调 done（见 GalleryPage 的「返回书库」） */
let exitToLibrary: ((rects: ReadonlyMap<number, CoverRect>, done: () => void) => void) | null = null
export function flyWallToLibrary(rects: ReadonlyMap<number, CoverRect>, done: () => void) {
  if (!exitToLibrary || !rects.size) return false
  exitToLibrary(rects, done)
  return true
}

/** 仅开发环境：控制台 __heroWall.freeze(0.4) 把从书库进来的过场停在某个进度逐帧检查，freeze(null) 继续 */
let devFreeze: number | null = null
if (import.meta.env.DEV) (window as unknown as { __heroWall?: object }).__heroWall = { freeze: (k: number | null) => (devFreeze = k) }

/**
 * 画廊首页的倾斜封面墙。和画布进入过渡的第一帧完全一样：同一张交错网格、同样的排列（按收藏先后取模）、
 * 同样的缩放和倾角，整面墙缓慢向左流动。点「进入画布」后画布接着这面墙继续画，背景不会跳。
 *
 * 从书库点「画廊」进来时（entry）：墙先是平的，书库里看得见的那些封面摆在书库的原位、原大小，
 * 再一边飞向墙上各自的格子一边整面倾斜成墙；其余格子在途中淡入。和画布的进入过渡是同一个思路：一直是同一批元素在动。
 *
 * 墙按整个视口的大小画、中心对准首屏中心（画布第一帧也是这样对准的），超出首屏的部分被首屏裁掉。
 * 每帧只改格子的 transform，换成另一部时才换图；离开视野、标签页切到后台或减少动态效果时不流动。
 */
export function HeroWall({ items, mobile, entry, className }: { items: readonly LibraryManga[]; mobile: boolean; entry?: ReadonlyMap<number, CoverRect> | null; className?: string }) {
  const grid = mobile ? MOBILE_GRID : DESKTOP_GRID
  const reduced = useReducedMotionPref()
  // 宽度跟随首屏（滚动条出现、消失都会变），高度取视口：和画布第一帧的画面同样大小
  const [size, setSize] = useState(() => ({ w: document.documentElement.clientWidth, h: window.innerHeight }))
  const root = useRef<HTMLDivElement>(null)
  const plane = useRef<HTMLDivElement>(null)
  const drift = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const box = root.current?.parentElement
    if (!box) return
    const on = () => setSize({ w: box.clientWidth, h: window.innerHeight })
    on()
    const ro = new ResizeObserver(on)
    ro.observe(box)
    window.addEventListener('resize', on)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', on)
    }
  }, [])
  // 过场开始时墙是平的、没缩小，要多备一些格子
  const widePool = useMemo(
    () => visibleCells(0, 0, size.w, size.h, grid, { scale: HOME_WALL.scale, ...homeWallExtra(size.w, size.h) }).length + 24,
    [size, grid],
  )
  const [steadyPool, setSteadyPool] = useState<number | null>(null)
  const pool = steadyPool == null ? widePool : Math.min(steadyPool, widePool)
  const pendingExit = useRef<{ rects: ReadonlyMap<number, CoverRect>; done: () => void } | null>(null)
  // 书库来的才有叠在上面的书库封面（飞入、飞回用），其余的不渲染，少一半图片元素
  const overlay = !!entry || !!libraryCoversForReturn()

  const slots = useRef<(HTMLSpanElement | null)[]>([])
  const shown = useRef<(string | null)[]>([])
  const assigned = useRef(new Map<string, number>())
  /**
   * 过场的进度放在 ref 里：挂上后马上会量一次尺寸（滚动条出现）、副作用重跑，过场要接着播，不能被打断。
   * keys：哪一格接哪一张书库的封面，第一次算好就不变（格子按行列编号，墙流动时编号不变）
   */
  const intro = useRef<{ from: ReadonlyMap<number, CoverRect>; keys: Map<string, CoverRect & { id: number }> | null; start: number } | null>(
    entry && entry.size && !reduced ? { from: entry, keys: null, start: 0 } : null,
  )

  // 布局副作用：换页动画拍新画面之前就要摆好，从书库进来的第一帧封面才在原位
  useLayoutEffect(() => {
    const el = root.current
    if (!el || !items.length) return
    const { w, h } = size
    ensureWall(w, h, grid)
    const compact = () => setSteadyPool(Math.min(widePool, cellsInWindow(w, h, grid, 1, Math.max(grid.cw, grid.ch) * wallScale(1)).length + 16))

    /**
     * 书库那一块封面对应墙上的哪一块格子：按原来的行列（x / y 聚类）落到墙上同样行列的一块，
     * 整块的中心对准书库那块封面的中心（墙的奇数列错开半格）。
     */
    const blockFor = (from: ReadonlyMap<number, CoverRect>, box: DOMRect) => {
      const covers = [...from].map(([id, r]) => ({ ...r, id }))
      const rank = (vals: number[]) => {
        const uniq = [...new Set(vals.map((v) => Math.round(v / 4)))].sort((p, q) => p - q)
        return (v: number) => uniq.indexOf(Math.round(v / 4))
      }
      const colOf = rank(covers.map((r) => r.x))
      const rowOf = rank(covers.map((r) => r.y))
      const cols = Math.max(...covers.map((r) => colOf(r.x))) + 1
      const rows = Math.max(...covers.map((r) => rowOf(r.y))) + 1
      const lx = covers.reduce((n, r) => n + r.x + r.w / 2, 0) / covers.length - box.left
      const ly = covers.reduce((n, r) => n + r.y + r.h / 2, 0) / covers.length - box.top
      const ox = wallState.cx + w / 2 + HOME_WALL.slide
      const oy = wallState.cy + h / 2
      const c0 = Math.round((lx - ox - grid.cw / 2) / grid.px - (cols - 1) / 2)
      const r0 = Math.round((ly - oy - grid.ch / 2) / grid.py - (rows - 1) / 2)
      return new Map(covers.map((r) => [`${c0 + colOf(r.x)}:${r0 + rowOf(r.y)}`, r]))
    }
    type Fly = Map<string, { x: number; y: number; s: number; src: string | null }>
    const flyFrom = (keys: ReadonlyMap<string, CoverRect>, box: DOMRect): Fly =>
      new Map([...keys].map(([key, r]) => [key, { x: r.x - box.left, y: r.y - box.top, s: r.w / grid.cw, src: r.src }]))

    /*
     * 进场（从书库来）：书库的封面整块落到墙上，整齐地一起倾斜进墙里。墙的显示顺序换几格（placeOrder），
     * 让这些格子放的正好是同一部，落地后还是那张封面；书太少、两格撞到同一个位置换不了的，飞到后段由书库的封面淡成格子自己的封面。
     */
    const it = intro.current
    let origins: Fly | null = null
    if (it) {
      // 封面位置记的是屏幕坐标，按墙此刻的位置换算（尺寸变了墙会挪）
      const box = el.getBoundingClientRect()
      if (!it.keys) {
        it.keys = blockFor(it.from, box)
        const indexOf = new Map(items.map((m, i) => [m.id, i]))
        const wants = [...it.keys].map(([key, r]) => {
          const [c, rr] = key.split(':').map(Number)
          return [cellIndex(c, rr, items.length), indexOf.get(r.id) ?? -1] as const
        })
        wallState.order = placeOrder(items.length, wants).order
        wallState.landing = { cx: wallState.cx, cy: wallState.cy, keys: it.keys, from: it.from }
      }
      origins = flyFrom(it.keys, box)
    }

    /*
     * 出场（回书库）：倒着播。墙停止流动，中间那块格子先淡成书库的封面，再一起飞回书库的原位、墙同时转平，
     * 其余格子淡掉；书库页面出来时封面已经在原位（见 GalleryPage 的「返回书库」）。
     */
    let leave: {
      fly: Fly
      start: number
      dur: number
      done: () => void
      fired: boolean
      /** 墙从哪倒回哪；没有时（不知道落在哪）不倒 */
      rewind: { from: [number, number]; to: [number, number] } | null
    } | null = null

    let painted = ''
    let paintedOrder = wallState.order
    /** k：进场时 0 = 书库、1 = 墙；出场时 0 = 墙、1 = 书库 */
    const paint = (k = 1, fly: Fly | null = null, out = false) => {
      // 墙的程度：1 是倾斜的墙，0 是平铺在书库原位
      const e = fly ? (out ? 1 - k : k) : 1
      const ox = wallState.cx + w / 2 + HOME_WALL.slide
      const oy = wallState.cy + h / 2
      const flying = !!fly && e < 1
      const cells = flying
        ? visibleCells(ox, oy, w, h, grid, { scale: HOME_WALL.scale, ...homeWallExtra(w, h) })
        : cellsInWindow(w, h, grid, 1, Math.max(grid.cw, grid.ch) * wallScale(1)).map(({ cell }) => cell)
      // 普通流动只移动公共层；飞向书库时仍逐格插值，保留原来的落点和封面交接。
      if (drift.current) drift.current.style.transform = flying ? '' : `translate(${ox.toFixed(1)}px, ${oy.toFixed(1)}px)`
      if (plane.current) plane.current.style.transform = wallTransform(e)
      const signature = cells.map(c => c.key).join('|')
      if (!flying && painted === signature && paintedOrder === wallState.order) return
      painted = flying ? '' : signature
      paintedOrder = wallState.order
      const retained = new Map([...assigned.current].filter(([, slot]) => slot < pool))
      const next = assignSlots(retained, cells.map((c) => c.key), pool)
      assigned.current = next
      const used = new Set(next.values())
      slots.current.forEach((s, i) => {
        if (s && !used.has(i)) s.style.visibility = 'hidden'
      })
      for (const cell of cells) {
        const i = next.get(cell.key)
        const s = i === undefined ? null : slots.current[i]
        if (!s || i === undefined) continue
        const m = items[wallItem(cell.c, cell.r, items.length)]
        if (shown.current[i] !== m.thumbnailUrl) {
          shown.current[i] = m.thumbnailUrl
          const img = s.firstElementChild as HTMLImageElement
          img.style.visibility = ''
          if (m.thumbnailUrl) img.src = m.thumbnailUrl
          else img.removeAttribute('src')
        }
        s.style.visibility = ''
        const o = fly && e < 1 ? fly.get(cell.key) : undefined
        const over = s.children[1] as HTMLImageElement | undefined
        if (over) {
          if (o && o.src && o.src !== m.thumbnailUrl) {
            // 格子放的不是书库那一部：进场时后段淡成格子自己的封面，出场时一开始先淡成书库的封面
            if (over.getAttribute('src') !== o.src) over.src = o.src
            over.style.opacity = (out ? clamp01(k / 0.3) : 1 - clamp01((k - 0.62) / 0.33)).toFixed(3)
          } else if (over.style.opacity !== '0') over.style.opacity = '0'
        }
        if (o) {
          const x = o.x + (cell.x - o.x) * e
          const y = o.y + (cell.y - o.y) * e
          s.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0px) scale(${(o.s + (1 - o.s) * e).toFixed(4)})`
          s.style.opacity = ''
          s.style.zIndex = '1'
        } else {
          const x = flying ? cell.x : cell.c * grid.px
          const y = flying ? cell.y : cell.r * grid.py + (Math.abs(cell.c % 2) === 1 ? grid.py / 2 : 0)
          s.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`
          // 其余格子进场时在墙倾斜的途中淡入，出场时先淡掉
          s.style.opacity = fly && e < 1 ? (out ? 1 - clamp01(k / 0.45) : clamp01((k - 0.25) / 0.55)).toFixed(3) : ''
          s.style.zIndex = ''
        }
      }
    }

    let raf = 0
    let last = 0
    let visible = true
    const step = (now: number) => {
      const dt = last ? Math.min(48, now - last) : 16
      last = now
      if (leave) {
        leave.start ||= now
        const p = devFreeze ?? clamp01((now - leave.start) / leave.dur)
        let k = easeInOut(p)
        if (leave.rewind) {
          // 前半段墙倒回落地时的位置（那一块封面回到中间），稍后封面开始飞回书库、墙转平
          const r = easeInOut(clamp01(p / 0.55))
          const { from, to } = leave.rewind
          wallState.cx = from[0] + (to[0] - from[0]) * r
          wallState.cy = from[1] + (to[1] - from[1]) * r
          k = easeInOut(clamp01((p - 0.22) / 0.78))
        }
        paint(k, leave.fly, true)
        if (p >= 1 && !leave.fired) {
          // 停在书库原位那一帧，等换页
          leave.fired = true
          leave.done()
        }
        if (p < 1) raf = requestAnimationFrame(step)
        return
      }
      if (origins && it) {
        // 过场：停一下再飞，飞的同时墙也在流动
        it.start ||= now
        const k = devFreeze ?? easeInOut(clamp01((now - it.start - ENTRY_HOLD) / ENTRY_DUR))
        if (!reduced) wallState.cx -= dt * HOME_WALL.drift * k
        paint(k, origins)
        if (k >= 1) {
          origins = null
          intro.current = null
          // 落地时墙的位置（过场途中墙在流动）
          if (wallState.landing) wallState.landing.cx = wallState.cx
          compact()
        }
        raf = requestAnimationFrame(step)
        return
      }
      if (reduced) return
      // 从画布和阅读档案回来时，墙在换页动画里就接着流动，避免落地后停一下。
      wallState.cx -= dt * HOME_WALL.drift
      paint()
      raf = requestAnimationFrame(step)
    }
    const sync = () => {
      cancelAnimationFrame(raf)
      raf = 0
      last = 0
      if (leave || origins || (visible && !document.hidden && !reduced)) raf = requestAnimationFrame(step)
    }
    // 重跑时过场可能已经播了一段，从当前进度接着画
    paint(origins && it ? (it.start ? (devFreeze ?? easeInOut(clamp01((performance.now() - it.start - ENTRY_HOLD) / ENTRY_DUR))) : 0) : 1, origins)
    exitToLibrary = (rects, done) => {
      if (leave) return
      // 返回动画先恢复平铺所需的格子；新池挂好后再开始倒放，不能半途缺封面。
      if (pool < widePool) {
        pendingExit.current = { rects, done }
        setSteadyPool(null)
        return
      }
      origins = null
      intro.current = null
      const box = el.getBoundingClientRect()
      const rewind = libraryRewind(wallState.landing, rects, wallState.cx, wallState.cy)
      if (rewind) {
        // 倒回落地的位置，再由原来那一块格子飞回去；墙流动得越远，倒回去多给一点时间
        const dist = Math.hypot(rewind.from[0] - rewind.to[0], rewind.from[1] - rewind.to[1])
        leave = {
          fly: flyFrom(rewind.keys, box),
          start: 0,
          dur: EXIT_DUR + Math.min(500, dist * 0.12),
          done,
          fired: false,
          rewind,
        }
      } else {
        // 不知道落在哪（换过书库页面等）：在墙此刻的中间取一块，先淡成书库的封面再飞
        leave = { fly: flyFrom(blockFor(rects, box), box), start: 0, dur: EXIT_DUR, done, fired: false, rewind: null }
      }
      sync()
      // 标签页在后台时动画帧会停，到时间照样换页
      window.setTimeout(() => {
        // 开发时用 __heroWall.freeze 停住检查的不算
        if (leave && !leave.fired && devFreeze === null) {
          leave.fired = true
          leave.done()
        }
      }, leave.dur + 400)
    }
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting
      sync()
    })
    io.observe(el)
    document.addEventListener('visibilitychange', sync)
    if (pendingExit.current) {
      const pending = pendingExit.current
      pendingExit.current = null
      exitToLibrary(pending.rects, pending.done)
    } else if (!origins) compact()
    sync()
    return () => {
      cancelAnimationFrame(raf)
      io.disconnect()
      document.removeEventListener('visibilitychange', sync)
      exitToLibrary = null
    }
  }, [items, size, grid, pool, widePool, reduced])

  return (
    <div ref={root} data-hero-wall aria-hidden className={cn('pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2', className)} style={{ width: size.w, height: size.h }}>
      <div ref={plane} className="absolute inset-0 origin-center" style={{ perspective: 1100, transform: intro.current ? wallTransform(0) : wallTransform(1) }}>
        <div ref={drift} className="absolute inset-0 will-change-transform">
          {Array.from({ length: items.length ? pool : 0 }, (_, i) => (
            <span
              key={i}
              ref={(el) => {
                if (slots.current[i] !== el) shown.current[i] = null
                slots.current[i] = el
              }}
              className="cv absolute top-0 left-0 origin-top-left rounded-[14px]"
              style={{ width: grid.cw, visibility: 'hidden' }}
            >
              <img alt="" draggable={false} decoding="async" onError={(e) => (e.currentTarget.style.visibility = 'hidden')} />
              {/* 从书库飞进来时叠在上面的书库封面，飞到后段淡掉 */}
              {overlay && <img alt="" draggable={false} decoding="async" className="absolute inset-0" style={{ opacity: 0 }} />}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
