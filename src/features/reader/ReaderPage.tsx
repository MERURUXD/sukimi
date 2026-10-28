import { useApolloClient, useQuery } from '@apollo/client/react'
import { useDrag } from '@use-gesture/react'
import { ChevronRight } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router'
import { Glass } from '@/components/glass/Glass'
import { useForceTheme } from '@/design/settings'
import { toastError } from '@/components/ui/toast'
import { chapterLabel } from '@/lib/format'
import { MangaChapters, MangaDetail, type Chapter } from '@/features/manga/queries'
import { sfwAttr } from '@/lib/devSafe'
import { cn } from '@/lib/cn'
import { isDemo } from '@/lib/demo'
import { useBackToDetail } from './nav'
import { loadPages, warm, aspectOf } from './pageCache'
import { pageReady, pageSrc, requestPage, splitFailed, usePageImages, type Variant } from './pageImage'
import { prefetchIndexes } from './scrollWindow'
import { decodePage } from './pageDecode'
import { usePageBookmarks } from './pageBookmarks'
import { WIDE, filterCss, type Half } from './pageTools'
import { PagedView, type Screen } from './PagedView'
import { atChapterEnd } from './progress'
import { useProgressSync } from './progressSync'
import { savePages } from './savePage'
import { ReaderChrome } from './ReaderChrome'
import { ScrollView } from './ScrollView'
import { SettingsPanel } from './SettingsPanel'
import { BGS, FITS, MODES, cycle, useMigrateReaderPrefs, useReaderMetaSync, useReaderSettings } from './settings'
import { pageTurn, keyGoesToControl } from './keys'
import { observedAfterJump } from './scrollBand'
import { buildSpreads, nextOf, pickSpread, pinAfterStep, prevOf } from './spreads'
import { useWakeLock } from './wakeLock'
import { t } from '@/i18n'

export function ReaderPage() {
  const mangaId = Number(useParams().id)
  const chapterId = Number(useParams().chapterId)
  const client = useApolloClient()
  const manga = useQuery(MangaDetail, { variables: { id: mangaId } })
  const chapters = useQuery(MangaChapters, { variables: { mangaId } })
  const [pages, setPages] = useState<{ id: number; urls: string[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  // 加载失败后点「重试」递增，重新拉取本话页面
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let alive = true
    setError(null)
    loadPages(client, chapterId)
      .then((urls) => alive && setPages({ id: chapterId, urls }))
      .catch((e: Error) => alive && setError(e.message.split('\n')[0]))
    return () => {
      alive = false
    }
  }, [client, chapterId, attempt])

  const list = chapters.data?.chapters.nodes
  const idx = list?.findIndex((c) => c.id === chapterId) ?? -1
  const chapter = list?.[idx]
  // 章节列表来自缓存，可能是服务端抓到新一话之前的：列表已加载却找不到本话时，重新取一次再下结论
  const missing = !!list && idx < 0
  const asked = useRef<number | null>(null)
  const [askedDone, setAskedDone] = useState<number | null>(null)
  const refetchChapters = chapters.refetch
  useEffect(() => {
    if (!missing || asked.current === chapterId) return
    asked.current = chapterId
    refetchChapters()
      .catch(() => {})
      .finally(() => setAskedDone(chapterId))
  }, [missing, chapterId, askedDone, refetchChapters])
  const notFound = missing && askedDone === chapterId
  const [settings] = useReaderSettings(mangaId)
  // 主题与玻璃参数一起跟随阅读背景，避免深色组件继承全站浅色的浓度和模糊。
  useForceTheme(settings.bg === 'white' ? 'light' : 'dark')
  const synced = useReaderMetaSync(mangaId)
  // 会话一旦挂上就不再因核对状态卸载：读到一半在设置里打开「按漫画记住阅读模式」时，
  // 核对要重新开始，卸载重挂会把已读的话按起始页重算而跳回第 1 页；核对结果到了再应用设置
  const [latched, setLatched] = useState<number | null>(null)
  if (synced && latched !== mangaId) setLatched(mangaId)
  const settingsReady = synced || latched === mangaId
  useMigrateReaderPrefs()
  const back = useBackToDetail(mangaId)
  const bg = BGS.find((b) => b.value === settings.bg)!

  return (
    <div
      className="fixed inset-0 overflow-hidden text-text"
      // 图像滤镜只作用在页面图片上（.reader-page），工具栏和设置面板不受影响
      style={{ background: bg.color, '--page-filter': filterCss(settings) } as CSSProperties}
      data-theme={settings.bg === 'white' ? 'light' : 'dark'}
      data-sfw={sfwAttr(manga.data?.manga.source?.displayName)}
      // 进出转场据此判断方向和落回哪一话（lib/readerTransition.ts）
      data-reader-root={`${mangaId}:${chapterId}`}
    >
      {notFound ? (
        <Center>
          <p className="text-danger">{t('reader.notFound')}</p>
          <div className="mt-4 flex justify-center gap-3">
            <button
              type="button"
              onClick={() => {
                asked.current = null
                setAskedDone(null)
              }}
              className="gbtn bg-accent-soft"
            >
              {t('common.retry')}
            </button>
            <button type="button" onClick={back} className="gbtn">
              {t('reader.backToDetail')}
            </button>
          </div>
        </Center>
      ) : error ? (
        <Center>
          <p className="text-danger">{t('reader.loadFailed', { reason: error })}</p>
          <div className="mt-4 flex justify-center gap-3">
            <button type="button" onClick={() => setAttempt((n) => n + 1)} className="gbtn bg-accent-soft">
              {t('common.retry')}
            </button>
            <button type="button" onClick={back} className="gbtn">
              {t('reader.backToDetail')}
            </button>
          </div>
        </Center>
      ) : !chapter || !list || pages?.id !== chapterId || !manga.data || !settingsReady ? (
        <Center>
          <p className="text-muted">{t('manga.loading')}</p>
        </Center>
      ) : pages.urls.length === 0 ? (
        <Center>
          <p className="text-muted">{t('reader.noPages')}</p>
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
let glideGen = 0
function glide(el: HTMLElement, dy: number) {
  const gen = ++glideGen
  cancelAnimationFrame(gliding)
  const start = performance.now()
  let done = 0
  const tick = (now: number) => {
    if (gen !== glideGen || !el.isConnected) return
    const t = Math.min(1, (now - start) / 260)
    const eased = 1 - (1 - t) ** 3
    const target = dy * eased
    el.scrollTop += target - done
    done = target
    if (t < 1) gliding = requestAnimationFrame(tick)
  }
  gliding = requestAnimationFrame(tick)
}
function cancelGlide() {
  glideGen++
  cancelAnimationFrame(gliding)
  gliding = 0
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
  useWakeLock(settings.keepAwake)

  // 从页面书签进来时（?page=第几页）直接到那一页；否则没读完的话从上次的页开始
  const wanted = Number(new URLSearchParams(location.search).get('page'))
  const startPage =
    Number.isInteger(wanted) && wanted >= 1
      ? Math.min(wanted - 1, last)
      : !chapter.isRead && chapter.lastPageRead > 0
        ? Math.min(chapter.lastPageRead, last)
        : 0
  const [page, setPage] = useState(startPage)
  // 书签页参数只用一次：去掉它，刷新或返回时按阅读进度续读
  useEffect(() => {
    if (location.search) navigate(location.pathname, { replace: true, state: location.state })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  // 单页模式拆分宽页时，当前显示的是先读的一半（0）还是后读的一半（1）
  const [half, setHalf] = useState<Half>(0)
  const [atEnd, setAtEnd] = useState(false)
  const [ui, setUi] = useState(true)
  const [panel, setPanel] = useState(false)
  const [scrolling, setScrolling] = useState(false)
  const [fullscreen, setFullscreen] = useState(!!document.fullscreenElement)
  const [aspectTick, bump] = useState(0)
  const scroller = useRef<HTMLDivElement>(null)
  // 纵向跳页后保持目标，防止异步裁边改变高度后偏页；用户主动滚动再解除。
  const landed = useRef<number | null>(null)
  useEffect(() => () => cancelGlide(), [])

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
  const double = settings.mode === 'double' && !narrow
  const aspects = pages.map(aspectOf)
  const spreads = buildSpreads(pages.length, double, settings.offsetFirst, aspects)
  // 已显示的拼版钉住：前面的页后加载出横页时，全局配对会整体错位，正在看的这一屏不能因此被换掉
  const [pin, setPin] = useState<number[] | null>(null)
  const shown = paged ? pickSpread(spreads, page, double ? pin : null, aspects, pages.length) : [page]
  const prevSpread = paged ? prevOf(spreads, shown) : undefined
  const nextSpread = paged ? nextOf(pages.length, double, shown, aspects) : undefined
  const onAspect = useCallback(() => bump((n) => n + 1), [])

  /* 裁白边与拆分宽页：处理好的图换掉原图显示；页码、进度仍按原来的页算 */
  usePageImages()
  const rtl = settings.dir === 'rtl'
  // Webtoon 是无缝长条，裁边会让接缝错开；双页模式的宽页本来就独占一屏，不拆
  const cropOn = settings.crop && settings.mode !== 'webtoon'
  const splitOn = settings.split && (settings.mode === 'vertical' || (paged && !double))
  const variant = (h?: Half): Variant => ({ crop: cropOn, half: h, rtl })
  // 拆不了的宽页（太大或读不了像素）整页显示一屏
  const splits = (i: number) => splitOn && (aspects[i] ?? 0) > WIDE && !splitFailed(pages[i], variant(0))
  // 只为当前页附近（预加载范围内，含上一屏）的页开始处理；纵向模式视口外只有占位，不在这里启动
  const srcOf = (i: number, h?: Half) => pageSrc(pages[i], variant(h), Math.abs(i - page) <= settings.preload + 1)
  // 这一屏和下一页的宽高比都知道了才钉：没加载完时按竖页算的配对随时可能变
  const settled = [...shown, Math.max(...shown) + 1].every((i) => i >= pages.length || aspects[i] !== undefined)
  const shownKey = shown.join('-')
  useEffect(() => {
    if (double && settled && pin?.join('-') !== shownKey) setPin(shownKey.split('-').map(Number))
  }, [double, settled, shownKey, pin])

  // 拆页和裁边也会改图片地址、尺寸：拼版确定后，还要等最终图片处理并解码完才揭开首屏。
  // 每一话独立等待；显示过一次不再隐藏，失败时仍保留 4 秒兜底。
  const curHalf = paged && shown.length === 1 && splits(shown[0]) ? half : undefined
  const layoutReady = (!double || (settled && pin?.join('-') === shownKey)) && (!splitOn || shown.every((i) => aspects[i] !== undefined))
  const imagesReady = shown.every((i) => pageReady(pages[i], variant(curHalf)))
  const stable = !paged || (layoutReady && imagesReady)
  const firstSources = JSON.stringify(shown.map((i) => srcOf(i, curHalf)))
  const [revealed, setRevealed] = useState(false)
  useEffect(() => {
    if (!stable || revealed) return
    let alive = true
    void Promise.all((JSON.parse(firstSources) as (string | undefined)[]).map(decodePage)).then(() => {
      if (alive) setRevealed(true)
    })
    return () => { alive = false }
  }, [stable, firstSources, revealed])
  useEffect(() => {
    const t = setTimeout(() => setRevealed(true), 4000)
    return () => clearTimeout(t)
  }, [])
  const holding = paged && !revealed

  // 拆分宽页：一页分成先读、后读两屏，翻页时先在两半之间走
  const screenOf = (sp: number[] | undefined, h: Half): Screen | undefined =>
    sp && { pages: sp, half: sp.length === 1 && splits(sp[0]) ? h : undefined }
  const screen: Screen = { pages: shown, half: curHalf }
  const nextScreen = curHalf === 0 ? { pages: shown, half: 1 as const } : screenOf(nextSpread, 0)
  const prevScreen = curHalf === 1 ? { pages: shown, half: 0 as const } : screenOf(prevSpread, 1)

  /* 预加载当前屏前后各几页（含上一屏）；快读完时预取下一话 */
  useEffect(() => {
    for (const i of prefetchIndexes(shown, pages.length, settings.preload)) {
      warm(pages[i], onAspect)
      // 要裁边或拆分的页提前处理好，翻到时直接显示。地址用最终要显示的那张。
      if (cropOn && !splits(i)) requestPage(pages[i], variant())
      if (splits(i)) for (const h of [0, 1] as const) requestPage(pages[i], variant(h))
      for (const h of (splits(i) ? [0, 1] : [undefined]) as (Half | undefined)[]) {
        const v = variant(h)
        if (!pageReady(pages[i], v)) continue
        const display = pageSrc(pages[i], v, false)
        if (display) void decodePage(display)
      }
    }
    if (next && page >= last - settings.preload) {
      void loadPages(client, next.id)
        .then((urls) => urls.slice(0, settings.preload).forEach((u) => warm(u)))
        .catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, settings.preload, pages, next, client, cropOn, splitOn, rtl, aspectTick])

  /* 进度回写（规则见 progress.ts） */
  const { synced, leave } = useProgressSync(mangaId, chapter, page, atChapterEnd(shown, last, splits(last), half), last)

  /* 翻页与换话 */
  const goChapter = useCallback(
    (c: Chapter | undefined) => {
      if (!c) return
      leave(c)
      // 换话替换当前历史记录，并保留「从详情页进来」的标记
      navigate(`/manga/${mangaId}/chapter/${c.id}`, { replace: true, state: location.state })
    },
    [leave, navigate, mangaId, location.state],
  )

  // 相邻屏每次渲染都重新算，这里不缓存函数
  const step = (d: 1 | -1) => {
    if (atEnd) {
      if (d < 0) setAtEnd(false)
      else if (next && settings.autoNext) goChapter(next)
      return
    }
    const to = d > 0 ? nextScreen : prevScreen
    if (to) {
      setPage(to.pages[0])
      // 往回翻进宽高比还不知道的页时先记成后一半：图载入后判定是宽页，就停在后一半而不是跳回先读的那半
      setHalf(to.half ?? (d < 0 ? 1 : 0))
      setPin(pinAfterStep(double, to.pages))
    } else if (d > 0) setAtEnd(true)
    else if (prev) goChapter(prev)
    setUi(false)
  }

  // 屏幕左右：RTL 时左边是下一页
  const left = () => step(settings.dir === 'rtl' ? 1 : -1)
  const right = () => step(settings.dir === 'rtl' ? -1 : 1)

  const jump = (i: number) => {
    setAtEnd(false)
    setPage(i)
    setHalf(0)
    if (!paged) {
      cancelGlide()
      landed.current = i
      scroller.current?.querySelector(`[data-i="${i}"]`)?.scrollIntoView({ block: 'start' })
    }
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

  /* 页面书签：记在章节元数据里，详情页的章节列表能直接跳到那一页 */
  const [bookmarks, toggleBookmarkAt] = usePageBookmarks(chapter)
  // 双页模式一屏有两页时，两页都能单独加书签（升序，B 管小页码，Shift+B 管大页码）
  const bookmarkPages = atEnd ? [last] : shown
  const toggleBookmark = (second = false) => toggleBookmarkAt(bookmarkPages[second ? bookmarkPages.length - 1 : 0])

  /* 保存 / 分享当前页：存原图（不带裁边、滤镜），双页时两页一起 */
  const [saving, setSaving] = useState(false)
  const saveCurrent = async () => {
    if (saving) return
    setSaving(true)
    const list = atEnd ? [last] : [...shown].sort((a, b) => a - b)
    try {
      await savePages(list.map((i) => ({ url: pages[i], name: t('reader.saveName', { title, chapter: chapterLabel(chapter), n: i + 1 }) })))
    } catch (e) {
      toastError(t('reader.saveFailed'), e)
    } finally {
      setSaving(false)
    }
  }

  /* 键盘。翻页函数放在 ref 里，监听只注册一次，避免每次渲染拆掉再绑上。 */
  const onKeyRef = useRef<(e: KeyboardEvent) => void>(() => {})
  onKeyRef.current = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return
    const el = e.target instanceof HTMLElement ? e.target : null
    const target = el ? { tagName: el.tagName, isContentEditable: el.isContentEditable } : null
    // 滑块和输入框自己用方向键，不要翻页，也不要取消它们的默认步进
    if (keyGoesToControl(target)) return
    const turn = pageTurn(e.key, settings.mode, settings.dir, e.shiftKey, target)
    if (turn?.kind === 'screen') step(turn.delta)
    else if (turn?.kind === 'page') jump(Math.min(last, Math.max(0, page + turn.delta)))
    else if (turn?.kind === 'scroll') {
      landed.current = null
      if (scroller.current) glide(scroller.current, turn.delta * window.innerHeight * 0.85)
    } else if (e.key === '[') goChapter(prev)
    else if (e.key === ']') goChapter(next)
    else if (e.key === 'm' || e.key === 'M') set({ mode: cycle(MODES, settings.mode) })
    else if (e.key === 'z' || e.key === 'Z') set({ fit: cycle(FITS, settings.fit) })
    else if (e.key === 'd' || e.key === 'D') set({ dir: settings.dir === 'rtl' ? 'ltr' : 'rtl' })
    else if (e.key === 'f' || e.key === 'F') toggleFullscreen()
    else if (e.key === 'b' || e.key === 'B') toggleBookmark(e.shiftKey)
    else if (e.key === 'Escape') {
      if (panel) setPanel(false)
      else setUi((v) => !v)
    }
    else return
    e.preventDefault()
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => onKeyRef.current(e)
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  // 切模式时保持当前页
  const prevMode = useRef(settings.mode)
  useEffect(() => {
    if (prevMode.current === settings.mode) return
    prevMode.current = settings.mode
    setAtEnd(false)
    // 单页翻页留下的一页钉子在双页里仍合法，切模式时丢掉，让拼版回到全局的两页
    setPin(null)
  }, [settings.mode])

  const pageLabel = atEnd
    ? `${pages.length} / ${pages.length}`
    : `${shown.length > 1 ? `${Math.min(...shown) + 1}–${Math.max(...shown) + 1}` : page + 1} / ${pages.length}`
  const curLabel = chapterLabel(chapter)
  const syncLabel =
    isDemo
      ? synced == null ? t('reader.sync.demoLocal') : t('reader.sync.demoSaved', { chapter: curLabel, page: synced + 1 })
      : synced == null ? t('reader.sync.waiting') : t('reader.sync.synced', { chapter: curLabel, page: synced + 1 })

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
            hidden={holding}
            pages={pages}
            screen={screen}
            prevScreen={prevScreen}
            nextScreen={nextScreen}
            src={srcOf}
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
          jumpTarget={landed}
          pages={pages}
          src={srcOf}
          splits={splits}
          onAspect={onAspect}
          startPage={page}
          settings={settings}
          onPage={(i, h) => {
            if (observedAfterJump(landed.current, i) === null) return
            setPage(i)
            setHalf(h ?? 0)
          }}
          onCenter={() => setUi((v) => !v)}
          onInteract={() => {
            landed.current = null
          }}
          onScroll={(d) => {
            landed.current = null
            if (scroller.current) glide(scroller.current, d * window.innerHeight * 0.85)
          }}
          onScrolling={setScrolling}
          footer={
            <>
              <div className="w-full py-8">{endCard}</div>
              {settings.autoNext && next && <AutoNext root={scroller} onEnter={() => goChapter(next)} />}
            </>
          }
        />
      )}

      {paged && holding && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-muted" aria-hidden>
          {t('manga.loading')}
        </div>
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
        bookmarks={bookmarks}
        bookmarkPages={bookmarkPages}
        onToggleBookmark={toggleBookmarkAt}
        saving={saving}
        onSave={saveCurrent}
      />
      <SettingsPanel open={ui && panel} settings={settings} set={set} syncLabel={syncLabel} bookmarks={bookmarks} onJump={jump} />
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
    ? [next.isDownloaded ? t('reader.end.downloaded') : t('reader.end.online'), next.pageCount > 0 ? t('reader.end.pages', { count: next.pageCount }) : null].filter(Boolean).join(' · ')
    : ''
  return (
    <Glass dense className="mx-auto flex w-[min(520px,100%)] flex-col items-center gap-1.5 rounded-[26px] p-7 text-center">
      <small className="text-xs text-muted">{t('reader.end.finished')}</small>
      <b className="text-base">{chapterLabel(chapter)}</b>
      {next ? (
        <>
          <ChevronRight className="my-1 size-5 rotate-90 text-muted" />
          <small className="text-xs text-muted">{t('reader.end.next', { info: nextInfo })}</small>
          <b className="text-[22px]">{chapterLabel(next)}</b>
          <div className={cn('mt-3.5 flex gap-2', scrollMode && 'flex-col items-center')}>
            {!scrollMode && (
              <button type="button" className="gbtn" onClick={onBack}>
                {t('reader.end.backToChapter')}
              </button>
            )}
            <button type="button" className="solid min-h-11" onClick={onNext}>
              {t('reader.end.continueNext')}
            </button>
          </div>
          {scrollMode && <small className="mt-2 text-xs text-muted">{t('reader.end.scrollNext')}</small>}
        </>
      ) : (
        <>
          <small className="mt-3 text-xs text-muted">{t('reader.end.latest')}</small>
          <button type="button" onClick={onDetail} className="gbtn mt-3">
            {t('reader.backToDetail')}
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
