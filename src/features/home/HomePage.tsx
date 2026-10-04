import { useApolloClient, useMutation, useQuery } from '@apollo/client/react'
import { AnimatePresence, motion } from 'motion/react'
import { ChevronLeft, ChevronRight, Download, Heart, History, Play } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { withSnapshot } from '@/api/persist'
import { isVisible } from '@/features/history/history'
import { EnqueueDownloads } from '@/api/chapters'
import { Glass } from '@/components/glass/Glass'
import { CoverImg } from '@/components/manga/CoverImg'
import { toast, toastError } from '@/components/ui/toast'
import { spring } from '@/design/motion'
import { ChapterIds } from '@/features/library/queries'
import { chapterLabel } from '@/features/manga/MangaHero'
import { usePrefetchManga } from '@/features/manga/prefetch'
import { sfwAttr } from '@/lib/devSafe'
import { cn } from '@/lib/cn'
import { sec, timeAgo } from '@/lib/format'
import { IN_LIBRARY, RecentReads, RecentUpdates, type ReadChapter, type UpdateChapter } from './queries'

/** 按漫画去重：每部漫画只保留最近读的那一话 */
function byManga(chapters: readonly ReadChapter[]) {
  const seen = new Set<number>()
  return chapters.filter((c) => !seen.has(c.manga.id) && seen.add(c.manga.id))
}

/** 继续阅读的目标：没读完就是这一话，读完了就是第一话未读 */
function resume(c: ReadChapter) {
  if (!c.isRead) {
    const page = c.pageCount > 0 ? `第 ${c.lastPageRead + 1} / ${c.pageCount} 页` : `第 ${c.lastPageRead + 1} 页`
    const pct = c.pageCount > 0 ? ((c.lastPageRead + 1) / c.pageCount) * 100 : 0
    return { id: c.id, label: chapterLabel(c), page, pct }
  }
  const next = c.manga.firstUnreadChapter
  if (next) return { id: next.id, label: chapterLabel(next), page: '下一话', pct: 0 }
  return null
}

const progressOf = (c: ReadChapter) =>
  c.isRead ? 100 : c.pageCount > 0 ? Math.round(((c.lastPageRead + 1) / c.pageCount) * 100) : 0

export function HomePage() {
  const reads = useQuery(RecentReads, { fetchPolicy: 'cache-and-network' })
  const updates = useQuery(RecentUpdates, {
    variables: { first: 200, offset: 0, filter: IN_LIBRARY },
    fetchPolicy: 'cache-and-network',
  })
  // 刷新页面后先用上次保存的数据，网络数据到了再替换
  const readsData = withSnapshot('recentReads', reads.data)
  const updatesData = withSnapshot('recentUpdates', updates.data)
  const recent = useMemo(() => byManga((readsData?.chapters.nodes ?? []).filter(isVisible)), [readsData])
  // 大图区优先放还有得读的漫画，都读完了才退回最近读过的
  const heroItems = useMemo(() => {
    const open = recent.filter((c) => resume(c))
    return (open.length ? open : recent).slice(0, 4)
  }, [recent])

  return (
    <>
      <Hero items={heroItems} loading={!readsData} />
      <div className="wrap pb-20">
        <UpdatesShelf chapters={updatesData?.chapters.nodes} />
        <RecentList items={recent.slice(0, 10)} />
      </div>
    </>
  )
}

/* ───────── 继续阅读大图区 ───────── */
function Hero({ items, loading }: { items: ReadChapter[]; loading: boolean }) {
  const [idx, setIdx] = useState(0)
  const cur = items[Math.min(idx, items.length - 1)]
  const client = useApolloClient()
  const navigate = useNavigate()
  const [enqueue] = useMutation(EnqueueDownloads)

  const downloadRest = async () => {
    if (!cur) return
    try {
      const { data } = await client.query({
        query: ChapterIds,
        variables: { filter: { mangaId: { equalTo: cur.manga.id }, isRead: { equalTo: false }, isDownloaded: { equalTo: false } } },
        fetchPolicy: 'network-only',
      })
      const ids = data?.chapters.nodes.map((c) => c.id) ?? []
      if (ids.length) await enqueue({ variables: { ids } })
      toast(ids.length ? `已将 ${ids.length} 话加入下载队列` : '后续章节都已下载')
    } catch (e) {
      toastError('加入下载失败', e)
    }
  }

  if (!cur) {
    return (
      <section className="relative -mt-[var(--nav-h)] pt-[var(--nav-h)]">
        <div className="wrap flex min-h-[420px] flex-col justify-end gap-4 pb-12">
          <span className="text-xs font-bold tracking-[.14em] text-muted">继续阅读</span>
          <h1 className="m-0 font-cjk text-[44px] leading-[1.1] font-black">{loading ? ' ' : '还没有读过的漫画'}</h1>
          {!loading && (
            <Link to="/library" className="solid w-fit no-underline">
              去书库挑一部
            </Link>
          )}
        </div>
      </section>
    )
  }

  const m = cur.manga
  const target = resume(cur)
  const meta = [m.author, m.genre.slice(0, 2).join(' · '), m.source?.displayName].filter(Boolean).join(' · ')

  return (
    <section aria-label="继续阅读" className="relative isolate -mt-[var(--nav-h)] min-h-[min(760px,92vh)] overflow-hidden pt-[var(--nav-h)]" data-sfw={sfwAttr(m.source?.displayName)}>
      {/* 背景：当前漫画封面的大幅模糊，切换时交叉淡入 */}
      <div className="absolute inset-0 -z-20 overflow-hidden" aria-hidden>
        <AnimatePresence initial={false}>
          <motion.img
            key={m.id}
            src={m.thumbnailUrl ?? undefined}
            alt=""
            initial={{ opacity: 0, scale: 1.08 }}
            animate={{ opacity: 0.95, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.9, ease: [0.2, 0, 0, 1] }}
            className="absolute -top-[40%] -left-[10%] h-[180%] w-[120%] object-cover blur-[70px] saturate-[1.6]"
          />
        </AnimatePresence>
      </div>
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          background:
            'linear-gradient(90deg, var(--scrim-b) 0%, var(--scrim-a) 60%, transparent 100%), linear-gradient(180deg, transparent 45%, var(--bg) 100%)',
        }}
      />

      <div className="wrap">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={m.id}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={spring.default}
            className="flex flex-wrap items-end gap-x-12 gap-y-6 pt-9 pb-9"
          >
            <Link
              to={`/manga/${m.id}`}
              viewTransition
              className="cv w-[180px] flex-none rounded-[14px] shadow-[0_40px_80px_rgba(0,0,0,.45),0_0_0_1px_rgba(255,255,255,.08)] sm:w-[220px] lg:w-[280px]"
            >
              <CoverImg src={m.thumbnailUrl} />
            </Link>
            <div className="flex max-w-[660px] min-w-0 flex-[1_1_420px] flex-col gap-3.5">
              <span className="text-xs font-bold tracking-[.14em] text-muted">继续阅读 · {timeAgo(sec(cur.lastReadAt))}</span>
              <h1 className="m-0 line-clamp-2 font-cjk text-[34px] leading-[1.08] font-black text-balance sm:text-[46px] xl:text-[60px]">{m.title}</h1>
              {meta && <span className="text-[15px] text-muted">{meta}</span>}
              {m.description && <p className="m-0 mt-1 line-clamp-3 text-[15px] leading-[1.7] text-muted">{m.description}</p>}
              {target && (
                <div className="mt-1.5 flex max-w-[420px] flex-col gap-2">
                  <div className="flex justify-between gap-3 text-[13px]">
                    <span className="font-semibold">{target.label}</span>
                    <span className="text-muted num">{target.page}</span>
                  </div>
                  <div className="prog">
                    <i style={{ width: `${target.pct}%` }} />
                  </div>
                </div>
              )}
              <div className="mt-2.5 flex flex-wrap gap-2.5">
                {target ? (
                  <Link to={`/manga/${m.id}/chapter/${target.id}`} className="solid no-underline">
                    <Play className="size-5 fill-current" strokeWidth={1.6} />
                    继续阅读
                  </Link>
                ) : (
                  <span className="solid opacity-60">已全部读完</span>
                )}
                <Glass
                  as="a"
                  href={`/manga/${m.id}`}
                  className="gbtn rounded-full no-underline"
                  onClick={(e) => {
                    if (e.ctrlKey || e.metaKey || e.shiftKey) return
                    e.preventDefault()
                    navigate(`/manga/${m.id}`)
                  }}
                >
                  漫画详情
                </Glass>
                {m.inLibrary && (
                  <Glass as="span" className="gicon rounded-full bg-g-hi" aria-label="已在书库" title="已在书库">
                    <Heart className="size-5 fill-current" strokeWidth={1.8} />
                  </Glass>
                )}
                <Glass as="button" type="button" className="gicon rounded-full" onClick={downloadRest} aria-label="下载后续章节" title="下载后续章节">
                  <Download className="size-5" strokeWidth={1.8} />
                </Glass>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        {items.length > 1 && (
          <div role="tablist" aria-label="正在阅读" className="grid grid-cols-1 gap-3 pb-10 sm:grid-cols-2 xl:grid-cols-4">
            {items.map((c, i) => {
              const on = c.manga.id === m.id
              const r = resume(c)
              return (
                <Glass
                  as="button"
                  key={c.manga.id}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => setIdx(i)}
                  data-sfw={sfwAttr(c.manga.source?.displayName)}
                  className={cn('flex min-w-0 items-center gap-3 rounded-[18px] py-2.5 pr-3.5 pl-2.5 text-left text-text', on && 'bg-g-hi')}
                >
                  <span className="cv w-11 flex-none rounded-[7px]">
                    <CoverImg src={c.manga.thumbnailUrl} />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-[5px]">
                    <span className="truncate font-semibold">{c.manga.title}</span>
                    <span className="truncate text-xs text-muted">{r ? r.label : '已全部读完'}</span>
                    <span className="prog h-[3px]">
                      <i style={{ width: `${progressOf(c)}%` }} />
                    </span>
                  </span>
                </Glass>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}

/* ───────── 最近更新书架 ───────── */
function UpdatesShelf({ chapters }: { chapters: UpdateChapter[] | undefined }) {
  const shelf = useRef<HTMLDivElement>(null)
  // 按漫画聚合：新章节数 = 这批里未读的话数
  const groups = useMemo(() => {
    const map = new Map<number, { latest: UpdateChapter; unread: number }>()
    for (const c of chapters ?? []) {
      const g = map.get(c.mangaId)
      if (g) g.unread += c.isRead ? 0 : 1
      else map.set(c.mangaId, { latest: c, unread: c.isRead ? 0 : 1 })
    }
    return [...map.values()].slice(0, 24)
  }, [chapters])
  const newCount = groups.reduce((n, g) => n + g.unread, 0)
  const withNew = groups.filter((g) => g.unread > 0).length

  const scroll = (d: number) => shelf.current?.scrollBy({ left: d * shelf.current.clientWidth * 0.8, behavior: 'smooth' })

  if (chapters && groups.length === 0) return null
  return (
    <section aria-labelledby="h-up" className="pt-11">
      <div className="mb-[18px] flex items-end justify-between gap-4">
        <div>
          <h2 id="h-up" className="m-0 text-[26px] font-bold">
            最近更新
          </h2>
          <span className="text-sm text-muted">{chapters ? (withNew ? `${withNew} 部漫画有 ${newCount} 话新章节` : '新章节都读过了') : ' '}</span>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/updates" className="mr-2 font-semibold text-muted no-underline hover:text-text">
            查看全部
          </Link>
          <Glass as="button" type="button" className="gicon size-10 rounded-full max-sm:hidden" onClick={() => scroll(-1)} aria-label="向左滚动">
            <ChevronLeft className="size-5" strokeWidth={1.8} />
          </Glass>
          <Glass as="button" type="button" className="gicon size-10 rounded-full max-sm:hidden" onClick={() => scroll(1)} aria-label="向右滚动">
            <ChevronRight className="size-5" strokeWidth={1.8} />
          </Glass>
        </div>
      </div>
      <div ref={shelf} className="-mx-1 grid snap-x auto-cols-[140px] grid-flow-col gap-[22px] overflow-x-auto px-1 pt-1 pb-3 [scrollbar-width:none] sm:auto-cols-[176px]">
        {groups.map(({ latest: c, unread }) => (
          <ShelfItem key={c.mangaId} c={c} unread={unread} />
        ))}
      </div>
    </section>
  )
}

function ShelfItem({ c, unread }: { c: UpdateChapter; unread: number }) {
  const prefetch = usePrefetchManga(c.mangaId)
  return (
    <Link
      to={`/manga/${c.mangaId}`}
      viewTransition
      {...prefetch}
      data-sfw={sfwAttr(c.manga.source?.displayName)}
      className="group flex min-w-0 snap-start flex-col gap-2.5 text-text no-underline"
    >
      <span className="cv rounded-xl shadow-[0_12px_28px_rgba(0,0,0,.28)] transition-transform duration-200 group-hover:-translate-y-1">
        <CoverImg src={c.manga.thumbnailUrl} loading="lazy" />
        {unread > 0 && (
          <Glass as="span" dense className="absolute top-2 right-2 z-[2] inline-flex min-h-[26px] items-center rounded-full px-2.5 text-xs font-bold num" suspendRefract>
            +{unread > 99 ? '99+' : unread}
          </Glass>
        )}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-[15px] font-semibold">{c.manga.title}</span>
        <span className="truncate text-[13px] text-muted">
          {chapterLabel(c)} · {timeAgo(sec(c.fetchedAt))}
        </span>
      </span>
    </Link>
  )
}

/* ───────── 最近阅读 ───────── */
function RecentList({ items }: { items: ReadChapter[] }) {
  if (!items.length) return null
  return (
    <section aria-labelledby="h-rec" className="pt-11">
      <div className="mb-[18px] flex items-end justify-between gap-4">
        <div>
          <h2 id="h-rec" className="m-0 text-[26px] font-bold">
            最近阅读
          </h2>
          <span className="text-sm text-muted">阅读进度已同步到服务器</span>
        </div>
        <Link to="/history" className="rounded-full text-text no-underline">
          <Glass as="span" className="gbtn rounded-full">
            <History className="size-[18px]" strokeWidth={1.8} />
            全部历史
          </Glass>
        </Link>
      </div>
      <div className="grid grid-cols-1 gap-x-6 gap-y-1.5 md:grid-cols-[repeat(auto-fill,minmax(360px,1fr))]">
        {items.map((c) => {
          const r = resume(c)
          const pct = progressOf(c)
          return (
            <Link
              key={c.manga.id}
              to={r ? `/manga/${c.manga.id}/chapter/${r.id}` : `/manga/${c.manga.id}`}
              data-sfw={sfwAttr(c.manga.source?.displayName)}
              className="-mx-2.5 flex items-center gap-[18px] rounded-[18px] p-2.5 text-text no-underline transition-colors hover:bg-hover"
            >
              <span className="cv w-[72px] flex-none rounded-[9px] shadow-[0_10px_24px_rgba(0,0,0,.3)]">
                <CoverImg src={c.manga.thumbnailUrl} loading="lazy" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="truncate text-base font-semibold">{c.manga.title}</span>
                <span className="truncate text-[13px] text-muted num">
                  {chapterLabel(c)} · {c.isRead ? '已读完' : c.pageCount > 0 ? `${c.lastPageRead + 1} / ${c.pageCount} 页` : `第 ${c.lastPageRead + 1} 页`}
                </span>
                <span className="prog mt-2 h-[3px] max-w-[220px]">
                  <i style={{ width: `${pct}%` }} />
                </span>
              </span>
              <span className="flex-none self-start pt-1 text-xs text-muted">{timeAgo(sec(c.lastReadAt))}</span>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
