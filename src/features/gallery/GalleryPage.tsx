import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { Seg, type SegItem } from '@/components/ui/Seg'
import { hasSnapshot } from '@/api/persist'
import { inCategory } from '@/features/library/category'
import { LibraryGrid, LibrarySkeleton } from '@/features/library/LibraryGrid'
import { count } from '@/lib/format'
import { cn } from '@/lib/cn'
import { useForceDark } from '@/design/settings'
import { HeroWall } from './HeroWall'
import { GALLERY, HERO_BOX, HERO_VIGNETTE, HeroCopy, type HeroLayout } from './GalleryHero'
import { galleryOrder, isCompleted, useGalleryLibrary, useMobile, useReducedMotionPref } from './hooks'
import { libraryCoversForEntry } from './readMorph'
import './gallery.css'

type FilterValue = 'all' | 'done' | number


const parseFilter = (v: string | null): FilterValue => (v === 'done' ? 'done' : v && /^\d+$/.test(v) ? Number(v) : 'all')

/**
 * 书库画廊首页：倾斜封面墙上的标题与两扇门（画布、阅读档案）。固定深色。
 * 首屏的墙和下面的全部作品像幻灯片的两页：在墙上往下滚整页切到全部作品，在全部作品最上面往上滚切回墙。
 */
export function GalleryPage() {
  useForceDark()
  const { all, stats, categories, loading, error } = useGalleryLibrary()
  const mobile = useMobile()
  // 既没有内存缓存也没有快照、要等网络时，网格到了播一次进场动画
  const [intro] = useState(() => !hasSnapshot('library') && all.length === 0)

  /* 全部作品的筛选：全部 / 各分类 / 已完结，放在网址里，返回时还在 */
  const [params, setParams] = useSearchParams()

  // 从书库点「画廊」进来：书库里的封面从原位飞上墙，标题和暗角等封面上墙了再淡入
  const [entry] = useState(libraryCoversForEntry)

  /* 像幻灯片一样分两页：首屏的墙、全部作品（见 usePaging） */
  const reduced = useReducedMotionPref()
  const grid = useRef<HTMLElement>(null)
  const page = usePaging(grid, reduced)
  // 从书库飞进来时，第二页（几百部的网格）等封面上了墙再挂：一起挂的话第一帧要多渲染一百多毫秒，过场开头会顿一下
  const [gridReady, setGridReady] = useState(!entry)
  useEffect(() => {
    if (gridReady) return
    const t = setTimeout(() => setGridReady(true), 1900)
    return () => clearTimeout(t)
  }, [gridReady])
  const toGrid = useCallback(() => {
    if (gridReady) return page('grid')
    setGridReady(true)
    requestAnimationFrame(() => page('grid'))
  }, [gridReady, page])

  const filter = parseFilter(params.get('f'))
  const defaultId = categories.find((c) => c.default)?.id ?? 0
  const tabs = useMemo<SegItem<FilterValue>[]>(() => {
    const out: SegItem<FilterValue>[] = [{ value: 'all', label: '全部', count: all.length }]
    for (const c of categories) {
      const n = all.filter((m) => inCategory(m, c.id, defaultId)).length
      if (c.default && n === 0) continue
      out.push({ value: c.id, label: c.default ? '默认' : c.name, count: n })
    }
    const done = all.filter(isCompleted).length
    if (done) out.push({ value: 'done', label: '已完结', count: done })
    return out
  }, [all, categories, defaultId])
  // 网址里的分类已不存在时按「全部」显示
  const active = tabs.some((t) => t.value === filter) ? filter : 'all'
  const items = useMemo(() => {
    const list = active === 'all' ? all : active === 'done' ? all.filter(isCompleted) : all.filter((m) => inCategory(m, active, defaultId))
    // 按收藏时间，新收藏的在前
    return [...list].sort((a, b) => Number(b.inLibraryAt) - Number(a.inLibraryAt))
  }, [all, active, defaultId])
  const pick = (v: FilterValue) =>
    setParams((p) => {
      if (v === 'all') p.delete('f')
      else p.set('f', String(v))
      return p
    }, { replace: true, preventScrollReset: true })

  const empty = !loading && !error && all.length === 0
  const ordered = useMemo(() => galleryOrder(all), [all])

  /* 进入画布：量出首屏此刻在屏幕上的位置一起带过去，画布第一帧按原位摆出同一份面板，不会跳 */
  const hero = useRef<HTMLElement>(null)
  const navigate = useNavigate()
  const enterCanvas = (e: MouseEvent) => {
    const link = (e.target as Element).closest('a[data-enter-canvas]')
    if (!link || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || !hero.current) return
    e.preventDefault()
    const r = hero.current.getBoundingClientRect()
    const layout: HeroLayout = { left: r.left, top: r.top, width: r.width, height: r.height }
    navigate(`${GALLERY}/canvas`, { state: { from: 'gallery', layout } })
  }

  return (
    <>
      <section ref={hero} aria-label="书库画廊" className={cn(HERO_BOX, 'isolate -mt-[var(--nav-h)] overflow-hidden')} onClickCapture={enterCanvas}>
        {!empty && <HeroWall items={ordered} mobile={mobile} entry={entry} className="-z-20" />}
        {/* 中间透出墙、四周和上下压暗到底色，文字始终看得清 */}
        <div aria-hidden className={cn('absolute inset-0 -z-10', entry && 'gallery-late')} style={{ background: HERO_VIGNETTE[mobile ? 'mobile' : 'desktop'] }} />

        <HeroCopy stats={stats} mobile={mobile} intro={intro} late={!!entry} onBrowse={toGrid} />
      </section>

      {/* 第二页至少占满一屏：切过来时停在它的顶部，内容少也不会切不到位；顶栏的高度留在它自己的上边距里，墙不会从顶栏下面露出来 */}
      {gridReady && (
        <section ref={grid} id="all" aria-labelledby="gallery-all" className="wrap min-h-svh pt-[calc(var(--nav-h)+24px)] pb-28 md:pt-[calc(var(--nav-h)+64px)]">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-4 md:mb-10">
            {mobile ? (
              <h2 id="gallery-all" className="sr">全部作品</h2>
            ) : (
              <div className="flex flex-col gap-2">
                <h2 id="gallery-all" className="m-0 font-cjk text-[40px] leading-[1.1] font-black tracking-[-0.01em]">
                  全部作品 <span className="font-sans font-medium text-muted num">{count(items.length)}</span>
                </h2>
                <p className="m-0 text-[15px] text-muted">按收藏时间排列，新收藏的在前。</p>
              </div>
            )}
            {tabs.length > 1 && <Seg label="筛选" items={tabs} value={active} onChange={pick} className="max-md:w-full" />}
          </div>

          {loading && <LibrarySkeleton density={mobile ? 'compact' : 'comfy'} />}
          {error && <p className="text-danger">加载失败：{error.message.split('\n')[0]}</p>}
          {empty && <p className="px-6 py-20 text-center text-muted">书库是空的，去「发现」页添加漫画吧。</p>}
          <LibraryGrid
            items={items}
            intro={intro}
            density={mobile ? 'compact' : 'comfy'}
            minTile={mobile ? 100 : 168}
            selecting={false}
            selected={NO_SELECTION}
            onToggle={noop}
            onLongPress={noop}
          />
        </section>
      )}
    </>
  )
}

const NO_SELECTION: ReadonlySet<number> = new Set()

const easeInOut = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2)

/**
 * 首页的两页切换。在墙（第一页）上往下滚、上滑、按 ↓ / PageDown / 空格，整页滑到全部作品的顶部；
 * 在全部作品的顶部往上滚、下拉、按 ↑ / PageUp，滑回墙；Home 随时回墙。全部作品里面照常滚动。
 * 切换期间和刚切完的一小会儿吞掉滚轮：触控板的惯性还在往同一个方向推，不吞的话会接着滚进网格或马上又切回去；
 * 在网格里一路往上滚到顶时也先停在顶部，下一次往上滚才切回墙。
 */
function usePaging(grid: React.RefObject<HTMLElement | null>, reduced: boolean) {
  const anim = useRef(0)
  const busyUntil = useRef(0)
  const lastGridWheel = useRef(0)

  // 全部作品顶部（扣掉顶栏）对应的滚动位置
  const gridY = useCallback(() => {
    const el = grid.current
    if (!el) return Infinity
    return el.getBoundingClientRect().top + window.scrollY - (parseFloat(getComputedStyle(el).scrollMarginTop) || 0)
  }, [grid])

  const go = useCallback(
    (to: 'hero' | 'grid') => {
      const y0 = window.scrollY
      const y1 = to === 'grid' ? gridY() : 0
      if (!Number.isFinite(y1) || Math.abs(y1 - y0) < 2) return
      cancelAnimationFrame(anim.current)
      if (reduced) {
        window.scrollTo({ top: y1, behavior: 'instant' })
        busyUntil.current = performance.now() + 300
        return
      }
      const dur = 760
      let start = 0
      busyUntil.current = Infinity
      const step = (now: number) => {
        start ||= now
        const k = Math.min(1, (now - start) / dur)
        window.scrollTo({ top: y0 + (y1 - y0) * easeInOut(k), behavior: 'instant' })
        if (k < 1) anim.current = requestAnimationFrame(step)
        else busyUntil.current = performance.now() + 450
      }
      anim.current = requestAnimationFrame(step)
    },
    [gridY, reduced],
  )

  useEffect(() => {
    const where = () => {
      const y = window.scrollY
      const g = gridY()
      return { y, hero: y < g - 2, gridTop: y >= g - 2 && y <= g + 2 }
    }
    const busy = () => performance.now() < busyUntil.current
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.deltaY === 0) return
      const { y, hero, gridTop } = where()
      if (busy()) {
        if (hero || gridTop) e.preventDefault()
        return
      }
      if (hero) {
        e.preventDefault()
        if (e.deltaY > 0) go('grid')
        else if (y > 0) go('hero')
        return
      }
      const now = performance.now()
      if (gridTop && e.deltaY < 0) {
        e.preventDefault()
        // 一路滚上来的这一下先停在顶部，等手停了再往上滚才切回墙
        if (now - lastGridWheel.current < 220) lastGridWheel.current = now
        else go('hero')
        return
      }
      lastGridWheel.current = now
      // 网格里往上滚、这一下会越过顶部：停在顶部，不滚进墙那一页
      const g = gridY()
      if (e.deltaY < 0 && y + e.deltaY < g) {
        e.preventDefault()
        window.scrollTo({ top: g, behavior: 'instant' })
      }
    }
    let y0 = 0
    let used = false
    const onTouchStart = (e: TouchEvent) => {
      y0 = e.touches[0].clientY
      used = false
    }
    const onTouchMove = (e: TouchEvent) => {
      const dy = e.touches[0].clientY - y0
      const { hero, gridTop } = where()
      if (busy() || used) {
        if (hero || (gridTop && dy > 0)) e.preventDefault()
        return
      }
      if (hero) {
        // 墙这一页不随手指滚动，滑够距离就整页切换
        e.preventDefault()
        if (dy < -36) {
          used = true
          go('grid')
        }
      } else if (gridTop && dy > 36) {
        e.preventDefault()
        used = true
        go('hero')
      }
    }
    const onKey = (e: KeyboardEvent) => {
      const t = e.target
      if (e.ctrlKey || e.metaKey || e.altKey || (t instanceof Element && t.closest('input, textarea, select, [contenteditable]'))) return
      const { hero, gridTop } = where()
      const down = ['ArrowDown', 'PageDown', ' '].includes(e.key) && !e.shiftKey
      const up = ['ArrowUp', 'PageUp'].includes(e.key) || (e.key === ' ' && e.shiftKey)
      if (busy() && (hero || gridTop)) e.preventDefault()
      else if (hero && down) {
        e.preventDefault()
        go('grid')
      } else if ((gridTop && up) || (e.key === 'Home' && !hero)) {
        e.preventDefault()
        go('hero')
      }
    }
    // 停在两页之间（拖滚动条、触屏惯性滚过了头）：吸到近的那一页
    const onScrollEnd = () => {
      if (busy()) return
      const { y, hero } = where()
      if (hero && y > 2) go(y < gridY() / 2 ? 'hero' : 'grid')
    }
    window.addEventListener('scrollend', onScrollEnd)
    window.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: false })
    window.addEventListener('keydown', onKey)
    return () => {
      cancelAnimationFrame(anim.current)
      window.removeEventListener('scrollend', onScrollEnd)
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('keydown', onKey)
    }
  }, [go, gridY])

  return go
}
const noop = () => {}
