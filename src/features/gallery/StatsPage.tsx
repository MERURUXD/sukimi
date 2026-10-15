import { ChevronDown, ChevronLeft } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from 'react'
import { useLocation, useNavigate, useNavigationType } from 'react-router'
import { Glass } from '@/components/glass/Glass'
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
import { CoverFlow, FlowInfo, TastePanel, flowLayout, type Ranked } from './StatsFlow'
import { createPager, ease, easeOut, seg, type Pager } from './statsPager'
import { tasteOf, type Taste } from './taste'
import { useReadChapters } from './useReadChapters'
import './gallery.css'

/** 排行最多显示这么多部 */
const TOP = 40

/**
 * 本页在这次会话里的记忆：进场播完过、停在第几屏、封面翻到第几部。
 * 从作品详情返回时直接显示原来的画面（阅读记录也有缓存），不再从头进场
 */
const memory = { shown: false, p: 0, cur: 0 }

/**
 * 进场进度 0→1：刻度生长、年轮与四项数字依次出现都按它走。减少动态效果或返回时直接到 1。
 * leave 把进度快速倒放回 0 作为出场，放完再换页。
 */
function useIntroProgress(ready: boolean, reduced: boolean, skip: boolean, dur = 2400) {
  const [t, setT] = useState(reduced || skip ? 1 : 0)
  const tRef = useRef(t)
  tRef.current = t
  const raf = useRef(0)
  const [out, setOut] = useState(false)
  useEffect(() => {
    if (!ready || tRef.current >= 1) {
      if (ready) memory.shown = true
      return
    }
    if (reduced) {
      setT(1)
      return
    }
    let start = 0
    let alive = true
    const step = (now: number) => {
      start ||= now
      const k = clamp01((now - start) / dur)
      setT(k)
      if (k < 1) raf.current = requestAnimationFrame(step)
      else memory.shown = true
    }
    // 从首页飞数字进来时，等数字落地再开始：进场每帧都要重画整页，和飞行抢主线程，数字会一顿一顿的
    void afterViewTransition().then(() => {
      if (alive) raf.current = requestAnimationFrame(step)
    })
    return () => {
      alive = false
      cancelAnimationFrame(raf.current)
    }
  }, [ready, reduced, dur])

  const leave = useCallback(
    (done: () => void) => {
      cancelAnimationFrame(raf.current)
      setOut(true)
      let fired = false
      const finish = () => {
        if (fired) return
        fired = true
        done()
      }
      if (reduced) return finish()
      const from = tRef.current
      const start = performance.now()
      const D = 420
      const step = (now: number) => {
        const k = clamp01((now - start) / D)
        setT(from * (1 - k * k))
        if (k < 1) raf.current = requestAnimationFrame(step)
        else finish()
      }
      raf.current = requestAnimationFrame(step)
      // 标签页在后台时动画帧会停，到时间照样换页
      window.setTimeout(finish, D + 300)
    },
    [reduced],
  )
  return { t, leave, out }
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

const dateLabel = (t: number) => {
  const d = new Date(t)
  return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日`
}

/**
 * 阅读档案，分两屏：第一屏「读了多少、什么时候读」——24 小时时钟外套近半年年轮，正中是已读话数，两侧四项数字；
 * 第二屏「读了什么」——已读排行的 3D 封面翻页和口味。往下滚（手机上滑）时镜头穿过表盘，封面从深处飞出来。
 * 固定深色。从画廊首页点「已读话数」进来时，那个数字由换页动画飞成这里的大数字；返回时再飞回去（见 readMorph）。
 */
export function StatsPage() {
  useForceDark()
  const { all, totals, stats: lib, loading: libLoading, error: libError, countsError, refetch, refetchCounts } = useGalleryLibrary()
  const reads = useReadChapters()
  const mobile = useMobile()
  const reduced = useReducedMotionPref()
  const location = useLocation()
  const navigate = useNavigate()
  const navType = useNavigationType()
  const [now] = useState(() => Date.now())
  // 从作品详情返回（阅读记录在缓存里）：不重播进场，停在原来那一屏、那一部
  const [back] = useState(() => navType === 'POP' && memory.shown && reads.chapters != null)

  const stats = useMemo(
    () => (reads.chapters && totals ? summarize(reads.chapters, all.map((m) => ({ id: m.id, total: totals.get(m.id) ?? 0 })), now) : null),
    [reads.chapters, totals, all, now],
  )
  const { ranked, taste } = useMemo(() => {
    if (!stats) return { ranked: [] as Ranked[], taste: null }
    const byId = new Map(all.map((m) => [m.id, m]))
    const read = stats.ranking.filter((r) => r.read > 0 && byId.has(r.id))
    return {
      ranked: read.slice(0, TOP).map((r, i) => ({ manga: byId.get(r.id)!, rank: i + 1, read: r.read, total: r.total })),
      // 口味按全部读过的作品算，不只排行里的前几十部
      taste: tasteOf(read.map((r) => ({ read: r.read, genre: byId.get(r.id)!.genre, author: byId.get(r.id)!.author }))),
    }
  }, [stats, all])
  const { t, leave, out } = useIntroProgress(!!stats, reduced, back)
  // 一进来还没有汇总结果：先摆出空时钟（刻度、外圈），加载时扫光、外圈走进度，汇总出来后刻度就地长出来
  const [primed] = useState(() => !stats)
  const landed = useLanded()

  const [pager] = useState(() => createPager({ p: back ? memory.p : 0, cur: back ? memory.cur : 0, count: 0, reduced }))
  useLayoutEffect(() => {
    pager.limit(ranked.length, !!stats && ranked.length > 0)
    // 汇总出来却没有排行（比如唯一读过的作品刚移出书库）：第二屏没东西可放，回到第一屏，不留一片空背景
    if (stats && !ranked.length && pager.p > 0) pager.reset()
  }, [pager, ranked.length, stats])
  useEffect(
    () => () => {
      memory.p = pager.p > 0.5 ? 1 : 0
      memory.cur = Math.max(0, Math.round(pager.cur))
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
   * 离开：第一屏先倒放进场再换页，已读话数飞回首页。第二屏上看不到那个数字，不倒回第一屏，直接淡出换页，免得等太久；
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
        works={all.length}
        t={t}
        reduced={reduced}
        glow={glow}
        loadingText={stats ? null : libLoading ? '正在加载书库…' : loadingText}
        // 离开时交还给进场进度，外圈跟着倒放收起
        load={primed && !out ? { fetched: reads.fetched, landed } : null}
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
  works: number
  t: number
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
function Backdrop({ glow, className, style }: { glow: [Rgb, Rgb]; className?: string; style?: CSSProperties }) {
  return (
    <div aria-hidden className={cn('pointer-events-none overflow-hidden', className)} style={style}>
      <div
        className="gallery-blob-a absolute top-[-16%] left-[36%] aspect-square w-[min(920px,90vw)] rounded-full opacity-85 blur-[30px] max-md:top-[-12%] max-md:left-[-30%] max-md:w-[520px]"
        style={{ background: `radial-gradient(closest-side, ${rgbCss(glow[0], 0.87)} 0%, ${rgbCss(glow[0], 0.33)} 45%, transparent 100%)` }}
      />
      <div
        className="gallery-blob-b absolute top-[36%] left-[66%] aspect-square w-[min(760px,70vw)] rounded-full opacity-70 blur-[30px] max-md:top-[26%] max-md:left-[30%] max-md:w-[460px]"
        style={{ background: `radial-gradient(closest-side, ${rgbCss(glow[1], 0.8)} 0%, ${rgbCss(glow[1], 0.27)} 50%, transparent 100%)` }}
      />
      <div className="gallery-blob-b absolute top-[30%] left-[-12%] aspect-square w-[720px] rounded-full bg-[radial-gradient(closest-side,rgba(255,255,255,.09),transparent)]" />
      <svg className="absolute inset-0 size-full opacity-20 mix-blend-overlay">
        <filter id="gallery-grain">
          <feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#gallery-grain)" />
      </svg>
    </div>
  )
}

/** 进场时一段段淡入上移；出场倒放时按同样的顺序收起 */
const upStyle = (t: number, at: number): CSSProperties => {
  const e = easeOut((t - at) / 0.45)
  return { opacity: e, translate: `0 ${((1 - e) * 18).toFixed(1)}px` }
}

/**
 * 两屏的手势：滚轮 / 方向键 / 竖向拖动切换两屏，第二屏上横向拖动、横向滚动、左右键翻封面。
 * 拖动按最先移动的方向分横竖；拖过就吞掉随后的点击，免得松手时点进了作品
 */
function usePagerInput(root: RefObject<HTMLDivElement | null>, pager: Pager, gap: number) {
  const moved = useRef(false)
  useEffect(() => {
    const el = root.current
    if (!el) return
    let acc = 0
    let accT = 0
    let snapT = 0
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) return
      e.preventDefault()
      const dx = e.deltaX
      const dy = e.deltaY * (e.deltaMode === 1 ? 40 : 1)
      if (pager.p > 0.98 && Math.abs(dx) > Math.abs(dy)) {
        pager.setCur(pager.cur + dx / 160)
        window.clearTimeout(snapT)
        snapT = window.setTimeout(() => pager.flip(pager.cur), 120)
        return
      }
      // 斜着划的触控板手势不算竖向，免得翻封面时一不小心退回第一屏
      if (Math.abs(dy) < Math.abs(dx) * 1.2 || pager.busy) return
      acc += dy
      window.clearTimeout(accT)
      accT = window.setTimeout(() => (acc = 0), 180)
      if (acc > 40 && pager.p < 0.5) pager.go(1)
      else if (acc < -40 && pager.p > 0.5) pager.go(0)
      else return
      acc = 0
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || (e.target as HTMLElement).closest?.('input, textarea, [contenteditable]')) return
      const k = e.key
      if ((k === 'ArrowDown' || k === 'PageDown' || (k === ' ' && !(e.target as HTMLElement).closest?.('button, a'))) && pager.p < 0.5 && pager.enabled) pager.go(1)
      else if ((k === 'ArrowUp' || k === 'PageUp') && pager.p > 0.5) pager.go(0)
      else if ((k === 'ArrowLeft' || k === 'ArrowRight') && pager.p > 0.98) pager.flip(pager.goal + (k === 'ArrowLeft' ? -1 : 1))
      else return
      e.preventDefault()
    }
    let ptr: { id: number; x: number; y: number; cur: number; axis: 'x' | 'y' | null; lastX: number; lastT: number; v: number } | null = null
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return
      moved.current = false
      ptr = { id: e.pointerId, x: e.clientX, y: e.clientY, cur: pager.cur, axis: null, lastX: e.clientX, lastT: performance.now(), v: 0 }
    }
    const onMove = (e: PointerEvent) => {
      if (!ptr || e.pointerId !== ptr.id) return
      const dx = e.clientX - ptr.x
      const dy = e.clientY - ptr.y
      if (!ptr.axis) {
        if (Math.hypot(dx, dy) < 8) return
        ptr.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
        moved.current = true
        el.setPointerCapture(e.pointerId)
      }
      if (ptr.axis === 'x' && pager.p > 0.98) {
        const now = performance.now()
        ptr.v = (e.clientX - ptr.lastX) / Math.max(1, now - ptr.lastT)
        ptr.lastX = e.clientX
        ptr.lastT = now
        pager.setCur(ptr.cur - dx / gap)
      }
    }
    const onUp = (e: PointerEvent) => {
      if (!ptr || e.pointerId !== ptr.id) return
      const dy = e.clientY - ptr.y
      // 松手时的速度决定多滑几张
      if (ptr.axis === 'x' && pager.p > 0.98) pager.flip(pager.cur - (ptr.v * 180) / gap)
      else if (ptr.axis === 'y') {
        if (dy < -40 && pager.p < 0.5) pager.go(1)
        else if (dy > 40 && pager.p > 0.5) pager.go(0)
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
      window.clearTimeout(snapT)
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onUp)
      el.removeEventListener('click', onClick, true)
      window.removeEventListener('keydown', onKey)
    }
  }, [root, pager, gap])
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
        caption: '至少翻过 · 近半年累计',
        bars: growth.map((v, i) => ({ v: v - base, on: true, lit: i === growth.length - 1 })),
        label: `至少翻过 ${count(s.pages)} 页`,
      },
    ],
  }
}

type Kpi = ReturnType<typeof kpiItems>['progress'][number]

function KpiBlock({ k, t, at, right, size, strip }: { k: Kpi; t: number; at: number; right?: boolean; size: number; strip: { w: number; h: number } }) {
  const e = easeOut((t - at) / 0.6)
  return (
    <div className={cn('flex flex-col', right ? 'items-end text-right' : 'items-start')} style={upStyle(t, at)}>
      <span aria-hidden className="flex items-baseline gap-1 leading-[.95] whitespace-nowrap">
        <span className="font-bold tracking-[-0.045em] num" style={{ fontSize: size }}>
          {k.value(e)}
        </span>
        <span className="font-cjk font-bold text-muted" style={{ fontSize: Math.round(size * 0.36) }}>
          {k.unit}
        </span>
      </span>
      <span className="mt-2 text-xs font-semibold whitespace-nowrap text-muted md:text-[13px]">{k.caption}</span>
      <span className={size > 40 ? 'mt-4' : 'mt-3'}>
        <Strip bars={k.bars} width={strip.w} height={strip.h} right={right} t={t} at={at + 0.1} label={k.label} />
      </span>
    </div>
  )
}

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

/** 一段进度写成 CSS（--p 每帧由页面写入） */
const seg01 = (a: string, b: string) => `clamp(0, calc((var(--p) - ${a}) / (${b} - ${a})), 1)`

function Stats(p: BodyProps) {
  const { mobile, stats, read, ranked, taste, works, t, reduced, pager } = p
  const win = useWindowSize()
  // 太矮的窗口（手机横屏、小屏手机）按最小高度排版再整体缩小：两屏都固定在一屏里，滚轮和上下滑留给切屏，不能改成滚动
  const k = Math.min(1, win.h / (mobile ? MIN_H_PHONE : MIN_H))
  const w = win.w / k
  const h = win.h / k
  const root = useRef<HTMLDivElement>(null)
  const zoom = useRef<HTMLDivElement>(null)
  const num = useRef<HTMLDivElement>(null)
  const tilt = useRef<HTMLDivElement>(null)
  const [tip, setTip] = useState<Tip>(null)
  const [screen, setScreen] = useState(pager.p > 0.5 ? 1 : 0)
  const [at, setIdx] = useState(() => Math.round(pager.cur))
  // 排行变短时（比如刚汇总完）不越界
  const idx = Math.min(at, Math.max(0, ranked.length - 1))

  /* ── 尺寸 ── */
  const side = mobile ? 24 : Math.round(Math.max(32, Math.min(64, w * 0.044)))
  const top = mobile ? 64 : 88
  const kpiW = w >= 1200 ? 196 : 168
  // 表盘（连年轮和外面的字）的边长；时钟本身按 360 / DIAL_UNITS 缩
  const dial = mobile ? Math.round(Math.max(260, Math.min(w - 16, h * 0.47))) : Math.round(Math.max(300, Math.min(h - top - 92, w - side * 2 - kpiW * 2 - 96, 700)))
  const clock = Math.round((dial * 360) / DIAL_UNITS)
  const text = read == null ? '—' : count(read)
  const numSize = Math.round(Math.max(36, Math.min(mobile ? 64 : 112, (clock * 0.6 - 36) / ([...text].length * 0.56))))
  const tasteW = Math.round(Math.max(260, Math.min(330, w * 0.22)))
  const flowW = mobile ? w : w - side * 2 - tasteW - 48
  const cw = Math.round(mobile ? Math.max(120, Math.min(160, h * 0.2, w * 0.4)) : Math.max(150, Math.min(240, (h - top - 230) / 1.5, flowW / 2.9)))
  const L = useMemo(() => flowLayout(cw, mobile), [cw, mobile])
  const flowH = L.ch + (mobile ? 40 : 60)

  const run = useMemo(() => (stats ? bestRun(stats.days) : null), [stats])
  const year = useMemo<YearRing | null>(() => (stats ? { days: stats.days, run, weekly: mobile } : null), [stats, run, mobile])
  const kpis = useMemo(() => (stats ? kpiItems(stats, works, run) : null), [stats, works, run])
  const peak = stats && stats.peak >= 0 ? stats.peak : -1

  useDialTilt(tilt, reduced || mobile, pager)
  const moved = usePagerInput(root, pager, L.gap1 * k)

  /* ── 每帧：穿过表盘、写 --p 给 CSS、记下停在哪一屏和哪一部 ── */
  useLayoutEffect(() => {
    const paint = () => {
      const pp = pager.p
      const ud = ease(seg(pp, 0.04, 0.56))
      const s = root.current?.style
      s?.setProperty('--p', pp.toFixed(4))
      s?.setProperty('--ek', ease(seg(pp, 0, 0.3)).toFixed(4))
      if (zoom.current) {
        zoom.current.style.transform = ud ? `scale(${(1 + ud * 1.9).toFixed(4)})` : ''
        zoom.current.style.opacity = `${1 - seg(pp, 0.14, 0.56)}`
        // 倾斜收平以后才模糊：模糊会把表盘压成一张平面
        zoom.current.style.filter = pp > 0.15 ? `blur(${(ud * 6).toFixed(2)}px)` : ''
      }
      if (num.current) {
        num.current.style.transform = ud ? `scale(${(1 + ud * 1.4).toFixed(4)})` : ''
        num.current.style.opacity = `${1 - seg(pp, 0.06, 0.44)}`
        num.current.style.filter = pp > 0.04 ? `blur(${(ud * 4).toFixed(2)}px)` : ''
      }
      setScreen(pp > 0.5 ? 1 : 0)
      setIdx(Math.max(0, Math.round(pager.cur)))
    }
    paint()
    return pager.subscribe(paint)
  }, [pager])

  // 正中那部的封面主色：背景光和地面光跟着换；翻页途中不取，停下再取
  const [tone, setTone] = useState<Rgb>(NEUTRAL)
  const current = ranked[idx]
  const toneSrc = current?.manga.thumbnailUrl
  useEffect(() => {
    let alive = true
    const id = window.setTimeout(() => void coverColor(toneSrc).then((c) => alive && setTone(c)), 140)
    return () => {
      alive = false
      window.clearTimeout(id)
    }
  }, [toneSrc])

  const kpiDrift = (dir: -1 | 1): CSSProperties =>
    mobile ? { opacity: 'calc(1 - var(--ek))', translate: '0 calc(var(--ek) * 30px)' } : { opacity: 'calc(1 - var(--ek))', translate: `calc(var(--ek) * ${dir * 60}px) 0` }
  const stripSize = mobile ? { w: Math.floor((w - side * 2 - 24) / 2), h: 18 } : { w: kpiW, h: 22 }
  const group = (title: string, items: Kpi[], right: boolean, at: number) => (
    <section aria-label={title} className={cn('flex flex-col gap-10', right && 'items-end')} style={kpiDrift(right ? 1 : -1)}>
      <h2 className="m-0 text-xs font-bold tracking-[.32em] text-muted" style={upStyle(t, at - 0.04)}>
        {title}
      </h2>
      {items.map((k, i) => (
        <KpiBlock key={k.key} k={k} t={t} at={at + i * 0.06} right={right} size={52} strip={stripSize} />
      ))}
    </section>
  )

  const dialEl = (
    <div className="relative flex-none" style={{ width: dial, height: dial }}>
      <div ref={zoom} className="absolute inset-0">
        <div className="absolute" style={{ left: (dial - clock) / 2, top: (dial - clock) / 2, width: clock, height: clock, perspective: 900 }}>
          <div ref={tilt} className="absolute inset-0 [transform-style:preserve-3d]">
            <Clock stats={stats} t={t} size={clock} tip={tip} onTip={setTip} load={p.load} read={read} failed={!!p.error} reduced={reduced} year={year} className="absolute inset-0" />
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
        <span className="mt-1 font-cjk text-xs font-bold text-white/70 md:text-sm" style={{ opacity: peak >= 0 ? easeOut((t - 0.5) / 0.4) : 0 }}>
          {peak >= 0 ? `${peak} 点读得最多${peak >= 22 || peak <= 3 ? ' · 是个夜猫子' : ''}` : ' '}
        </span>
      </div>
    </div>
  )

  const flowBox = current && (
    <div className="relative w-full flex-none" style={{ height: flowH }}>
      {/* 名次大字垫在封面后面；手机上露出的部分太少，看着像一团色块，不放 */}
      {!mobile && (
        <span
          aria-hidden
          className="pointer-events-none absolute left-1/2 -translate-x-1/2 font-bold tracking-[-0.06em] text-white/[.055] num"
          style={{ top: flowH / 2 - L.ch * 0.62, fontSize: L.ch * 0.83, lineHeight: 1, opacity: seg01('0.6', '0.9') }}
        >
          {String(current.rank).padStart(2, '0')}
        </span>
      )}
      {/* 地面上铺一片这部封面颜色的光 */}
      <span
        aria-hidden
        className="pointer-events-none absolute rounded-[50%] transition-[background] duration-700"
        style={{
          left: flowW / 2 - L.cw * 1.6,
          top: flowH / 2 + L.ch / 2 - L.cw * 0.14,
          width: L.cw * 3.2,
          height: L.cw * 0.5,
          background: `radial-gradient(closest-side, ${rgbCss(tone, 0.5)}, ${rgbCss(tone, 0.12)} 60%, transparent)`,
          opacity: seg01('0.55', '0.95'),
        }}
      />
      <CoverFlow ranked={ranked} idx={idx} pager={pager} L={L} width={flowW} cy={flowH / 2} moved={moved} />
    </div>
  )

  const info = current && <FlowInfo it={current} tone={tone} phone={mobile} onStep={mobile ? undefined : (d) => pager.flip(pager.goal + d)} first={idx === 0} last={idx === ranked.length - 1} />
  const rankLabel = (
    <span className="text-xs font-bold tracking-[.32em] text-muted" style={{ opacity: seg01('0.6', '0.85') }}>
      已读排行 · 前 {ranked.length} 部
    </span>
  )
  // 正中封面背后的两团光，颜色跟着正中那部
  const glows = (cx: number, cy: number) => (
    <>
      <div aria-hidden className="pointer-events-none absolute rounded-full blur-[110px] transition-[background-color] duration-700" style={{ left: cx - 380, top: cy - 300, width: 760, height: 600, backgroundColor: rgbCss(tone), opacity: `calc(${seg01('0.4', '0.9')} * .55)` }} />
      <div aria-hidden className="pointer-events-none absolute rounded-full mix-blend-screen blur-[110px] transition-[background-color] duration-700" style={{ left: cx - 360, top: cy - 280, width: 720, height: 560, backgroundColor: rgbCss(tone), opacity: `calc(${seg01('0.5', '0.95')} * .25)` }} />
    </>
  )

  return (
    <div ref={root} className="fixed inset-0 touch-none overflow-hidden select-none" style={{ '--p': pager.p, '--ek': 0 } as CSSProperties}>
      <div className="absolute top-0 left-0 origin-top-left" style={{ width: w, height: h, transform: k < 1 ? `scale(${k})` : undefined }}>
        <Backdrop glow={p.glow} className="absolute inset-0" style={{ opacity: `calc(1 - ${seg01('0.3', '0.8')} * .6)` }} />

        {/* ───── 第一屏 ───── */}
        <div className="absolute inset-0" inert={screen === 1}>
          {mobile ? (
            <div className="absolute inset-x-0 flex flex-col items-center" style={{ top: top + 8 }}>
              {dialEl}
              {kpis && (
                <div className="mt-4 grid w-full grid-cols-2 gap-x-6 gap-y-6" style={{ paddingInline: side, ...kpiDrift(1) }}>
                  {[...kpis.progress, ...kpis.rhythm].map((k, i) => (
                    <KpiBlock key={k.key} k={k} t={t} at={0.38 + i * 0.05} size={36} strip={stripSize} />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="absolute grid items-center" style={{ left: side, right: side, top, bottom: 92, gridTemplateColumns: `${kpiW}px minmax(0,1fr) ${kpiW}px` }}>
              <div>{kpis && group('进度', kpis.progress, false, 0.38)}</div>
              <div className="flex justify-center">{dialEl}</div>
              <div className="flex justify-end">{kpis && group('节奏', kpis.rhythm, true, 0.46)}</div>
            </div>
          )}
          <div className="absolute inset-x-0 flex justify-center px-6" style={{ bottom: mobile ? 'max(20px, env(safe-area-inset-bottom))' : 28 }}>
            <Hint p={p} t={t} pager={pager} mobile={mobile} />
          </div>
        </div>

        {/* ───── 第二屏 ───── */}
        {current && taste && (
          <div className="absolute inset-0" inert={screen === 0} aria-hidden={screen === 0}>
            {mobile ? (
              <>
                {glows(w / 2, top + 30 + flowH / 2)}
                <div className="absolute inset-x-0 flex flex-col" style={{ top: top + 4, bottom: 0 }}>
                  <div style={{ paddingInline: side }}>{rankLabel}</div>
                  {flowBox}
                  <div className="px-6">{info}</div>
                  <div className="mt-6" style={{ paddingInline: side }}>
                    <TastePanel taste={taste} it={current} tone={tone} phone />
                  </div>
                </div>
              </>
            ) : (
              <>
                {glows(side + flowW / 2, top + (h - top - 40) / 2 - 60)}
                <div className="absolute grid" style={{ left: side, right: side, top, bottom: 40, gridTemplateColumns: `${flowW}px ${tasteW}px`, columnGap: 48 }}>
                  <section aria-label="已读排行" className="relative flex min-w-0 flex-col justify-center">
                    <div className="absolute top-0 left-0">{rankLabel}</div>
                    {flowBox}
                    {info}
                  </section>
                  <div className="flex items-center">
                    <TastePanel taste={taste} it={current} tone={tone} phone={false} />
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ───── 顶栏：两屏共用，不跟着穿过表盘 ───── */}
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
  )
}
