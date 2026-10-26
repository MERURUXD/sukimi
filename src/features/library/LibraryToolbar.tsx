import { ArrowDown, ArrowUp, Check, CheckSquare, Minus, Plus, RefreshCw, Search, SlidersHorizontal, X } from 'lucide-react'
import { AnimatePresence } from 'motion/react'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Glass } from '@/components/glass/Glass'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { Popover } from '@/components/ui/Popover'
import { Seg, type SegItem } from '@/components/ui/Seg'
import { useMobile } from '@/features/gallery/hooks'
import { cn } from '@/lib/cn'
import { FILTERS, SORTS } from './filtering'
import { useLibraryView, type BadgeKey, type Density, type LibraryTab, type SublineKey, type TitleLines } from './store'

const DENSITIES: SegItem<Density>[] = [
  { value: 'comfy', label: '舒适网格' },
  { value: 'compact', label: '紧凑网格' },
  { value: 'list', label: '列表' },
]

const BADGES: { key: BadgeKey; label: string }[] = [
  { key: 'favorite', label: '特别关心' },
  { key: 'unread', label: '未读数' },
  { key: 'downloaded', label: '已下载' },
  { key: 'score', label: '评分' },
  { key: 'bookmarks', label: '书签数' },
  { key: 'completed', label: '已完结' },
  { key: 'lang', label: '语言' },
]

const TITLE_LINES: SegItem<`${TitleLines}`>[] = [
  { value: '0', label: '不显示标题' },
  { value: '1', label: '标题一行' },
  { value: '2', label: '标题两行' },
]

const SUBLINE: { key: SublineKey; label: string }[] = [
  { key: 'source', label: '来源' },
  { key: 'time', label: '更新时间' },
  { key: 'author', label: '作者' },
  { key: 'genre', label: '题材标签' },
]

/** 每行封面数的可选范围；从「自动」切到固定时先用中间值 */
const COLS = { mobile: { min: 2, max: 6, start: 3 }, desktop: { min: 2, max: 12, start: 6 } }

const COL_MODES: SegItem<'auto' | 'fixed'>[] = [
  { value: 'auto', label: '自动' },
  { value: 'fixed', label: '固定' },
]

type PanelTab = 'filter' | 'sort' | 'display'

const PANEL_TABS: SegItem<PanelTab>[] = [
  { value: 'filter', label: '筛选' },
  { value: 'sort', label: '排序' },
  { value: 'display', label: '显示' },
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
  categories: SegItem<LibraryTab>[]
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
  const [tab, setTab] = useState<PanelTab>('filter')
  // 手机上用底部面板，桌面用锚定在按钮旁的弹出层
  const mobile = useMobile()
  const activeFilters = FILTERS.filter((f) => view.filters[f.key] !== 0)
  const activeSources = view.sources.map((id) => ({ id, name: sources.find((x) => x.id === id)?.name ?? id }))
  const filtering = activeFilters.length > 0 || activeSources.length > 0
  // 每行数目按当前屏幕宽窄分开记
  const device = mobile ? 'mobile' : 'desktop'
  const cols = view.cols[device]
  const range = COLS[device]
  const stepCols = (d: number) => view.setCols(device, Math.min(range.max, Math.max(range.min, (cols || range.start) + (cols ? d : 0))))

  const closePanel = () => setPanel(false)
  const button = (
    <Glass flat as="button"
        type="button"
        className={cn('rounded-full', 'gbtn max-sm:size-11 max-sm:px-0', (panel || filtering) && 'bg-g-hi')}
        aria-expanded={panel}
        onClick={() => setPanel((v) => !v)}
      >
      <SlidersHorizontal className="size-[18px]" strokeWidth={1.8} />
      <span className="max-sm:hidden">筛选与排序</span>
    </Glass>
  )
  const content = (
    <>
      <Seg label="面板分页" glass={false} items={PANEL_TABS} value={tab} onChange={setTab} className="grid w-full grid-cols-3 [&>button]:justify-center" />

      {tab === 'filter' && (
        <>
          <div>
            <h3 className="pop-h">点击包含，再次点击排除</h3>
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
              {/* 内边距给胶囊的描边留位置，否则最后一行的下沿会被滚动容器裁掉 */}
              <div className="-m-1 flex max-h-[180px] flex-wrap gap-1.5 overflow-y-auto p-1">
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
        </>
      )}

      {tab === 'sort' && (
        <div>
          <h3 className="pop-h">再次点击切换排序方向</h3>
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
          <h3 className="pop-h mt-3">置顶</h3>
          <button type="button" className="opt" aria-pressed={view.favoriteFirst} onClick={() => view.setFavoriteFirst(!view.favoriteFirst)}>
            <span className="flex-1">特别关心排在最前</span>
            {view.favoriteFirst && <Check className="size-4" strokeWidth={2.2} />}
          </button>
        </div>
      )}

      {tab === 'display' && (
        <>
          <div>
            <h3 className="pop-h">显示方式</h3>
            <Seg label="显示方式" glass={false} items={DENSITIES} value={view.density} onChange={view.setDensity} className="grid w-full grid-cols-3 [&>button]:justify-center" />
          </div>
          {/* 列表没有封面网格，下面几项只对两种网格生效 */}
          {view.density !== 'list' && (
            <>
              <div>
                <h3 className="pop-h flex items-center">
                  <span className="flex-1">每行数目</span>
                  <span className="tracking-normal normal-case">{mobile ? '手机' : '宽屏'}单独设置</span>
                </h3>
                <div className="flex items-center gap-2">
                  <Seg
                    label="每行数目"
                    glass={false}
                    items={COL_MODES}
                    value={cols ? 'fixed' : 'auto'}
                    onChange={(v) => view.setCols(device, v === 'auto' ? 0 : range.start)}
                    className="grid flex-1 grid-cols-2 [&>button]:justify-center"
                  />
                  <button type="button" className="fopt size-9 justify-center px-0" aria-label="每行减少一部" disabled={cols === range.min} onClick={() => stepCols(-1)}>
                    <Minus className="size-4" strokeWidth={2.4} />
                  </button>
                  <span className={cn('w-6 text-center font-semibold num', !cols && 'text-faint')} aria-live="polite">{cols || '—'}</span>
                  <button type="button" className="fopt size-9 justify-center px-0" aria-label="每行增加一部" disabled={cols === range.max} onClick={() => stepCols(1)}>
                    <Plus className="size-4" strokeWidth={2.4} />
                  </button>
                </div>
              </div>
              <div>
                <h3 className="pop-h">封面标记</h3>
                <div className="flex flex-wrap gap-1.5">
                  {BADGES.map((b) => (
                    <button key={b.key} type="button" className={cn('fopt', view.badges[b.key] && 'inc')} aria-pressed={view.badges[b.key]} onClick={() => view.toggleBadge(b.key)}>
                      {b.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="pop-h">封面下文字</h3>
                <Seg
                  label="标题"
                  glass={false}
                  items={TITLE_LINES}
                  value={`${view.titleLines}`}
                  onChange={(v) => view.setTitleLines(Number(v) as TitleLines)}
                  className="mb-2.5 grid w-full grid-cols-3 [&>button]:justify-center"
                />
                {view.density === 'compact' ? (
                  <p className="px-1 text-xs text-muted">紧凑网格只显示标题。</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {SUBLINE.map((x) => (
                      <button key={x.key} type="button" className={cn('fopt', view.subline[x.key] && 'inc')} aria-pressed={view.subline[x.key]} onClick={() => view.toggleSubline(x.key)}>
                        {x.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}
    </>
  )

  return (
    <div className="mb-6 flex flex-wrap items-center gap-2.5">
      {categories.length > 1 && (
        <Seg flat label="分类" items={categories} value={view.category} onChange={view.setCategory} />
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

      <Glass flat as="label" className="flex h-11 min-w-0 flex-[0_1_300px] items-center gap-2.5 rounded-full px-4 text-muted max-sm:flex-[1_1_120px]">
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

      {mobile ? button : (
        <Popover
          open={panel}
          onClose={closePanel}
          label="筛选与排序"
          fitViewport
          className="glass-legible flex w-[360px] max-w-[calc(100vw-32px)] flex-col gap-4 px-4 py-4"
          trigger={button}
        >
          {content}
        </Popover>
      )}
      {mobile && createPortal(
        <AnimatePresence>
          {panel && (
            <BottomSheet id="library-panel" label="筛选与排序" closeLabel="关闭筛选与排序" onClose={closePanel} className="glass-legible">
              <div className="flex flex-col gap-4 px-2 pt-3 pb-2">{content}</div>
            </BottomSheet>
          )}
        </AnimatePresence>,
        document.body,
      )}

      <Glass flat as="button" type="button" className={cn('rounded-full', 'gbtn max-sm:size-11 max-sm:px-0', selecting && 'bg-g-hi')} aria-pressed={selecting} onClick={onToggleSelect}>
        {selecting ? <Check className="size-[18px]" strokeWidth={2} /> : <CheckSquare className="size-[18px]" strokeWidth={1.8} />}
        <span className="max-sm:hidden">{selecting ? '完成' : '选择'}</span>
      </Glass>

      <Glass flat as="button"
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
