import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router'
import { LoadError } from '@/components/ui/LoadError'
import { Seg, type SegItem } from '@/components/ui/Seg'
import { hasSnapshot } from '@/api/persist'
import { inCategory } from '@/features/library/category'
import { LibraryGrid, LibrarySkeleton } from '@/features/library/LibraryGrid'
import { count } from '@/lib/format'
import { cn } from '@/lib/cn'
import { useAppearance, useForceDark } from '@/design/settings'
import { HeroWall, flyWallToLibrary } from './HeroWall'
import { WindowWall } from './SharedWindowWall'
import { afterWindowWall } from './windowScene'
import { lockGalleryReturnScroll } from './returnScroll'
import { GALLERY, HERO_BOX, HERO_VIGNETTE, HeroCopy, type HeroLayout } from './GalleryHero'
import { PosterShare } from './PosterShare'
import { galleryOrder, isCompleted, NSFW_ALL_HIDDEN, useGalleryLibrary, useMobile, useReducedMotionPref } from './hooks'
import { afterViewTransition, armLibraryFade, armWindowBack, canvasBackForEntry, finishCanvasBack, libraryCoversForEntry, libraryCoversForReturn, setLibraryExit, windowEntryForEntry, withoutHiddenCovers } from './readMorph'
import './gallery.css'
import { t as tl } from '@/i18n'

type FilterValue = 'all' | 'done' | number

const parseFilter = (v: string | null): FilterValue => (v === 'done' ? 'done' : v && /^\d+$/.test(v) ? Number(v) : 'all')

/**
 * 书库画廊首页：倾斜封面墙上的标题与两扇门（画布、阅读档案）。固定深色。
 * 首屏的墙和下面的全部作品像幻灯片的两页：在墙上往下滚整页切到全部作品，在全部作品最上面往上滚切回墙。
 */
export function GalleryPage() {
  useForceDark()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from
  const origin = from === 'library' || from === 'home' ? from : null
  const sharedWall = origin === 'home'
  const { all, full, stats, categories, loading, error, refetch } = useGalleryLibrary()
  const mobile = useMobile()
  const [sharing, setSharing] = useState(false)
  const homeWindowVisible = useAppearance((s) => s.homeGallery)
  // 既没有内存缓存也没有快照、要等网络时，网格到了播一次进场动画
  const [intro] = useState(() => !hasSnapshot('library') && all.length === 0)

  /* 全部作品的筛选：全部 / 各分类 / 已完结，放在网址里，返回时还在 */
  const [params, setParams] = useSearchParams()

  // 从书库点「画廊」进来：书库里的封面从原位飞上墙，标题和暗角等封面上墙了再淡入
  const [rawEntry] = useState(libraryCoversForEntry)
  // 画廊里被 NSFW 过滤的作品，进出场叠层不能露出书库里记下的原图
  const visibleIds = useMemo(() => new Set(all.map((m) => m.id)), [all])
  const entry = useMemo(() => rawEntry && withoutHiddenCovers(rawEntry, visibleIds), [rawEntry, visibleIds])
  // 首页来路保留同一面墙，取景范围和标题一起展开。
  const [reveal] = useState(windowEntryForEntry)
  const [canvasBack] = useState(canvasBackForEntry)
  useEffect(() => {
    if (canvasBack !== null) void afterViewTransition().then(() => finishCanvasBack(canvasBack))
  }, [canvasBack])

  /* 像幻灯片一样分两页：首屏的墙、全部作品（见 usePaging） */
  const reduced = useReducedMotionPref()
  const grid = useRef<HTMLElement>(null)
  const page = usePaging(grid, reduced)
  // 从书库飞进来时，第二页（几百部的网格）等封面上了墙再挂：一起挂的话第一帧要多渲染一百多毫秒，过场开头会顿一下
  const [gridReady, setGridReady] = useState(!entry && !reveal && canvasBack === null)
  useEffect(() => {
    if (gridReady) return
    if (reveal || canvasBack !== null) {
      let alive = true
      let idle = 0
      // 画布已回到墙的姿态，先交接首屏，下面的作品网格等换页结束后空闲挂载。
      void (reveal ? afterWindowWall() : afterViewTransition()).then(() => {
        if (!alive) return
        const mount = () => alive && setGridReady(true)
        idle = typeof requestIdleCallback === 'function' ? requestIdleCallback(mount, { timeout: 1000 }) : window.setTimeout(mount, 80)
      })
      return () => {
        alive = false
        if (typeof cancelIdleCallback === 'function') cancelIdleCallback(idle)
        else clearTimeout(idle)
      }
    }
    const t = setTimeout(() => setGridReady(true), 1900)
    return () => clearTimeout(t)
  }, [gridReady, reveal, canvasBack])
  const toGrid = useCallback(() => {
    if (gridReady) return page('grid')
    setGridReady(true)
    requestAnimationFrame(() => page('grid'))
  }, [gridReady, page])

  const filter = parseFilter(params.get('f'))
  const defaultId = categories.find((c) => c.default)?.id ?? 0
  const tabs = useMemo<SegItem<FilterValue>[]>(() => {
    const out: SegItem<FilterValue>[] = [{ value: 'all', label: tl('gallery.all'), count: all.length }]
    for (const c of categories) {
      const n = all.filter((m) => inCategory(m, c.id, defaultId)).length
      if (c.default && n === 0) continue
      out.push({ value: c.id, label: c.default ? tl('gallery.default') : c.name, count: n })
    }
    const done = all.filter(isCompleted).length
    if (done) out.push({ value: 'done', label: tl('gallery.completed'), count: done })
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
    // 沿用来路 state（决定墙的样式与返回动画），并声明不回到顶部，否则筛选会闪回墙那一页
    }, { replace: true, preventScrollReset: true, state: { ...(location.state as object | null), keepScroll: true } })

  const empty = !loading && !error && all.length === 0
  // 书库有作品但全被 NSFW 隐藏：不能当成空书库，提示去哪里调整
  const allHidden = empty && full.length > 0
  const ordered = useMemo(() => galleryOrder(all), [all])

  /*
   * 离开画廊首页，来路决定去路（state.from，直接打开、刷新的没有来路）：
   * - 返回键：回来路。从书库点进来、后退回同一个书库页面时，墙停下来，中间那块封面飞回书库的原位、墙转平，
   *   文字淡掉，再换页（书库那一页在下面、画廊在上面淡出，封面不动）；从首页来的，同一面墙收进首页的取景窗；没有来路回书库。
   * - 导航栏的「书库」：一定去书库。来路是书库才飞回，其余都是普通换页。
   */
  const navigate = useNavigate()
  const hero = useRef<HTMLElement>(null)
  const leaving = useRef(false)
  const unlockScroll = useRef<(() => void) | null>(null)
  useEffect(() => () => {
    const unlock = unlockScroll.current
    if (!unlock) return
    // 目标页先恢复原来的滚动位置；锁一直保留到换页和橱窗收回都结束。
    void Promise.all([afterViewTransition(), afterWindowWall()]).then(unlock)
  }, [])
  const leave = useCallback(
    (to: 'back' | 'library') => {
      if (leaving.current) return
      leaving.current = true
      unlockScroll.current = lockGalleryReturnScroll()
      // 上一条历史记录就是来路页时才能 navigate(-1)（刷新、新标签页打开的没有）
      const canBack = (window.history.state?.idx ?? 0) > 0
      const fromLibrary = origin === 'library' && canBack
      const backHome = to === 'back' && origin === 'home'
      const go = () => {
        armLibraryFade()
        if (fromLibrary || (backHome && canBack)) navigate(-1)
        else navigate(backHome ? '/' : '/library', { viewTransition: true })
      }
      // 书库来路保留原来的文字淡出与封面飞回。
      const fadeUi = (duration = 380, only = '[data-hero-ui]') =>
        hero.current?.querySelectorAll<HTMLElement>(only).forEach((el) =>
          el.animate([{ opacity: getComputedStyle(el).opacity }, { opacity: 0 }], { duration, easing: 'ease-out', fill: 'forwards' }),
        )
      // 首页橱窗关闭时走普通返回，不等待不存在的取景窗。
      if (backHome && canBack && homeWindowVisible && !reduced && window.scrollY <= 2 && armWindowBack()) {
        // 文字和墙同步收尾，不先等待一次淡出；导航独立于墙层。
        navigate(-1)
        return
      }
      const returning = fromLibrary ? libraryCoversForReturn() : null
      const rects = returning && withoutHiddenCovers(returning, visibleIds)
      if (reduced || !rects || window.scrollY > 2) return go()
      fadeUi()
      if (!flyWallToLibrary(rects, go)) go()
    },
    [origin, navigate, reduced, homeWindowVisible, visibleIds],
  )
  const toBack = useCallback(() => leave('back'), [leave])

  useEffect(() => {
    setLibraryExit(() => leave('library'))
    return () => setLibraryExit(null)
  }, [leave])

  /* 进入画布：量出首屏此刻在屏幕上的位置一起带过去，画布第一帧按原位摆出同一份面板，不会跳 */
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
      <section ref={hero} aria-label={tl('gallery.name')} className={cn(HERO_BOX, 'isolate -mt-[var(--nav-h)] overflow-hidden')} onClickCapture={enterCanvas}>
        {!empty && (sharedWall
          ? <WindowWall kind="gallery" items={ordered} mobile={mobile} shade={HERO_VIGNETTE[mobile ? 'mobile' : 'desktop']} className="-z-20" />
          : <HeroWall items={ordered} mobile={mobile} entry={entry} className="-z-20" />)}
        {/* 中间透出墙、四周和上下压暗到底色，文字始终看得清 */}
        {!sharedWall && <div aria-hidden data-hero-ui data-hero-fade className={cn('absolute inset-0 -z-10', entry && 'gallery-late')} style={{ background: HERO_VIGNETTE[mobile ? 'mobile' : 'desktop'] }} />}

        <HeroCopy stats={stats} mobile={mobile} intro={intro} late={!!entry} morph={!!reveal} onBrowse={toGrid} onBack={toBack} backLabel={origin === 'home' ? tl('gallery.backHome') : tl('gallery.backLibrary')} onShare={() => setSharing(true)} />
      </section>
      <PosterShare open={sharing} initial="library" onClose={() => setSharing(false)} />

      {/* 第二页至少占满一屏：切过来时停在它的顶部，内容少也不会切不到位；顶栏的高度留在它自己的上边距里，墙不会从顶栏下面露出来 */}
      {gridReady && (
        <section ref={grid} id="all" aria-labelledby="gallery-all" className="wrap min-h-svh pt-[calc(var(--nav-h)+24px)] pb-28 md:pt-[calc(var(--nav-h)+64px)]">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-4 md:mb-10">
            {mobile ? (
              <h2 id="gallery-all" className="sr">{tl('gallery.allWorks')}</h2>
            ) : (
              <div className="flex flex-col gap-2">
                <h2 id="gallery-all" className="m-0 font-cjk text-[40px] leading-[1.1] font-black tracking-[-0.01em]">
                  {tl('gallery.allWorks')} <span className="font-sans font-medium text-muted num">{count(items.length)}</span>
                </h2>
                <p className="m-0 text-[15px] text-muted">{tl('gallery.sortNote')}</p>
              </div>
            )}
            {tabs.length > 1 && <Seg label={tl('gallery.filter')} items={tabs} value={active} onChange={pick} className="max-md:w-full" />}
          </div>

          {loading && <LibrarySkeleton density={mobile ? 'compact' : 'comfy'} />}
          {error && <LoadError message={error.message} onRetry={() => void refetch()} />}
          {empty && <p className="px-6 py-20 text-center text-muted">{allHidden ? NSFW_ALL_HIDDEN : tl('gallery.empty')}</p>}
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
      // 空格是按钮和链接自己的激活键，焦点在它们上面时不当成翻页
      if (e.key === ' ' && t instanceof Element && t.closest('button, a[href], summary, [role="button"]')) return
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
