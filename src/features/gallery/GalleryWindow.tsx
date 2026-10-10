import { useQuery } from '@apollo/client/react'
import { ArrowRight } from 'lucide-react'
import { useMemo, useRef, type CSSProperties, type PointerEvent } from 'react'
import { Link } from 'react-router'
import { isVisible } from '@/features/history/history'
import type { LibraryManga } from '@/features/library/queries'
import { count } from '@/lib/format'
import { CoverWall } from './CoverWall'
import { GALLERY } from './GalleryHero'
import { chapterTotals, galleryOrder, readChapters, useMobile } from './hooks'
import { GalleryCounts } from './queries'
import { prefetchGallery } from './readMorph'
import { WINDOW_K, WINDOW_K_ON, wallTransform } from './wall'
import './window.css'

const WALL_VARS = { '--wall-rest': wallTransform(WINDOW_K), '--wall-on': wallTransform(WINDOW_K_ON) } as CSSProperties

/**
 * 首页最底下的「画廊橱窗」：画廊那面倾斜封面墙的一扇取景窗，点「进入画廊」去画廊。
 * 窗始终是深色（画廊各页固定深色，从窗里进去主题不会突然翻转）；平时墙是黑白半透明的底纹，
 * 指上去 / 手指按住 / 键盘聚焦时显出颜色、倾角往画廊里的姿态靠，并随指针左右微微转一点。
 *
 * library：书库全部作品；exclude：首页别处已经出现的作品（大图区、最近阅读），窗里尽量不重复它们。
 */
export function GalleryWindow({ library, exclude }: { library: readonly LibraryManga[] | undefined; exclude: ReadonlySet<number> }) {
  const mobile = useMobile()
  const box = useRef<HTMLDivElement>(null)
  // 排列和画廊首页的墙一样（按收藏先后），封面才一一对应
  const items = useMemo(() => galleryOrder(library ?? []), [library])
  // 窗里优先放最近读过的：按阅读时间倒序，跳过首页已有的、没有封面的和阅读历史里隐藏了的
  const picks = useMemo(() => {
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

  /* 指针：鼠标悬停、手指按住都显色，横向位置带一点倾斜；竖着滑是翻页（touch-action: pan-y），浏览器接管时 pointercancel 复位 */
  const on = (v: boolean) => {
    const el = box.current
    if (!el) return
    if (v) el.setAttribute('data-on', '')
    else {
      el.removeAttribute('data-on')
      el.style.setProperty('--tx', '0')
    }
  }
  const tilt = (e: PointerEvent) => {
    const el = box.current
    if (!el || !el.hasAttribute('data-on')) return
    const r = el.getBoundingClientRect()
    el.style.setProperty('--tx', Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width - 0.5) * 2)).toFixed(3))
  }

  if (!items.length) return null
  return (
    <section aria-labelledby="h-gallery" className="pt-14">
      <div
        ref={box}
        className="gwin"
        style={WALL_VARS}
        onPointerEnter={(e) => {
          prefetchGallery()
          if (e.pointerType === 'mouse') on(true)
        }}
        onPointerLeave={(e) => e.pointerType === 'mouse' && on(false)}
        onPointerDown={(e) => {
          if (e.pointerType === 'mouse') return
          on(true)
          tilt(e)
        }}
        onPointerMove={tilt}
        onPointerUp={(e) => e.pointerType !== 'mouse' && on(false)}
        onPointerCancel={() => on(false)}
      >
        <div className="gwin-wall">
          <CoverWall items={items} mobile={mobile} picks={picks} />
        </div>
        <div aria-hidden className="gwin-shade" />
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
          <Link to={GALLERY} state={{ from: 'home' }} viewTransition onFocus={prefetchGallery} className="gwin-cta no-underline">
            进入画廊
            <ArrowRight className="size-[18px]" strokeWidth={2} />
          </Link>
        </div>
      </div>
    </section>
  )
}
