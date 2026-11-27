import { useApolloClient, useMutation, useQuery } from '@apollo/client/react'
import { Play, Search, Trash2 } from 'lucide-react'
import { useWindowVirtualizer } from '@tanstack/react-virtual'
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import type { Reference } from '@apollo/client'
import { useAuth } from '@/api/auth'
import { rememberLoadedWindow } from '@/api/paging'
import { useRestoredOffset } from '@/app/ScrollManager'
import { Glass } from '@/components/glass/Glass'
import { CoverImg } from '@/components/manga/CoverImg'
import { confirm } from '@/components/ui/Confirm'
import { LoadError } from '@/components/ui/LoadError'
import { PageHeader } from '@/components/ui/PageHeader'
import { toast, toastError } from '@/components/ui/toast'
import { usePrefetchManga } from '@/features/manga/prefetch'
import { FROM_DETAIL } from '@/features/reader/nav'
import { sfwAttr } from '@/lib/devSafe'
import { useNsfwBlur } from '@/features/nsfw/useNsfw'
import { chapterLabel, clock, count, dayLabel } from '@/lib/format'
import { cn } from '@/lib/cn'
import { riseStep, useIntro } from '@/lib/intro'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { groupHistory, hiddenKey, hiddenValue, visibleHistoryCount, type HistoryEntry } from './history'
import { HideHistory, History, type HistoryItem } from './queries'
import { HISTORY_PAGE, historyVariables } from './pagination'
import { t } from '@/i18n'

export function HistoryPage() {
  const client = useApolloClient()
  const [variables] = useState(() => historyVariables(client.cache))
  const history = useQuery(History, {
    variables,
    fetchPolicy: 'cache-and-network',
    notifyOnNetworkStatusChange: true,
  })
  const { data, loading, error, fetchMore } = history
  const [introWanted] = useState(() => !data)
  const intro = useIntro(introWanted, !!data)
  const userId = useAuth((s) => s.user?.id)
  const [query, setQuery] = useState('')
  const list = useMemo(() => data?.chapters.nodes ?? [], [data])
  const hasMore = data?.chapters.pageInfo.hasNextPage ?? false

  const q = query.trim().toLowerCase()
  const days = useMemo(() => {
    const hits = q ? list.filter((c) => c.manga.title.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)) : list
    return groupHistory(hits, (t) => dayLabel(t), userId)
  }, [list, q, userId])

  const more = () => {
    const offset = list.length
    // 新的一页由缓存的分页合并接到后面（见 api/cache.ts）
    return fetchMore({ variables: { first: HISTORY_PAGE, offset } }).then((result) => {
      const added = result.data?.chapters.nodes.length ?? 0
      if (added) rememberLoadedWindow(history.observable, offset + added, HISTORY_PAGE)
    })
  }

  // 滚到底自动加载；搜索时交由下方按钮按需加载更早记录，避免无命中时连续翻完整个历史
  const sentinel = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = sentinel.current
    if (!el || !hasMore || q) return
    const io = new IntersectionObserver(([e]) => e.isIntersecting && !loading && void more(), { rootMargin: '600px' })
    io.observe(el)
    return () => io.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMore, loading, list.length, q])

  const [hide] = useMutation(HideHistory)
  const hiddenKeyOfUser = userId === undefined ? undefined : hiddenKey(userId)
  const remove = useCallback(async (entry: HistoryEntry<HistoryItem>) => {
    const ok = await confirm({
      title: t('downloads.history.deleteTitle'),
      body: t('downloads.history.deleteBody', { title: entry.latest.manga.title, n: entry.chapters.length }),
      ok: t('downloads.history.deleteOk'),
    })
    if (!ok) return
    if (hiddenKeyOfUser === undefined) return
    const value = hiddenValue(entry)
    try {
      await hide({
        variables: { ids: entry.chapters.map((c) => c.id), key: hiddenKeyOfUser, value },
        // 直接改缓存里这些章节的元数据，历史和首页立即生效
        update: (cache) => {
          for (const c of entry.chapters) {
            cache.modify({
              id: cache.identify({ __typename: 'ChapterType', id: c.id }),
              fields: {
                meta: (existing: readonly (Reference | { key: string })[] = [], { readField }) => [
                  ...existing.filter((m) => readField('key', m as Reference) !== hiddenKeyOfUser),
                  { __typename: 'ChapterMetaType', chapterId: c.id, key: hiddenKeyOfUser, value },
                ],
              },
            })
          }
        },
      })
      toast(t('downloads.history.deleted'))
    } catch (e) {
      toastError(t('downloads.history.deleteFailed'), e)
    }
  }, [hide, hiddenKeyOfUser])

  const shown = days.reduce((n, d) => n + d.entries.length, 0)
  const visible = data ? visibleHistoryCount(data.chapters.totalCount, list, userId) : null

  return (
    <div className="wrap pb-20">
      <PageHeader
        title={t('downloads.history.title')}
        sub={<>
          {visible ? t('downloads.history.total', { n: count(visible.total) }) : loading ? t('manga.loading') : ''}
          {visible && (q ? t('downloads.history.searchLoaded', { n: count(visible.loaded) }) : hasMore ? t('downloads.history.loaded', { n: count(visible.loaded) }) : '')}
        </>}
        actions={
          <Glass flat as="label" className="flex h-11 min-w-0 flex-[0_1_320px] items-center gap-2.5 rounded-full px-4 text-muted max-sm:basis-full">
            <Search className="size-[18px] flex-none" strokeWidth={1.8} />
            <span className="sr">{t('downloads.history.searchLabel')}</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('downloads.history.searchPlaceholder')}
              className="min-w-0 flex-1 border-0 bg-transparent text-text outline-none placeholder:text-faint"
            />
          </Glass>
        }
      />

      {error && !data && <LoadError className="py-16" prefix={t('downloads.history.loadFailed')} message={error.message} onRetry={() => void history.refetch().catch(() => {})} />}
      {!data && !error && <HistorySkeleton />}
      {data && shown === 0 && !hasMore && <p className="py-16 text-center text-muted">{q ? t('downloads.history.noMatch') : t('downloads.history.none')}</p>}
      {data && shown === 0 && hasMore && q && (
        <div className="flex flex-col items-center gap-3 py-16 text-center text-muted">
          <p className="m-0">{t('downloads.history.notFound', { n: count(visible?.loaded ?? 0), q: query.trim() })}</p>
          <Glass flat as="button" type="button" className="gbtn rounded-full text-text" disabled={loading} onClick={() => void more()}>
            {loading ? t('downloads.history.loadingOlder') : t('downloads.history.loadOlder')}
          </Glass>
        </div>
      )}

      <HistoryList days={days} intro={intro} onRemove={remove} />

      {hasMore && (shown > 0 || !q) && (
        <div ref={q ? undefined : sentinel} className="py-6 text-center text-sm text-muted">
          {loading ? t('downloads.history.loadingOlder') : (
            <button type="button" className="font-semibold text-text hover:underline" onClick={() => void more()}>
              {q ? t('downloads.history.loadOlderCount', { loaded: count(visible?.loaded ?? 0), total: count(visible?.total ?? 0) }) : t('downloads.history.loadOlderPlain')}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

type Day = { label: string; entries: HistoryEntry<HistoryItem>[] }
/**
 * 虚拟列表的一行：日期标题，或同一天里并排的一到两条记录。
 * first 是这行第一条在全部记录里的序号，排进场动画用；end 表示这一天的最后一行，下面留组间距。
 */
type Item = { kind: 'day'; label: string } | { kind: 'row'; entries: HistoryEntry<HistoryItem>[]; first: number; end: boolean }

/** 历史可能翻到上千条，只挂视口附近的行；桌面两栏，按天分组 */
function HistoryList({ days, intro, onRemove }: { days: Day[]; intro: boolean; onRemove: (entry: HistoryEntry<HistoryItem>) => void }) {
  const cols = useMediaQuery('(min-width: 1024px)') ? 2 : 1
  const items = useMemo(() => {
    const out: Item[] = []
    let n = 0
    for (const d of days) {
      out.push({ kind: 'day', label: d.label })
      for (let i = 0; i < d.entries.length; i += cols) {
        out.push({ kind: 'row', entries: d.entries.slice(i, i + cols), first: n, end: i + cols >= d.entries.length })
        n += cols
      }
    }
    return out
  }, [days, cols])

  const initialOffset = useRestoredOffset()
  const box = useRef<HTMLDivElement>(null)
  const [top, setTop] = useState(0)
  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const y = el.getBoundingClientRect().top + window.scrollY
    if (Math.abs(y - top) > 0.5) setTop(y)
  })
  const v = useWindowVirtualizer({
    count: items.length,
    // 行：封面 84 + 上下内边距 20，再加行距 2 或组间距 24；日期：文字 16 + 下距 8
    estimateSize: (i) => {
      const it = items[i]
      return it.kind === 'day' ? 24 : it.end ? 128 : 106
    },
    overscan: 6,
    scrollMargin: top,
    // 默认会取创建时的 window.scrollY，切页时那是上一页的位置；改用 ScrollManager 记下的位置
    initialOffset,
    getItemKey: (i) => {
      const it = items[i]
      return it.kind === 'day' ? `d:${it.label}` : `${cols}:${it.entries[0].latest.id}`
    },
  })

  return (
    <div ref={box} className="relative" style={{ height: v.getTotalSize() }}>
      {v.getVirtualItems().map((r) => {
        const it = items[r.index]
        return (
          <div
            key={r.key}
            data-index={r.index}
            ref={v.measureElement}
            className={cn('absolute inset-x-0 top-0', it.kind === 'row' && ['grid gap-x-6', it.end ? 'pb-6' : 'pb-0.5', cols > 1 ? 'grid-cols-2' : 'grid-cols-1'])}
            style={{ transform: `translateY(${r.start - v.options.scrollMargin}px)` }}
          >
            {it.kind === 'day' ? (
              <h2 className="m-0 pb-2 text-xs font-bold tracking-[.08em] text-muted">{it.label}</h2>
            ) : (
              it.entries.map((e, j) => <HistoryRow key={e.latest.id} entry={e} rise={intro ? riseStep(it.first + j) : undefined} onRemove={onRemove} />)
            )}
          </div>
        )
      })}
    </div>
  )
}

const HistoryRow = memo(function HistoryRow({ entry, rise, onRemove }: { entry: HistoryEntry<HistoryItem>; rise?: React.CSSProperties; onRemove: (entry: HistoryEntry<HistoryItem>) => void }) {
  const c = entry.latest
  const prefetch = usePrefetchManga(c.manga.id)
  const progress = c.isRead ? t('downloads.history.finished') : c.pageCount > 0 ? t('downloads.history.readPageOf', { current: c.lastPageRead + 1, total: c.pageCount }) : t('downloads.history.readPage', { page: c.lastPageRead + 1 })
  return (
    <div
      data-sfw={sfwAttr(c.manga.source?.displayName)}
      data-nsfw={useNsfwBlur(c.manga)}
      data-reader-origin
      style={rise}
      className={cn('action-row -mx-2.5 flex items-center gap-4 rounded-[18px] p-2.5 transition-colors hover:bg-hover', rise && 'rise')}
    >
      <Link to={`/manga/${c.manga.id}`} viewTransition {...prefetch} className="flex min-w-0 flex-1 items-center gap-4 text-text no-underline">
        <span className="cv w-14 flex-none rounded-[9px] shadow-[0_10px_24px_rgba(0,0,0,.3)]">
          <CoverImg src={c.manga.thumbnailUrl} loading="lazy" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate font-semibold">{c.manga.title}</span>
          <span className="flex min-w-0 text-[13px] text-muted num">
            <span className="truncate">{chapterLabel(c)} · {progress}</span>
            <span className="flex-none whitespace-pre"> · {clock(Number(c.lastReadAt) * 1000)}</span>
          </span>
          {entry.chapters.length > 1 && <span className="text-[13px] text-faint">{t('downloads.history.alsoRead', { n: entry.chapters.length - 1 })}</span>}
        </span>
      </Link>
      {!c.isRead && (
        // 行有进场动画（改透明度），这里不用玻璃按钮，免得动画期间玻璃失效
        <Link to={`/manga/${c.manga.id}/chapter/${c.id}`} state={FROM_DETAIL} viewTransition className="gicon size-10 text-text no-underline" aria-label={t('downloads.history.continueAria', { title: c.manga.title })} title={t('downloads.history.continue')}>
          <Play className="size-[18px] fill-current" strokeWidth={1.6} />
        </Link>
      )}
      <button type="button" className="row-action gicon size-10 text-muted hover:text-danger" aria-label={t('downloads.history.deleteAria', { title: c.manga.title })} title={t('downloads.history.deleteRow')} onClick={() => onRemove(entry)}>
        <Trash2 className="size-[18px]" strokeWidth={1.8} />
      </button>
    </div>
  )
})

function HistorySkeleton() {
  return (
    <div className="grid grid-cols-1 gap-x-6 lg:grid-cols-2" aria-hidden>
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="flex items-center gap-4 p-2.5">
          <span className="skel aspect-[2/3] w-14 rounded-[9px]" />
          <span className="flex flex-1 flex-col gap-2">
            <span className="skel h-4 w-1/2 rounded-full" />
            <span className="skel h-3 w-1/3 rounded-full" />
          </span>
        </div>
      ))}
    </div>
  )
}
