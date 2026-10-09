import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { LibraryManga } from '@/features/library/queries'
import { cn } from '@/lib/cn'
import { DESKTOP_GRID, HOME_WALL, MOBILE_GRID, assignSlots, cellIndex, centerOn, homeWallExtra, visibleCells, type Grid } from './canvasMath'
import { useReducedMotionPref } from './hooks'

/**
 * 首页墙的位置，首页和画布之间交接用：首页一直在写，进画布时画布从这里接着画；
 * 倒放回首页时画布写回来，首页从那里继续流动。整个页面会话内有效。
 * 记的是相对屏幕中心的偏移（ox - 宽 / 2）：首页和画布量到的宽度可能差一个滚动条，按左边记会错开半个滚动条宽。
 */
export const wallState: { cx: number; cy: number; grid: Grid | null } = { cx: NaN, cy: NaN, grid: null }

/**
 * 画廊首页的倾斜封面墙。和画布进入过渡的第一帧完全一样：同一张交错网格、同样的排列（按收藏先后取模）、
 * 同样的缩放和倾角，整面墙缓慢向左流动。点「进入画布」后画布接着这面墙继续画，背景不会跳。
 *
 * 墙按整个视口的大小画、中心对准首屏中心（画布第一帧也是这样对准的），超出首屏的部分被首屏裁掉。
 * 每帧只改格子的 transform，换成另一部时才换图；离开视野、标签页切到后台或减少动态效果时不流动。
 */
export function HeroWall({ items, mobile, className }: { items: readonly LibraryManga[]; mobile: boolean; className?: string }) {
  const grid = mobile ? MOBILE_GRID : DESKTOP_GRID
  const reduced = useReducedMotionPref()
  // 宽度跟随首屏（滚动条出现、消失都会变），高度取视口：和画布第一帧的画面同样大小
  const [size, setSize] = useState(() => ({ w: document.documentElement.clientWidth, h: window.innerHeight }))
  const root = useRef<HTMLDivElement>(null)
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
  const pool = useMemo(
    () => visibleCells(0, 0, size.w, size.h, grid, { scale: HOME_WALL.scale, ...homeWallExtra(size.w, size.h) }).length + 24,
    [size, grid],
  )

  const slots = useRef<(HTMLSpanElement | null)[]>([])
  const shown = useRef<(string | null)[]>([])
  const assigned = useRef(new Map<string, number>())

  useEffect(() => {
    const el = root.current
    if (!el || !items.length) return
    const { w, h } = size
    if (wallState.grid !== grid || Number.isNaN(wallState.cx)) {
      const c = centerOn(0, 0, w, h, grid)
      Object.assign(wallState, { cx: c.x - w / 2, cy: c.y - h / 2, grid })
    }

    const paint = () => {
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
        const m = items[cellIndex(cell.c, cell.r, items.length)]
        if (shown.current[i] !== m.thumbnailUrl) {
          shown.current[i] = m.thumbnailUrl
          const img = s.firstElementChild as HTMLImageElement
          img.style.visibility = ''
          if (m.thumbnailUrl) img.src = m.thumbnailUrl
          else img.removeAttribute('src')
        }
        s.style.visibility = ''
        s.style.transform = `translate3d(${cell.x.toFixed(1)}px, ${cell.y.toFixed(1)}px, 0px)`
      }
    }
    paint()
    if (reduced) return

    let raf = 0
    let last = 0
    let visible = true
    const step = (now: number) => {
      const dt = last ? Math.min(48, now - last) : 16
      last = now
      wallState.cx -= dt * HOME_WALL.drift
      paint()
      raf = requestAnimationFrame(step)
    }
    const sync = () => {
      cancelAnimationFrame(raf)
      raf = 0
      last = 0
      if (visible && !document.hidden) raf = requestAnimationFrame(step)
    }
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
      <div
        className="absolute inset-0 origin-center"
        style={{
          perspective: 1100,
          transform: `perspective(1800px) rotateX(${HOME_WALL.rotateX}deg) rotateZ(${HOME_WALL.rotateZ}deg) scale(${HOME_WALL.scale})`,
        }}
      >
        {Array.from({ length: items.length ? pool : 0 }, (_, i) => (
          <span
            key={i}
            ref={(el) => {
              slots.current[i] = el
            }}
            className="cv absolute top-0 left-0 rounded-[14px] shadow-[0_30px_60px_-24px_rgba(0,0,0,.9)]"
            style={{ width: grid.cw, visibility: 'hidden' }}
          >
            <img alt="" draggable={false} decoding="async" onError={(e) => (e.currentTarget.style.visibility = 'hidden')} />
          </span>
        ))}
      </div>
    </div>
  )
}
