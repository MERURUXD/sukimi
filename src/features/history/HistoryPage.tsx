import { useApolloClient, useMutation, useQuery } from '@apollo/client/react'
import { Play, Search, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import type { Reference } from '@apollo/client'
import { useAuth } from '@/api/auth'
import { Glass } from '@/components/glass/Glass'
import { CoverImg } from '@/components/manga/CoverImg'
import { confirm } from '@/components/ui/Confirm'
import { LoadError } from '@/components/ui/LoadError'
import { toast, toastError } from '@/components/ui/toast'
import { usePrefetchManga } from '@/features/manga/prefetch'
import { FROM_DETAIL } from '@/features/reader/nav'
import { sfwAttr } from '@/lib/devSafe'
import { useNsfwBlur } from '@/features/nsfw/useNsfw'
import { chapterLabel, clock, count, dayLabel } from '@/lib/format'
import { cn } from '@/lib/cn'
import { riseStep, useIntro } from '@/lib/intro'
import { groupHistory, hiddenKey, hiddenValue, type HistoryEntry } from './history'
import { HideHistory, History, type HistoryItem } from './queries'
import { HISTORY_PAGE, historyVariables } from './pagination'

/** 阅读历史：按天分组，同一天同一部漫画合成一条；可以搜索和删除单条 */
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

  const more = () =>
    fetchMore({
      variables: { first: HISTORY_PAGE, offset: list.length },
      updateQuery: (prev, { fetchMoreResult }) => ({
        chapters: { ...fetchMoreResult.chapters, nodes: [...prev.chapters.nodes, ...fetchMoreResult.chapters.nodes] },
      }),
    })

  // 滚到底自动加载；搜索时也继续往下加载，在更早的记录里找
  const sentinel = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = sentinel.current
    if (!el || !hasMore) return
    const io = new IntersectionObserver(([e]) => e.isIntersecting && !loading && void more(), { rootMargin: '600px' })
    io.observe(el)
    return () => io.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMore, loading, list.length])

  const [hide] = useMutation(HideHistory)
  const hiddenKeyOfUser = userId === undefined ? undefined : hiddenKey(userId)
  const remove = async (entry: HistoryEntry<HistoryItem>) => {
    const ok = await confirm({
      title: '删除这条阅读记录？',
      body: `「${entry.latest.manga.title}」这一天的 ${entry.chapters.length} 话不再出现在历史和首页里。阅读进度和已读状态不变，之后再读会重新记录。`,
      ok: '删除',
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
      toast('已删除这条记录')
    } catch (e) {
      toastError('删除失败', e)
    }
  }

  let row = 0
  const shown = days.reduce((n, d) => n + d.entries.length, 0)

  return (
    <div className="wrap pb-20">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-4 pt-9 pb-8">
        <div className="min-w-0 flex-auto">
          <h1 className="m-0 font-cjk text-[40px] font-black">阅读历史</h1>
          <span className="text-sm text-muted">
            {data ? `${count(data.chapters.totalCount)} 话读过的记录` : loading ? '正在加载…' : ''}
            {q && data && ` · 在已加载的 ${count(list.length)} 话里搜索`}
          </span>
        </div>
        <Glass as="label" className="flex h-11 min-w-0 flex-[0_1_320px] items-center gap-2.5 rounded-full px-4 text-muted max-sm:basis-full">
          <Search className="size-[18px] flex-none" strokeWidth={1.8} />
          <span className="sr">搜索历史</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索漫画或章节名"
            className="min-w-0 flex-1 border-0 bg-transparent text-text outline-none placeholder:text-faint"
          />
        </Glass>
      </div>

      {error && !data && <LoadError className="py-16" prefix="无法读取阅读历史" message={error.message} onRetry={() => void history.refetch().catch(() => {})} />}
      {!data && !error && <HistorySkeleton />}
      {data && shown === 0 && !hasMore && <p className="py-16 text-center text-muted">{q ? '没有匹配的记录' : '还没有阅读记录'}</p>}

      {days.map((d) => (
        <section key={d.label} aria-label={d.label} className="mb-6">
          <h2 className="m-0 pb-2 text-xs font-bold tracking-[.08em] text-muted">{d.label}</h2>
          <div className="grid grid-cols-1 gap-x-6 gap-y-0.5 lg:grid-cols-2">
            {d.entries.map((e) => (
              <HistoryRow key={e.latest.id} entry={e} rise={intro ? riseStep(row++) : undefined} onRemove={() => void remove(e)} />
            ))}
          </div>
        </section>
      ))}

      {hasMore && (
        <div ref={sentinel} className="py-6 text-center text-sm text-muted">
          {loading ? '正在加载更早的记录…' : (
            <button type="button" className="font-semibold text-text" onClick={() => void more()}>加载更早的记录</button>
          )}
        </div>
      )}
    </div>
  )
}

function HistoryRow({ entry, rise, onRemove }: { entry: HistoryEntry<HistoryItem>; rise?: React.CSSProperties; onRemove: () => void }) {
  const c = entry.latest
  const prefetch = usePrefetchManga(c.manga.id)
  const progress = c.isRead ? '已读完' : c.pageCount > 0 ? `读到 ${c.lastPageRead + 1} / ${c.pageCount} 页` : `读到第 ${c.lastPageRead + 1} 页`
  return (
    <div
      data-sfw={sfwAttr(c.manga.source?.displayName)}
      data-nsfw={useNsfwBlur(c.manga)}
      data-reader-origin
      style={rise}
      className={cn('-mx-2.5 flex items-center gap-4 rounded-[18px] p-2.5 transition-colors hover:bg-hover', rise && 'rise')}
    >
      <Link to={`/manga/${c.manga.id}`} viewTransition {...prefetch} className="flex min-w-0 flex-1 items-center gap-4 text-text no-underline">
        <span className="cv w-14 flex-none rounded-[9px] shadow-[0_10px_24px_rgba(0,0,0,.3)]">
          <CoverImg src={c.manga.thumbnailUrl} loading="lazy" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate font-semibold">{c.manga.title}</span>
          <span className="truncate text-[13px] text-muted num">
            {chapterLabel(c)} · {progress} · {clock(Number(c.lastReadAt) * 1000)}
          </span>
          {entry.chapters.length > 1 && <span className="text-[13px] text-faint">这天还读了 {entry.chapters.length - 1} 话</span>}
        </span>
      </Link>
      {!c.isRead && (
        // 行有进场动画（改透明度），这里不用玻璃按钮，免得动画期间玻璃失效
        <Link to={`/manga/${c.manga.id}/chapter/${c.id}`} state={FROM_DETAIL} viewTransition className="gicon size-10 text-text no-underline" aria-label={`继续阅读 ${c.manga.title}`} title="继续阅读">
          <Play className="size-[18px] fill-current" strokeWidth={1.6} />
        </Link>
      )}
      <button type="button" className="gicon size-10 text-muted hover:text-danger" aria-label={`删除 ${c.manga.title} 的这条记录`} title="删除这条记录" onClick={onRemove}>
        <Trash2 className="size-[18px]" strokeWidth={1.8} />
      </button>
    </div>
  )
}

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
