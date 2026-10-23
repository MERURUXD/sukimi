import { useApolloClient, useQuery } from '@apollo/client/react'
import { BookmarkCheck, ExternalLink, Puzzle, Search, SlidersHorizontal } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type MouseEvent, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Glass } from '@/components/glass/Glass'
import { CoverImg } from '@/components/manga/CoverImg'
import { Seg } from '@/components/ui/Seg'
import { Popover } from '@/components/ui/Popover'
import { usePrefetchManga } from '@/features/manga/prefetch'
import { MangaMenuItems } from '@/features/favorite/MangaMenuItems'
import { useLongPress } from '@/lib/useLongPress'
import { sfwAttr } from '@/lib/devSafe'
import { cn } from '@/lib/cn'
import { riseStep } from '@/lib/intro'
import { LibrarySkeleton } from '@/features/library/LibraryGrid'
import type { FilterChangeInput } from '@/api/gql/graphql'
import { resetOnUserContext } from '@/api/userContext'
import { sourceBrowseKey } from './filters'
import { SourceFilterPanel } from './SourceFilterPanel'
import { SourceIcon } from './SourceIcon'
import { onlineSources, summarizeMultiSearch, useMultiSourceSearch, type SearchResults } from './multiSearch'
import { ExtensionUpdateCount, FetchSourceManga, langLabel, Sources, type Source, type SourceManga } from './queries'

type Mode = 'POPULAR' | 'LATEST' | 'SEARCH'

/** 封面触屏长按、鼠标右键打开「稍后再看 / 特别关心」菜单；单来源网格和全局搜索结果共用 */
function MangaMenu({ m, align = 'left', children }: {
  m: Pick<SourceManga, 'id' | 'title' | 'inLibrary'>
  align?: 'left' | 'right'
  children: (open: ReturnType<typeof useLongPress> & { onContextMenu: (e: MouseEvent) => void; 'aria-haspopup': 'menu' }) => ReactNode
}) {
  const [menu, setMenu] = useState(false)
  const close = useCallback(() => setMenu(false), [])
  const press = useLongPress(() => setMenu(true))
  const open = {
    ...press,
    onContextMenu: (e: MouseEvent) => {
      e.preventDefault()
      setMenu(true)
    },
    'aria-haspopup': 'menu' as const,
  }
  return (
    <Popover open={menu} onClose={close} trigger={children(open)} align={align} label={`${m.title} 的操作`} rootClassName="min-w-0" className="w-[220px]">
      <MangaMenuItems mangaId={m.id} inLibrary={m.inLibrary} onDone={close} />
    </Popover>
  )
}

/** 浏览结果的封面网格 */
function MangaTile({ m, source, rise }: { m: SourceManga; source: string; rise?: CSSProperties }) {
  const prefetch = usePrefetchManga(m.id)
  return <MangaMenu m={m}>{(open) => (
    <Link
      to={`/manga/${m.id}`}
      viewTransition
      {...prefetch}
      {...open}
      data-sfw={sfwAttr(source)}
      style={rise}
      className={cn('group flex min-w-0 flex-col gap-2 text-text no-underline', rise && 'rise')}
    >
      <span className="cv rounded-xl shadow-[0_12px_28px_rgba(0,0,0,.28)] transition-transform duration-200 group-hover:-translate-y-[3px]">
        <CoverImg src={m.thumbnailUrl} loading="lazy" />
        {m.inLibrary && (
          <span className="absolute bottom-2 left-2 z-[2] inline-flex h-[26px] items-center gap-1 rounded-full border border-white/20 bg-black/45 px-2.5 text-xs font-bold text-white backdrop-blur-[14px]">
            <BookmarkCheck className="size-3.5" strokeWidth={2.2} />
            已在书库
          </span>
        )}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate font-semibold">{m.title}</span>
        {m.author && <span className="truncate text-[13px] text-muted">{m.author}</span>}
      </span>
    </Link>
  )}</MangaMenu>
}

export function BrowsePage() {
  const { data } = useQuery(Sources)
  const sources = useMemo(
    // 本地源放最后
    () => [...(data?.sources.nodes ?? [])].sort((a, b) => Number(a.id === '0') - Number(b.id === '0') || a.displayName.localeCompare(b.displayName)),
    [data],
  )
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const [input, setInput] = useState(q)
  const sourceId = params.get('source') ?? sources.find((s) => s.id !== '0')?.id ?? sources[0]?.id
  const current = sources.find((s) => s.id === sourceId)
  const mode = (params.get('mode') as Mode | null) ?? (q ? 'SEARCH' : 'POPULAR')

  const set = (patch: Record<string, string | null>) =>
    setParams(
      (p) => {
        const n = new URLSearchParams(p)
        for (const [k, v] of Object.entries(patch)) {
          if (v == null) n.delete(k)
          else n.set(k, v)
        }
        return n
      },
      { replace: true },
    )

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const v = input.trim()
    set({ q: v || null, mode: v ? 'SEARCH' : null })
  }

  const groups = useMemo(() => {
    const m = new Map<string, Source[]>()
    for (const s of sources) m.set(s.lang, [...(m.get(s.lang) ?? []), s])
    return [...m.entries()]
  }, [sources])
  const searchSources = useMemo(() => onlineSources(sources), [sources])
  // 有可更新的扩展时在入口上显示数量
  const updates = useQuery(ExtensionUpdateCount, { fetchPolicy: 'cache-and-network' }).data?.extensions.totalCount ?? 0

  return (
    <div className="wrap">
      <div className="flex flex-col items-center gap-[18px] pt-9 pb-8 text-center">
        <h1 className="m-0 font-cjk text-[40px] font-black">发现</h1>
        <form onSubmit={submit} className="w-[min(680px,100%)]">
          <Glass as="label" className="flex h-12 items-center gap-2.5 rounded-full px-[18px] text-muted">
            <Search className="size-5 flex-none" strokeWidth={1.8} />
            <span className="sr">全局搜索</span>
            <input
              type="search"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="在所有在线源中搜索，回车开始"
              className="min-w-0 flex-1 border-0 bg-transparent text-[15px] text-text outline-none placeholder:text-faint"
            />
            <span className="text-[13px] whitespace-nowrap num">{searchSources.length} 个在线源</span>
          </Glass>
        </form>
      </div>

      {q && <GlobalSearch q={q} sources={searchSources} onOpen={(id) => set({ source: id, mode: 'SEARCH' })} />}

      <div className="flex flex-wrap items-start gap-7 pb-20">
        <aside aria-label="漫画源列表" className="max-w-[300px] min-w-0 flex-[1_1_260px] border-r border-line pr-4 pb-2.5 max-md:max-w-none max-md:border-r-0 max-md:pr-0">
          <div className="mb-1 flex items-center gap-2 pl-3">
            <h2 className="m-0 flex-1 text-[22px] font-bold">漫画源</h2>
            <Link to="/browse/extensions" className="rounded-full text-text no-underline">
              <Glass as="span" className="gbtn min-h-10 rounded-full">
                <Puzzle className="size-[18px]" strokeWidth={1.8} />
                扩展
                {updates > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-solid px-1.5 text-[11px] font-bold text-on-solid num">{updates}</span>}
              </Glass>
            </Link>
          </div>
          {groups.map(([lang, list]) => (
            <div key={lang}>
              <div className="px-3 pt-3.5 pb-1.5 text-xs font-bold tracking-[.08em] text-muted">{langLabel(lang)}</div>
              {list.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={s.id === sourceId}
                  onClick={() => set({ source: s.id, mode: null })}
                  className={cn(
                    'flex min-h-[54px] w-full items-center gap-3 rounded-[14px] px-2.5 py-1.5 text-left transition-colors',
                    s.id === sourceId ? 'bg-accent-soft' : 'hover:bg-hover',
                  )}
                >
                  <SourceIcon s={s} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="line-clamp-2 leading-snug font-semibold break-words" title={s.displayName}>{s.displayName}</span>
                    <span className="truncate text-[13px] text-muted">
                      {[s.supportsLatest ? '支持最新' : null, s.contentWarning === 'NSFW' ? '含成人内容' : s.contentWarning === 'MIXED' ? '部分成人内容' : null]
                        .filter(Boolean)
                        .join(' · ') || ' '}
                    </span>
                  </span>
                  <span className="rounded-md border border-line px-1.5 text-[11px] font-semibold text-muted">{s.lang === 'localsourcelang' ? '本地' : s.lang.toUpperCase()}</span>
                </button>
              ))}
            </div>
          ))}
        </aside>

        {current && <SourceBrowser key={current.id} source={current} mode={mode} q={q} onMode={(m) => set({ mode: m })} />}
      </div>
    </div>
  )
}

/* ───────── 单个源的浏览 ───────── */

/**
 * 已加载的结果按来源、方式、关键词和筛选条件留在内存里（本次会话内）。
 * 从详情页返回时直接恢复列表和滚动位置，不用重新向来源请求，封面也能飞回原来的格子。
 */
const loaded = new Map<string, { items: SourceManga[]; page: number; hasNext: boolean }>()
const appliedFilters = new Map<string, FilterChangeInput[]>()

export function SourceBrowser({ source, mode, q, onMode }: { source: Source; mode: Mode; q: string; onMode: (m: Mode) => void }) {
  const [filters, setFilters] = useState(() => appliedFilters.get(source.id) ?? [])
  const [panel, setPanel] = useState(false)
  const [revision, setRevision] = useState(0)
  const filterButton = useRef<HTMLElement>(null)
  const panelId = `source-filters-${source.id}`
  const key = sourceBrowseKey(source.id, mode, q, filters)
  const closePanel = () => {
    setPanel(false)
    filterButton.current?.focus()
  }
  const apply = (changes: FilterChangeInput[]) => {
    appliedFilters.set(source.id, changes)
    setFilters(changes)
    // 显式应用时从第一页重新搜索；返回详情时仍可复用已经加载的结果。
    loaded.delete(sourceBrowseKey(source.id, 'SEARCH', q, changes))
    setRevision((value) => value + 1)
    closePanel()
    onMode('SEARCH')
  }
  const modes = [
    { value: 'POPULAR' as Mode, label: '热门' },
    ...(source.supportsLatest ? [{ value: 'LATEST' as Mode, label: '最新' }] : []),
    ...(q || filters.length > 0 || mode === 'SEARCH' ? [{ value: 'SEARCH' as Mode, label: q ? `搜索「${q}」` : '筛选结果' }] : []),
  ]

  return (
    <section aria-labelledby="h-src" className="min-w-0 flex-[999_1_520px]">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <SourceIcon s={source} size={44} />
        <div className="min-w-0 flex-auto">
          <h2 id="h-src" className="m-0 text-[22px] font-bold">{source.displayName}</h2>
          <span className="text-xs text-muted">{langLabel(source.lang)}</span>
        </div>
        <Seg label="浏览方式" items={modes} value={mode} onChange={onMode} />
        {source.id !== '0' && (
          <Popover
            id={panelId}
            label="来源筛选"
            fitViewport
            open={panel}
            onClose={closePanel}
            className="w-[400px] max-w-[calc(100vw-32px)] px-4 py-4 [--g-drop:0_0_0_transparent] [&_.solid]:shadow-none max-md:fixed max-md:inset-x-4 max-md:top-4 max-md:w-auto"
            trigger={
              <Glass as="button" ref={filterButton} type="button" aria-expanded={panel} aria-controls={panelId} aria-haspopup="dialog" onClick={() => setPanel((value) => !value)} className={cn('gbtn rounded-full [--g-drop:0_0_0_transparent]', (panel || (mode === 'SEARCH' && filters.length > 0)) && 'bg-g-hi')}>
                <SlidersHorizontal className="size-[18px]" strokeWidth={1.8} />
                来源筛选{mode === 'SEARCH' && filters.length > 0 && <span className="text-xs num">{filters.length}</span>}
              </Glass>
            }
          >
            <SourceFilterPanel sourceId={source.id} applied={filters} onApply={apply} onClose={closePanel} />
          </Popover>
        )}
        {source.homeUrl && (
          <Glass as="a" href={source.homeUrl} target="_blank" rel="noreferrer" className="gicon size-10 rounded-full" aria-label="打开来源网站" title="打开来源网站">
            <ExternalLink className="size-[18px]" strokeWidth={1.8} />
          </Glass>
        )}
      </div>
      {mode === 'SEARCH' && filters.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-3 text-sm text-muted">
          <span>已应用 {filters.length} 项来源筛选</span>
          <button type="button" className="font-semibold text-text" onClick={() => apply([])}>清除筛选</button>
        </div>
      )}
      <SourceResults key={`${key}|${revision}`} source={source} mode={mode} q={q} filters={filters} />
    </section>
  )
}

function SourceResults({ source, mode, q, filters }: { source: Source; mode: Mode; q: string; filters: FilterChangeInput[] }) {
  const client = useApolloClient()
  const key = sourceBrowseKey(source.id, mode, q, filters)
  const [saved] = useState(() => loaded.get(key))
  const [items, setItems] = useState<SourceManga[]>(saved?.items ?? [])
  const [page, setPage] = useState(saved?.page ?? 0)
  const [hasNext, setHasNext] = useState(saved?.hasNext ?? true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const busy = useRef(false)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])
  // 最近一批从网络加载的条目从第几个开始，只给这一批播进场动画（恢复出来的不播）
  const [batchFrom, setBatchFrom] = useState(items.length)

  useEffect(() => {
    loaded.set(key, { items, page, hasNext })
  }, [key, items, page, hasNext])

  const loadMore = useCallback(async () => {
    if (busy.current || !hasNext) return
    busy.current = true
    setLoading(true)
    setError(null)
    try {
      const { data } = await client.mutate({
        mutation: FetchSourceManga,
        variables: { source: source.id, type: mode, page: page + 1, query: mode === 'SEARCH' ? q : undefined, filters: mode === 'SEARCH' ? filters : undefined },
      })
      if (!mounted.current) return
      const r = data?.fetchSourceManga
      if (!r) throw new Error('来源没有返回结果，请重试')
      const seen = new Set(items.map((m) => m.id))
      setBatchFrom(items.length)
      setItems((prev) => [...prev, ...(r?.mangas ?? []).filter((m) => !seen.has(m.id))])
      setHasNext(!!r?.hasNextPage)
      setPage((p) => p + 1)
    } catch (e) {
      if (mounted.current) setError((e as Error).message.split('\n')[0])
    } finally {
      busy.current = false
      if (mounted.current) setLoading(false)
    }
  }, [client, source.id, mode, q, filters, page, hasNext, items])

  // 首屏 + 滚到底自动加载
  const sentinel = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = sentinel.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => e.isIntersecting && void loadMore(), { rootMargin: '800px' })
    io.observe(el)
    return () => io.disconnect()
  }, [loadMore])

  return (
    <>
      {items.length > 0 && <p className="mb-4 text-xs text-muted">已加载 {items.length} 部</p>}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-x-[18px] gap-y-[26px]">
        {items.map((m, i) => (
          <MangaTile key={m.id} m={m} source={source.displayName} rise={i >= batchFrom ? riseStep(i - batchFrom) : undefined} />
        ))}
      </div>
      {loading && items.length === 0 && <LibrarySkeleton density="comfy" />}
      {error && (
        <div className="py-8 text-center">
          <p className="m-0 text-danger">加载失败：{error}</p>
          <button type="button" className="gbtn mt-3 bg-accent-soft" onClick={() => void loadMore()}>
            重试
          </button>
        </div>
      )}
      {!error && !loading && !hasNext && items.length === 0 && <p className="py-16 text-center text-muted">没有结果</p>}
      {loading && items.length > 0 && <p className="py-6 text-center text-muted">正在从来源加载…</p>}
      {!error && hasNext && <div ref={sentinel} className="h-px" />}
    </>
  )
}

/* ───────── 全局搜索：所有源并行（最多同时 3 个） ───────── */
/** 搜过的关键词结果留在内存里，从详情页返回时不用重新搜 */
const searched = new Map<string, SearchResults>()
// 来源浏览与搜索结果带着按用户的 inLibrary，也受权限（成人来源）影响，换身份时清空
resetOnUserContext(() => {
  loaded.clear()
  appliedFilters.clear()
  searched.clear()
})

function GlobalSearch({ q, sources, onOpen }: { q: string; sources: Source[]; onOpen: (id: string) => void }) {
  const { results, retry } = useMultiSourceSearch(q, sources, searched)
  const summary = summarizeMultiSearch(sources, results)

  return (
    <section aria-labelledby="h-gs" className="mb-9">
      <div className="mb-3.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 id="h-gs" className="m-0 text-[22px] font-bold">
          全局搜索「{q}」
        </h2>
        <span className="text-[13px] text-muted num">
          已完成 {summary.done} / {summary.total} 个在线源{summary.failed > 0 ? ` · 失败 ${summary.failed}` : ''}
        </span>
        {summary.failed > 0 && summary.loading === 0 && (
          <button type="button" className="text-[13px] font-semibold text-text hover:underline" onClick={() => retry()}>
            重试失败来源
          </button>
        )}
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-3.5">
        {sources.map((s) => {
          const r = results[s.id]
          return (
            <div key={s.id} className="flex flex-col gap-3 bg-[linear-gradient(var(--line),var(--line))] bg-[length:100%_1px] bg-no-repeat pt-4">
              <div className="flex items-center gap-2.5">
                <button type="button" onClick={() => onOpen(s.id)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
                  <SourceIcon s={s} size={28} />
                  <span className="flex-1 truncate font-semibold">{s.displayName}</span>
                  {r?.status !== 'error' && (
                    <span className="text-xs text-muted">
                      {!r || r.status === 'loading' ? '搜索中…' : r.items.length ? `${r.items.length} 个结果 · 查看全部` : '无结果'}
                    </span>
                  )}
                </button>
                {r?.status === 'error' && (
                  <button
                    type="button"
                    onClick={() => retry([s.id])}
                    className="flex-none rounded-full px-2.5 py-1 text-xs font-semibold text-danger transition-colors hover:bg-hover"
                    aria-label={`重试 ${s.displayName}`}
                  >
                    搜索失败 · 重试
                  </button>
                )}
              </div>
              <div className="grid min-h-[60px] grid-cols-4 gap-2.5">
                {r?.items.slice(0, 4).map((m, i) => (
                  // 一行四个，右半边的菜单向左展开，不超出屏幕
                  <MangaMenu key={m.id} m={m} align={i < 2 ? 'left' : 'right'}>{(open) => (
                    <Link to={`/manga/${m.id}`} viewTransition {...open} data-sfw={sfwAttr(s.displayName)} className="cv block rounded-lg" aria-label={m.title} title={m.title}>
                      <CoverImg src={m.thumbnailUrl} loading="lazy" />
                    </Link>
                  )}</MangaMenu>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
