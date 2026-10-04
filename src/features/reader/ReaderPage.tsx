import { useApolloClient, useMutation, useQuery } from '@apollo/client/react'
import { useDrag } from '@use-gesture/react'
import { ChevronRight } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router'
import { Glass } from '@/components/glass/Glass'
import { toastError } from '@/components/ui/toast'
import { chapterLabel } from '@/features/manga/MangaHero'
import { MangaChapters, MangaDetail, type Chapter } from '@/features/manga/queries'
import { sfwAttr } from '@/lib/devSafe'
import { cn } from '@/lib/cn'
import { useBackToDetail } from './nav'
import { loadPages, warm, aspectOf } from './pageCache'
import { PagedView } from './PagedView'
import { SaveProgress } from './queries'
import { ReaderChrome } from './ReaderChrome'
import { ScrollView } from './ScrollView'
import { SettingsPanel } from './SettingsPanel'
import { BGS, FITS, MODES, cycle, useReaderSettings } from './settings'
import { buildSpreads, spreadOf } from './spreads'

export function ReaderPage() {
  const mangaId = Number(useParams().id)
  const chapterId = Number(useParams().chapterId)
  const client = useApolloClient()
  const manga = useQuery(MangaDetail, { variables: { id: mangaId } })
  const chapters = useQuery(MangaChapters, { variables: { mangaId } })
  const [pages, setPages] = useState<{ id: number; urls: string[] } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    setError(null)
    loadPages(client, chapterId)
      .then((urls) => alive && setPages({ id: chapterId, urls }))
      .catch((e: Error) => alive && setError(e.message.split('\n')[0]))
    return () => {
      alive = false
    }
  }, [client, chapterId])

  const list = chapters.data?.chapters.nodes
  const idx = list?.findIndex((c) => c.id === chapterId) ?? -1
  const chapter = list?.[idx]
  const [settings] = useReaderSettings(mangaId)
  const back = useBackToDetail(mangaId)
  const bg = BGS.find((b) => b.value === settings.bg)!

  return (
    <div
      className="fixed inset-0 overflow-hidden text-text"
      style={{ background: bg.color }}
      data-theme={settings.bg === 'white' ? 'light' : 'dark'}
      data-sfw={sfwAttr(manga.data?.manga.source?.displayName)}
    >
      {error ? (
        <Center>
          <p className="text-danger">无法加载本话：{error}</p>
          <button type="button" onClick={back} className="gbtn mt-4">
            返回详情
          </button>
        </Center>
      ) : !chapter || !list || pages?.id !== chapterId || !manga.data ? (
        <Center>
          <p className="text-muted">正在加载…</p>
        </Center>
      ) : pages.urls.length === 0 ? (
        <Center>
          <p className="text-muted">这一话没有页面</p>
        </Center>
      ) : (
        <ReaderSession
          key={chapterId}
          mangaId={mangaId}
          title={manga.data.manga.title}
          chapter={chapter}
          prev={list[idx - 1]}
          next={list[idx + 1]}
          pages={pages.urls}
        />
      )}
    </div>
  )
}

/**
 * 平滑滚动一段距离。不用 behavior: 'smooth'：图片加载引起的滚动锚定调整会打断它，
 * 导致连按空格时每隔一次才动。
 */
let gliding = 0
function glide(el: HTMLElement, dy: number) {
  cancelAnimationFrame(gliding)
  const start = performance.now()
  let done = 0
  const tick = (now: number) => {
    const t = Math.min(1, (now - start) / 260)
    const eased = 1 - (1 - t) ** 3
    const target = dy * eased
    el.scrollTop += target - done
    done = target
    if (t < 1) gliding = requestAnimationFrame(tick)
  }
  gliding = requestAnimationFrame(tick)
}

function useNarrow() {
  const q = '(max-width: 767px) and (orientation: portrait)'
  const [narrow, setNarrow] = useState(() => matchMedia(q).matches)
  useEffect(() => {
    const m = matchMedia(q)
    const on = () => setNarrow(m.matches)
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [])
  return narrow
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="grid h-full place-items-center text-center">{<div>{children}</div>}</div>
}

/** 一话的阅读状态；换话时整个重建 */
function ReaderSession({
  mangaId,
  title,
  chapter,
  prev,
  next,
  pages,
}: {
  mangaId: number
  title: string
  chapter: Chapter
  prev: Chapter | undefined
  next: Chapter | undefined
  pages: string[]
}) {
  const navigate = useNavigate()
  const location = useLocation()
  const client = useApolloClient()
  const [settings, set] = useReaderSettings(mangaId)
  const back = useBackToDetail(mangaId)
  const paged = settings.mode === 'single' || settings.mode === 'double'
  const last = pages.length - 1

  // 续读：没读完的话从上次的页开始
  const startPage = !chapter.isRead && chapter.lastPageRead > 0 ? Math.min(chapter.lastPageRead, last) : 0
  const [page, setPage] = useState(startPage)
  const [atEnd, setAtEnd] = useState(false)
  const [ui, setUi] = useState(true)
  const [panel, setPanel] = useState(false)
  const [scrolling, setScrolling] = useState(false)
  const [fullscreen, setFullscreen] = useState(!!document.fullscreenElement)
  const [, bump] = useState(0)
  const scroller = useRef<HTMLDivElement>(null)

  /* 工具栏自动隐藏：显示后 3 秒没有操作就收起；设置面板打开时不收。
     鼠标（精确指针）移到屏幕上下边缘或停在工具栏上会呼出 / 保持显示。 */
  const [poke, setPoke] = useState(0)
  const lastPoke = useRef(0)
  useEffect(() => {
    if (!ui || panel) return
    const t = setTimeout(() => setUi(false), 3000)
    return () => clearTimeout(t)
  }, [ui, panel, poke])
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      // 边缘呼出只给鼠标；手指在工具栏、设置面板上操作（拖进度条等）时都算「有操作」，不让它中途收起
      const edge = e.pointerType === 'mouse' && (e.clientY < 96 || e.clientY > window.innerHeight - 96)
      const onChrome = (e.target as Element | null)?.closest?.('.glass')
      if (!edge && !onChrome) return
      const now = performance.now()
      if (now - lastPoke.current < 400) return
      lastPoke.current = now
      setUi(true)
      setPoke((n) => n + 1)
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('pointerdown', onMove, { passive: true })
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerdown', onMove)
    }
  }, [])

  // 阅读时整页不响应越界滚动：手机上滚到顶再下拉不会触发浏览器的下拉刷新
  useEffect(() => {
    const html = document.documentElement
    const prev = html.style.overscrollBehavior
    html.style.overscrollBehavior = 'none'
    return () => {
      html.style.overscrollBehavior = prev
    }
  }, [])

  /* 双页拼版（宽图独占一屏，随图片加载更新） */
  // 竖屏窄屏（手机）上双页太小，自动按单页显示
  const narrow = useNarrow()
  const spreads = buildSpreads(pages.length, settings.mode === 'double' && !narrow, settings.offsetFirst, pages.map(aspectOf))
  const si = spreadOf(spreads, page)
  const shown = paged ? spreads[si] : [page]
  const onAspect = useCallback(() => bump((n) => n + 1), [])

  /* 预加载后面几页；快读完时预取下一话 */
  useEffect(() => {
    const from = Math.max(...shown) + 1
    for (let i = from; i < Math.min(pages.length, from + settings.preload); i++) warm(pages[i], onAspect)
    if (next && page >= last - settings.preload) {
      void loadPages(client, next.id)
        .then((urls) => urls.slice(0, settings.preload).forEach((u) => warm(u)))
        .catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, settings.preload, pages, next, client])

  /* 进度回写：翻页后 0.6 秒写一次，读到最后一页标为已读；离开时立即写 */
  const [save] = useMutation(SaveProgress)
  const pending = useRef<{ page: number; read: boolean } | null>(null)
  const [synced, setSynced] = useState<number | null>(null)
  const flush = useCallback(() => {
    const p = pending.current
    if (!p) return
    pending.current = null
    save({ variables: { id: chapter.id, lastPageRead: p.page, isRead: p.read ? true : undefined } })
      .then(() => setSynced(p.page))
      .catch((e) => toastError('进度同步失败', e))
  }, [save, chapter.id])

  const reachedEnd = Math.max(...shown) >= last
  useEffect(() => {
    if (page === chapter.lastPageRead && !reachedEnd) return
    pending.current = { page, read: reachedEnd && !chapter.isRead }
    const t = setTimeout(flush, 600)
    return () => clearTimeout(t)
  }, [page, reachedEnd, chapter.lastPageRead, chapter.isRead, flush])
  useEffect(() => flush, [flush])

  /* 翻页与换话 */
  const goChapter = useCallback(
    (c: Chapter | undefined) => {
      if (!c) return
      // 往后翻 = 这一话读完了（纵向模式自动进下一话时，页码状态可能还没来得及更新）
      if (c.sourceOrder > chapter.sourceOrder) pending.current = { page: last, read: !chapter.isRead }
      flush()
      // 换话替换当前历史记录，并保留「从详情页进来」的标记
      navigate(`/manga/${mangaId}/chapter/${c.id}`, { replace: true, state: location.state })
    },
    [flush, navigate, mangaId, chapter.sourceOrder, chapter.isRead, last, location.state],
  )

  const step = useCallback(
    (d: 1 | -1) => {
      if (atEnd) {
        if (d < 0) setAtEnd(false)
        else if (next && settings.autoNext) goChapter(next)
        return
      }
      if (d > 0) {
        if (si >= spreads.length - 1) setAtEnd(true)
        else setPage(spreads[si + 1][0])
      } else if (si > 0) setPage(spreads[si - 1][0])
      else if (prev) goChapter(prev)
      setUi(false)
    },
    [atEnd, next, prev, settings.autoNext, goChapter, si, spreads],
  )

  // 屏幕左右：RTL 时左边是下一页
  const left = useCallback(() => step(settings.dir === 'rtl' ? 1 : -1), [step, settings.dir])
  const right = useCallback(() => step(settings.dir === 'rtl' ? -1 : 1), [step, settings.dir])

  const jump = (i: number) => {
    setAtEnd(false)
    setPage(i)
    if (!paged) scroller.current?.querySelector(`[data-i="${i}"]`)?.scrollIntoView({ block: 'start' })
  }

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void document.documentElement.requestFullscreen().catch(() => {})
  }, [])
  useEffect(() => {
    const on = () => setFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', on)
    return () => document.removeEventListener('fullscreenchange', on)
  }, [])

  /* 键盘 */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const k = e.key
      if (k === 'ArrowLeft') paged ? left() : jump(Math.max(0, page - 1))
      else if (k === 'ArrowRight') paged ? right() : jump(Math.min(last, page + 1))
      else if (k === ' ') {
        if (!paged) {
          if (scroller.current) glide(scroller.current, (e.shiftKey ? -1 : 1) * window.innerHeight * 0.85)
        } else step(e.shiftKey ? -1 : 1)
      } else if (k === '[') goChapter(prev)
      else if (k === ']') goChapter(next)
      else if (k === 'm' || k === 'M') set({ mode: cycle(MODES, settings.mode) })
      else if (k === 'z' || k === 'Z') set({ fit: cycle(FITS, settings.fit) })
      else if (k === 'd' || k === 'D') set({ dir: settings.dir === 'rtl' ? 'ltr' : 'rtl' })
      else if (k === 'f' || k === 'F') toggleFullscreen()
      else if (k === 'Escape') panel ? setPanel(false) : setUi((v) => !v)
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // 切模式时保持当前页
  const prevMode = useRef(settings.mode)
  useEffect(() => {
    if (prevMode.current === settings.mode) return
    prevMode.current = settings.mode
    setAtEnd(false)
  }, [settings.mode])

  const pageLabel = atEnd
    ? `${pages.length} / ${pages.length}`
    : `${shown.length > 1 ? `${Math.min(...shown) + 1}–${Math.max(...shown) + 1}` : page + 1} / ${pages.length}`
  const curLabel = chapterLabel(chapter)
  const syncLabel =
    synced == null ? '翻页后自动同步阅读进度到服务器' : `进度已同步到服务器 · ${curLabel}第 ${synced + 1} 页`

  const endCard = (
    <EndCard
      chapter={chapter}
      next={next}
      scrollMode={!paged}
      onBack={() => setAtEnd(false)}
      onNext={() => goChapter(next)}
      onDetail={back}
    />
  )

  return (
    <>
      {paged ? (
        atEnd ? (
          <EndSwipe dir={settings.dir} onBack={() => setAtEnd(false)} onNext={() => goChapter(next)} onTap={() => setUi((v) => !v)}>
            {endCard}
          </EndSwipe>
        ) : (
          <PagedView
            pages={pages}
            spread={shown}
            prevSpread={spreads[si - 1]}
            nextSpread={spreads[si + 1]}
            settings={settings}
            onLeft={left}
            onRight={right}
            onStep={step}
            onCenter={() => setUi((v) => !v)}
            onAspect={onAspect}
          />
        )
      ) : (
        <ScrollView
          key={settings.mode}
          scrollerRef={scroller}
          pages={pages}
          startPage={page}
          settings={settings}
          onPage={setPage}
          onCenter={() => setUi((v) => !v)}
          onScroll={(d) => scroller.current && glide(scroller.current, d * window.innerHeight * 0.85)}
          onScrolling={setScrolling}
          footer={
            <>
              <div className="w-full py-8">{endCard}</div>
              {settings.autoNext && next && <AutoNext root={scroller} onEnter={() => goChapter(next)} />}
            </>
          }
        />
      )}

      <ReaderChrome
        visible={ui}
        suspendRefract={scrolling}
        onBack={back}
        title={title}
        chapterLabel={curLabel}
        pageLabel={pageLabel}
        settings={settings}
        set={set}
        panel={panel}
        onTogglePanel={() => setPanel((v) => !v)}
        fullscreen={fullscreen}
        onFullscreen={toggleFullscreen}
        pageCount={pages.length}
        shown={atEnd ? [last] : shown}
        readUpTo={Math.max(...shown) + settings.preload}
        onJump={jump}
        hasPrev={!!prev}
        hasNext={!!next}
        onPrevChapter={() => goChapter(prev)}
        onNextChapter={() => goChapter(next)}
      />
      <SettingsPanel open={ui && panel} settings={settings} set={set} syncLabel={syncLabel} />
    </>
  )
}

function EndCard({
  chapter,
  next,
  scrollMode,
  onBack,
  onNext,
  onDetail,
}: {
  chapter: Chapter
  next: Chapter | undefined
  scrollMode: boolean
  onBack: () => void
  onNext: () => void
  onDetail: () => void
}) {
  const nextInfo = next
    ? [next.isDownloaded ? '已下载' : '在线', next.pageCount > 0 ? `${next.pageCount} 页` : null].filter(Boolean).join(' · ')
    : ''
  return (
    <Glass dense className="mx-auto flex w-[min(520px,100%)] flex-col items-center gap-1.5 rounded-[26px] p-7 text-center">
      <small className="text-xs text-muted">已读完</small>
      <b className="text-base">{chapterLabel(chapter)}</b>
      {next ? (
        <>
          <ChevronRight className="my-1 size-5 rotate-90 text-muted" />
          <small className="text-xs text-muted">下一话 · {nextInfo}</small>
          <b className="text-[22px]">{chapterLabel(next)}</b>
          <div className={cn('mt-3.5 flex gap-2', scrollMode && 'flex-col items-center')}>
            {!scrollMode && (
              <button type="button" className="gbtn" onClick={onBack}>
                返回本话
              </button>
            )}
            <button type="button" className="solid min-h-11" onClick={onNext}>
              继续阅读下一话
            </button>
          </div>
          {scrollMode && <small className="mt-2 text-xs text-muted">继续下滑自动进入下一话</small>}
        </>
      ) : (
        <>
          <small className="mt-3 text-xs text-muted">这是最新的一话</small>
          <button type="button" onClick={onDetail} className="gbtn mt-3">
            返回详情
          </button>
        </>
      )}
    </Glass>
  )
}

/** 纵向模式：滚到底部的留白完全露出时进入下一话 */
function AutoNext({ root, onEnter }: { root: React.RefObject<HTMLDivElement | null>; onEnter: () => void }) {
  const el = useRef<HTMLDivElement>(null)
  const cb = useRef(onEnter)
  cb.current = onEnter
  useEffect(() => {
    if (!el.current || !root.current) return
    const r = root.current
    // 要求用户确实往下滚过，避免很短的一话一打开就跳走
    const io = new IntersectionObserver(([e]) => e.isIntersecting && r.scrollTop > 0 && cb.current(), { root: r, threshold: 1 })
    io.observe(el.current)
    return () => io.disconnect()
  }, [root])
  return <div ref={el} className="h-[45vh] w-full" aria-hidden />
}

/**
 * 翻页模式的「已读完」：和翻页一样左右滑动，往回滑回到本话最后一页，往前滑进入下一话；
 * 点空白处切换工具栏，滚轮向上回到本话。
 */
function EndSwipe({ dir, onBack, onNext, onTap, children }: { dir: 'ltr' | 'rtl'; onBack: () => void; onNext: () => void; onTap: () => void; children: React.ReactNode }) {
  const bind = useDrag(
    ({ swipe: [sx], tap, event }) => {
      if (tap) {
        // 点到卡片（按钮）以外的空白处才切换工具栏；手势库在 window 上收抬起事件，不能比 currentTarget
        if (!(event.target as Element | null)?.closest?.('.glass')) onTap()
        return
      }
      if (!sx) return
      // 手指向右划：LTR 是回上一页，RTL 是下一页
      const forward = dir === 'rtl' ? sx > 0 : sx < 0
      if (forward) onNext()
      else onBack()
    },
    { axis: 'x', filterTaps: true, swipe: { distance: 40, velocity: 0.3 } },
  )
  return (
    <div {...bind()} className="absolute inset-0 grid touch-pan-y place-items-center overscroll-none p-4" onWheel={(e) => e.deltaY < 0 && onBack()}>
      {children}
    </div>
  )
}
