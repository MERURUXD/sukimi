import { useApolloClient, useMutation, useQuery } from '@apollo/client/react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ChevronLeft, ChevronRight, Download, Heart, History, Play, Shuffle } from 'lucide-react'
import { Fragment, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useHref, useNavigate } from 'react-router'
import { useAuth } from '@/api/auth'
import { withSnapshot } from '@/api/persist'
import { isVisible } from '@/features/history/history'
import { EnqueueDownloads } from '@/api/chapters'
import { captureUser, resetOnUserContext, StaleSessionError } from '@/api/userContext'
import { Can } from '@/features/auth/Can'
import { Glass } from '@/components/glass/Glass'
import { CoverFlow } from '@/components/manga/CoverFlow'
import { CoverImg } from '@/components/manga/CoverImg'
import { toast, toastError } from '@/components/ui/toast'
import { ChapterIds, LibraryMangas } from '@/features/library/queries'
import { useLibraryView } from '@/features/library/store'
import { useLaterList } from '@/features/later/useLater'
import { favoritesWithNew } from '@/features/favorite/favorite'
import { useFavorites } from '@/features/favorite/useFavorites'
import type { LibraryMangasQuery } from '@/api/gql/graphql'
import { GalleryWindow } from '@/features/gallery/GalleryWindow'
import { useLanded } from '@/features/gallery/readMorph'
import { usePrefetchManga } from '@/features/manga/prefetch'
import { sfwAttr } from '@/lib/devSafe'
import { cn } from '@/lib/cn'
import { useAppearance } from '@/design/settings'
import { isDemo } from '@/lib/demo'
import { useNsfw } from '@/features/nsfw/useNsfw'
import { chapterLabel, sec, timeAgo } from '@/lib/format'
import { IN_LIBRARY, RecentReads, RecentUpdates, type ReadChapter, type UpdateChapter } from './queries'
import { isRecent, isStale, notStarted, pickBatch } from './picks'
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

type LibManga = LibraryMangasQuery['mangas']['nodes'][number]

/** 大图区从最近在读的这么多部里随机挑 HERO_COUNT 部 */
const HERO_POOL = 20
const HERO_COUNT = 4
const SHELF_COUNT = 12

/** 每次打开或刷新网页换一个随机种子；页面里的切换仍按同一种子挑，网络数据替换快照时不会整批跳动 */
const session = Math.random().toString(36).slice(2)
/** 每个区块「换一批」的次数；放在模块里，从详情页返回时还是同一批 */
const batches = new Map<string, number>()

function useBatch(key: string) {
  const [n, setN] = useState(() => batches.get(key) ?? 0)
  // 以模块里的计数为准：大图区切换时淡出中的旧按钮还能被点到，它闭包里的 n 是旧的
  const next = () => {
    const v = (batches.get(key) ?? 0) + 1
    batches.set(key, v)
    setN(v)
  }
  return [`${key}:${session}`, n, next] as const
}

export function HomePage() {
  const homeSections = useAppearance((s) => s.homeSections)
  const homeSectionOrder = useAppearance((s) => s.homeSectionOrder)
  const showGallery = useAppearance((s) => s.homeGallery)
  // 换页动画期间有缓存就只用缓存，落地后再去网络刷新：结果一到整页要重新渲染，和动画抢主线程会一顿一顿的（见 useLanded）
  const landed = useLanded()
  const reads = useQuery(RecentReads, { fetchPolicy: landed ? 'cache-and-network' : 'cache-first' })
  // 和书库页共用同一份查询与快照，之后打开书库也不用再等
  const lib = useQuery(LibraryMangas)
  const updates = useQuery(RecentUpdates, {
    variables: { first: 200, offset: 0, filter: IN_LIBRARY },
    fetchPolicy: landed ? 'cache-and-network' : 'cache-first',
    skip: !homeSections.updates,
  })
  // 刷新页面后先用上次保存的数据，网络数据到了再替换
  const readsData = withSnapshot('recentReads', reads.data)
  const updatesData = withSnapshot('recentUpdates', updates.data)
  const libData = withSnapshot('library', lib.data)
  // NSFW 作品在首页一律不出现（见 features/nsfw）：从源头去掉，大图区、书架和橱窗都不用各自判断
  const { hidden } = useNsfw()
  const userId = useAuth((s) => s.user?.id)
  const recent = useMemo(() => byManga((readsData?.chapters.nodes ?? []).filter((c) => isVisible(c, userId) && !hidden(c.manga))), [readsData, hidden, userId])
  const library = useMemo(() => libData?.mangas.nodes.filter((m) => !hidden(m)), [libData, hidden])
  const updateChapters = useMemo(() => updatesData?.chapters.nodes.filter((c) => !hidden(c.manga)), [updatesData, hidden])
  const [heroSeed, heroBatch, nextHero] = useBatch('hero')
  // 大图区只从书库里的漫画中挑：两周内读过、还有得读的随机挑；没有就退回还有得读的，再退回最近读过的。
  // 顺序也随机，换一批时第一部一定会变
  const hero = useMemo(() => {
    const now = Date.now() / 1000
    const inLib = recent.filter((c) => c.manga.inLibrary)
    const open = inLib.filter((c) => resume(c))
    const fresh = open.filter((c) => isRecent(c.lastReadAt, now))
    const pool = (fresh.length ? fresh : open.length ? open : inLib).slice(0, HERO_POOL)
    return { items: pickBatch(pool, HERO_COUNT, heroSeed, heroBatch, (c) => c.manga.id), more: pool.length > HERO_COUNT }
  }, [recent, heroSeed, heroBatch])
  const shelves = useMemo(() => {
    if (!library) return null
    const now = Date.now() / 1000
    // 大图区正在展示的不再重复出现
    const shown = new Set(hero.items.map((c) => c.manga.id))
    return {
      stale: library.filter((m) => isStale(m, now, userId) && !shown.has(m.id)),
      fresh: library.filter(notStarted),
    }
  }, [library, hero.items, userId])

  // 首页别处已经出现的作品：橱窗里尽量不重复它们（大图区正在展示的、最近阅读那三条）
  const onPage = useMemo(() => new Set([...hero.items, ...(homeSections.recent ? recent.slice(0, 3) : [])].map((c) => c.manga.id)), [hero.items, recent, homeSections.recent])

  const content = {
    favorite: homeSections.favorite && <FavoriteShelf library={library} />,
    updates: homeSections.updates && <UpdatesShelf chapters={updateChapters} />,
    stale: homeSections.stale && <MangaShelf id="stale" title="好久没看" note={(n) => `${n} 部读到一半，超过两周没打开`}
      mangas={shelves?.stale} sub={(m) => `上次 ${timeAgo(sec(m.lastReadChapter?.lastReadAt))} · ${m.unreadCount} 话未读`} />,
    fresh: homeSections.fresh && <MangaShelf id="fresh" title="还没开始读" note={(n) => `书库里有 ${n} 部还没翻开`}
      mangas={shelves?.fresh} sub={(m) => `共 ${m.unreadCount} 话`} />,
    recent: homeSections.recent && <RecentList items={recent.slice(0, 3)} />,
    later: homeSections.later && <LaterShelf />,
    // 橱窗的数字照常计入 NSFW，封面墙由它自己去掉，所以给完整书库
    gallery: showGallery && <GalleryWindow library={libData?.mangas.nodes} exclude={readsData ? onPage : undefined} />,
  }

  return (
    <>
      <Hero items={hero.items} loading={!readsData} onShuffle={hero.more ? nextHero : undefined} />
      <div className="wrap pb-20">
        {homeSectionOrder.map((id) => <Fragment key={id}>{content[id]}</Fragment>)}
      </div>
    </>
  )
}

/* ───────── 继续阅读大图区 ───────── */
/** 大图区当前漫画；放在模块里跨页面保留，整页刷新后自然回到第一部 */
let lastHeroManga: number | null = null
resetOnUserContext(() => {
  lastHeroManga = null
  batches.clear()
})

function Hero({ items, loading, onShuffle }: { items: ReadChapter[]; loading: boolean; onShuffle?: () => void }) {
  const homeMobileLayout = useAppearance((s) => s.homeMobileLayout)
  const homeDesktopLayout = useAppearance((s) => s.homeDesktopLayout)
  const homeMotionBg = useAppearance((s) => s.homeMotionBg)
  const immersive = homeMobileLayout === 'cover'
  const desktopImmersive = homeDesktopLayout === 'cover'
  // 按漫画 id 记住选中项：从详情页返回时首页会重新挂载，若退回第一部，封面就飞不回原来那张
  const [selId, setSelId] = useState(() => lastHeroManga)
  const found = items.findIndex((c) => c.manga.id === selId)
  const activeIdx = found >= 0 ? found : 0
  const setIdx = (i: number) => {
    const id = items[i]?.manga.id ?? null
    lastHeroManga = id
    setSelId(id)
  }
  // 换一批后回到新一批的第一部；不清掉的话，上一批选中的那部若又被挑中会一直停在它上面
  const shuffle = () => {
    lastHeroManga = null
    setSelId(null)
    onShuffle?.()
  }
  const cur = items[activeIdx]
  const reducedMotion = useReducedMotion()
  const swipe = useHeroSwipe((direction) => setIdx(Math.max(0, Math.min(items.length - 1, activeIdx + direction))))
  const client = useApolloClient()
  const navigate = useNavigate()
  const detailHref = useHref(`/manga/${cur?.manga.id ?? ''}`)
  const [enqueue] = useMutation(EnqueueDownloads)

  const downloadRest = async () => {
    if (!cur) return
    const still = captureUser()
    try {
      const { data } = await client.query({
        query: ChapterIds,
        variables: { filter: { mangaId: { equalTo: cur.manga.id }, isRead: { equalTo: false }, isDownloaded: { equalTo: false } } },
        fetchPolicy: 'network-only',
      })
      still()
      const ids = data?.chapters.nodes.map((c) => c.id) ?? []
      if (ids.length) await enqueue({ variables: { ids } })
      toast(ids.length ? `已将 ${ids.length} 话加入下载队列` : '后续章节都已下载')
    } catch (e) {
      if (!(e instanceof StaleSessionError)) toastError('加入下载失败', e)
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
              {/* 桌面端缩略图分辨率不够，铺满后会发糊发虚；索性加模糊当氛围背景，略放大避免边缘露出。 */}
              <CoverImg src={m.thumbnailUrl} className="absolute inset-0 size-full scale-110 object-cover object-[center_15%] blur-[18px] saturate-[1.15]" />
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
                    <Link to={`/manga/${m.id}/chapter/${target.id}`} viewTransition className={cn('solid min-w-0 px-3 text-sm no-underline md:px-6 md:text-base', immersive && 'max-md:ring-1 max-md:ring-white/20')}>
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
                      navigate(`/manga/${m.id}`, { viewTransition: true })
                    }}
                  >
                    <span className="md:hidden">详情</span><span className="hidden md:inline">漫画详情</span>
                  </Glass>
                  {m.inLibrary && (
                    <Glass as="span" className="gicon rounded-full bg-g-hi" aria-label="已在书库" title="已在书库">
                      <Heart className="size-5 fill-current" strokeWidth={1.8} />
                    </Glass>
                  )}
                  <Can permission="DOWNLOAD_CHAPTERS">
                    <Glass as="button" type="button" className="gicon rounded-full" onClick={downloadRest} aria-label="下载后续章节" title="下载后续章节">
                      <Download className="size-5" strokeWidth={1.8} />
                    </Glass>
                  </Can>
                  {/* 手机的换一批在切换圆点旁边 */}
                  {onShuffle && (
                    <Glass as="button" type="button" className="gicon rounded-full max-md:hidden" onClick={shuffle} aria-label="换一批继续阅读" title="换一批">
                      <Shuffle className="size-5" strokeWidth={1.8} />
                    </Glass>
                  )}
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {items.length > 1 && (
          <div className="flex items-center justify-center pb-1 md:hidden">
            <div role="group" aria-label="切换继续阅读漫画" className="flex">
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
            {onShuffle && (
              <button
                type="button"
                onClick={shuffle}
                aria-label="换一批继续阅读"
                title="换一批"
                className="flex size-11 flex-none items-center justify-center rounded-full text-muted hover:bg-hover hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text"
              >
                <Shuffle className="size-[18px]" strokeWidth={1.8} />
              </button>
            )}
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
                  // 去掉玻璃亮边和投影，只靠底色区分，避免成排的框住的卡片；选中项用更亮的底色，其余悬停时提亮示意可点
                  className={cn('flex min-w-0 snap-start items-center gap-2.5 rounded-[18px] border-transparent p-2.5 text-left text-text shadow-none transition-colors md:gap-3 md:pr-3.5', on ? 'bg-g-hi' : 'hover:bg-(--g-bg)')}
                >
                  <span className="cv w-8 flex-none rounded-[7px] md:w-11">
                    <CoverImg src={c.manga.thumbnailUrl} />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-[5px]">
                    <span className="truncate text-sm font-semibold md:text-base">{c.manga.title}</span>
                    <span className="truncate text-[13px] text-muted">{r ? r.label : '已全部读完'}</span>
                    <span className="truncate text-[13px] text-muted">{r ? r.page : '没有未读章节'}</span>
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

/* ───────── 横向书架 ───────── */
function Shelf({ id, title, note, actions, children }: { id: string; title: string; note: string; actions?: ReactNode; children: ReactNode }) {
  const shelf = useRef<HTMLDivElement>(null)
  const scroll = (d: number) => shelf.current?.scrollBy({ left: d * shelf.current.clientWidth * 0.8, behavior: 'smooth' })
  return (
    <section aria-labelledby={`h-${id}`} className="pt-11">
      <div className="mb-[18px] flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h2 id={`h-${id}`} className="m-0 text-[26px] font-bold">
            {title}
          </h2>
          <span className="text-sm text-muted">{note}</span>
        </div>
        <div className="flex flex-none items-center gap-2">
          {actions}
          <Glass as="button" type="button" className="gicon size-10 rounded-full max-sm:hidden" onClick={() => scroll(-1)} aria-label="向左滚动">
            <ChevronLeft className="size-5" strokeWidth={1.8} />
          </Glass>
          <Glass as="button" type="button" className="gicon size-10 rounded-full max-sm:hidden" onClick={() => scroll(1)} aria-label="向右滚动">
            <ChevronRight className="size-5" strokeWidth={1.8} />
          </Glass>
        </div>
      </div>
      <div ref={shelf} className="-mx-1 grid snap-x auto-cols-[140px] grid-flow-col gap-[22px] overflow-x-auto px-1 pt-1 pb-3 [scrollbar-width:none] sm:auto-cols-[176px]">
        {children}
      </div>
    </section>
  )
}

type ShelfManga = { id: number; title: string; thumbnailUrl?: string | null; source?: { displayName: string } | null }

/** 书架上的一部漫画：封面、标题和一行说明，badge 显示在封面右上角 */
function ShelfItem({ manga, sub, badge }: { manga: ShelfManga; sub: string; badge?: string }) {
  const prefetch = usePrefetchManga(manga.id)
  return (
    <Link
      to={`/manga/${manga.id}`}
      viewTransition
      {...prefetch}
      data-sfw={sfwAttr(manga.source?.displayName)}
      className="group flex min-w-0 snap-start flex-col gap-2.5 text-text no-underline"
    >
      <span className="cv rounded-xl shadow-[0_12px_28px_rgba(0,0,0,.28)] transition-transform duration-200 group-hover:-translate-y-1">
        <CoverImg src={manga.thumbnailUrl} loading="lazy" />
        {badge && (
          <Glass as="span" dense className="absolute top-2 right-2 z-[2] inline-flex min-h-[26px] items-center rounded-full px-2.5 text-xs font-bold num" suspendRefract>
            {badge}
          </Glass>
        )}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-[15px] font-semibold">{manga.title}</span>
        <span className="truncate text-[13px] text-muted">{sub}</span>
      </span>
    </Link>
  )
}

/* ───────── 好久没看 / 还没开始读 ───────── */
function MangaShelf({ id, title, note, mangas, sub }: { id: string; title: string; note: (n: number) => string; mangas: LibManga[] | undefined; sub: (m: LibManga) => string }) {
  const [seed, batch, next] = useBatch(id)
  const shown = useMemo(() => (mangas ? pickBatch(mangas, SHELF_COUNT, seed, batch, (m) => m.id) : []), [mangas, seed, batch])
  if (!mangas?.length) return null
  return (
    <Shelf
      id={id}
      title={title}
      note={note(mangas.length)}
      actions={
        mangas.length > SHELF_COUNT && (
          <Glass as="button" type="button" className="gbtn mr-1 rounded-full" onClick={next} aria-label={`换一批${title}`}>
            <Shuffle className="size-[18px]" strokeWidth={1.8} />
            <span className="max-sm:hidden">换一批</span>
          </Glass>
        )
      }
    >
      {shown.map((m) => (
        <ShelfItem key={m.id} manga={m} sub={sub(m)} />
      ))}
    </Shelf>
  )
}

/* ───────── 特别关心书架 ───────── */
/** 只放有新章节没读的，最近抓到新章节的在前；都读完了整个模块不显示。「全部」去书库的「特别关心」标签 */
function FavoriteShelf({ library }: { library: LibManga[] | undefined }) {
  const favorites = useFavorites()
  const items = useMemo(() => (library && favorites.map ? favoritesWithNew(library, favorites.map) : undefined), [library, favorites.map])
  const navigate = useNavigate()
  const setCategory = useLibraryView((s) => s.setCategory)
  if (!items?.length) return null
  const unread = items.reduce((n, m) => n + m.unreadCount, 0)
  return (
    <Shelf
      id="favorite"
      title="特别关心"
      note={`${items.length} 部有 ${unread} 话没读`}
      actions={
        <Glass as="button" type="button" className="gbtn mr-1 rounded-full" onClick={() => { setCategory('favorite'); navigate('/library') }} aria-label="查看全部特别关心">
          全部
          <ChevronRight className="size-[18px]" strokeWidth={1.8} />
        </Glass>
      }
    >
      {items.slice(0, SHELF_COUNT).map((m) => (
        <ShelfItem key={m.id} manga={m} sub={`${timeAgo(sec(m.latestFetchedChapter?.fetchedAt))}更新`} badge={m.unreadCount > 99 ? '99+' : String(m.unreadCount)} />
      ))}
    </Shelf>
  )
}

/* ───────── 稍后再看书架 ───────── */
/** 最近加入的在前；「全部」去书库的「稍后再看」标签 */
function LaterShelf() {
  const { hidden } = useNsfw()
  const all = useLaterList().items
  const items = useMemo(() => all?.filter((m) => !hidden(m)), [all, hidden])
  const navigate = useNavigate()
  const setCategory = useLibraryView((s) => s.setCategory)
  if (!items?.length) return null
  return (
    <Shelf
      id="later"
      title="稍后再看"
      note={`存了 ${items.length} 部，最近加入的在前`}
      actions={
        <Glass as="button" type="button" className="gbtn mr-1 rounded-full" onClick={() => { setCategory('later'); navigate('/library') }} aria-label="查看全部稍后再看">
          全部
          <ChevronRight className="size-[18px]" strokeWidth={1.8} />
        </Glass>
      }
    >
      {items.slice(0, SHELF_COUNT).map((m) => (
        <ShelfItem key={m.id} manga={m} sub={`${timeAgo(sec(String(m.laterAt)))}加入`} />
      ))}
    </Shelf>
  )
}

/* ───────── 最近更新书架 ───────── */
function UpdatesShelf({ chapters }: { chapters: UpdateChapter[] | undefined }) {
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

  if (chapters && groups.length === 0) return null
  return (
    <Shelf
      id="up"
      title="最近更新"
      note={chapters ? (withNew ? `${withNew} 部漫画有 ${newCount} 话新章节` : '新章节都读过了') : ' '}
      actions={
        <Link to="/updates" className="mr-2 font-semibold text-muted no-underline hover:text-text">
          查看全部
        </Link>
      }
    >
      {groups.map(({ latest: c, unread }) => (
        <ShelfItem key={c.mangaId} manga={c.manga} sub={`${chapterLabel(c)} · ${timeAgo(sec(c.fetchedAt))}`} badge={unread > 0 ? `+${unread > 99 ? '99+' : unread}` : undefined} />
      ))}
    </Shelf>
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
        {items.map((c) => (
          <RecentRow key={c.manga.id} c={c} />
        ))}
      </div>
    </section>
  )
}

/**
 * 封面单独进详情（带封面飞入），文字区继续阅读；整行仍是一个悬停区。
 * 不嵌套链接：两个 Link 并排，读完的作品文字区也进详情，借用同行封面飞入。
 */
function RecentRow({ c }: { c: ReadChapter }) {
  const prefetch = usePrefetchManga(c.manga.id)
  const r = resume(c)
  const pct = progressOf(c)
  const detail = `/manga/${c.manga.id}`
  return (
    <div data-sfw={sfwAttr(c.manga.source?.displayName)} data-reader-origin className="-mx-2.5 flex items-center gap-[18px] rounded-[18px] p-2.5 transition-colors hover:bg-hover">
      <Link to={detail} viewTransition {...prefetch} className="cv w-[72px] flex-none rounded-[9px] shadow-[0_10px_24px_rgba(0,0,0,.3)]" aria-label={`${c.manga.title} 详情`}>
        <CoverImg src={c.manga.thumbnailUrl} loading="lazy" />
      </Link>
      <Link
        to={r ? `${detail}/chapter/${r.id}` : detail}
        viewTransition
        className="flex min-w-0 flex-1 flex-col gap-1 text-text no-underline"
      >
        {/* 时间放进标题行：文字列宽度固定，各行进度条右端才对齐 */}
        <span className="flex items-baseline gap-3">
          <span className="min-w-0 flex-1 truncate text-base font-semibold">{c.manga.title}</span>
          <span className="flex-none text-[13px] text-muted">{timeAgo(sec(c.lastReadAt))}</span>
        </span>
        <span className="truncate text-[13px] text-muted num">
          {chapterLabel(c)} · {c.isRead ? '已读完' : c.pageCount > 0 ? `${c.lastPageRead + 1} / ${c.pageCount} 页` : `第 ${c.lastPageRead + 1} 页`}
        </span>
        <span className="prog mt-2 h-[3px] w-full max-w-[220px]">
          <i style={{ width: `${pct}%` }} />
        </span>
      </Link>
    </div>
  )
}
