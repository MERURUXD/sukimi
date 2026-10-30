import { ArrowDown, ArrowUp, Check, CheckSquare, Minus, Plus, RefreshCw, Search, SlidersHorizontal, X } from 'lucide-react'
import { AnimatePresence } from 'motion/react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Glass } from '@/components/glass/Glass'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { Popover } from '@/components/ui/Popover'
import { Seg, type SegItem } from '@/components/ui/Seg'
import { useMobile } from '@/features/gallery/hooks'
import { cn } from '@/lib/cn'
import { FILTERS, SORTS } from './filtering'
import { useLibraryView, type BadgeKey, type Density, type LibraryTab, type SublineKey, type TitleLines } from './store'
import { t } from '@/i18n'

const DENSITIES: SegItem<Density>[] = [
  { value: 'comfy', label: t('library.toolbar.comfy') },
  { value: 'compact', label: t('library.toolbar.compact') },
  { value: 'list', label: t('library.toolbar.list') },
]

const BADGES: { key: BadgeKey; label: string }[] = [
  { key: 'favorite', label: t('library.toolbar.badgeFavorite') },
  { key: 'unread', label: t('library.toolbar.badgeUnread') },
  { key: 'downloaded', label: t('library.toolbar.badgeDownloaded') },
  { key: 'score', label: t('library.toolbar.badgeScore') },
  { key: 'bookmarks', label: t('library.toolbar.badgeBookmarks') },
  { key: 'completed', label: t('library.toolbar.badgeCompleted') },
  { key: 'lang', label: t('library.toolbar.badgeLang') },
]

const TITLE_LINES: SegItem<`${TitleLines}`>[] = [
  { value: '0', label: t('library.toolbar.titleNone') },
  { value: '1', label: t('library.toolbar.titleOne') },
  { value: '2', label: t('library.toolbar.titleTwo') },
]

const SUBLINE: { key: SublineKey; label: string }[] = [
  { key: 'source', label: t('library.toolbar.metaSource') },
  { key: 'time', label: t('library.toolbar.metaTime') },
  { key: 'author', label: t('library.toolbar.metaAuthor') },
  { key: 'genre', label: t('library.toolbar.metaGenre') },
]

/** 每行封面数的可选范围；从「自动」切到固定时先用中间值 */
const COLS = { mobile: { min: 2, max: 6, start: 3 }, desktop: { min: 2, max: 12, start: 6 } }

const COL_MODES: SegItem<'auto' | 'fixed'>[] = [
  { value: 'auto', label: t('library.toolbar.colsAuto') },
  { value: 'fixed', label: t('library.toolbar.colsFixed') },
]

type PanelTab = 'filter' | 'sort' | 'display'

const PANEL_TABS: SegItem<PanelTab>[] = [
  { value: 'filter', label: t('library.toolbar.tabFilter') },
  { value: 'sort', label: t('library.toolbar.tabSort') },
  { value: 'display', label: t('library.toolbar.tabDisplay') },
]

export function LibraryToolbar({
  categories,
  sources,
  tags,
  query,
  onQuery,
  selecting,
  onToggleSelect,
  updating,
  onRefresh,
}: {
  categories: SegItem<LibraryTab>[]
  sources: { id: string; name: string; count: number }[]
  /** 书库里出现过的标签（来源与自建合在一起），多的在前 */
  tags: { name: string; count: number }[]
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
  const activeTags = Object.entries(view.tags)
  const filtering = activeFilters.length > 0 || activeSources.length > 0 || activeTags.length > 0
  // 每行数目按当前屏幕宽窄分开记
  const device = mobile ? 'mobile' : 'desktop'
  const cols = view.cols[device]
  const range = COLS[device]
  const stepCols = (d: number) => view.setCols(device, Math.min(range.max, Math.max(range.min, (cols || range.start) + (cols ? d : 0))))

  const [sourceList, sourceFade] = useScrollFade(sources.length)
  const closePanel = () => setPanel(false)
  const sortLabel = SORTS.find((s) => s.key === view.sort)?.label ?? ''
  const SortDir = view.desc ? ArrowDown : ArrowUp
  // 当前排序显示在按钮上（原来写在页头副标题里，手机上会把箭头挤到第二行）
  const button = (
    <Glass flat as="button"
        type="button"
        className={cn('rounded-full', 'gbtn max-sm:size-11 max-sm:px-0', (panel || filtering) && 'bg-g-hi')}
        aria-expanded={panel}
        aria-label={t('library.toolbar.filterSortAria', { sort: sortLabel, dir: t(view.desc ? 'library.toolbar.desc' : 'library.toolbar.asc') })}
        onClick={() => setPanel((v) => !v)}
      >
      <SlidersHorizontal className="size-[18px]" strokeWidth={1.8} />
      <span className="inline-flex items-center gap-1 max-sm:hidden">
        {sortLabel}
        <SortDir className="size-4" strokeWidth={2} />
      </span>
    </Glass>
  )
  const content = (
    <>
      <Seg label={t('library.toolbar.panelTabs')} glass={false} items={PANEL_TABS} value={tab} onChange={setTab} className="grid w-full shrink-0 grid-cols-3 [&>button]:justify-center" />

      {tab === 'filter' && (
        <>
          <div>
            <h3 className="pop-h">{t('library.toolbar.filterHint')}</h3>
            <div className="flex flex-wrap gap-1.5">
              {FILTERS.map((f) => {
                const st = view.filters[f.key]
                return (
                  <button
                    key={f.key}
                    type="button"
                    className={cn('fopt', st === 1 && 'inc', st === 2 && 'exc')}
                    onClick={() => view.cycleFilter(f.key)}
                    aria-label={t('library.toolbar.filterAria', { label: f.label, state: [t('library.toolbar.stateAny'), t('library.toolbar.stateInclude'), t('library.toolbar.stateExclude')][st] })}
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
                <span className="flex-1">{t('library.toolbar.sources')}</span>
                {view.sources.length > 0 && (
                  <button type="button" onClick={view.clearSources} className="font-semibold tracking-normal text-text">
                    {t('library.toolbar.clear')}
                  </button>
                )}
              </h3>
              {/* 内边距给胶囊的描边留位置，否则最后一行的下沿会被滚动容器裁掉 */}
              <div ref={sourceList} data-fade={sourceFade} className="vfade no-scrollbar -m-1 flex max-h-[180px] flex-wrap gap-1.5 overflow-y-auto overscroll-contain p-1">
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
          {(tags.length > 0 || activeTags.length > 0) && <TagFilter tags={tags} />}
        </>
      )}

      {tab === 'sort' && (
        <div>
          <h3 className="pop-h">{t('library.toolbar.sortHint')}</h3>
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
          <h3 className="pop-h mt-3">{t('library.toolbar.pin')}</h3>
          <button type="button" className="opt" aria-pressed={view.favoriteFirst} onClick={() => view.setFavoriteFirst(!view.favoriteFirst)}>
            <span className="flex-1">{t('library.toolbar.favoriteFirst')}</span>
            {view.favoriteFirst && <Check className="size-4" strokeWidth={2.2} />}
          </button>
        </div>
      )}

      {tab === 'display' && (
        <>
          <div>
            <h3 className="pop-h">{t('library.toolbar.categoryTabs')}</h3>
            <div className="flex flex-wrap gap-1.5">
              <button type="button" className={cn('fopt', view.showFavoriteTab && 'inc')} aria-pressed={view.showFavoriteTab} onClick={() => view.setTabVisible('favorite', !view.showFavoriteTab)}>
                {t('library.tab.favorite')}
              </button>
              <button type="button" className={cn('fopt', view.showLaterTab && 'inc')} aria-pressed={view.showLaterTab} onClick={() => view.setTabVisible('later', !view.showLaterTab)}>
                {t('library.tab.later')}
              </button>
            </div>
          </div>
          <div>
            <h3 className="pop-h">{t('library.toolbar.layout')}</h3>
            <Seg label={t('library.toolbar.layout')} glass={false} items={DENSITIES} value={view.density} onChange={view.setDensity} className="grid w-full grid-cols-3 [&>button]:justify-center" />
          </div>
          {/* 列表没有封面网格，下面几项只对两种网格生效 */}
          {view.density !== 'list' && (
            <>
              <div>
                <h3 className="pop-h flex items-center">
                  <span className="flex-1">{t('library.toolbar.perRow')}</span>
                  <span className="tracking-normal normal-case">{t('library.toolbar.perRowDevice', { device: t(mobile ? 'library.toolbar.devicePhone' : 'library.toolbar.deviceWide') })}</span>
                </h3>
                <div className="flex items-center gap-2">
                  <Seg
                    label={t('library.toolbar.perRow')}
                    glass={false}
                    items={COL_MODES}
                    value={cols ? 'fixed' : 'auto'}
                    onChange={(v) => view.setCols(device, v === 'auto' ? 0 : range.start)}
                    className="grid flex-1 grid-cols-2 [&>button]:justify-center"
                  />
                  <button type="button" className="fopt size-9 justify-center px-0" aria-label={t('library.toolbar.fewer')} disabled={cols === range.min} onClick={() => stepCols(-1)}>
                    <Minus className="size-4" strokeWidth={2.4} />
                  </button>
                  <span className={cn('w-6 text-center font-semibold num', !cols && 'text-faint')} aria-live="polite">{cols || '—'}</span>
                  <button type="button" className="fopt size-9 justify-center px-0" aria-label={t('library.toolbar.more')} disabled={cols === range.max} onClick={() => stepCols(1)}>
                    <Plus className="size-4" strokeWidth={2.4} />
                  </button>
                </div>
              </div>
              <div>
                <h3 className="pop-h">{t('library.toolbar.badges')}</h3>
                <div className="flex flex-wrap gap-1.5">
                  {BADGES.map((b) => (
                    <button key={b.key} type="button" className={cn('fopt', view.badges[b.key] && 'inc')} aria-pressed={view.badges[b.key]} onClick={() => view.toggleBadge(b.key)}>
                      {b.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="pop-h">{t('library.toolbar.belowCover')}</h3>
                <Seg
                  label={t('library.toolbar.titleLabel')}
                  glass={false}
                  items={TITLE_LINES}
                  value={`${view.titleLines}`}
                  onChange={(v) => view.setTitleLines(Number(v) as TitleLines)}
                  className="mb-2.5 grid w-full grid-cols-3 [&>button]:justify-center"
                />
                {view.density === 'compact' ? (
                  <p className="px-1 text-xs text-muted">{t('library.toolbar.compactNote')}</p>
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
        <Seg flat label={t('library.toolbar.categoryAria')} items={categories} value={view.category} onChange={view.setCategory} />
      )}

      {activeFilters.map((f) => (
        <button
          key={f.key}
          type="button"
          onClick={() => view.clearFilter(f.key)}
          aria-label={t('library.toolbar.removeFilter', { label: f.label })}
          className="inline-flex min-h-8 items-center gap-1 rounded-full bg-accent-soft py-0 pr-1.5 pl-3 text-[13px] font-semibold"
        >
          {view.filters[f.key] === 2 ? t('library.toolbar.excludeChip', { label: f.label }) : f.label}
          <X className="size-4 opacity-70" />
        </button>
      ))}

      {activeSources.map((src) => (
        <button
          key={src.id}
          type="button"
          onClick={() => view.toggleSource(src.id)}
          aria-label={t('library.toolbar.removeSource', { name: src.name })}
          className="inline-flex min-h-8 items-center gap-1 rounded-full bg-accent-soft py-0 pr-1.5 pl-3 text-[13px] font-semibold"
        >
          {src.name}
          <X className="size-4 opacity-70" />
        </button>
      ))}

      {activeTags.map(([name, st]) => (
        <button
          key={name}
          type="button"
          onClick={() => view.clearTag(name)}
          aria-label={t('library.toolbar.removeTag', { name })}
          className="inline-flex min-h-8 items-center gap-1 rounded-full bg-accent-soft py-0 pr-1.5 pl-3 text-[13px] font-semibold"
        >
          {st === 2 ? t('library.toolbar.excludeChip', { label: name }) : name}
          <X className="size-4 opacity-70" />
        </button>
      ))}

      <span className="flex-1 max-sm:hidden" />

      <Glass flat as="label" className="flex h-11 min-w-0 flex-[0_1_300px] items-center gap-2.5 rounded-full px-4 text-muted max-sm:flex-[1_1_120px]">
        <Search className="size-[18px] flex-none" strokeWidth={1.8} />
        <span className="sr">{t('library.toolbar.search')}</span>
        <input
          type="search"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder={t('library.toolbar.searchPlaceholder')}
          className="min-w-0 flex-1 border-0 bg-transparent text-text outline-none placeholder:text-faint"
        />
      </Glass>

      {mobile ? button : (
        <Popover
          open={panel}
          onClose={closePanel}
          label={t('library.toolbar.filterSort')}
          fitViewport
          rootClassName="ml-auto"
          className="glass-legible flex w-[360px] max-w-[calc(100vw-32px)] flex-col gap-4 px-4 py-4"
          trigger={button}
        >
          {content}
        </Popover>
      )}
      {mobile && createPortal(
        <AnimatePresence>
          {panel && (
            <BottomSheet id="library-panel" label={t('library.toolbar.filterSort')} closeLabel={t('library.toolbar.closePanel')} onClose={closePanel} className="glass-legible">
              <div className="flex flex-col gap-4 px-2 pt-3 pb-2">{content}</div>
            </BottomSheet>
          )}
        </AnimatePresence>,
        document.body,
      )}

      <Glass flat as="button" type="button" className={cn('rounded-full', 'gbtn max-sm:size-11 max-sm:px-0', selecting && 'bg-g-hi')} aria-pressed={selecting} onClick={onToggleSelect}>
        {selecting ? <Check className="size-[18px]" strokeWidth={2} /> : <CheckSquare className="size-[18px]" strokeWidth={1.8} />}
        <span className="max-sm:hidden">{selecting ? t('library.toolbar.done') : t('library.toolbar.select')}</span>
      </Glass>

      <Glass flat as="button"
          type="button"
          className="gicon rounded-full"
          onClick={onRefresh}
          disabled={!!updating}
          aria-label={t('library.checkUpdates')}
          title={updating ? t('library.checking', { done: updating.finished, total: updating.total }) : t('library.checkUpdates')}
        >
        <RefreshCw className={cn('size-[18px]', updating && 'animate-spin')} strokeWidth={1.8} />
      </Glass>
    </div>
  )
}

/** 标签多到要翻时才给搜索框 */
const TAG_SEARCH_MIN = 12

/** 系统滚动条在玻璃面板上很突兀：隐藏它，改为哪头还有内容哪头渐隐，提示这里能滚 */
function useScrollFade(dep: number) {
  // 用回调 ref：来源列表只在「筛选」页签挂载，切页签时要重新绑定
  const [el, ref] = useState<HTMLDivElement | null>(null)
  const [fade, setFade] = useState<'t' | 'b' | 'tb' | undefined>()
  useEffect(() => {
    if (!el) return
    const measure = () => {
      const top = el.scrollTop > 2
      const bottom = el.scrollTop + el.clientHeight < el.scrollHeight - 2
      setFade(top && bottom ? 'tb' : top ? 't' : bottom ? 'b' : undefined)
    }
    measure()
    el.addEventListener('scroll', measure, { passive: true })
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', measure)
      ro.disconnect()
    }
  }, [el, dep])
  return [ref, fade] as const
}

/** 筛选面板里的标签组：和上面的筛选一样点一下包含、再点排除；选中的排在最前，搜索时也不藏起来 */
function TagFilter({ tags }: { tags: { name: string; count: number }[] }) {
  const picks = useLibraryView((s) => s.tags)
  const cycleTag = useLibraryView((s) => s.cycleTag)
  const clearTags = useLibraryView((s) => s.clearTags)
  const [q, setQ] = useState('')
  const needle = q.trim().toLowerCase()
  const picked = Object.keys(picks)
  const pickedSet = new Set(picked.map((n) => n.toLowerCase()))
  const count = new Map(tags.map((x) => [x.name.toLowerCase(), x.count]))
  const rest = tags.filter((x) => !pickedSet.has(x.name.toLowerCase()) && (!needle || x.name.toLowerCase().includes(needle)))
  const shown = [...picked.map((name) => ({ name, count: count.get(name.toLowerCase()) ?? 0 })), ...rest]
  const [list, fade] = useScrollFade(shown.length)
  return (
    <div>
      <h3 className="pop-h flex items-center">
        <span className="flex-1">{t('library.toolbar.tags')}</span>
        {picked.length > 0 && (
          <button type="button" onClick={clearTags} className="font-semibold tracking-normal text-text">
            {t('library.toolbar.clear')}
          </button>
        )}
      </h3>
      {tags.length > TAG_SEARCH_MIN && (
        <label className="plain mb-2 flex h-9 items-center gap-2 rounded-full px-3 text-muted">
          <Search className="size-4 flex-none" strokeWidth={1.8} />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('library.toolbar.tagSearch')} aria-label={t('library.toolbar.tagSearch')} className="min-w-0 flex-1 border-0 bg-transparent text-[13px] text-text outline-none placeholder:text-faint" />
        </label>
      )}
      {/* 内边距给胶囊的描边留位置，否则最后一行的下沿会被滚动容器裁掉 */}
      <div ref={list} data-fade={fade} className="vfade no-scrollbar -m-1 flex max-h-[180px] flex-wrap gap-1.5 overflow-y-auto overscroll-contain p-1">
        {shown.map(({ name, count: n }) => {
          // 标签名可能撞上 constructor 这类对象自带的属性名，只认自己的键
          const st = Object.hasOwn(picks, name) ? picks[name] : 0
          return (
            <button
              key={name}
              type="button"
              className={cn('fopt', st === 1 && 'inc', st === 2 && 'exc')}
              onClick={() => cycleTag(name)}
              aria-label={t('library.toolbar.filterAria', { label: name, state: [t('library.toolbar.stateAny'), t('library.toolbar.stateInclude'), t('library.toolbar.stateExclude')][st] })}
            >
              {st === 1 && <Plus className="size-3.5" strokeWidth={2.6} />}
              {st === 2 && <Minus className="size-3.5" strokeWidth={2.6} />}
              {name}
              <span className="text-[11px] opacity-60 num">{n}</span>
            </button>
          )
        })}
        {shown.length === 0 && <span className="px-1 text-[13px] text-muted">{t('library.toolbar.tagNone')}</span>}
      </div>
    </div>
  )
}
