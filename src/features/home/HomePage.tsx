import { useApolloClient, useMutation, useQuery } from '@apollo/client/react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ChevronLeft, ChevronRight, Download, Heart, History, Play } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { Link, useHref, useNavigate } from 'react-router'
import { withSnapshot } from '@/api/persist'
import { isVisible } from '@/features/history/history'
import { EnqueueDownloads } from '@/api/chapters'
import { Glass } from '@/components/glass/Glass'
import { CoverFlow } from '@/components/manga/CoverFlow'
import { CoverImg } from '@/components/manga/CoverImg'
import { toast, toastError } from '@/components/ui/toast'
import { ChapterIds } from '@/features/library/queries'
import { chapterLabel } from '@/features/manga/MangaHero'
import { usePrefetchManga } from '@/features/manga/prefetch'
import { sfwAttr } from '@/lib/devSafe'
import { cn } from '@/lib/cn'
import { useAppearance } from '@/design/settings'
import { isDemo } from '@/lib/demo'
import { sec, timeAgo } from '@/lib/format'
import { IN_LIBRARY, RecentReads, RecentUpdates, type ReadChapter, type UpdateChapter } from './queries'
import { readingTarget } from './reading'
import { useHeroSwipe } from './useHeroSwipe'

/** 按漫画去重：每部漫画只保留最近读的那一话 */
function byManga(chapters: readonly ReadChapter[]) {
  const seen = new Set<number>()
  return chapters.filter((c) => !seen.has(c.manga.id) && seen.add(c.manga.id))
}

/** 继续阅读的目标：没读完就是这一话，读完了就是第一话未读 */
function resume(c: ReadChapter) {
  const target = readingTarget(c)
  return target ? { ...target, id: target.chapter.id, label: chapterLabel(target.chapter) } : null
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
  const homeMobileLayout = useAppearance((s) => s.homeMobileLayout)
  const homeDesktopLayout = useAppearance((s) => s.homeDesktopLayout)
  const homeMotionBg = useAppearance((s) => s.homeMotionBg)
  const immersive = homeMobileLayout === 'cover'
  const desktopImmersive = homeDesktopLayout === 'cover'
  const [idx, setIdx] = useState(0)
  const activeIdx = Math.min(idx, Math.max(0, items.length - 1))
  const cur = items[activeIdx]
  const reducedMotion = useReducedMotion()
  const swipe = useHeroSwipe((direction) => setIdx(Math.max(0, Math.min(items.length - 1, activeIdx + direction))))
  const client = useApolloClient()
  const navigate = useNavigate()
  const detailHref = useHref(`/manga/${cur?.manga.id ?? ''}`)
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
        <div className="wrap flex min-h-[240px] flex-col justify-end gap-4 pb-8 md:min-h-[420px] md:pb-12">
          <span className="text-xs font-bold tracking-[.14em] text-muted">继续阅读</span>
          <h1 className="m-0 font-cjk text-[28px] leading-[1.1] font-black md:text-[44px]">{loading ? ' ' : '还没有读过的漫画'}</h1>
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
  const staticBg = (
    <AnimatePresence initial={false}>
      <motion.img
        key={m.id}
        src={m.thumbnailUrl ?? undefined}
        alt=""
        initial={{ opacity: 0, scale: 1.08 }}
        animate={{ opacity: 0.95, scale: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: reducedMotion ? 0 : 0.9, ease: [0.2, 0, 0, 1] }}
        className="absolute -top-[40%] -left-[10%] h-[180%] w-[120%] object-cover blur-[70px] saturate-[1.6]"
      />
    </AnimatePresence>
  )
  const meta = [m.author, m.genre.slice(0, 2).join(' · '), m.source?.displayName].filter(Boolean).join(' · ')

  return (
    <section aria-label="继续阅读" className="relative isolate -mt-[var(--nav-h)] pt-[var(--nav-h)] md:min-h-[min(760px,92vh)]" data-mobile-layout={homeMobileLayout} data-desktop-layout={homeDesktopLayout} data-sfw={sfwAttr(m.source?.displayName)}>
      {/* 背景：当前漫画封面的大幅模糊，默认缓慢流动、切换时交叉淡入；底边短 2px，避免模糊层取整后漏出亮线 */}
      <div className={cn('absolute inset-x-0 top-0 bottom-0.5 -z-20 overflow-hidden', immersive && 'hidden md:block', desktopImmersive && 'md:hidden')} aria-hidden>
        {homeMotionBg && !(immersive && desktopImmersive) ? (
          <CoverFlow src={m.thumbnailUrl} className="absolute inset-0" fallback={staticBg} />
        ) : (
          staticBg
        )}
      </div>
      <div
        aria-hidden
        className={cn('absolute inset-0 -z-10', immersive && 'hidden md:block', desktopImmersive && 'md:hidden')}
        style={{ background: 'linear-gradient(90deg, var(--scrim-b) 0%, var(--scrim-a) 60%, transparent 100%)' }}
      />
      <div aria-hidden className={cn('fade-to-bg absolute inset-0 -z-10 [--from:30%]', immersive && 'hidden md:block', desktopImmersive && 'md:hidden')} />
      {desktopImmersive && (
        <div aria-hidden data-desktop-hero-art className="absolute inset-0 -z-10 hidden overflow-hidden bg-bg md:block">
          <AnimatePresence initial={false}>
            <motion.div key={m.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reducedMotion ? 0 : 0.45 }} className="absolute inset-0">
              <CoverImg src={m.thumbnailUrl} className="absolute inset-0 size-full object-cover object-[center_15%]" />
            </motion.div>
          </AnimatePresence>
          {/* 横屏用主题底色保证文字对比，右侧保留封面细节，底部渐变衔接书架。 */}
          <div className="absolute inset-0 bg-[linear-gradient(90deg,var(--bg)_0%,color-mix(in_srgb,var(--bg)_90%,transparent)_30%,var(--scrim-a)_65%,transparent_100%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(11,11,13,.15)_0%,transparent_50%,var(--bg)_96%)]" />
        </div>
      )}
      {immersive && (
        <div aria-hidden className="absolute inset-0 -z-10 overflow-hidden bg-bg md:hidden">
          <AnimatePresence initial={false}>
            <motion.div
              key={m.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reducedMotion ? 0 : 0.45 }}
              className="absolute inset-x-0 top-0 h-[80%]"
            >
              <CoverImg src={m.thumbnailUrl} className="absolute inset-0 size-full object-cover object-top" />
            </motion.div>
          </AnimatePresence>
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,.25)_0%,transparent_35%,rgba(11,11,13,.4)_65%,var(--bg)_95%)]" />
        </div>
      )}

      <div className="wrap">
        <div {...swipe} className="relative [touch-action:pan-y_pinch-zoom] md:[touch-action:auto]">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={m.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reducedMotion ? 0 : 0.16 }}
              className={cn(immersive
                ? 'relative flex min-h-[calc(min(680px,100svh_-_112px)_-_112px)] flex-col items-start justify-end pt-10 pb-2 md:min-h-0'
                : 'flex flex-col items-center gap-5 pt-6 pb-2 max-md:[@media(max-height:700px)]:gap-3 max-md:[@media(max-height:700px)]:pt-3',
                'md:flex-row md:flex-wrap md:items-end md:gap-x-12 md:gap-y-6 md:pt-9 md:pb-9', desktopImmersive && 'md:min-h-[min(560px,72vh)] md:justify-start md:pt-12 md:pb-12')}
            >
              <Link
                to={`/manga/${m.id}`}
                viewTransition
                data-hero-art-link
                aria-label={`查看《${m.title}》详情`}
                className={cn(immersive ? 'cv absolute inset-0 z-0 aspect-auto w-full bg-transparent md:relative md:inset-auto md:z-auto md:aspect-[2/3] md:rounded-[14px] md:shadow-[0_40px_80px_rgba(0,0,0,.45),0_0_0_1px_rgba(255,255,255,.08)]' : 'cv w-[clamp(96px,calc(33svh_-_88px),184px)] rounded-[14px]',
                  'flex-none md:w-[220px] lg:w-[280px]', !immersive && 'shadow-[0_40px_80px_rgba(0,0,0,.45),0_0_0_1px_rgba(255,255,255,.08)]', desktopImmersive && 'md:hidden')}
              >
                <CoverImg src={m.thumbnailUrl} className={cn(immersive && 'hidden md:block')} />
              </Link>
              <div className={cn('relative flex w-full min-w-0 flex-col gap-4 max-md:[@media(max-height:700px)]:gap-3 md:max-w-[660px] md:flex-[1_1_420px] md:items-stretch md:gap-3.5 md:text-left', immersive ? 'z-10 items-start text-left max-md:text-white' : 'max-w-[420px] items-center text-center', desktopImmersive && 'md:max-w-[min(580px,58%)] md:flex-none')}>
                {immersive && (
                  // 文字衬底随标题高度移动，长标题和明亮封面也能保持对比度。
                  <div aria-hidden className="pointer-events-none absolute -inset-x-4 -top-16 -bottom-2 -z-10 bg-[linear-gradient(180deg,transparent_0,rgba(11,11,13,.95)_56px,rgba(11,11,13,.97)_calc(100%_-_76px),var(--bg)_100%)] sm:-inset-x-8 md:hidden" />
                )}
                <div className="flex w-full min-w-0 flex-col gap-2 md:gap-3.5">
                  <span className={cn('text-xs font-bold tracking-[.14em] text-muted', immersive && 'max-md:text-white/70')}>继续阅读 · {timeAgo(sec(cur.lastReadAt))}</span>
                  <h1 className={cn('m-0 line-clamp-2 font-cjk text-[30px] leading-[1.15] font-black break-words text-balance max-md:[@media(max-height:700px)]:text-[26px] md:text-[46px] md:leading-[1.08] xl:text-[60px]', desktopImmersive && m.title.length > 22 && 'md:line-clamp-none md:text-[32px] lg:text-[40px] xl:text-[44px]')}>{m.title}</h1>
                  {m.author && <span className={cn('truncate text-[13px] text-muted md:hidden', immersive && 'max-md:text-white/70')}>{m.author}</span>}
                  {meta && <span className="hidden text-[15px] text-muted md:block">{meta}</span>}
                  {m.description && <p className="m-0 mt-1 hidden line-clamp-3 text-[15px] leading-[1.7] text-muted md:[display:-webkit-box]">{m.description}</p>}
                </div>
                {target && (
                  <div className="flex w-full max-w-[420px] flex-col gap-2 md:mt-1.5">
                    <div className={cn('flex gap-2 text-[13px] md:justify-between md:gap-3', immersive ? 'justify-start' : 'justify-center')}>
                      <span className="min-w-0 truncate font-semibold">{target.isNext && '接着读 · '}{target.label}</span>
                      <span aria-hidden className={cn('text-muted md:hidden', immersive && 'max-md:text-white/70')}>·</span>
                      <span className={cn('flex-none text-muted num', immersive && 'max-md:text-white/70')}>{target.page}</span>
                    </div>
                    {target.pct !== null && (
                      <div className="prog hidden md:block"><i style={{ width: `${target.pct}%` }} /></div>
                    )}
                  </div>
                )}
                <div data-home-actions className={cn('grid w-full items-center gap-2 md:mt-2.5 md:flex md:flex-wrap md:gap-2.5', m.inLibrary ? 'grid-cols-[minmax(0,1fr)_auto_auto_auto]' : 'grid-cols-[minmax(0,1fr)_auto_auto]')}>
                  {target ? (
                    <Link to={`/manga/${m.id}/chapter/${target.id}`} className={cn('solid min-w-0 px-3 text-sm no-underline md:px-6 md:text-base', immersive && 'max-md:ring-1 max-md:ring-white/20')}>
                      <Play className="size-4 fill-current md:size-5" strokeWidth={1.6} />
                      继续阅读
                    </Link>
                  ) : (
                    <span className="solid min-w-0 px-3 text-sm opacity-60 md:px-6 md:text-base">已全部读完</span>
                  )}
                  <Glass
                    as="a"
                    href={detailHref}
                    className="gbtn rounded-full px-3 text-sm no-underline md:px-[18px] md:text-base"
                    onClick={(e) => {
                      if (e.ctrlKey || e.metaKey || e.shiftKey) return
                      e.preventDefault()
                      navigate(`/manga/${m.id}`)
                    }}
                  >
                    <span className="md:hidden">详情</span><span className="hidden md:inline">漫画详情</span>
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
        </div>

        {items.length > 1 && (
          <div role="group" aria-label="切换继续阅读漫画" className="flex justify-center pb-1 md:hidden">
            {items.map((c, i) => (
              <button
                key={c.manga.id}
                type="button"
                aria-label={`切换到第 ${i + 1} 部：${c.manga.title}`}
                aria-pressed={i === activeIdx}
                onClick={() => setIdx(i)}
                className="flex size-11 flex-none items-center justify-center rounded-full text-text hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text"
              >
                <span aria-hidden className={cn('h-1.5 rounded-full bg-current transition-[width,opacity] duration-200 motion-reduce:transition-none', i === activeIdx ? 'w-6 opacity-100' : 'w-1.5 opacity-35')} />
              </button>
            ))}
          </div>
        )}
        {items.length > 1 && (
          <div role="tablist" aria-label="正在阅读" className="hidden gap-3 pt-1 pb-10 md:grid md:grid-cols-2 xl:grid-cols-4">
            {items.map((c, i) => {
              const on = c.manga.id === m.id
              const r = resume(c)
              const pct = r ? r.pct : 100
              return (
                <Glass
                  as="button"
                  key={c.manga.id}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => setIdx(i)}
                  data-sfw={sfwAttr(c.manga.source?.displayName)}
                  className={cn('flex min-w-0 snap-start items-center gap-2.5 rounded-[18px] p-2.5 text-left text-text md:gap-3 md:pr-3.5', on && 'bg-g-hi')}
                >
                  <span className="cv w-8 flex-none rounded-[7px] md:w-11">
                    <CoverImg src={c.manga.thumbnailUrl} />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-[5px]">
                    <span className="truncate text-sm font-semibold md:text-base">{c.manga.title}</span>
                    <span className="truncate text-xs text-muted">{r ? r.label : '已全部读完'}</span>
                    <span className="truncate text-[11px] text-muted">{r ? r.page : '没有未读章节'}</span>
                    {pct !== null && (
                      <span className="prog h-[3px]"><i style={{ width: `${pct}%` }} /></span>
                    )}
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
          <span className="text-sm text-muted">{isDemo ? '演示进度仅在本次会话中保留' : '阅读进度已同步到服务器'}</span>
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
                {/* 时间放进标题行：文字列宽度固定，各行进度条右端才对齐 */}
                <span className="flex items-baseline gap-3">
                  <span className="min-w-0 flex-1 truncate text-base font-semibold">{c.manga.title}</span>
                  <span className="flex-none text-xs text-muted">{timeAgo(sec(c.lastReadAt))}</span>
                </span>
                <span className="truncate text-[13px] text-muted num">
                  {chapterLabel(c)} · {c.isRead ? '已读完' : c.pageCount > 0 ? `${c.lastPageRead + 1} / ${c.pageCount} 页` : `第 ${c.lastPageRead + 1} 页`}
                </span>
                <span className="prog mt-2 h-[3px] w-full max-w-[220px]">
                  <i style={{ width: `${pct}%` }} />
                </span>
              </span>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
