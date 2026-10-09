import { useMemo, useRef, useState, type MouseEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { Seg, type SegItem } from '@/components/ui/Seg'
import { hasSnapshot } from '@/api/persist'
import { inCategory } from '@/features/library/category'
import { LibraryGrid, LibrarySkeleton } from '@/features/library/LibraryGrid'
import { count } from '@/lib/format'
import { cn } from '@/lib/cn'
import { HeroWall } from './HeroWall'
import { GALLERY, HERO_BOX, HERO_VIGNETTE, HeroCopy, type HeroLayout } from './GalleryHero'
import { galleryOrder, isCompleted, useGalleryLibrary, useMobile } from './hooks'
import './gallery.css'

type FilterValue = 'all' | 'done' | number

const parseFilter = (v: string | null): FilterValue => (v === 'done' ? 'done' : v && /^\d+$/.test(v) ? Number(v) : 'all')

/** 书库画廊首页：倾斜封面墙上的标题与两扇门（画布、阅读档案），下面是全部作品。跟随主题。 */
export function GalleryPage() {
  const { all, stats, categories, loading, error } = useGalleryLibrary()
  const mobile = useMobile()
  // 既没有内存缓存也没有快照、要等网络时，网格到了播一次进场动画
  const [intro] = useState(() => !hasSnapshot('library') && all.length === 0)

  /* 全部作品的筛选：全部 / 各分类 / 已完结，放在网址里，返回时还在 */
  const [params, setParams] = useSearchParams()
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
        {!empty && <HeroWall items={ordered} mobile={mobile} className="-z-20" />}
        {/* 中间透出墙、四周和上下压暗到底色，文字始终看得清 */}
        <div aria-hidden className="absolute inset-0 -z-10" style={{ background: HERO_VIGNETTE[mobile ? 'mobile' : 'desktop'] }} />

        <HeroCopy stats={stats} mobile={mobile} intro={intro} />
      </section>

      <section id="all" aria-labelledby="gallery-all" className="wrap scroll-mt-[var(--nav-h)] pt-6 pb-28 md:pt-16">
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
    </>
  )
}

const NO_SELECTION: ReadonlySet<number> = new Set()
const noop = () => {}
