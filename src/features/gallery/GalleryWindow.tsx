import { useQuery } from '@apollo/client/react'
import { ArrowRight } from 'lucide-react'
import { useEffect, useMemo, useRef, type CSSProperties, type PointerEvent } from 'react'
import { Link } from 'react-router'
import { isVisible } from '@/features/history/history'
import type { LibraryManga } from '@/features/library/queries'
import { count } from '@/lib/format'
import { CoverWall } from './CoverWall'
import { GALLERY } from './GalleryHero'
import { chapterTotals, galleryOrder, readChapters, useMobile } from './hooks'
import { GalleryCounts } from './queries'
import { enterGalleryFromHome, plainClick, prefetchGallery } from './readMorph'
import { prepareWindowWall, windowWallBusy } from './windowScene'
import { DESKTOP_GRID, MOBILE_GRID } from './canvasMath'
import { WINDOW_K, WINDOW_K_ON, ensureWall, wallCoverUrls, wallTransform } from './wall'
import './window.css'

const WALL_VARS = { '--wall-rest': wallTransform(WINDOW_K), '--wall-on': wallTransform(WINDOW_K_ON) } as CSSProperties

/**
 * 首页最底下的「画廊橱窗」：画廊那面倾斜封面墙的一扇取景窗，点「进入画廊」去画廊。
 * 窗始终是深色（画廊各页固定深色，从窗里进去主题不会突然翻转）；平时墙是黑白半透明的底纹，
 * 指上去 / 手指按住 / 键盘聚焦时显出颜色、倾角往画廊里的姿态靠，并随指针左右微微转一点。
 *
 * library：书库全部作品；exclude：首页别处已经出现的作品（大图区、最近阅读），窗里尽量不重复它们。
 *
 * 点「进入画廊」：窗口揭开成整屏、墙落成画廊里的姿态；从画廊返回时画廊收进窗口里（见 readMorph 的
 * enterGalleryFromHome / windowScene）。
 */
export function GalleryWindow({ library, exclude }: { library: readonly LibraryManga[] | undefined; exclude: ReadonlySet<number> | undefined }) {
  const mobile = useMobile()
  const box = useRef<HTMLDivElement>(null)
  // 排列和画廊首页的墙一样（按收藏先后），封面才一一对应
  const items = useMemo(() => galleryOrder(library ?? []), [library])
  // 窗里优先放最近读过的：按阅读时间倒序，跳过首页已有的、没有封面的和阅读历史里隐藏了的
  // exclude 还没有（最近阅读没加载出来）时不换格，等它到了再换
  const picks = useMemo(() => {
    if (!exclude) return undefined
    const at = (m: LibraryManga) => Number(m.lastReadChapter?.lastReadAt ?? 0)
    const index = new Map(items.map((m, i) => [m.id, i]))
    return items
      .filter((m) => m.thumbnailUrl && !exclude.has(m.id) && at(m) > 0 && (!m.lastReadChapter || isVisible(m.lastReadChapter)))
      .sort((a, b) => at(b) - at(a))
      .map((m) => index.get(m.id)!)
  }, [items, exclude])

  // 只取总话数，不用整个 useGalleryLibrary（它还会去查分类）；算式和画廊首页、阅读档案共用
  const counts = useQuery(GalleryCounts, { fetchPolicy: 'cache-first' })
  const read = readChapters(items, chapterTotals(counts.data))

  // 指到橱窗上就把画廊整屏会用到的封面先取回来，窗口揭开时不会一块块冒出来
  const preloaded = useRef(false)
  const preloadCovers = () => {
    if (preloaded.current || !items.length) return
    preloaded.current = true
    const grid = mobile ? MOBILE_GRID : DESKTOP_GRID
    const w = document.documentElement.clientWidth
    const h = window.innerHeight
    ensureWall(w, h, grid)
    const urls = wallCoverUrls(items, grid, w, h)
    const load = () => {
      prepareWindowWall()
      urls.forEach((u) => Object.assign(new Image(), { decoding: 'async', src: u }))
    }
    // Safari 没有 requestIdleCallback
    if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(load, { timeout: 1500 })
    else setTimeout(load, 200)
  }

  /* 指针：鼠标悬停、手指按住都显色，横向位置带一点倾斜；竖着滑是翻页（touch-action: pan-y），浏览器接管时 pointercancel 复位 */
  const on = (v: boolean) => {
    const el = box.current
    if (!el || windowWallBusy()) return
    if (v) el.setAttribute('data-on', '')
    else {
      el.removeAttribute('data-on')
      el.style.setProperty('--tx', '0')
    }
  }
  const tilt = (e: PointerEvent) => {
    const el = box.current
    if (!el || windowWallBusy() || !el.hasAttribute('data-on')) return
    const r = el.getBoundingClientRect()
    el.style.setProperty('--tx', Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width - 0.5) * 2)).toFixed(3))
  }

  const has = items.length > 0
  // 橱窗即将进入视口时先取路由代码，键盘和直接点击也不用临时等待模块加载。
  useEffect(() => {
    if (!box.current) return
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      prefetchGallery()
      observer.disconnect()
    }, { rootMargin: '400px 0px' })
    observer.observe(box.current)
    return () => observer.disconnect()
  }, [has])

  if (!has) return null
  return (
    <section aria-labelledby="h-gallery" className="pt-14">
      <div
        ref={box}
        className="gwin"
        style={WALL_VARS}
        onPointerEnter={(e) => {
          prefetchGallery()
          preloadCovers()
          if (e.pointerType === 'mouse') on(true)
        }}
        onPointerLeave={(e) => e.pointerType === 'mouse' && on(false)}
        onPointerDown={(e) => {
          if (e.pointerType === 'mouse') return
          on(true)
          tilt(e)
        }}
        onPointerMove={tilt}
        // 触屏抬手后稍等再复位：抬手紧接着就是点击，进画廊的过渡要看到橱窗还是显色的样子
        onPointerUp={(e) => e.pointerType !== 'mouse' && window.setTimeout(() => on(false), 500)}
        onPointerCancel={() => on(false)}
      >
        <CoverWall items={items} mobile={mobile} picks={picks} className="-z-2" />
        <div className="gwin-copy">
          <div className="min-w-0">
            <p className="gwin-kicker">书库画廊</p>
            <h2 id="h-gallery" className="gwin-title font-cjk">
              每一部收藏，
              <br />
              都在这面墙上。
            </h2>
            <p className="gwin-stats num">
              {count(items.length)} 部作品 · 已读 {read == null ? '—' : count(read)} 话
            </p>
          </div>
          <Link
            to={GALLERY}
            state={{ from: 'home' }}
            viewTransition={mobile}
            onClick={(e) => plainClick(e) && !window.matchMedia('(prefers-reduced-motion: reduce)').matches && box.current && enterGalleryFromHome(box.current)}
            onFocus={() => {
              prefetchGallery()
              preloadCovers()
            }}
            className="gwin-cta no-underline"
          >
            进入画廊
            <ArrowRight className="size-[18px]" strokeWidth={2} />
          </Link>
        </div>
      </div>
    </section>
  )
}
