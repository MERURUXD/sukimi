import { useDrag } from '@use-gesture/react'
import { ArrowRight, ChevronLeft, Crown, Sparkles } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react'
import { Link, useLocation, useNavigate, useNavigationType } from 'react-router'
import { Glass } from '@/components/glass/Glass'
import { BACK_SLOT, GalleryBack } from './GalleryBack'
import { CoverImg } from '@/components/manga/CoverImg'
import type { LibraryManga } from '@/features/library/queries'
import { NEUTRAL, coverColor, rgbCss } from '@/lib/coverColor'
import { count } from '@/lib/format'
import { cn } from '@/lib/cn'
import { PAGE_PATH_ATTR } from '@/lib/coverTransition'
import type { Rgb } from '@/lib/palette'
import { useForceDark } from '@/design/settings'
import { clamp01 } from './canvasMath'
import { GALLERY } from './GalleryHero'
import { useGalleryLibrary, useMobile, useReducedMotionPref } from './hooks'
import { afterViewTransition, armReadMorph } from './readMorph'
import { heatLevel, summarize, type ReadingStats } from './stats'
import { useReadChapters } from './useReadChapters'
import './gallery.css'

/** 排行最多显示这么多部 */
const TOP = 40
const easeOut = (x: number) => 1 - (1 - clamp01(x)) ** 3

interface Ranked {
  manga: LibraryManga
  rank: number
  read: number
  total: number | null
}

type Tip = { kind: 'hour'; h: number } | { kind: 'day'; i: number } | null

/**
 * 本页在这次会话里的记忆：进场播完过、排行墙停在哪。
 * 从作品详情返回时直接显示最终画面（阅读记录也有缓存），不再从头进场，排行墙停在原来那一列。
 */
const memory = { shown: false, s: 0 }

/**
 * 进场进度 0→1：刻度生长、排行墙飞入、时间线亮起都按它走。减少动态效果或返回时直接到 1。
 * leave 把进度快速倒放回 0 作为出场，放完再换页。
 */
function useIntroProgress(ready: boolean, reduced: boolean, skip: boolean, dur = 2400) {
  const [t, setT] = useState(reduced || skip ? 1 : 0)
  const tRef = useRef(t)
  tRef.current = t
  const raf = useRef(0)
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
  return { t, leave }
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

const dateLabel = (t: number) => {
  const d = new Date(t)
  return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日`
}

/**
 * 阅读档案：已读话数、阅读时钟、小结、近半年时间线和已读排行。固定深色；桌面一屏，手机为长页。
 * 从画廊首页点「已读话数」进来时，那个数字由换页动画飞成这里的大数字；返回时再飞回去（见 readMorph）。
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
  // 从作品详情返回（阅读记录在缓存里）：不重播进场，排行墙停在原来那一列
  const [back] = useState(() => navType === 'POP' && memory.shown && reads.chapters != null)

  const stats = useMemo(
    () => (reads.chapters && totals ? summarize(reads.chapters, all.map((m) => ({ id: m.id, total: totals.get(m.id) ?? 0 })), now) : null),
    [reads.chapters, totals, all, now],
  )
  const ranked = useMemo<Ranked[]>(() => {
    if (!stats) return []
    const byId = new Map(all.map((m) => [m.id, m]))
    return stats.ranking
      .filter((r) => r.read > 0 && byId.has(r.id))
      .slice(0, TOP)
      .map((r, i) => ({ manga: byId.get(r.id)!, rank: i + 1, read: r.read, total: r.total }))
  }, [stats, all])
  const { t, leave } = useIntroProgress(!!stats, reduced, back)

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

  /* 离开：先倒放进场，再换页，已读话数飞回首页。浏览器后退时来不及倒放，数字照样飞回去 */
  const leaving = useRef(false)
  const exit = useCallback(() => {
    if (leaving.current) return
    leaving.current = true
    leave(() => {
      armReadMorph()
      const fromGallery = (location.state as { from?: string } | null)?.from === 'gallery'
      if (fromGallery && (window.history.state?.idx ?? 0) > 0) navigate(-1)
      else navigate(GALLERY, { viewTransition: true })
    })
  }, [leave, location.state, navigate])
  useEffect(() => {
    const onPop = () => armReadMorph()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.ctrlKey && !e.metaKey && !e.altKey) exit()
    }
    window.addEventListener('popstate', onPop)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('popstate', onPop)
      window.removeEventListener('keydown', onKey)
    }
  }, [exit])

  // 章节、书库、总话数任何一个失败都要给出错误和重试，否则会一直停在「正在汇总」
  const error = reads.error ?? libError ?? countsError
  const retry = useCallback(() => {
    if (reads.error) reads.retry()
    if (libError) void refetch()
    if (countsError) void refetchCounts()
  }, [reads, libError, countsError, refetch, refetchCounts])
  const loadingText = error ? null : `正在汇总阅读记录…${reads.fetched ? `已取 ${count(reads.fetched)} 话` : ''}`
  const body: BodyProps = {
    stats,
    // 汇总出来之前先用书库里的「总话数 − 未读」，和首页那个数字一样，飞过来落地时不跳
    read: stats?.read ?? lib.read,
    ranked,
    works: all.length,
    t,
    reduced,
    glow,
    loadingText: stats ? null : libLoading ? '正在加载书库…' : loadingText,
    error,
    retry,
    now,
    back,
    onExit: exit,
  }

  return (
    <div data-theme="dark" {...{ [PAGE_PATH_ATTR]: location.pathname }} className="relative min-h-dvh bg-bg text-text">
      {mobile ? <MobileStats {...body} /> : <DesktopStats {...body} />}
    </div>
  )
}

interface BodyProps {
  stats: ReadingStats | null
  read: number | null
  ranked: Ranked[]
  works: number
  t: number
  reduced: boolean
  glow: [Rgb, Rgb]
  loadingText: string | null
  error: unknown
  retry: () => void
  now: number
  /** 从作品详情返回：排行墙恢复到原来的位置 */
  back: boolean
  onExit: () => void
}

/* ───────── 背景与噪点 ───────── */
function Backdrop({ glow, className }: { glow: [Rgb, Rgb]; className?: string }) {
  return (
    <div aria-hidden className={cn('pointer-events-none overflow-hidden', className)}>
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

/* ───────── 桌面：左边大数字（背后是阅读时钟）、右边排行墙、底部近半年时间线；不再有框住的面板 ───────── */
function DesktopStats(p: BodyProps) {
  const { w, h } = useWindowSize()
  const side = Math.round(Math.max(32, Math.min(64, w * 0.04)))
  const top = 92
  const lineH = 104
  const lineTop = h - 24 - lineH
  const heroW = Math.round(Math.max(320, Math.min(540, w * 0.34)))

  return (
    <div className="fixed inset-0 overflow-hidden select-none">
      <Backdrop glow={p.glow} className="absolute inset-0" />
      <RankWall
        ranked={p.ranked}
        works={p.works}
        t={p.t}
        width={w}
        bottom={lineTop - 10}
        left={side + heroW + 24}
        reduced={p.reduced}
        restore={p.back}
        empty={!!p.stats && !p.ranked.length}
      />

      <header className={cn('absolute z-10 flex items-center gap-4', BACK_SLOT)}>
        <GalleryBack onClick={p.onExit} title="返回画廊首页（Esc）" />
        <div className="flex flex-col gap-0.5">
          <h1 className="m-0 font-cjk text-xl font-black">阅读档案</h1>
          <span className="text-[13px] text-muted">书库画廊 · 截至 {dateLabel(p.now)}</span>
        </div>
      </header>

      <ReadHero {...p} left={side} top={top} width={heroW} height={lineTop - 20 - top} />
      {p.stats && <Timeline stats={p.stats} t={p.t} left={side} top={lineTop} width={w - side * 2} />}
    </div>
  )
}

/**
 * 时钟下面小结和三项数据占的高度。加载中和加载完都占这么高：整块是垂直居中的，
 * 下面变高的话中间的数字会跟着上移，第一次打开时从首页飞过来的数字落地后就会再挪一下
 */
const LOWER_H = 168

/** 左边的主角：一圈阅读时钟，正中是已读话数（从首页飞过来的那个数字）；下面是小结和三项数据 */
function ReadHero({ stats, read, ranked, works, t, reduced, loadingText, error, retry, left, top, width, height }: BodyProps & { left: number; top: number; width: number; height: number }) {
  const [tip, setTip] = useState<Tip>(null)
  const text = read == null ? '—' : count(read)
  // 时钟占住左上，下面留给小结和三项数据；数字按位数缩放，放得进时钟的内圈
  const ring = Math.round(Math.max(220, Math.min(width, height - LOWER_H - 42, 520)))
  const size = Math.round(Math.max(36, Math.min(150, (ring * 0.6 - 36) / ([...text].length * 0.56))))
  const peak = stats && stats.peak >= 0 ? stats.peak : -1
  return (
    <section aria-label="阅读概览" className="absolute z-10 flex flex-col justify-center gap-6" style={{ left, top, width, height }}>
      <div className="relative flex-none" style={{ width: ring, height: ring }}>
        {stats && <Clock stats={stats} t={t} size={ring} tip={tip} onTip={setTip} faint className="absolute inset-0" />}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1.5">
          <span className="text-[13px] font-semibold tracking-[.32em] text-muted">已读章节</span>
          <span className="flex items-baseline gap-1.5">
            {/* 数字一开始就是最终值：它是从首页飞过来的，落地时不能变 */}
            <span data-gallery-read className="leading-[.95] font-bold tracking-[-0.045em] num" style={{ fontSize: size }}>
              {text}
            </span>
            <span className="font-cjk text-xl font-bold text-white/75">话</span>
          </span>
          <span className="font-cjk text-sm font-bold text-white/70" style={{ opacity: peak >= 0 ? easeOut((t - 0.5) / 0.4) : 0 }}>
            {peak >= 0 ? `${peak} 点读得最多` : ' '}
          </span>
        </div>
      </div>
      {stats ? (
        <div className="relative flex flex-col gap-6" style={{ height: LOWER_H }}>
          <div style={upStyle(t, 0.3)}>
            <Ticker stats={stats} top={ranked[0]} reduced={reduced} plain />
          </div>
          <div style={upStyle(t, 0.38)}>
            <Kpis stats={stats} works={works} e={easeOut((t - 0.38) / 0.6)} plain />
          </div>
        </div>
      ) : (
        <div className="relative flex flex-col items-start gap-4" style={{ height: LOWER_H }}>
          {error ? (
            <>
              <p className="m-0 text-danger">阅读记录加载失败</p>
              <button type="button" className="solid" onClick={retry}>
                重试
              </button>
            </>
          ) : (
            <p className="m-0 text-muted num">{loadingText}</p>
          )}
        </div>
      )}
    </section>
  )
}

/** 手机上的时钟、三项数据、小结、热力图 */
function Overview({ stats, ranked, works, t, reduced, loadingText, error, retry, clockSize, heatCell }: BodyProps & { clockSize: number; heatCell: number }) {
  const [tip, setTip] = useState<Tip>(null)
  if (!stats) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        {error ? (
          <>
            <p className="m-0 text-danger">阅读记录加载失败</p>
            <button type="button" className="solid" onClick={retry}>
              重试
            </button>
          </>
        ) : (
          <p className="m-0 text-muted num">{loadingText}</p>
        )}
      </div>
    )
  }
  const e1 = easeOut(t / 0.7)
  return (
    <>
      <Clock
        stats={stats}
        t={t}
        size={clockSize}
        tip={tip}
        onTip={setTip}
        center={
          stats.peak >= 0 ? (
            <>
              <span className="text-xs font-semibold tracking-[.3em] text-muted">高峰</span>
              <span className="text-[44px] leading-[1.08] font-bold tracking-[-0.04em] num">{stats.peak}</span>
              <span className="font-cjk text-sm font-bold text-white/80">点读得最多</span>
            </>
          ) : (
            <span className="text-sm text-muted">还没有阅读时间</span>
          )
        }
      />
      <Kpis stats={stats} works={works} e={e1} />
      <Ticker stats={stats} top={ranked[0]} reduced={reduced} />
      <Heatmap stats={stats} t={t} cell={heatCell} tip={tip} onTip={setTip} />
    </>
  )
}

/* ───────── 24 小时时钟 ───────── */
function Clock({
  stats,
  t,
  size,
  tip,
  onTip,
  center,
  faint,
  className,
}: {
  stats: ReadingStats
  t: number
  size: number
  tip: Tip
  onTip: (t: Tip) => void
  center?: ReactNode
  /** 桌面上垫在大数字背后：刻度更淡，只有读得最多的那一格亮 */
  faint?: boolean
  className?: string
}) {
  const k = size / 360
  const c = size / 2
  const max = Math.max(1, ...stats.hours)
  const timed = stats.hours.reduce((a, b) => a + b, 0)
  const now = new Date()
  const nowDeg = (now.getHours() + now.getMinutes() / 60) * 15
  const radius = 112 * k
  const hourTip = tip?.kind === 'hour' ? tip.h : -1
  const barLen = (n: number) => (6 + (n / max) * 44) * k
  const ringIn = easeOut((t - 0.05) / 0.5)
  return (
    <div
      role="img"
      aria-label={`24 小时阅读时钟：有阅读时间的 ${timed} 话${stats.peak >= 0 ? `，${stats.peak} 点读得最多` : ''}`}
      className={cn('flex-none', className ?? 'relative')}
      style={{ width: size, height: size }}
      onMouseLeave={() => onTip(null)}
    >
      {!faint && <div aria-hidden className="absolute rounded-full border border-white/12 bg-[radial-gradient(circle,rgba(255,255,255,.07),transparent_70%)]" style={{ inset: 76 * k }} />}
      <div aria-hidden className="absolute rounded-full border border-dashed border-white/10" style={{ inset: 14 * k, opacity: ringIn, rotate: `${(1 - ringIn) * -40}deg` }} />
      {stats.hours.map((n, h) => {
        const grow = easeOut((t - 0.08 - h * 0.022) / 0.4)
        const hot = h === stats.peak
        const on = h === hourTip
        const idle = faint ? (n ? 'rgba(255,255,255,.26)' : 'rgba(255,255,255,.1)') : 'rgba(255,255,255,.38)'
        return (
          <div key={h} className="absolute size-0" style={{ left: c, top: c, transform: `rotate(${h * 15}deg)` }}>
            <span
              className="absolute flex items-end justify-center"
              style={{ left: -11 * k, bottom: radius, width: 22 * k, height: 52 * k }}
              onMouseEnter={() => onTip({ kind: 'hour', h })}
              onClick={() => onTip(on ? null : { kind: 'hour', h })}
            >
              <span
                className="block rounded-full transition-[background-color,box-shadow] duration-200"
                style={{
                  width: 8 * k,
                  height: Math.max(4, barLen(n) * grow),
                  background: hot || on ? '#fff' : idle,
                  boxShadow: hot ? '0 0 14px rgba(255,255,255,.85)' : on ? '0 0 10px rgba(255,255,255,.6)' : undefined,
                }}
              />
            </span>
          </div>
        )
      })}
      {/* 现在几点 */}
      <div aria-hidden className="absolute size-0" style={{ left: c, top: c, transform: `rotate(${nowDeg}deg)`, opacity: ringIn }}>
        <span className="gallery-ping absolute size-3 rounded-full border-[1.5px] border-white" style={{ left: -6, bottom: radius + 54 * k }} />
        <span className="absolute size-2.5 rounded-full bg-white shadow-[0_0_14px_#fff]" style={{ left: -5, bottom: radius + 55 * k }} />
      </div>
      {[
        ['0', { left: c, top: 2, transform: 'translateX(-50%)' }],
        ['6', { right: 0, top: c, transform: 'translateY(-50%)' }],
        ['12', { left: c, bottom: 0, transform: 'translateX(-50%)' }],
        ['18', { left: 0, top: c, transform: 'translateY(-50%)' }],
      ].map(([label, style]) => (
        <span key={label as string} aria-hidden className="absolute text-[11px] text-faint" style={{ ...(style as CSSProperties), opacity: ringIn }}>
          {label as string}
        </span>
      ))}
      {center && (
        <div aria-hidden className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-0.5">
          {center}
        </div>
      )}
      {hourTip >= 0 && (
        <span
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded-[10px] border border-white/22 bg-[rgba(28,28,31,.94)] px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap text-text shadow-[0_8px_20px_rgba(0,0,0,.5)]"
          style={{
            left: c + Math.sin((hourTip * Math.PI) / 12) * (radius + barLen(stats.hours[hourTip]) + 22 * k),
            top: c - Math.cos((hourTip * Math.PI) / 12) * (radius + barLen(stats.hours[hourTip]) + 22 * k),
          }}
        >
          {hourTip} 点 · {stats.hours[hourTip]} 话
        </span>
      )}
    </div>
  )
}

/* ───────── 三项数据 ───────── */
function Kpis({ stats, works, e, plain }: { stats: ReadingStats; works: number; e: number; plain?: boolean }) {
  const pct = stats.total ? (stats.read / stats.total) * 100 : 0
  const past = stats.days.filter((d) => !d.future).length
  const items = [
    { value: `${Math.round(pct * e)}`, unit: '%', label: '书库已读', aria: `${Math.round(pct)}%`, w: pct * e },
    { value: `${Math.round(stats.caughtUp * e)}/${works}`, unit: '部', label: '已追平', aria: `${stats.caughtUp} / ${works} 部`, w: works ? (stats.caughtUp / works) * 100 * e : 0 },
    { value: `${Math.round(stats.activeDays * e)}`, unit: '天', label: '近半年有阅读', aria: `${stats.activeDays} / ${past} 天`, w: past ? (stats.activeDays / past) * 100 * e : 0 },
  ]
  if (plain) {
    // 桌面：只用文字，不加框也不加进度条
    return (
      <dl className="m-0 flex flex-wrap gap-x-12 gap-y-4">
        {items.map((it) => (
          <div key={it.label} className="flex flex-col-reverse gap-1.5">
            <dt className="text-[13px] text-muted">{it.label}</dt>
            <dd aria-label={`${it.label} ${it.aria}`} className="m-0 flex items-baseline gap-1 leading-none">
              <span className="text-[34px] font-bold tracking-[-0.02em] num">{it.value}</span>
              <span className="font-cjk text-sm font-semibold text-white/70">{it.unit}</span>
            </dd>
          </div>
        ))}
      </dl>
    )
  }
  return (
    <div className="grid w-full grid-cols-3 gap-3.5">
      {items.map((it) => (
        <div key={it.label} className="flex min-w-0 flex-col gap-[7px]">
          <span className="flex items-baseline gap-[3px] leading-none">
            <span className="text-2xl font-bold tracking-[-0.02em] num">{it.value}</span>
            <span className="font-cjk text-[13px] font-semibold text-white/70">{it.unit}</span>
          </span>
          <span className="text-xs text-muted">{it.label}</span>
          <span role="img" aria-label={`${it.label} ${it.aria}`} className="block h-1 overflow-hidden rounded-sm bg-white/12">
            <span className="block h-full rounded-sm bg-[#f4f4f5] shadow-[0_0_10px_rgba(255,255,255,.6)]" style={{ width: `${Math.min(100, it.w).toFixed(1)}%` }} />
          </span>
        </div>
      ))}
    </div>
  )
}

/* ───────── 轮播小结 ───────── */
function tickerLines(s: ReadingStats, top: Ranked | undefined) {
  const cut = (text: string, n: number) => ([...text].length > n ? `${[...text].slice(0, n).join('')}…` : text)
  const lines: string[] = []
  if (s.peak >= 0) lines.push(`最常在 ${s.peak} 点翻开漫画${s.peak >= 22 || s.peak <= 3 ? '，是个夜猫子' : ''}`)
  if (s.streak > 1) lines.push(`最长连续读了 ${s.streak} 天，一天都没落下`)
  if (top) lines.push(`《${cut(top.manga.title, 12)}》读了 ${count(top.read)} 话，排第一`)
  if (s.pages > 0) lines.push(`至少翻过 ${count(s.pages)} 页，约 ${count(Math.max(1, Math.round(s.pages / 200)))} 本单行本那么厚`)
  if (s.caughtUp > 0) lines.push(`已经追平 ${s.caughtUp} 部，就等更新了`)
  if (s.total != null && s.total > s.read) lines.push(`书库里还有 ${count(s.total - s.read)} 话没读`)
  if (s.untimed > 0) lines.push(`另有 ${count(s.untimed)} 话没有阅读时间，只计入总数`)
  return lines.length ? lines : ['还没有阅读记录，读完一话就会出现在这里']
}

function Ticker({ stats, top, reduced, plain }: { stats: ReadingStats; top: Ranked | undefined; reduced: boolean; plain?: boolean }) {
  const lines = tickerLines(stats, top)
  const [i, setI] = useState(0)
  // 减少动态效果时不自动轮播，点一下换下一句
  useEffect(() => {
    if (reduced) return
    const timer = setInterval(() => setI((n) => n + 1), 3400)
    return () => clearInterval(timer)
  }, [reduced])
  const at = i % lines.length
  const dots = (
    <span aria-hidden className="flex flex-none gap-1">
      {lines.map((l, j) => (
        <span key={l} className="block h-[5px] rounded-[3px] transition-[width,background-color] duration-300" style={{ width: j === at ? 18 : 5, background: j === at ? '#f4f4f5' : 'rgba(255,255,255,.3)' }} />
      ))}
    </span>
  )
  if (plain) {
    // 桌面：一句大字，像引言；不套框
    return (
      <div className="flex flex-col items-start gap-3">
        {/* 自动轮播不用 aria-live，免得读屏每隔几秒被打断 */}
        <button type="button" key={i} onClick={() => setI((n) => n + 1)} title="下一句" className="gallery-tick m-0 max-w-full text-left font-cjk text-[clamp(18px,1.6vw,24px)] leading-[1.4] font-bold">
          {lines[at]}
        </button>
        {dots}
      </div>
    )
  }
  return (
    <div className="flex h-[50px] w-full items-center gap-3 overflow-hidden rounded-2xl border border-white/10 bg-white/6 px-3.5">
      <Sparkles className="size-[18px] flex-none" strokeWidth={1.8} />
      <button type="button" key={i} onClick={() => setI((n) => n + 1)} title="下一句" className="gallery-tick m-0 min-w-0 flex-1 truncate text-left font-cjk text-[15px] font-bold">
        {lines[at]}
      </button>
      {dots}
    </div>
  )
}

/* ───────── 近半年 ───────── */
const HEAT = ['rgba(255,255,255,.07)', 'rgba(255,255,255,.22)', 'rgba(255,255,255,.42)', 'rgba(255,255,255,.66)', 'rgba(255,255,255,.95)']

const dayLabel = (date: number, n: number) => `${new Date(date).getMonth() + 1} 月 ${new Date(date).getDate()} 日 · ${n ? `${n} 话` : '没有阅读'}`

/** 桌面：底部横跨全宽的时间线，每天一根，越高读得越多；从左往右依次长出来 */
function Timeline({ stats, t, left, top, width }: { stats: ReadingStats; t: number; left: number; top: number; width: number }) {
  const [tip, setTip] = useState(-1)
  const days = stats.days
  const step = width / days.length
  const barW = Math.max(2, Math.min(7, step * 0.5))
  const max = Math.max(1, ...days.map((d) => d.count))
  const barsH = 50
  const months = days.flatMap((d, i) => (new Date(d.date).getDate() === 1 ? [{ x: i * step, label: `${new Date(d.date).getMonth() + 1} 月` }] : []))
  const tipDay = tip >= 0 ? days[tip] : null
  return (
    <section aria-labelledby="gallery-line" className="absolute z-10" style={{ left, top, width }}>
      <div className="flex items-baseline justify-between gap-4" style={upStyle(t, 0.42)}>
        <h2 id="gallery-line" className="m-0 font-cjk text-[15px] font-bold">
          近半年 · 每天读了几话
        </h2>
        <span className="text-xs text-muted num">
          {stats.activeDays} 天有阅读{stats.streak > 1 && ` · 历来最长连续 ${stats.streak} 天`}
        </span>
      </div>
      <div
        role="img"
        aria-label={`近半年每天的阅读话数：${stats.activeDays} 天有阅读，最长连续 ${stats.streak} 天`}
        className="relative mt-3"
        style={{ height: barsH }}
        onMouseLeave={() => setTip(-1)}
      >
        {days.map((d, i) => {
          const grow = easeOut((t - 0.4 - i * 0.0024) / 0.35)
          const hgt = d.future ? 0 : d.count ? 5 + (d.count / max) * (barsH - 5) : 3
          return (
            <span key={d.date} className="absolute bottom-0 flex h-full items-end justify-center" style={{ left: i * step, width: step }} onMouseEnter={() => !d.future && setTip(i)}>
              <span
                className="block rounded-full"
                style={{
                  width: barW,
                  height: hgt * grow,
                  background: i === tip ? '#fff' : HEAT[d.count ? Math.max(1, heatLevel(d.count)) : 0],
                  boxShadow: i === tip ? '0 0 10px rgba(255,255,255,.6)' : undefined,
                }}
              />
            </span>
          )
        })}
        {tipDay && (
          <span
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-[10px] border border-white/22 bg-[rgba(28,28,31,.94)] px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap shadow-[0_8px_20px_rgba(0,0,0,.5)]"
            style={{ left: Math.min(width - 70, Math.max(70, tip * step + step / 2)), top: -8 }}
          >
            {dayLabel(tipDay.date, tipDay.count)}
          </span>
        )}
      </div>
      <div aria-hidden className="relative mt-2 h-4" style={{ opacity: easeOut((t - 0.45) / 0.4) }}>
        {months.map((m) => (
          <span key={m.x} className="absolute top-0 text-[11px] text-faint" style={{ left: m.x }}>
            {m.label}
          </span>
        ))}
      </div>
    </section>
  )
}

/** 手机：近半年热力图，一列一周 */
function Heatmap({ stats, t, cell, tip, onTip }: { stats: ReadingStats; t: number; cell: number; tip: Tip; onTip: (t: Tip) => void }) {
  const pitch = cell + 3
  const weeks = stats.days.length / 7
  const width = weeks * pitch - 3
  const months: { x: number; label: string }[] = []
  for (let w = 0; w < weeks; w++) {
    const d = new Date(stats.days[w * 7].date)
    if (d.getDate() <= 7) months.push({ x: w * pitch, label: `${d.getMonth() + 1} 月` })
  }
  const dayTip = tip?.kind === 'day' ? tip.i : -1
  const tipDay = dayTip >= 0 ? stats.days[dayTip] : null
  return (
    <div className="w-full">
      <div className="flex items-center justify-between gap-3">
        <h2 className="m-0 font-cjk text-[15px] font-bold">近半年 · 每天读了几话</h2>
        <span aria-hidden className="flex items-center gap-1 text-[11px] text-faint">
          少
          {HEAT.map((bg) => (
            <span key={bg} className="size-2.5 rounded-[3px]" style={{ background: bg }} />
          ))}
          多
        </span>
      </div>
      <div aria-hidden className="relative mx-auto mt-2 h-3.5" style={{ width }}>
        {months.map((m) => (
          <span key={m.x} className="absolute top-0 text-[11px] text-faint" style={{ left: m.x }}>
            {m.label}
          </span>
        ))}
      </div>
      <div
        role="img"
        aria-label={`近半年每天的阅读话数：${stats.activeDays} 天有阅读，最长连续 ${stats.streak} 天`}
        className="relative mx-auto mt-1 grid grid-flow-col gap-[3px]"
        style={{ width, gridTemplateRows: `repeat(7, ${cell}px)`, gridAutoColumns: cell }}
        onMouseLeave={() => onTip(null)}
      >
        {stats.days.map((d, i) => {
          // 一列一列像波浪一样亮起
          const e = easeOut((t - 0.3 - Math.floor(i / 7) * 0.018 - (i % 7) * 0.01) / 0.35)
          return (
            <span
              key={d.date}
              className="rounded-[3px]"
              style={{
                width: cell,
                height: cell,
                background: d.future ? 'transparent' : HEAT[heatLevel(d.count)],
                outline: i === dayTip ? '1.5px solid #f4f4f5' : undefined,
                opacity: e,
                transform: `scale(${(0.3 + 0.7 * e).toFixed(3)})`,
              }}
              onMouseEnter={() => !d.future && onTip({ kind: 'day', i })}
              onClick={() => !d.future && onTip(i === dayTip ? null : { kind: 'day', i })}
            />
          )
        })}
        {tipDay && (
          <span
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-[10px] border border-white/22 bg-[rgba(28,28,31,.94)] px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap shadow-[0_8px_20px_rgba(0,0,0,.5)]"
            style={{ left: Math.floor(dayTip / 7) * pitch + cell / 2, top: (dayTip % 7) * pitch - 6 }}
          >
            {dayLabel(tipDay.date, tipDay.count)}
          </span>
        )}
      </div>
    </div>
  )
}

/* ───────── 排行封面 ───────── */
function Plate({ it, width, best, onClick, className, style, showRank }: { it: Ranked; width: number; best?: boolean; onClick?: (e: MouseEvent) => void; className?: string; style?: CSSProperties; showRank?: boolean }) {
  const [color, setColor] = useState<Rgb>(NEUTRAL)
  useEffect(() => {
    if (!best) return
    let alive = true
    void coverColor(it.manga.thumbnailUrl).then((c) => alive && setColor(c))
    return () => {
      alive = false
    }
  }, [best, it.manga.thumbnailUrl])
  return (
    // 不走封面过渡：排行墙在 3D 透视里，给里面的封面挂换页动画的过渡名，浏览器会整个中止
    <Link
      to={`/manga/${it.manga.id}`}
      draggable={false}
      onClick={onClick}
      aria-label={`第 ${it.rank} 名：${it.manga.title}，已读 ${it.read} 话`}
      className={cn('gallery-plate relative block rounded-[18px] border border-white/24 bg-white/7 p-2 text-text no-underline shadow-[inset_0_1px_0_rgba(255,255,255,.2),0_30px_60px_-28px_rgba(0,0,0,.9)] transition-[border-color] duration-300 hover:border-white/60', className)}
      style={{ width, ...style, '--c': rgbCss(color) } as CSSProperties}
    >
      {best && (
        <>
          <span aria-hidden className="gallery-glow absolute -inset-[46px] -z-10 rounded-[60px] blur-[8px]" style={{ background: `radial-gradient(closest-side, ${rgbCss(color)} 0%, ${rgbCss(color, 0.4)} 55%, transparent 100%)` }} />
          <span aria-hidden className="gallery-ring absolute -inset-1 rounded-[21px] p-[3px]" />
        </>
      )}
      <span className="gallery-plate-cover cv rounded-[11px]">
        <CoverImg src={it.manga.thumbnailUrl} loading="lazy" />
        {best && <span aria-hidden className="gallery-sheen pointer-events-none absolute inset-0 z-[1]" />}
        {showRank && (
          <span className="absolute bottom-2.5 left-2.5 z-[2] flex h-7 items-center gap-1.5 rounded-full border border-white/26 bg-black/42 px-[11px] text-[13px] font-bold whitespace-nowrap backdrop-blur-[10px] num">
            <span className="text-white/70">No.{it.rank}</span>
            {count(it.read)} 话
          </span>
        )}
        <span className="gallery-plate-cap absolute inset-x-0 bottom-0 z-[3] flex flex-col gap-1 bg-gradient-to-b from-transparent to-black/85 px-3 pt-10 pb-3">
          <span className="line-clamp-2 font-cjk text-[13px] leading-[1.35] font-bold">{it.manga.title}</span>
          <span className="text-xs text-white/80 num">
            已读 {count(it.read)} / {it.total == null ? '—' : count(it.total)} 话
          </span>
        </span>
      </span>
      {best && (
        <span className="absolute -top-4 -right-4 z-[4] flex h-[34px] rotate-6 items-center gap-1.5 rounded-full bg-[#f4f4f5] pr-3.5 pl-[11px] text-[13px] font-bold text-[#0b0b0d] shadow-[0_10px_24px_rgba(0,0,0,.5)]">
          <Crown className="size-[15px]" strokeWidth={2} />
          读得最多
        </span>
      )}
    </Link>
  )
}

/* ───────── 桌面排行墙：两部一列，可拖动、甩动、滚动，停下吸附到最近的一列；排到左边的列渐渐变暗淡出 ───────── */
function RankWall({
  ranked,
  works,
  t,
  width,
  bottom,
  left,
  reduced,
  restore,
  empty,
}: {
  ranked: Ranked[]
  works: number
  t: number
  width: number
  /** 排行墙（含底部刻度）最低能到哪里，下面是时间线 */
  bottom: number
  /** 排行墙从哪里开始，左边是大数字 */
  left: number
  reduced: boolean
  restore: boolean
  empty: boolean
}) {
  const cols = Math.ceil(ranked.length / 2)
  // 尺寸按可用高度算：列头、两张封面、间距和底部刻度放得下
  const top = 92
  const head = 88
  const coverW = Math.round(Math.max(72, Math.min(190, ((bottom - top - head - 22 - 30) / 2 - 16) / 1.5)))
  const plateW = coverW + 16
  const plateH = Math.round(coverW * 1.5 + 16)
  const pitch = plateW + 30
  // 第一列（「已读排行」）贴着左边界，第一名在它右边一列
  const pivot = left + plateW / 2 + pitch
  const persp = 1300
  const ox = pivot + pitch * 0.7
  const [s, setS] = useState(() => (restore ? memory.s : 0))
  const sRef = useRef(s)
  sRef.current = s
  const target = useRef(s)
  const moved = useRef(false)
  const dragging = useRef(false)
  const raf = useRef(0)
  const lastWheel = useRef(0)
  const min = -pitch
  const max = Math.max(0, (cols - 1) * pitch)
  const snap = (x: number) => Math.max(-1, Math.min(Math.max(0, cols - 1), Math.round(x / pitch))) * pitch
  const clampS = (x: number) => Math.max(min - pitch / 2, Math.min(max + pitch / 2, x))

  // 离开时记下停在哪一列（按列数记，返回时窗口大小变了也对得上）
  const pitchRef = useRef(pitch)
  pitchRef.current = pitch
  useEffect(
    () => () => {
      cancelAnimationFrame(raf.current)
      memory.s = Math.round(sRef.current / pitchRef.current) * pitchRef.current
    },
    [],
  )

  const settle = () => {
    cancelAnimationFrame(raf.current)
    let last = performance.now()
    const step = (now: number) => {
      const dt = Math.max(0, Math.min(48, now - last))
      last = now
      if (dragging.current) return
      if (now - lastWheel.current < 160) {
        raf.current = requestAnimationFrame(step)
        return
      }
      const cur = sRef.current
      let next = cur + (target.current - cur) * (reduced ? 1 : Math.min(1, dt * 0.012))
      if (Math.abs(target.current - next) < 0.3) next = target.current
      sRef.current = next
      setS(next)
      if (next !== target.current) raf.current = requestAnimationFrame(step)
    }
    raf.current = requestAnimationFrame(step)
  }

  const bind = useDrag(
    ({ first, last, tap, movement: [mx], velocity: [vx], direction: [dx], memo }) => {
      // 单击也会以「非第一帧」调一次，那时没有起点：照算会得到 NaN，整面墙从此停住（点侧边的封面就会这样）
      if (t < 1 || tap) return memo
      const s0 = first ? sRef.current : (memo as number | undefined)
      if (s0 === undefined || !Number.isFinite(s0)) return memo
      if (first) {
        moved.current = false
        cancelAnimationFrame(raf.current)
      }
      dragging.current = !last
      if (Math.abs(mx) > 4) moved.current = true
      const next = clampS(s0 - mx)
      sRef.current = next
      setS(next)
      if (last) {
        // 甩得越快滑得越远，再吸到最近的一列
        target.current = snap(next - (reduced ? 0 : vx * dx * 220))
        settle()
      }
      return s0
    },
    { pointer: { capture: false }, filterTaps: true, axis: 'x' },
  )

  const onWheel = (e: React.WheelEvent) => {
    if (t < 1) return
    lastWheel.current = performance.now()
    const next = clampS(sRef.current + (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY))
    sRef.current = next
    setS(next)
    target.current = snap(next)
    settle()
  }

  const onPlate = (j: number) => (e: MouseEvent) => {
    // 刚拖动过不算点击；点的不是正中那一列时先把它移过来
    if (moved.current) {
      e.preventDefault()
      return
    }
    if (Math.abs(sRef.current - j * pitch) > pitch / 2) {
      e.preventDefault()
      target.current = j * pitch
      settle()
    }
  }

  // 进场的先后按「离当前停靠的那一列有几列」算，不按列号：返回时墙停在第 14 列，列号算下来的延迟早超过整段动画，那些列会一直半透明、话数停在 0。
  // 上限 6：再远的列在屏幕外，也保证 t 到 1 时每一列都已到位
  const base = Math.round(s / pitch) - 1
  const lagOf = (j: number) => Math.max(0, Math.min(6, j - base))
  const items: { j: number; x: number; z: number; ry: number; o: number; zi: number }[] = []
  for (let j = -1; j < cols; j++) {
    const d = j * pitch - s
    let x = pivot + d
    let z = 0
    let ry = 0
    let o = 1
    if (d < 0) {
      // 排到左边的列：稍微往后退、侧过去一点、变暗，靠近左边的大数字之前完全淡出
      const k = Math.min(1, -d / pitch)
      z = -90 * k
      ry = 10 * k
      o = (1 - 0.4 * k) * clamp01((x - plateW / 2 - (left - pitch * 0.5)) / (pitch * 0.5))
    }
    // 进场：各列依次从右侧翻转着飞入；出场时倒放
    const ej = easeOut((t - 0.12 - lagOf(j) * 0.05) / 0.5)
    x += (1 - ej) * 260
    o *= ej
    ry -= (1 - ej) * 80
    if (o <= 0.01 || (x - plateW / 2 > width + 40 && j >= 0)) continue
    items.push({ j, x, z, ry, o, zi: 100 + Math.round(d / pitch) })
  }

  // 底部刻度跟着各列的透视位置走；只画刻度线，话数已经写在列头上了
  const ticksY = top + head + plateH * 2 + 22 + 18
  const ticks = items
    .filter((c) => c.j >= 0)
    .map((c) => ({ j: c.j, x: ox + ((c.x - ox) * persp) / (persp - c.z), o: c.o }))

  return (
    <div className={cn('absolute inset-0 touch-pan-y', t >= 1 && 'cursor-grab active:cursor-grabbing')} {...bind()} onWheel={onWheel}>
      <div className="absolute inset-0" style={{ perspective: persp, perspectiveOrigin: `${ox}px ${top + head + plateH}px` }}>
        {items.map(({ j, x, z, ry, o, zi }) => {
          const a = ranked[j * 2]
          const b = ranked[j * 2 + 1]
          return (
            <div key={j} className="absolute" style={{ left: x - plateW / 2, top, width: plateW, zIndex: zi, opacity: o, transform: `translateZ(${z.toFixed(1)}px) rotateY(${ry.toFixed(2)}deg)` }}>
              <div className="gallery-float" style={{ animationDelay: `${-(j + 1) * 0.7}s` }}>
                {j < 0 ? (
                  <div className="flex flex-col justify-between rounded-[18px] border border-white/24 bg-white/7 px-6 py-[26px] shadow-[inset_0_1px_0_rgba(255,255,255,.2),0_30px_60px_-28px_rgba(0,0,0,.9)]" style={{ marginTop: head, height: plateH * 2 + 22 }}>
                    <span className="text-[13px] font-medium tracking-[.3em] text-white/70">TOP {ranked.length || works}</span>
                    <span className="flex flex-col gap-3.5">
                      <span className="font-cjk leading-[1.08] font-black" style={{ fontSize: Math.round(Math.min(46, plateW * 0.26)) }}>
                        已读
                        <br />
                        排行
                      </span>
                      <span className="text-sm leading-[1.7] text-white/75">{empty ? '还没有读过的作品，读完一话就会出现在这里。' : '按已读话数从多到少。拖动、甩动或滚动浏览。'}</span>
                      <ArrowRight className="size-[30px]" strokeWidth={1.8} />
                    </span>
                  </div>
                ) : (
                  <>
                    <div aria-hidden className="flex flex-col items-center justify-end gap-2" style={{ height: head }}>
                      <span className="text-xs font-semibold tracking-[.24em] text-faint">No.{a.rank}</span>
                      <span className="flex items-baseline gap-1.5 leading-none">
                        <span className="text-[44px] font-bold tracking-[-0.03em] num">{count(Math.round(a.read * easeOut((t - 0.3 - Math.min(2, Math.max(0, lagOf(j) - 1)) * 0.05) / 0.6)))}</span>
                        <span className="font-cjk text-lg font-bold text-white/75">话</span>
                      </span>
                      <span className="h-[18px] w-px bg-white/40" />
                    </div>
                    <Plate it={a} width={plateW} best={a.rank === 1} onClick={onPlate(j)} style={a.rank === 1 ? { transform: 'scale(1.04)' } : undefined} />
                    {b && <Plate it={b} width={plateW} onClick={onPlate(j)} showRank className="mt-[22px]" />}
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div aria-hidden className="pointer-events-none absolute inset-x-0 h-[40px]" style={{ top: ticksY - 12, opacity: easeOut((t - 0.2) / 0.5) }}>
        <div className="absolute top-3 right-10 h-px bg-[linear-gradient(90deg,transparent,rgba(255,255,255,.3)_12%,rgba(255,255,255,.3))]" style={{ left: left + 28 }} />
        <div className="absolute -top-[2px] -ml-[110px] h-5 w-[220px] rounded-[50%] bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,.95),transparent_70%)] blur-[3px]" style={{ left: pivot }} />
        {ticks.map((tk) => (
          <span key={tk.j} className="absolute top-[7px] h-[13px] w-px bg-white/60" style={{ left: tk.x, opacity: tk.o }} />
        ))}
      </div>
    </div>
  )
}

/* ───────── 手机：竖排长页 ───────── */
function MobileStats(p: BodyProps) {
  const { w } = useWindowSize()
  const clockSize = Math.min(300, w - 90)
  const heatCell = Math.max(7, Math.min(11, Math.floor((w - 40 + 3) / 26) - 3))
  return (
    <>
      <Backdrop glow={p.glow} className="absolute inset-x-0 top-0 h-[760px]" />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[760px] bg-[linear-gradient(180deg,transparent_60%,var(--bg))]" />
      <div className="relative flex flex-col items-center gap-6 px-5 pt-[max(12px,env(safe-area-inset-top))] pb-16">
        <header className="flex w-full items-center justify-between">
          <Glass as="button" type="button" onClick={p.onExit} aria-label="返回画廊首页" className="gicon size-11 rounded-full text-text">
            <ChevronLeft className="size-[22px]" strokeWidth={1.8} />
          </Glass>
          <h1 className="m-0 font-cjk text-[17px] font-black">阅读档案</h1>
          <span className="size-11" />
        </header>
        {/* 主角：已读话数，从首页飞过来的那个数字 */}
        <div className="flex flex-col items-center gap-1">
          <span className="text-[11px] font-semibold tracking-[.3em] text-muted">已读章节</span>
          <span className="flex items-baseline gap-1.5">
            <span data-gallery-read className="text-[64px] leading-none font-bold tracking-[-0.045em] num">
              {p.read == null ? '—' : count(p.read)}
            </span>
            <span className="font-cjk text-lg font-bold text-white/75">话</span>
          </span>
          <span className="text-[11px] tracking-[.08em] text-muted">截至 {dateLabel(p.now)} · 按每话最后一次阅读的时间</span>
        </div>
        <Overview {...p} clockSize={clockSize} heatCell={heatCell} />
        {p.stats && <RankStrip ranked={p.ranked} />}
      </div>
    </>
  )
}

/** 手机排行：横向滑动的封面，自动对齐到中间 */
function RankStrip({ ranked }: { ranked: Ranked[] }) {
  return (
    <section aria-labelledby="gallery-rank" className="-mx-5 w-[calc(100%+40px)]">
      <div className="flex items-baseline justify-between px-5">
        <h2 id="gallery-rank" className="m-0 font-cjk text-[22px] font-black">
          已读排行
        </h2>
        <span className="text-xs text-muted">{ranked.length ? `左右滑动 · 前 ${ranked.length} 部` : '还没有读过的作品'}</span>
      </div>
      {ranked.length > 0 && (
        <div className="no-scrollbar mt-3.5 flex snap-x snap-mandatory gap-1.5 overflow-x-auto px-[calc(50%-80px)] pt-[18px] pb-[22px] [perspective:900px]">
          {ranked.map((it) => (
            <div key={it.manga.id} className="gallery-cf flex w-40 flex-none snap-center flex-col items-center gap-2.5">
              <span aria-hidden className="flex items-baseline gap-1.5 leading-none">
                <span className="text-[11px] font-semibold tracking-[.2em] text-faint">No.{it.rank}</span>
                <span className="text-[26px] font-bold num">{count(it.read)}</span>
                <span className="font-cjk text-[13px] font-bold text-white/75">话</span>
              </span>
              <Plate it={it} width={160} best={it.rank === 1} className="p-1.5" />
              <span className="line-clamp-2 w-[150px] text-center font-cjk text-[13px] leading-[1.35] font-bold">{it.manga.title}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
