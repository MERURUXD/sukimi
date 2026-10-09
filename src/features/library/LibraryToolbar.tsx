import { ArrowDown, ArrowUp, Check, CheckSquare, Images, Minus, Plus, RefreshCw, Search, SlidersHorizontal, X } from 'lucide-react'
import { useState } from 'react'
import { Glass } from '@/components/glass/Glass'
import { Popover } from '@/components/ui/Popover'
import { Seg, type SegItem } from '@/components/ui/Seg'
import { cn } from '@/lib/cn'
import { GlassLink } from '@/components/glass/GlassLink'
import { enterGalleryFromLibrary, plainClick } from '@/features/gallery/readMorph'
import { FILTERS, SORTS } from './filtering'
import { useLibraryView, type Density } from './store'

const prefetchGallery = () => void import('@/features/gallery/GalleryPage')

const DENSITIES: SegItem<Density>[] = [
  { value: 'comfy', label: '舒适网格' },
  { value: 'compact', label: '紧凑网格' },
  { value: 'list', label: '列表' },
]

export function LibraryToolbar({
  categories,
  sources,
  query,
  onQuery,
  selecting,
  onToggleSelect,
  updating,
  onRefresh,
}: {
  categories: SegItem<'all' | number>[]
  sources: { id: string; name: string; count: number }[]
  query: string
  onQuery: (q: string) => void
  selecting: boolean
  onToggleSelect: () => void
  updating: { finished: number; total: number } | null
  onRefresh: () => void
}) {
  const view = useLibraryView()
  const [panel, setPanel] = useState(false)
  const activeFilters = FILTERS.filter((f) => view.filters[f.key] !== 0)
  const activeSources = view.sources.map((id) => ({ id, name: sources.find((x) => x.id === id)?.name ?? id }))
  const filtering = activeFilters.length > 0 || activeSources.length > 0

  return (
    <div className="mb-6 flex flex-wrap items-center gap-2.5">
      {categories.length > 1 && (
        <Seg label="分类" items={categories} value={view.category} onChange={view.setCategory} />
      )}

      {activeFilters.map((f) => (
        <button
          key={f.key}
          type="button"
          onClick={() => view.clearFilter(f.key)}
          aria-label={`移除筛选 ${f.label}`}
          className="inline-flex min-h-8 items-center gap-1 rounded-full bg-accent-soft py-0 pr-1.5 pl-3 text-[13px] font-semibold"
        >
          {view.filters[f.key] === 2 ? `排除 ${f.label}` : f.label}
          <X className="size-4 opacity-70" />
        </button>
      ))}

      {activeSources.map((src) => (
        <button
          key={src.id}
          type="button"
          onClick={() => view.toggleSource(src.id)}
          aria-label={`移除来源筛选 ${src.name}`}
          className="inline-flex min-h-8 items-center gap-1 rounded-full bg-accent-soft py-0 pr-1.5 pl-3 text-[13px] font-semibold"
        >
          {src.name}
          <X className="size-4 opacity-70" />
        </button>
      ))}

      <span className="flex-1 max-sm:hidden" />

      <Glass as="label" className="flex h-11 min-w-0 flex-[0_1_300px] items-center gap-2.5 rounded-full px-4 text-muted max-sm:flex-[1_1_120px]">
        <Search className="size-[18px] flex-none" strokeWidth={1.8} />
        <span className="sr">搜索书库</span>
        <input
          type="search"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="搜索标题、作者、标签或来源"
          className="min-w-0 flex-1 border-0 bg-transparent text-text outline-none placeholder:text-faint"
        />
      </Glass>

      <Popover
        open={panel}
        onClose={() => setPanel(false)}
        label="筛选与排序"
        className="flex w-[360px] max-w-[calc(100vw-32px)] flex-col gap-5 px-4 py-5"
        trigger={
          <Glass as="button"
              type="button"
              className={cn('rounded-full', 'gbtn max-sm:size-11 max-sm:px-0', (panel || filtering) && 'bg-g-hi')}
              aria-expanded={panel}
              onClick={() => setPanel((v) => !v)}
            >
            <SlidersHorizontal className="size-[18px]" strokeWidth={1.8} />
            <span className="max-sm:hidden">筛选与排序</span>
          </Glass>
        }
      >
        <div>
          <h3 className="pop-h">筛选 · 点一下包含，再点排除</h3>
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => {
              const st = view.filters[f.key]
              return (
                <button
                  key={f.key}
                  type="button"
                  className={cn('fopt', st === 1 && 'inc', st === 2 && 'exc')}
                  onClick={() => view.cycleFilter(f.key)}
                  aria-label={`${f.label}：${['不限', '仅包含', '排除'][st]}`}
                >
                  {st === 1 && <Plus className="size-3.5" strokeWidth={2.6} />}
                  {st === 2 && <Minus className="size-3.5" strokeWidth={2.6} />}
                  {f.label}
                </button>
              )
            })}
          </div>
        </div>
        {sources.length > 1 && (
          <div>
            <h3 className="pop-h flex items-center">
              <span className="flex-1">来源 · 可多选</span>
              {view.sources.length > 0 && (
                <button type="button" onClick={view.clearSources} className="font-semibold tracking-normal text-text">
                  清除
                </button>
              )}
            </h3>
            <div className="flex max-h-[168px] flex-wrap gap-1.5 overflow-y-auto">
              {sources.map((src) => {
                const on = view.sources.includes(src.id)
                return (
                  <button
                    key={src.id}
                    type="button"
                    className={cn('fopt', on && 'inc')}
                    aria-pressed={on}
                    onClick={() => view.toggleSource(src.id)}
                  >
                    {src.name}
                    <span className="text-[11px] opacity-60 num">{src.count}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}
        <div>
          <h3 className="pop-h">排序 · 再点一次切换方向</h3>
          {SORTS.map((s) => {
            const on = s.key === view.sort
            const Arrow = view.desc ? ArrowDown : ArrowUp
            return (
              <button key={s.key} type="button" className="opt" aria-pressed={on} onClick={() => view.pickSort(s.key)}>
                <span className="flex-1">{s.label}</span>
                {on && <Arrow className="size-4" strokeWidth={2.2} />}
              </button>
            )
          })}
        </div>
        <div>
          <h3 className="pop-h">显示</h3>
          <Seg label="显示方式" glass={false} items={DENSITIES} value={view.density} onChange={view.setDensity} className="grid w-full grid-cols-3 [&>button]:justify-center" />
        </div>
      </Popover>

      {/* 书库里的封面一起飞上画廊那面墙（见 gallery/readMorph 的 enterGalleryFromLibrary） */}
      <GlassLink
        to="/library/gallery"
        viewTransition
        onClick={(e) => plainClick(e) && !window.matchMedia('(prefers-reduced-motion: reduce)').matches && enterGalleryFromLibrary()}
        // 指到按钮上就先载入画廊页的代码：第一次点开时过场不用边飞边等下载和解析
        onPointerEnter={prefetchGallery}
        onFocus={prefetchGallery}
        className="gbtn rounded-full no-underline max-sm:size-11 max-sm:px-0"
        aria-label="书库画廊"
        title="书库画廊"
      >
        <Images className="size-[18px]" strokeWidth={1.8} />
        <span className="max-sm:hidden" aria-hidden>画廊</span>
      </GlassLink>

      <Glass as="button" type="button" className={cn('rounded-full', 'gbtn max-sm:size-11 max-sm:px-0', selecting && 'bg-g-hi')} aria-pressed={selecting} onClick={onToggleSelect}>
        {selecting ? <Check className="size-[18px]" strokeWidth={2} /> : <CheckSquare className="size-[18px]" strokeWidth={1.8} />}
        <span className="max-sm:hidden">{selecting ? '完成' : '选择'}</span>
      </Glass>

      <Glass as="button"
          type="button"
          className="gicon rounded-full"
          onClick={onRefresh}
          disabled={!!updating}
          aria-label="检查书库更新"
          title={updating ? `正在检查更新 ${updating.finished}/${updating.total}` : '检查书库更新'}
        >
        <RefreshCw className={cn('size-[18px]', updating && 'animate-spin')} strokeWidth={1.8} />
      </Glass>
    </div>
  )
}
