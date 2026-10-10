import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { LibraryManga } from '@/features/library/queries'
import { cn } from '@/lib/cn'
import { DESKTOP_GRID, HOME_WALL, MOBILE_GRID, assignSlots, visibleCells } from './canvasMath'
import { useReducedMotionPref } from './hooks'
import { WINDOW_K, WINDOW_K_ON, cellsInWindow, ensureWall, wallItem, wallRange, wallScale, wallState, windowCells, windowOrder } from './wall'

/**
 * 轻量版的画廊封面墙，铺满父元素（父元素要有大小、position 非 static），给首页橱窗用。
 * 和 HeroWall 画的是同一面墙：同一套格子几何、同样的排列（wallItem）、同样的流动方向与速度，
 * 位置读写同一份 wallState，所以进画廊时那边接着同一个位置，封面一一对应。
 * 但没有书库进出的过场，只画窗里看得见的格子（几十格），每帧只改 transform。
 *
 * 倾斜由外层用 CSS 变量 --wall-rest / --wall-on 给出（.gwin-plane，见 window.css），这里不碰，
 * 指上去时 CSS 过渡到另一个姿态，不用每帧重算。离开视野、标签页在后台或减少动态效果时不流动，也不去加载封面。
 *
 * picks：窗里这几格优先放哪几部（第几部，按优先级），挂上时一次性写进 wallState.order；不给就按原排列。
 */
export function CoverWall({ items, mobile, picks, className }: { items: readonly LibraryManga[]; mobile: boolean; picks?: readonly number[]; className?: string }) {
  const grid = mobile ? MOBILE_GRID : DESKTOP_GRID
  const reduced = useReducedMotionPref()
  const root = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  useLayoutEffect(() => {
    const el = root.current
    if (!el) return
    const on = () => setSize({ w: el.clientWidth, h: el.clientHeight })
    on()
    const ro = new ResizeObserver(on)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  // 指上去时的墙更大，格子更少；备足静止时（更小、更斜）看得见的格子
  const pool = useMemo(() => {
    if (!size.w) return 0
    return visibleCells(0, 0, size.w, size.h, grid, wallRange(size.w, size.h, Math.max(WINDOW_K, WINDOW_K_ON))).length + 8
  }, [size, grid])

  const paintNow = useRef<(() => void) | null>(null)
  const placedFor = useRef(-1)

  /*
   * 挂上时按 picks 换格：窗里看得见的格子放最近读过、又不在首页别处出现的作品，窗里就不会重复首页已有的封面。
   * 一次性：之后别处（换一批大图区等）怎么变都不再换，窗里的封面不会中途变。书库数量变了才重换一次。
   * 换了以后「落地位置」那份记录（从书库进画廊用）对不上了，一并清掉。
   */
  useLayoutEffect(() => {
    if (!picks || !items.length || !size.w || placedFor.current === items.length) return
    placedFor.current = items.length
    ensureWall(size.w, size.h, grid)
    wallState.order = windowOrder(items.length, windowCells(size.w, size.h, grid), picks)
    wallState.landing = null
    paintNow.current?.()
  }, [picks, items.length, size, grid])

  const slots = useRef<(HTMLSpanElement | null)[]>([])
  const shown = useRef<(string | null)[]>([])
  const assigned = useRef(new Map<string, number>())

  useLayoutEffect(() => {
    if (!items.length || !size.w) return
    const { w, h } = size
    ensureWall(w, h, grid)
    // 指上去时墙更大、倾角不同，多留一格的边，免得过渡中四周露出空白
    const margin = grid.ch * wallScale(WINDOW_K)
    let loaded = false

    const paint = () => {
      const cells = cellsInWindow(w, h, grid, WINDOW_K, margin).map((p) => p.cell)
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
        s.style.transform = `translate3d(${cell.x.toFixed(1)}px, ${cell.y.toFixed(1)}px, 0px)`
      }
    }
    paintNow.current = () => loaded && paint()

    let raf = 0
    let last = 0
    let near = false
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
      if (!near) return
      // 第一次靠近才开始摆封面、加载图片：橱窗在页面最底下，用不到时不该白白请求几十张封面
      loaded = true
      paint()
      if (!document.hidden && !reduced) raf = requestAnimationFrame(step)
    }
    const io = new IntersectionObserver(([e]) => {
      near = e.isIntersecting
      sync()
    }, { rootMargin: '400px 0px' })
    io.observe(root.current!)
    document.addEventListener('visibilitychange', sync)
    return () => {
      cancelAnimationFrame(raf)
      io.disconnect()
      document.removeEventListener('visibilitychange', sync)
      paintNow.current = null
    }
  }, [items, size, grid, pool, reduced])

  return (
    <div ref={root} aria-hidden className={cn('pointer-events-none absolute inset-0', className)}>
      <div className="gwin-plane absolute inset-0">
        {Array.from({ length: items.length ? pool : 0 }, (_, i) => (
          <span
            key={i}
            ref={(el) => {
              slots.current[i] = el
            }}
            className="cv absolute top-0 left-0 origin-top-left rounded-[14px] shadow-[0_20px_40px_-20px_rgba(0,0,0,.9)]"
            style={{ width: grid.cw, visibility: 'hidden' }}
          >
            <img alt="" draggable={false} decoding="async" onError={(e) => (e.currentTarget.style.visibility = 'hidden')} />
          </span>
        ))}
      </div>
    </div>
  )
}
