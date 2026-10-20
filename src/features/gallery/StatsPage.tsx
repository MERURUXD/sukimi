import { ChevronDown, ChevronLeft } from 'lucide-react'
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode, type RefObject } from 'react'
import { useLocation, useNavigate, useNavigationType } from 'react-router'
import { useAuth } from '@/api/auth'
import { Glass } from '@/components/glass/Glass'
import { MovingGlassBackdrop } from '@/components/glass/MovingGlassBackdrop'
import { createIntro, type Intro } from './statsIntro'
import { BACK_SLOT, GalleryBack } from './GalleryBack'
import { NEUTRAL, coverColor, rgbCss } from '@/lib/coverColor'
import { count } from '@/lib/format'
import { cn } from '@/lib/cn'
import { PAGE_PATH_ATTR } from '@/lib/coverTransition'
import type { Rgb } from '@/lib/palette'
import { useForceDark } from '@/design/settings'
import { clamp01 } from './canvasMath'
import { GALLERY } from './GalleryHero'
import { useGalleryLibrary, useMobile, useReducedMotionPref } from './hooks'
import { afterViewTransition, armReadMorph, useLanded } from './readMorph'
import { bestRun, pageGrowth, summarize, weekActive, type ReadingStats } from './stats'
import { Clock, DIAL_UNITS, Strip, useDialTilt, type Tip, type YearRing } from './StatsDial'
import { GROUP, RankScreen, maskRanked, type RankLayout, type Ranked } from './StatsRank'
import { TasteScreen, type TasteLayout } from './StatsTaste'
import { useNsfw } from '@/features/nsfw/useNsfw'
import { LAST_SCREEN, createPager, ease, easeOut, seg, type Pager } from './statsPager'
import { tasteOf, type Taste } from './taste'
import { useReadChapters } from './useReadChapters'
import './gallery.css'

/** 排行最多显示这么多部 */
const TOP = 40

/**
 * 本页在这次会话里的记忆：进场播完过、停在第几屏、排行翻到第几组。
 * 从作品详情返回时直接显示原来的画面（阅读记录也有缓存），不再从头进场
 */
const memory = { shown: false, p: 0, cur: 0 }

/**
 * 进场进度 0→1：刻度生长、年轮与四项数字依次出现都按它走。减少动态效果或返回时直接到 1。
 * leave 把进度快速倒放回 0 作为出场，放完再换页。
 */
function useIntroProgress(ready: boolean, reduced: boolean, skip: boolean, dur = 2400) {
  const [intro] = useState(() => createIntro(reduced || skip ? 1 : 0))
  const raf = useRef(0)
  const timer = useRef(0)
  const exiting = useRef(false)
  const [out, setOut] = useState(false)
  useEffect(() => {
    if (exiting.current) return
    if (!ready || intro.t >= 1) {
      if (ready) memory.shown = true
      return
    }
    if (reduced) {
      intro.paint(1)
      memory.shown = true
      return
    }
    let start = 0
    let alive = true
    const step = (now: number) => {
      if (exiting.current) return
      start ||= now
      const k = clamp01((now - start) / dur)
      intro.paint(k)
      if (k < 1) raf.current = requestAnimationFrame(step)
      else memory.shown = true
    }
    // 从首页飞数字进来时，等数字落地再开始，保留进场的衔接。
    void afterViewTransition().then(() => {
      if (alive && !exiting.current) raf.current = requestAnimationFrame(step)
    })
    return () => {
      alive = false
      cancelAnimationFrame(raf.current)
    }
  }, [ready, reduced, dur, intro])
  useEffect(() => () => { cancelAnimationFrame(raf.current); window.clearTimeout(timer.current) }, [])

  const leave = useCallback(
    (done: () => void) => {
      cancelAnimationFrame(raf.current)
      exiting.current = true
      setOut(true)
      let fired = false
      const finish = () => {
        if (fired) return
        fired = true
        done()
      }
      if (reduced) return finish()
      const from = intro.t
      const start = performance.now()
      const D = 420
      const step = (now: number) => {
        const k = clamp01((now - start) / D)
        intro.paint(from * (1 - k * k))
        if (k < 1) raf.current = requestAnimationFrame(step)
        else finish()
      }
      raf.current = requestAnimationFrame(step)
      // 标签页在后台时动画帧会停，到时间照样换页
      timer.current = window.setTimeout(finish, D + 300)
    },
    [reduced, intro],
  )
  return { intro, leave, out }
}

function useWindowSize() {
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight })
  useEffect(() => {
    const on = () => setSize({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  return size
}

/** 排版用的最小高度，低于它整体缩小 */
const MIN_H = 600
const MIN_H_PHONE = 680
/** 桌面上排行、口味两屏排版用的最小高度，低于它这两屏再缩小 */
const STAGE_MIN_H = 760

const dateLabel = (t: number) => {
  const d = new Date(t)
  return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日`
}

/**
 * 阅读档案，分三屏：第一屏「读了多少、什么时候读」——24 小时时钟外套近半年年轮，正中是已读话数，两侧四项数字；
 * 第二屏「读得最多的」——已读排行，一组八部，前三名放大；第三屏「口味」——常读的题材和作者。
 * 往下滚（手机上滑）一次翻一屏：镜头先穿过表盘，排行的封面从低处升起；再往下排行往上飘走，口味一行行长出来。
 * 固定深色。从画廊首页点「已读话数」进来时，那个数字由换页动画飞成这里的大数字；返回时再飞回去（见 readMorph）。
 */
export function StatsPage() {
  useForceDark()
  // 档案按完整书库汇总：NSFW 作品照常计数，只在排行里换成占位（见 maskRanked）
  const { full: all, totals, stats: lib, loading: libLoading, error: libError, countsError, refetch, refetchCounts } = useGalleryLibrary()
  const { hidden } = useNsfw()
  const reads = useReadChapters()
  const mobile = useMobile()
  const reduced = useReducedMotionPref()
  const location = useLocation()
  const navigate = useNavigate()
  const navType = useNavigationType()
  const userId = useAuth((s) => s.user?.id)
  const [now] = useState(() => Date.now())
  // 从作品详情返回（阅读记录在缓存里）：不重播进场，停在原来那一屏、那一部
  const [back] = useState(() => navType === 'POP' && memory.shown && reads.chapters != null)

  const stats = useMemo(
    () => (reads.chapters && totals ? summarize(reads.chapters, all.map((m) => ({ id: m.id, total: totals.get(m.id) ?? 0 })), now, userId) : null),
    [reads.chapters, totals, all, now, userId],
  )
  const { ranked, taste } = useMemo(() => {
    if (!stats) return { ranked: [] as Ranked[], taste: null }
    const byId = new Map(all.map((m) => [m.id, m]))
    const read = stats.ranking.filter((r) => r.read > 0 && byId.has(r.id))
    return {
      ranked: read.slice(0, TOP).map((r, i) => {
        const m = byId.get(r.id)!
        const masked = hidden(m)
        return { manga: masked ? maskRanked(m) : m, masked, rank: i + 1, read: r.read, total: r.total, pages: r.pages }
      }),
      // 口味按全部读过的作品算，不只排行里的前几十部；NSFW 作品不计入，免得题材和作者认出是哪部
      taste: tasteOf(read.filter((r) => !hidden(byId.get(r.id)!)).map((r) => ({ id: r.id, read: r.read, pages: r.pages, genre: byId.get(r.id)!.genre, author: byId.get(r.id)!.author }))),
    }
  }, [stats, all, hidden])
  // 口味屏里作者那两张小封面
  const coverOf = useMemo(() => {
    const m = new Map(all.map((x) => [x.id, x.thumbnailUrl ?? null]))
    return (id: number) => m.get(id) ?? null
  }, [all])
  const { intro, leave, out } = useIntroProgress(!!stats, reduced, back)
  // 一进来还没有汇总结果：先摆出空时钟（刻度、外圈），加载时扫光、外圈走进度，汇总出来后刻度就地长出来
  const [primed] = useState(() => !stats)
  const landed = useLanded()
  const load = useMemo(() => primed && !out ? { fetched: reads.fetched, landed } : null, [primed, out, reads.fetched, landed])

  const [pager] = useState(() => createPager({ p: back ? memory.p : 0, cur: back ? memory.cur : 0, count: 0, reduced }))
  useLayoutEffect(() => {
    pager.limit(Math.ceil(ranked.length / GROUP), !!stats && ranked.length > 0)
    // 汇总出来却没有排行（比如唯一读过的作品刚移出书库）：后两屏没东西可放，回到第一屏，不留一片空背景
    if (stats && !ranked.length && pager.p > 0) pager.reset()
  }, [pager, ranked.length, stats])
  useEffect(
    () => () => {
      memory.p = Math.round(pager.p)
      memory.cur = pager.cur
      pager.dispose()
    },
    [pager],
  )

  // 背景光晕取读得最多的两部的封面主色
  const [glow, setGlow] = useState<[Rgb, Rgb]>([NEUTRAL, NEUTRAL])
  const firstCover = ranked[0]?.manga.thumbnailUrl
  const secondCover = ranked[1]?.manga.thumbnailUrl
  useEffect(() => {
    let alive = true
    // 取主色要读封面像素，等飞行落地再做
    void afterViewTransition()
      .then(() => Promise.all([coverColor(firstCover), coverColor(secondCover ?? firstCover)]))
      .then((c) => alive && setGlow(c))
    return () => {
      alive = false
    }
  }, [firstCover, secondCover])

  /*
   * 离开：第一屏先倒放进场再换页，已读话数飞回首页。后两屏上看不到那个数字，不倒回第一屏，直接淡出换页，免得等太久；
   * 切屏途中（还偏第一屏）先快速收回再走第一屏的流程。浏览器后退时来不及倒放，在第一屏照样让数字飞回去
   */
  const leaving = useRef(false)
  const exit = useCallback(() => {
    if (leaving.current) return
    leaving.current = true
    const nav = () => {
      const fromGallery = (location.state as { from?: string } | null)?.from === 'gallery'
      if (fromGallery && (window.history.state?.idx ?? 0) > 0) navigate(-1)
      else navigate(GALLERY, { viewTransition: true })
    }
    const back = () =>
      leave(() => {
        armReadMorph()
        nav()
      })
    if (pager.p > 0.5) nav()
    else if (pager.p > 0) pager.go(0, back, 300)
    else back()
  }, [leave, location.state, navigate, pager])
  useEffect(() => {
    const onPop = () => {
      if (pager.p <= 0.5) armReadMorph()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.ctrlKey && !e.metaKey && !e.altKey) exit()
    }
    window.addEventListener('popstate', onPop)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('popstate', onPop)
      window.removeEventListener('keydown', onKey)
    }
  }, [exit, pager])

  // 章节、书库、总话数任何一个失败都要给出错误和重试，否则会一直停在「正在汇总」
  const error = reads.error ?? libError ?? countsError
  const retry = useCallback(() => {
    if (reads.error) reads.retry()
    if (libError) void refetch()
    if (countsError) void refetchCounts()
  }, [reads, libError, countsError, refetch, refetchCounts])
  const loadingText = error ? null : `正在汇总阅读记录…${reads.fetched ? `已取 ${count(reads.fetched)} 话` : ''}`

  return (
    <div data-theme="dark" {...{ [PAGE_PATH_ATTR]: location.pathname }} className="relative min-h-dvh bg-bg text-text">
      <Stats
        mobile={mobile}
        stats={stats}
        // 汇总出来之前先用书库里的「总话数 − 未读」，和首页那个数字一样，飞过来落地时不跳
        read={stats?.read ?? lib.read}
        ranked={ranked}
        taste={taste}
        coverOf={coverOf}
        works={all.length}
        intro={intro}
        reduced={reduced}
        glow={glow}
        loadingText={stats ? null : libLoading ? '正在加载书库…' : loadingText}
        // 离开时交还给进场进度，外圈跟着倒放收起
        load={load}
        error={error}
        retry={retry}
        now={now}
        pager={pager}
        onExit={exit}
      />
    </div>
  )
}

interface BodyProps {
  mobile: boolean
  stats: ReadingStats | null
  read: number | null
  ranked: Ranked[]
  taste: Taste | null
  coverOf: (id: number) => string | null
  works: number
  intro: Intro
  reduced: boolean
  glow: [Rgb, Rgb]
  loadingText: string | null
  /** 一进来就在加载时才有：已取的话数、已读话数是否已落地（落地前不扫光、不走进度） */
  load: { fetched: number; landed: boolean } | null
  error: unknown
  retry: () => void
  now: number
  pager: Pager
  onExit: () => void
}

/* ───────── 背景与噪点 ───────── */
const Backdrop = memo(function Backdrop({ glow, className, fade }: { glow: [Rgb, Rgb]; className?: string; fade?: string }) {
  return (
    <div aria-hidden data-stats-progress="p" className={cn('pointer-events-none overflow-hidden', className)} style={{ opacity: fade }}>
      <div
        className="gallery-blob-a absolute top-[-16%] left-[36%] aspect-square w-[min(920px,90vw)] rounded-full opacity-85 max-md:top-[-12%] max-md:left-[-30%] max-md:w-[520px]"
        style={{ background: `radial-gradient(closest-side, ${rgbCss(glow[0], 0.87)} 0%, ${rgbCss(glow[0], 0.33)} 45%, transparent 100%)` }}
      />
      <div
        className="gallery-blob-b absolute top-[36%] left-[66%] aspect-square w-[min(760px,70vw)] rounded-full opacity-70 max-md:top-[26%] max-md:left-[30%] max-md:w-[460px]"
        style={{ background: `radial-gradient(closest-side, ${rgbCss(glow[1], 0.8)} 0%, ${rgbCss(glow[1], 0.27)} 50%, transparent 100%)` }}
      />
      <div className="gallery-blob-b absolute top-[30%] left-[-12%] aspect-square w-[720px] rounded-full bg-[radial-gradient(closest-side,rgba(255,255,255,.09),transparent)]" />
      <div className="gallery-grain absolute inset-0" />
    </div>
  )
})

const MemoRankScreen = memo(RankScreen)
const MemoTasteScreen = memo(TasteScreen)

/** 进场时一段段淡入上移；出场倒放时按同样的顺序收起 */
const upStyle = (t: number, at: number): CSSProperties => {
  const e = easeOut((t - at) / 0.45)
  return { opacity: e, translate: `0 ${((1 - e) * 18).toFixed(1)}px` }
}

/**
 * 三屏的手势：滚轮 / 方向键 / 竖向拖动一次翻一屏；排行那屏上横向拖动、横向滚动、左右键换一组。
 * 拖动按最先移动的方向分横竖；拖过就吞掉随后的点击，免得松手时点进了作品
 */
function usePagerInput(root: RefObject<HTMLDivElement | null>, pager: Pager) {
  const moved = useRef(false)
  useEffect(() => {
    const el = root.current
    if (!el) return
    const here = () => Math.round(pager.p)
    const onRank = () => Math.abs(pager.p - 1) < 0.02
    const step = (d: -1 | 1) => {
      const to = here() + d
      if (to >= 0 && to <= LAST_SCREEN) pager.go(to)
    }
    let acc = 0
    let accT = 0
    let accX = 0
    let lastFlip = 0
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) return
      e.preventDefault()
      const dx = e.deltaX * (e.deltaMode === 1 ? 40 : 1)
      const dy = e.deltaY * (e.deltaMode === 1 ? 40 : 1)
      if (onRank() && Math.abs(dx) > Math.abs(dy)) {
        // 触控板横划一次会来一串事件：攒够一段才换组，换完歇一会儿，免得一划翻好几组
        const now = performance.now()
        if (now - lastFlip < 450) return
        accX += dx
        window.clearTimeout(accT)
        accT = window.setTimeout(() => (accX = 0), 180)
        if (Math.abs(accX) < 60) return
        pager.flip(pager.cur + (accX > 0 ? 1 : -1))
        accX = 0
        lastFlip = now
        return
      }
      // 斜着划的触控板手势不算竖向，免得换组时一不小心切屏
      if (Math.abs(dy) < Math.abs(dx) * 1.2 || pager.busy) return
      acc += dy
      window.clearTimeout(accT)
      accT = window.setTimeout(() => (acc = 0), 180)
      if (acc > 40) step(1)
      else if (acc < -40) step(-1)
      else return
      acc = 0
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || (e.target as HTMLElement).closest?.('input, textarea, [contenteditable]')) return
      const k = e.key
      if (k === 'ArrowDown' || k === 'PageDown' || (k === ' ' && !(e.target as HTMLElement).closest?.('button, a'))) step(1)
      else if (k === 'ArrowUp' || k === 'PageUp') step(-1)
      else if ((k === 'ArrowLeft' || k === 'ArrowRight') && onRank()) pager.flip(pager.cur + (k === 'ArrowLeft' ? -1 : 1))
      else return
      e.preventDefault()
    }
    let ptr: { id: number; x: number; y: number; axis: 'x' | 'y' | null } | null = null
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return
      moved.current = false
      ptr = { id: e.pointerId, x: e.clientX, y: e.clientY, axis: null }
    }
    const onMove = (e: PointerEvent) => {
      if (!ptr || e.pointerId !== ptr.id || ptr.axis) return
      const dx = e.clientX - ptr.x
      const dy = e.clientY - ptr.y
      if (Math.hypot(dx, dy) < 8) return
      ptr.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
      moved.current = true
      el.setPointerCapture(e.pointerId)
    }
    const onUp = (e: PointerEvent) => {
      if (!ptr || e.pointerId !== ptr.id) return
      const dx = e.clientX - ptr.x
      const dy = e.clientY - ptr.y
      if (ptr.axis === 'x' && onRank() && Math.abs(dx) > 40) pager.flip(pager.cur + (dx < 0 ? 1 : -1))
      else if (ptr.axis === 'y') {
        if (dy < -40) step(1)
        else if (dy > 40) step(-1)
      }
      ptr = null
    }
    const onClick = (e: MouseEvent) => {
      if (!moved.current) return
      e.preventDefault()
      e.stopPropagation()
      moved.current = false
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onUp)
    el.addEventListener('click', onClick, true)
    window.addEventListener('keydown', onKey)
    return () => {
      window.clearTimeout(accT)
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onUp)
      el.removeEventListener('click', onClick, true)
      window.removeEventListener('keydown', onKey)
    }
  }, [root, pager])
  return useCallback(() => moved.current, [])
}

/** 3.1 万页；不到一万照常写 */
const pagesText = (n: number) => (n >= 10000 ? { v: (n / 10000).toFixed(1).replace(/\.0$/, ''), u: '万页' } : { v: count(n), u: '页' })

/** 两侧四项数字：每项是大数字、一行说明和一条细竖条小图 */
function kpiItems(s: ReadingStats, works: number, run: ReturnType<typeof bestRun>) {
  const ratio = (f: number) => Array.from({ length: 24 }, (_, i) => ({ v: 1, lit: (i + 0.5) / 24 <= f }))
  const frac = s.total ? s.read / s.total : 0
  const growth = pageGrowth(s.days, s.pages, 24)
  const base = s.pages - s.days.reduce((a, d) => a + d.pages, 0)
  const pg = pagesText(s.pages)
  const runWeeks = run ? [Math.floor(run.from / 7), Math.floor(run.to / 7)] : null
  return {
    progress: [
      {
        key: 'read',
        value: (e: number) => (s.total ? `${Math.round(frac * 100 * e)}` : '—'),
        unit: '%',
        caption: `已读 · ${count(s.read)} / ${s.total == null ? '—' : count(s.total)} 话`,
        bars: ratio(frac),
        label: `书库已读 ${Math.round(frac * 100)}%`,
      },
      {
        key: 'caught',
        value: (e: number) => `${Math.round(s.caughtUp * e)}`,
        unit: ` / ${works}`,
        caption: '部已追平',
        bars: ratio(works ? s.caughtUp / works : 0),
        label: `已追平 ${s.caughtUp} / ${works} 部`,
      },
    ],
    rhythm: [
      {
        key: 'days',
        value: (e: number) => `${Math.round(s.activeDays * e)}`,
        unit: '天',
        caption: '近半年有阅读 · 按周',
        bars: weekActive(s.days).map((v, w) => ({ v, on: v > 0, lit: !!runWeeks && v > 0 && w >= runWeeks[0] && w <= runWeeks[1] })),
        label: `近半年有 ${s.activeDays} 天有阅读`,
      },
      {
        key: 'pages',
        value: () => pg.v,
        unit: pg.u,
        caption: '约翻过 · 近半年累计',
        bars: growth.map((v, i) => ({ v: v - base, on: true, lit: i === growth.length - 1 })),
        label: `约翻过 ${count(s.pages)} 页`,
      },
    ],
  }
}

type Kpi = ReturnType<typeof kpiItems>['progress'][number]

const KpiBlock = memo(function KpiBlock({ k, intro, at, right, size, strip }: { k: Kpi; intro: Intro; at: number; right?: boolean; size: number; strip: { w: number; h: number } }) {
  const value = useRef<HTMLSpanElement>(null)
  const t = intro.t
  useLayoutEffect(() => intro.subscribe(() => {
    const next = k.value(easeOut((intro.t - at) / 0.6))
    if (value.current && value.current.textContent !== next) value.current.textContent = next
  }), [intro, k, at])
  const e = easeOut((t - at) / 0.6)
  return (
    <div data-intro-rise={at} className={cn('flex flex-col', right ? 'items-end text-right' : 'items-start')} style={upStyle(t, at)}>
      <span aria-hidden className="flex items-baseline gap-1 leading-[.95] whitespace-nowrap">
        <span ref={value} className="font-bold tracking-[-0.045em] num" style={{ fontSize: size }}>
          {k.value(e)}
        </span>
        <span className="font-cjk font-bold text-muted" style={{ fontSize: Math.round(size * 0.36) }}>
          {k.unit}
        </span>
      </span>
      <span className="mt-2 text-xs font-semibold whitespace-nowrap text-muted md:text-[13px]">{k.caption}</span>
      <span className={size > 40 ? 'mt-4' : 'mt-3'}>
        <Strip bars={k.bars} width={strip.w} height={strip.h} right={right} intro={intro} at={at + 0.1} label={k.label} />
      </span>
    </div>
  )
})

/** 第一屏底部：往下看的提示；还在汇总时换成进度文字，失败时是重试 */
function Hint({ p, t, pager, mobile }: { p: BodyProps; t: number; pager: Pager; mobile: boolean }) {
  if (!p.stats)
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        {p.error ? (
          <>
            <p className="m-0 text-danger">阅读记录加载失败</p>
            <button type="button" className="solid" onClick={p.retry}>
              重试
            </button>
          </>
        ) : (
          <p className="m-0 text-sm text-muted num">{p.loadingText}</p>
        )}
      </div>
    )
  if (!p.ranked.length) return <p className="m-0 text-sm text-muted">还没有读过的作品，读完一话就会出现在这里</p>
  const e = easeOut((t - 0.6) / 0.45)
  return (
    // 透明度放在玻璃元素自己身上，不放祖先，免得背景采样跟着变
    <Glass
      data-intro-hint
      data-stats-progress="p"
      as="button"
      type="button"
      onClick={() => pager.go(1)}
      className="flex h-10 items-center gap-1.5 rounded-full pr-3.5 pl-4 text-[13px] font-bold text-text"
      style={{ opacity: `calc(${e} * (1 - ${seg01('0', '0.15')}))`, translate: `0 calc(${((1 - e) * 18).toFixed(1)}px + ${seg01('0', '0.15')} * 12px)` }}
    >
      {mobile ? '上滑' : '往下看'} · 读了什么
      <ChevronDown className="size-4" strokeWidth={2.4} />
    </Glass>
  )
}

const SCREENS = ['概览', '已读排行', '口味']

/** 右侧三个小点：当前这屏拉长，点哪个切到哪屏 */
function ScreenDots({ screen, pager, mobile, style }: { screen: number; pager: Pager; mobile: boolean; style: CSSProperties }) {
  return (
    <nav data-intro-rise="0.7" aria-label="切换屏幕" className="absolute top-1/2 z-10 flex -translate-y-1/2 flex-col" style={{ right: mobile ? 4 : 14, ...style }}>
      {SCREENS.map((label, i) => (
        <button key={label} type="button" aria-label={label} aria-current={screen === i ? 'true' : undefined} onClick={() => pager.go(i)} className="group grid place-items-center p-2">
          <span className={cn('block h-[22px] w-1.5 rounded-full transition-[transform,background-color] duration-400 ease-out', screen === i ? 'scale-y-100 bg-white' : 'scale-y-[.273] bg-white/30 group-hover:bg-white/60')} />
        </button>
      ))}
    </nav>
  )
}

/** 一段进度写成 CSS，变量只写在实际使用它的光晕或按钮上。 */
const seg01 = (a: string, b: string) => `clamp(0, calc((var(--stats-p) - ${a}) / (${b} - ${a})), 1)`

function Stats(p: BodyProps) {
  const { mobile, stats, read, ranked, taste, works, intro, reduced, pager } = p
  const t = intro.t
  const animating = useSyncExternalStore(pager.subscribe, () => pager.animating)
  const win = useWindowSize()
  // 太矮的窗口（手机横屏、小屏手机）按最小高度排版再整体缩小：三屏都固定在一屏里，滚轮和上下滑留给切屏，不能改成滚动
  const k = Math.min(1, win.h / (mobile ? MIN_H_PHONE : MIN_H))
  const w = win.w / k
  const h = win.h / k
  const root = useRef<HTMLDivElement>(null)
  const zoom = useRef<HTMLDivElement>(null)
  const num = useRef<HTMLDivElement>(null)
  const tilt = useRef<HTMLDivElement>(null)
  const [tip, setTip] = useState<Tip>(null)
  const [screen, setScreen] = useState(() => Math.round(pager.p))
  const [at, setGroup] = useState(pager.cur)
  // 排行变短时（比如刚汇总完）不越界
  const groups = Math.ceil(ranked.length / GROUP)
  const rankGroup = Math.min(at, Math.max(0, groups - 1))

  /* ── 尺寸 ── */
  const side = mobile ? 24 : Math.round(Math.max(32, Math.min(64, w * 0.044)))
  const top = mobile ? 64 : 88
  // 大屏放大倍数：按 1440×860 排版，更高更宽的窗口里数字、表盘和封面一起放大，不让内容缩在中间、四周空一大片
  const u = mobile ? 1 : Math.max(1, Math.min(h / 860, w / 1440, 1.3))
  const kpiW = Math.round((w >= 1200 ? 196 : 168) * u)
  const kpiGap = Math.round(80 * u)
  // 表盘（连年轮和外面的字）的边长；时钟本身按 360 / DIAL_UNITS 缩
  const dial = mobile ? Math.round(Math.max(260, Math.min(w - 16, h * 0.47))) : Math.round(Math.max(300, Math.min(h - top - 92, w - side * 2 - kpiW * 2 - kpiGap * 2, 960)))
  const clock = Math.round((dial * 360) / DIAL_UNITS)
  const text = useMemo(() => read == null ? '—' : count(read), [read])
  const numSize = Math.round(Math.max(36, Math.min(mobile ? 64 : 136, (clock * 0.6 - 36) / ([...text].length * 0.56))))
  // 后两屏在桌面矮窗口里按 STAGE_MIN_H 高排版再整体缩小：标题、领奖台、书架、翻组按钮叠起来比第一屏高，
  // 600 高时会顶到顶栏、底部按钮被裁掉。第一屏仍按原来的最小高度
  const k2 = mobile ? 1 : Math.min(1, h / STAGE_MIN_H)
  const sw = w / k2
  const sh = h / k2
  // 后两屏的舞台：超宽屏上也收在中间；右边留出切屏小点的位置（手机上靠左，只让出右边一小条）
  const stage = mobile ? sw - side * 2 - 10 : Math.min(sw - side * 2 - 48, Math.round(1500 * u))
  const stageL = mobile ? side : (sw - stage) / 2
  const headFs = Math.round(mobile ? Math.max(30, Math.min(44, sw * 0.09)) : Math.max(40, Math.min(82 * u, sw * 0.052)))
  // 标题占的高度：小字一行加大字（手机两行）
  const headH = mobile ? 30 + headFs * 1.12 * 2 : 34 + headFs * 1.12
  const pageBottom = mobile ? 20 : 36
  const pageTop = top + 8
  const rankL = useMemo<RankLayout>(() => {
    if (mobile) {
      // 第一名封面在左、信息在右，二三名并排，再下面五张小封面：按剩下的高度定封面大小
      const shelfW = Math.min(46, Math.floor((stage - 40) / 5))
      const avail = sh - pageTop - pageBottom - headH - 16 * 3 - 76 - (shelfW * 1.5 + 22) - 50
      const cw1 = Math.round(Math.max(80, Math.min(sw * 0.36, avail / 2.43)))
      return { phone: true, left: stageL, width: stage, top: pageTop, bottom: pageBottom, headFs, cw1, cw2: Math.round(cw1 * 0.62), shelfW, u }
    }
    const shelfW = Math.round(54 * u)
    // 领奖台第一列占 1.45 份；封面旁边还要放下大名次
    const col1 = ((stage * 0.92) * 1.45) / 3.45
    // 前三名下面的书名、话数、进度条约 125 高；书架、翻组按钮各一行
    const avail = sh - pageTop - pageBottom - headH - 26 * u * 3 - 125 * u - shelfW * 1.5 - 50
    const cw1 = Math.round(Math.max(110, Math.min(avail / 1.5, 260 * u, col1 / 1.95)))
    return { phone: false, left: stageL, width: stage, top: pageTop, bottom: pageBottom, headFs, cw1, cw2: Math.round(cw1 * 0.74), shelfW, u }
  }, [mobile, stage, stageL, sh, sw, pageTop, pageBottom, headH, headFs, u])
  const genreN = taste?.genres.length ?? 0
  const authorN = taste?.authors.length ?? 0
  const tasteL = useMemo<TasteLayout>(() => {
    const base = { phone: mobile, left: stageL, width: stage, top: pageTop, bottom: pageBottom, headFs, u }
    if (!mobile) {
      const avail = sh - pageTop - pageBottom - headH - 46 * u
      const genreFs = Math.round(Math.max(22, Math.min(42 * u, sw * 0.03, (avail / Math.max(1, genreN) - 30 * u) / 1.15)))
      return { ...base, genreFs, rowGap: Math.round(18 * u), authorCw: Math.round(44 * u), authorGap: Math.round(28 * u) }
    }
    // 手机上题材和作者竖着叠，整屏又不能滚：按剩下的高度压缩题材行，还不够再压作者，矮屏上最后一位作者也不被裁掉。
    // 每行题材 = 字高 + 6 + 细条 3（中文字体实际略高，按 12 留余量），行间 rowGap；作者区 = 小标题 16 + 每位（封面高 + 间距）
    const free = sh - pageTop - pageBottom - headH - 24 - 28
    const fit = (authorCw: number, authorGap: number) => {
      const per = genreN ? (free - (authorN ? 16 + authorN * (authorCw * 1.6 + authorGap) : 0)) / genreN : Infinity
      const rowGap = per < 44 ? 6 : 10
      return { genreFs: Math.floor(Math.max(16, Math.min(22, (per - 12 - rowGap) / 1.15))), rowGap, authorCw, authorGap, ok: per >= 16 * 1.15 + 12 + rowGap }
    }
    const roomy = fit(30, 12)
    const l = roomy.ok ? roomy : fit(24, 8)
    return { ...base, genreFs: l.genreFs, rowGap: l.rowGap, authorCw: l.authorCw, authorGap: l.authorGap }
  }, [mobile, stage, stageL, sh, sw, pageTop, pageBottom, headH, headFs, u, genreN, authorN])

  const run = useMemo(() => (stats ? bestRun(stats.days) : null), [stats])
  const year = useMemo<YearRing | null>(() => (stats ? { days: stats.days, run, weekly: mobile } : null), [stats, run, mobile])
  const kpis = useMemo(() => (stats ? kpiItems(stats, works, run) : null), [stats, works, run])
  const peak = stats && stats.peak >= 0 ? stats.peak : -1

  useDialTilt(tilt, reduced || mobile, pager)
  const moved = usePagerInput(root, pager)

  /* ── 每帧只改实际运动的节点；切屏完成后才更新 React 与无障碍状态 ── */
  useLayoutEffect(() => {
    // 进度只传给使用它的区域，避免每帧让表盘的整棵 SVG 子树重算继承样式。
    const progress = root.current?.querySelectorAll<HTMLElement>('[data-stats-progress="p"]')
    const drift = root.current?.querySelectorAll<HTMLElement>('[data-stats-drift]')
    const panels = root.current?.querySelectorAll<HTMLElement>('[data-stats-screen]')
    const paint = () => {
      const pp = pager.p
      const ud = ease(seg(pp, 0.04, 0.56))
      // 过渡重叠区仍同时显示两屏，完全退出以后才停止绘制，保留各屏状态和回程动画。
      panels?.forEach((el) => {
        const i = Number(el.dataset.statsScreen)
        if (i === 0) el.style.visibility = pp < 0.62 ? '' : 'hidden'
        // 后两屏提前挂着并解码封面；不把首次绘制推迟到过渡半程。
        else el.style.opacity = i === 1 ? (pp > 0.25 && pp < 1.8 ? '1' : '0') : pp > 1.2 ? '1' : '0'
        const inactive = pager.animating || i !== Math.round(pp)
        if (el.inert !== inactive) el.inert = inactive
        const hidden = String(inactive)
        if (el.getAttribute('aria-hidden') !== hidden) el.setAttribute('aria-hidden', hidden)
      })
      progress?.forEach((el) => el.style.setProperty('--stats-p', pp.toFixed(4)))
      const ek = ease(seg(pp, 0, 0.3))
      drift?.forEach((el) => {
        el.style.opacity = String(1 - ek)
        el.style.translate = mobile ? `0 ${ek * 30}px` : `${ek * Number(el.dataset.statsDrift) * 60}px 0`
      })
      if (zoom.current) {
        zoom.current.style.transform = ud ? `scale(${(1 + ud * 1.9).toFixed(4)})` : ''
        zoom.current.style.opacity = `${1 - seg(pp, 0.14, 0.56)}`
      }
      if (num.current) {
        num.current.style.transform = ud ? `scale(${(1 + ud * 1.4).toFixed(4)})` : ''
        num.current.style.opacity = `${1 - seg(pp, 0.06, 0.44)}`
      }
      const ping = root.current?.querySelector<HTMLElement>('.gallery-ping')
      if (ping) ping.style.animationPlayState = pp === 0 && !pager.animating ? '' : 'paused'
      if (!pager.animating) setScreen(Math.round(pp))
      setGroup(pager.cur)
    }
    paint()
    return pager.subscribe(paint)
  }, [pager, mobile, stats, ranked.length])

  useLayoutEffect(() => {
    const rises = root.current?.querySelectorAll<HTMLElement>('[data-intro-rise]')
    const fades = root.current?.querySelectorAll<HTMLElement>('[data-intro-fade]')
    const hint = root.current?.querySelector<HTMLElement>('[data-intro-hint]')
    return intro.subscribe(() => {
      rises?.forEach((el) => Object.assign(el.style, upStyle(intro.t, Number(el.dataset.introRise))))
      fades?.forEach((el) => { el.style.opacity = String(easeOut((intro.t - Number(el.dataset.introFade)) / 0.4)) })
      if (hint) {
        const e = easeOut((intro.t - 0.6) / 0.45)
        hint.style.opacity = `calc(${e} * (1 - ${seg01('0', '0.15')}))`
        hint.style.translate = `0 calc(${((1 - e) * 18).toFixed(1)}px + ${seg01('0', '0.15')} * 12px)`
      }
    })
  })

  // 这一组第一名的封面主色：排行背后的光跟着换
  const [tone, setTone] = useState<Rgb>(NEUTRAL)
  const current = ranked[rankGroup * GROUP]
  const toneSrc = current?.manga.thumbnailUrl
  useEffect(() => {
    let alive = true
    const id = window.setTimeout(() => void coverColor(toneSrc).then((c) => alive && setTone(c)), 140)
    return () => {
      alive = false
      window.clearTimeout(id)
    }
  }, [toneSrc])

  const stripSize = useMemo(() => mobile ? { w: Math.floor((w - side * 2 - 24) / 2), h: 18 } : { w: kpiW, h: Math.round(22 * u) }, [mobile, w, side, kpiW, u])
  const group = (title: string, items: Kpi[], right: boolean, at: number) => (
    <section aria-label={title} data-stats-drift={right ? 1 : -1} className={cn('flex flex-col gap-10', right && 'items-end')}>
      <h2 data-intro-rise={at - 0.04} className="m-0 text-xs font-bold tracking-[.32em] text-muted" style={upStyle(t, at - 0.04)}>
        {title}
      </h2>
      {items.map((k, i) => (
        <KpiBlock key={k.key} k={k} intro={intro} at={at + i * 0.06} right={right} size={Math.round(52 * u)} strip={stripSize} />
      ))}
    </section>
  )

  const dialEl = (
    <div className="relative flex-none" style={{ width: dial, height: dial }}>
      <div ref={zoom} className="absolute inset-0">
        <div className="absolute" style={{ left: (dial - clock) / 2, top: (dial - clock) / 2, width: clock, height: clock, perspective: 900 }}>
          <div ref={tilt} className={cn('absolute inset-0', !mobile && '[transform-style:preserve-3d]')}>
            <Clock stats={stats} intro={intro} flat={mobile} size={clock} tip={tip} onTip={setTip} load={p.load} read={read} failed={!!p.error} reduced={reduced} year={year} className="absolute inset-0" />
          </div>
        </div>
      </div>
      <div ref={num} className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1.5">
        <span className="text-xs font-semibold tracking-[.32em] text-muted md:text-[13px]">已读章节</span>
        <span className="flex items-baseline gap-1.5">
          {/* 数字一开始就是最终值：它是从首页飞过来的，落地时不能变 */}
          <span data-gallery-read className="leading-[.95] font-bold tracking-[-0.045em] num" style={{ fontSize: numSize }}>
            {text}
          </span>
          <span className="font-cjk text-lg font-bold text-white/75 md:text-xl">话</span>
        </span>
        <span data-intro-fade={peak >= 0 ? 0.5 : undefined} className="mt-1 font-cjk text-xs font-bold text-white/70 md:text-sm" style={{ opacity: peak >= 0 ? easeOut((t - 0.5) / 0.4) : 0 }}>
          {peak >= 0 ? `${peak} 点读得最多${peak >= 22 || peak <= 3 ? ' · 是个夜猫子' : ''}` : ' '}
        </span>
      </div>
    </div>
  )

  // 后两屏背后的两团光：排行跟着这一组第一名的封面颜色，口味用背景的第二种颜色，切屏时交替淡入淡出
  const glows = (cx: number, cy: number, color: Rgb, fade: string) => (
    <div data-stats-glow data-stats-progress="p" aria-hidden className="pointer-events-none absolute" style={{ left: cx - 600, top: cy - 500, width: 1200, height: 1000, background: `radial-gradient(ellipse, ${rgbCss(color, .65)} 0%, ${rgbCss(color, .32)} 40%, ${rgbCss(color, .08)} 65%, transparent 80%)`, opacity: `calc(${fade})` }} />
  )
  const midY = pageTop + (sh - pageTop - pageBottom) / 2
  // 后两屏的排版坐标系：矮窗口里整体缩小（见 k2）
  const stageBox = (children: ReactNode) => (
    <div className="absolute top-0 left-0 origin-top-left" style={{ width: sw, height: sh, transform: k2 < 1 ? `scale(${k2})` : undefined }}>
      {children}
    </div>
  )

  return (
    <MovingGlassBackdrop value={animating ? 'suspend' : true}>
    <div ref={root} className="fixed inset-0 touch-none overflow-hidden select-none">
      <div className="absolute top-0 left-0 origin-top-left" style={{ width: w, height: h, transform: k < 1 ? `scale(${k})` : undefined }}>
        <Backdrop glow={p.glow} className="absolute inset-0" fade={`calc(1 - ${seg01('0.3', '0.8')} * .6)`} />

        {/* ───── 第一屏 ───── */}
        <div data-stats-screen="0" className="absolute inset-0" inert={screen !== 0}>
          {mobile ? (
            <div className="absolute inset-x-0 flex flex-col items-center" style={{ top: top + 8 }}>
              {dialEl}
              {kpis && (
                <div data-stats-drift="1" className="mt-4 grid w-full grid-cols-2 gap-x-6 gap-y-6" style={{ paddingInline: side }}>
                  {[...kpis.progress, ...kpis.rhythm].map((k, i) => (
                    <KpiBlock key={k.key} k={k} intro={intro} at={0.38 + i * 0.05} size={36} strip={stripSize} />
                  ))}
                </div>
              )}
            </div>
          ) : (
            // 两侧数字贴着表盘，整组居中；不铺满整个窗口，宽屏上中间才不会空出一大片
            <div className="absolute grid items-center justify-center" style={{ left: side, right: side, top, bottom: 92, gridTemplateColumns: `${kpiW}px ${dial}px ${kpiW}px`, columnGap: kpiGap }}>
              <div>{kpis && group('进度', kpis.progress, false, 0.38)}</div>
              {dialEl}
              <div className="flex justify-end">{kpis && group('节奏', kpis.rhythm, true, 0.46)}</div>
            </div>
          )}
          <div className="absolute inset-x-0 flex justify-center px-6" style={{ bottom: mobile ? 'max(20px, env(safe-area-inset-bottom))' : 28 }}>
            <Hint p={p} t={t} pager={pager} mobile={mobile} />
          </div>
        </div>

        {/* ───── 第二屏：已读排行 · 第三屏：口味 ───── */}
        {current && taste && (
          <>
            <div data-stats-screen="1" className="absolute inset-0" inert={screen !== 1} aria-hidden={screen !== 1}>
              {stageBox(
                <>
                  {glows(stageL + stage * (mobile ? 0.4 : 0.25), midY, tone, `${seg01('0.4', '0.9')} * (1 - ${seg01('1.1', '1.6')})`)}
                  <MemoRankScreen ranked={ranked} group={rankGroup} pager={pager} L={rankL} moved={moved} />
                </>,
              )}
            </div>
            <div data-stats-screen="2" className="absolute inset-0" inert={screen !== 2} aria-hidden={screen !== 2}>
              {stageBox(
                <>
                  {glows(stageL + stage * 0.3, midY, p.glow[1], `${seg01('1.3', '1.8')} * .7`)}
                  <MemoTasteScreen taste={taste} coverOf={p.coverOf} pager={pager} L={tasteL} />
                </>,
              )}
            </div>
            <ScreenDots screen={screen} pager={pager} mobile={mobile} style={upStyle(t, 0.7)} />
          </>
        )}

        {/* ───── 顶栏：三屏共用，不跟着穿过表盘 ───── */}
        {mobile ? (
          <header className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-5 pt-[max(12px,env(safe-area-inset-top))]">
            <Glass as="button" type="button" onClick={p.onExit} aria-label="返回画廊首页" className="gicon size-11 rounded-full text-text">
              <ChevronLeft className="size-[22px]" strokeWidth={1.8} />
            </Glass>
            <div className="flex flex-col items-center">
              <h1 className="m-0 font-cjk text-[17px] font-black">阅读档案</h1>
              <span className="text-[11px] text-muted">截至 {dateLabel(p.now)}</span>
            </div>
            <span className="size-11" />
          </header>
        ) : (
          <header className={cn('absolute z-10 flex items-center gap-4', BACK_SLOT)}>
            <GalleryBack onClick={p.onExit} title="返回画廊首页（Esc）" />
            <div className="flex flex-col gap-0.5">
              <h1 className="m-0 font-cjk text-xl font-black">阅读档案</h1>
              <span className="text-[13px] text-muted">书库画廊 · 截至 {dateLabel(p.now)} · 时间按每话最后一次阅读算</span>
            </div>
          </header>
        )}
      </div>
    </div>
    </MovingGlassBackdrop>
  )
}
