import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { LibraryManga } from '@/features/library/queries'
import { cn } from '@/lib/cn'
import { DESKTOP_GRID, HOME_WALL, MOBILE_GRID, assignSlots, cellIndex, centerOn, clamp01, easeInOut, homeWallExtra, placeOrder, visibleCells, type Grid } from './canvasMath'
import { useReducedMotionPref } from './hooks'
import { activeViewTransition, type CoverRect } from './readMorph'

/**
 * 首页墙的位置，首页和画布之间交接用：首页一直在写，进画布时画布从这里接着画；
 * 倒放回首页时画布写回来，首页从那里继续流动。整个页面会话内有效。
 * 记的是相对屏幕中心的偏移（ox - 宽 / 2）：首页和画布量到的宽度可能差一个滚动条，按左边记会错开半个滚动条宽。
 */
export const wallState: { cx: number; cy: number; grid: Grid | null; order: number[] | null } = { cx: NaN, cy: NaN, grid: null, order: null }

/**
 * 第 (c, r) 格放第几部。默认按收藏先后（cellIndex）；从书库进来时换过几格（wallState.order，见 placeOrder），
 * 首页的墙和画布都按它画，进画布时内容才接得上。编号、放映顺序、搜索仍按收藏先后。
 */
export function wallItem(c: number, r: number, n: number) {
  const p = cellIndex(c, r, n)
  const o = wallState.order
  return o && o.length === n && p >= 0 ? o[p] : p
}

/** 第 i 部在墙上的位置（cellIndex 的值），找最近放着它的格子用 */
export function wallPosOf(i: number, n: number) {
  const o = wallState.order
  return o && o.length === n ? o.indexOf(i) : i
}

/** 从书库进来的过场：先停一下（书库的标题和工具栏在上面淡出），再飞上墙 */
const ENTRY_HOLD = 260
const ENTRY_DUR = 1500

/** 仅开发环境：控制台 __heroWall.freeze(0.4) 把从书库进来的过场停在某个进度逐帧检查，freeze(null) 继续 */
let devFreeze: number | null = null
if (import.meta.env.DEV) (window as unknown as { __heroWall?: object }).__heroWall = { freeze: (k: number | null) => (devFreeze = k) }

const wallTransform = (k: number) =>
  `perspective(1800px) rotateX(${(HOME_WALL.rotateX * k).toFixed(3)}deg) rotateZ(${(HOME_WALL.rotateZ * k).toFixed(3)}deg) scale(${(1 + (HOME_WALL.scale - 1) * k).toFixed(4)})`

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
  const pool = useMemo(
    () => visibleCells(0, 0, size.w, size.h, grid, { scale: HOME_WALL.scale, ...homeWallExtra(size.w, size.h) }).length + 24,
    [size, grid],
  )

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
    if (wallState.grid !== grid || Number.isNaN(wallState.cx)) {
      const c = centerOn(0, 0, w, h, grid)
      Object.assign(wallState, { cx: c.x - w / 2, cy: c.y - h / 2, grid })
    }

    /*
     * 过场：书库的封面按原来的行列整块落到墙中间同样行列的一块格子上（墙的奇数列错开半格），
     * 整齐地一起倾斜进墙里。墙的显示顺序换几格（placeOrder），让这些格子放的正好是同一部，落地后还是那张封面；
     * 书太少、两格撞到同一个位置换不了的，飞到后段由书库的封面淡成格子自己的封面。
     */
    const it = intro.current
    let origins: Map<string, { x: number; y: number; s: number; src: string | null }> | null = null
    if (it) {
      // 封面位置记的是屏幕坐标，按墙此刻的位置换算（尺寸变了墙会挪）
      const box = el.getBoundingClientRect()
      if (!it.keys) {
        const covers = [...it.from].map(([id, r]) => ({ ...r, id }))
        const rank = (vals: number[]) => {
          const uniq = [...new Set(vals.map((v) => Math.round(v / 4)))].sort((p, q) => p - q)
          return (v: number) => uniq.indexOf(Math.round(v / 4))
        }
        const colOf = rank(covers.map((r) => r.x))
        const rowOf = rank(covers.map((r) => r.y))
        const cols = Math.max(...covers.map((r) => colOf(r.x))) + 1
        const rows = Math.max(...covers.map((r) => rowOf(r.y))) + 1
        // 整块的中心对准书库那一块封面的中心
        const lx = covers.reduce((n, r) => n + r.x + r.w / 2, 0) / covers.length - box.left
        const ly = covers.reduce((n, r) => n + r.y + r.h / 2, 0) / covers.length - box.top
        const ox = wallState.cx + w / 2 + HOME_WALL.slide
        const oy = wallState.cy + h / 2
        const c0 = Math.round((lx - ox - grid.cw / 2) / grid.px - (cols - 1) / 2)
        const r0 = Math.round((ly - oy - grid.ch / 2) / grid.py - (rows - 1) / 2)
        it.keys = new Map(covers.map((r) => [`${c0 + colOf(r.x)}:${r0 + rowOf(r.y)}`, r]))
        // 换墙的显示顺序：这些格子放书库里那一部
        const indexOf = new Map(items.map((m, i) => [m.id, i]))
        const wants = [...it.keys].map(([key, r]) => {
          const [c, rr] = key.split(':').map(Number)
          return [cellIndex(c, rr, items.length), indexOf.get(r.id) ?? -1] as const
        })
        wallState.order = placeOrder(items.length, wants).order
      }
      origins = new Map()
      for (const [key, r] of it.keys) origins.set(key, { x: r.x - box.left, y: r.y - box.top, s: r.w / grid.cw, src: r.src })
    }

    const paint = (k = 1) => {
      // 和画布过渡第一帧同样的偏移与范围
      const cells = visibleCells(wallState.cx + w / 2 + HOME_WALL.slide, wallState.cy + h / 2, w, h, grid, { scale: HOME_WALL.scale, ...homeWallExtra(w, h) })
      const next = assignSlots(assigned.current, cells.map((c) => c.key), pool)
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
        const o = origins && k < 1 ? origins.get(cell.key) : undefined
        const over = s.lastElementChild as HTMLImageElement
        if (o && o.src) {
          if (over.getAttribute('src') !== o.src) over.src = o.src
          over.style.opacity = (1 - clamp01((k - 0.62) / 0.33)).toFixed(3)
        } else if (over.style.opacity !== '0') over.style.opacity = '0'
        if (o) {
          const x = o.x + (cell.x - o.x) * k
          const y = o.y + (cell.y - o.y) * k
          s.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0px) scale(${(o.s + (1 - o.s) * k).toFixed(4)})`
          s.style.opacity = ''
          s.style.zIndex = '1'
        } else {
          s.style.transform = `translate3d(${cell.x.toFixed(1)}px, ${cell.y.toFixed(1)}px, 0px)`
          // 过场里其余格子在墙倾斜的途中淡入
          s.style.opacity = origins && k < 1 ? clamp01((k - 0.25) / 0.55).toFixed(3) : ''
          s.style.zIndex = ''
        }
      }
      if (plane.current) plane.current.style.transform = wallTransform(origins ? k : 1)
    }

    let raf = 0
    let last = 0
    let visible = true
    const step = (now: number) => {
      const dt = last ? Math.min(48, now - last) : 16
      last = now
      if (origins && it) {
        // 过场：停一下再飞，飞的同时墙也在流动
        it.start ||= now
        const k = devFreeze ?? easeInOut(clamp01((now - it.start - ENTRY_HOLD) / ENTRY_DUR))
        if (!reduced) wallState.cx -= dt * HOME_WALL.drift * k
        paint(k)
        if (k >= 1) {
          origins = null
          intro.current = null
        }
        raf = requestAnimationFrame(step)
        return
      }
      if (reduced) return
      // 换页动画期间不动：新页面是实时画面，墙每帧挪一下整页都要重画，飞行中的数字会卡；0.75 秒只差几个像素
      if (!activeViewTransition()) {
        wallState.cx -= dt * HOME_WALL.drift
        paint()
      }
      raf = requestAnimationFrame(step)
    }
    const sync = () => {
      cancelAnimationFrame(raf)
      raf = 0
      last = 0
      if (origins || (visible && !document.hidden && !reduced)) raf = requestAnimationFrame(step)
    }
    // 重跑时过场可能已经播了一段，从当前进度接着画
    paint(origins && it ? (it.start ? (devFreeze ?? easeInOut(clamp01((performance.now() - it.start - ENTRY_HOLD) / ENTRY_DUR))) : 0) : 1)
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting
      sync()
    })
    io.observe(el)
    document.addEventListener('visibilitychange', sync)
    sync()
    return () => {
      cancelAnimationFrame(raf)
      io.disconnect()
      document.removeEventListener('visibilitychange', sync)
    }
  }, [items, size, grid, pool, reduced])

  return (
    <div ref={root} aria-hidden className={cn('pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2', className)} style={{ width: size.w, height: size.h }}>
      <div ref={plane} className="absolute inset-0 origin-center" style={{ perspective: 1100, transform: wallTransform(intro.current ? 0 : 1) }}>
        {Array.from({ length: items.length ? pool : 0 }, (_, i) => (
          <span
            key={i}
            ref={(el) => {
              slots.current[i] = el
            }}
            className="cv absolute top-0 left-0 origin-top-left rounded-[14px] shadow-[0_30px_60px_-24px_rgba(0,0,0,.9)]"
            style={{ width: grid.cw, visibility: 'hidden' }}
          >
            <img alt="" draggable={false} decoding="async" onError={(e) => (e.currentTarget.style.visibility = 'hidden')} />
            {/* 从书库飞进来时叠在上面的书库封面，飞到后段淡掉 */}
            <img alt="" draggable={false} decoding="async" className="absolute inset-0" style={{ opacity: 0 }} />
          </span>
        ))}
      </div>
    </div>
  )
}
