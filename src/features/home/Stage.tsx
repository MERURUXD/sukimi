import { useDrag } from '@use-gesture/react'
import { animate, AnimatePresence, motion, useMotionValue, useReducedMotion, useTransform, type MotionValue } from 'motion/react'
import { Download, Play, Shuffle } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject, type WheelEvent } from 'react'
import { Link, useHref, useNavigate } from 'react-router'
import { Can } from '@/features/auth/Can'
import { Glass } from '@/components/glass/Glass'
import { CoverImg } from '@/components/manga/CoverImg'
import { spring } from '@/design/motion'
import { useAppearance } from '@/design/settings'
import { cn } from '@/lib/cn'
import { sfwAttr } from '@/lib/devSafe'
import { sec, timeAgo } from '@/lib/format'
import { READER_VT_ATTR } from '@/lib/readerTransition'
import type { ReadChapter } from './queries'
import { t } from '@/i18n'

/** 打开网页时的路径。开屏动画只在首页就是第一页时播一次，从别的页回来只播轻的进场 */
const bootPath = location.pathname
let introPlayed = false
/** 首页大图区已经显示过内容（任一布局）：之后再换到舞台（例如窗口从手机宽度拉宽）也不播 */
export const markIntroPlayed = () => { introPlayed = true }

/** 大图区的进场：intro 是舞台的开屏动画；light 是之后每次回到首页的轻进场（文字浮起、两侧封面展开） */
export type Entrance = 'intro' | 'light'

/**
 * 挂载时决定一次进场方式，ready（有内容可显示）之后放完就收起，之后切换作品不再重播。
 * 从阅读器缩回首页时不播：阅读器要缩进「继续阅读」按钮，按钮这时还没浮现会缩进一片空白。
 */
export function useEntrance(stage: boolean, ready: boolean) {
  const reduced = useReducedMotion()
  const on = useAppearance((s) => s.homeIntro)
  const [mode] = useState<Entrance | null>(() => {
    if (!on || reduced) return null
    if (stage && !introPlayed && location.pathname === bootPath) return 'intro'
    return document.documentElement.hasAttribute(READER_VT_ATTR) ? null : 'light'
  })
  const [entering, setEntering] = useState(mode !== null)
  useEffect(() => {
    if (!entering || !ready) return
    const t = setTimeout(() => setEntering(false), mode === 'intro' ? 2400 : 1200)
    return () => clearTimeout(t)
  }, [entering, ready, mode])
  return { mode, entering: entering ? mode : null }
}

/** 扇形里离中间 0、1、2 张的姿态；只给右侧，左侧镜像。尺寸靠缩放，所有封面同一个盒子，量位置简单 */
const POSES = [
  { x: 0, rotateY: 0, scale: 1 },
  { x: 215, rotateY: -36, scale: 0.855 },
  { x: 370, rotateY: -50, scale: 0.76 },
]
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/**
 * 连续的「离中间第几张」→ 姿态。拖动时在相邻两格之间插值；
 * 2 格以外继续往外推并淡出，绕到另一侧的那张在看不见的时候换边（5 部时）。静止时封面都不透明。
 */
function poseAt(off: number, n: number) {
  const a = Math.abs(off)
  const s = Math.sign(off)
  const edge = n / 2
  if (a > 2) {
    const p = POSES[2]
    return { x: s * (p.x + (a - 2) * 155), rotateY: s * p.rotateY, scale: p.scale, opacity: edge > 2 ? Math.max(0, 1 - (a - 2) / (edge - 2)) : 1 }
  }
  const i = a < 1 ? 0 : 1
  const p = POSES[i]
  const q = POSES[i + 1]
  const t = a - i
  return { x: s * lerp(p.x, q.x, t), rotateY: s * lerp(p.rotateY, q.rotateY, t), scale: lerp(p.scale, q.scale, t), opacity: 1 }
}

/** 环形排列：离 pos 多远，落在 [-n/2, n/2) */
const wrap = (d: number, n: number) => ((((d + n / 2) % n) + n) % n) - n / 2
const mod = (k: number, n: number) => ((k % n) + n) % n

/** 封面区的设计高度；封面区以下（指示条、标题、按钮）加上方留白约占 RESERVED */
const DECK_H = 420
const RESERVED = 470
/** 矮窗口里整组封面等比缩小，让「继续阅读」按钮留在首屏 */
const fitOf = () => Math.max(0.5, Math.min(1, (window.innerHeight - RESERVED) / DECK_H))

/**
 * 封面区的尺寸：fit 是按窗口高度的缩小比例；spread 是横向展开的比例，
 * 让最外侧封面（缩放后半宽 105）不超出封面区。1100px 宽、不缩小时是设计稿的原样。
 */
function useDeckSize() {
  const ref = useRef<HTMLDivElement>(null)
  const spread = useMotionValue(1)
  const [fit, setFit] = useState(fitOf)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    let width = 0
    const measure = () => {
      const f = fitOf()
      setFit(f)
      if (width) spread.set(Math.max(0.5, Math.min(1, (width / f / 2 - 16 - 105) / POSES[2].x)))
    }
    // 初次尺寸也由排版后的观察结果提供，挂载时读 clientWidth 会强制整个首页提前排版。
    const ro = new ResizeObserver(([entry]) => {
      width = entry.contentRect.width
      measure()
    })
    ro.observe(el)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [spread])
  return [ref, spread, fit] as const
}
const EASE = [0.2, 0, 0, 1] as const
const nativeEntrance = () => typeof Element.prototype.animate === 'function'

const fanTransform = (p: ReturnType<typeof poseAt>, spread: number, f: number) =>
  `translateX(${p.x * spread * f}px) scale(${1 - (1 - p.scale) * f}) rotateY(${p.rotateY * f}deg)`

/** 展开用浏览器原生 transform 时间线；只有用户中途操作时才交回跟手的 MotionValue。 */
function useFanEntrance(deck: RefObject<HTMLDivElement | null>, pos: MotionValue<number>, spread: MotionValue<number>, order: string, n: number, mode: Entrance | null, reduced: boolean) {
  const fan = useMotionValue(1)
  const stop = useRef<() => void>(() => {})
  const startedAt = useRef<number | null>(null)
  useLayoutEffect(() => {
    if (reduced) { fan.set(1); return }
    if (!mode || !deck.current) return
    const from = mode === 'intro' ? 0 : 0.8
    const duration = mode === 'intro' ? 900 : 700
    const delay = mode === 'intro' ? 600 : 0
    const now = document.timeline.currentTime
    if (typeof now !== 'number' || !nativeEntrance()) {
      fan.set(from)
      const animation = animate(fan, 1, { duration: duration / 1000, delay: delay / 1000, ease: EASE })
      return () => animation.stop()
    }
    startedAt.current ??= now
    const start = startedAt.current
    if (now - start >= delay + duration) { fan.set(1); return }
    fan.set(1)
    const all = [...deck.current.querySelectorAll<HTMLElement>('[data-fan-card]')].map((el) => {
      const j = Number(el.dataset.fanCard)
      return { el, j, pose: poseAt(wrap(j - pos.get(), n), n) }
    })
    const cards = all.filter((c) => c.pose.x !== 0)
    const frames = (c: typeof cards[number]) => [
      { transform: fanTransform(c.pose, spread.get(), from) },
      { transform: fanTransform(c.pose, spread.get(), 1) },
    ]
    const animations = cards.map((c) => {
      const animation = c.el.animate(frames(c), { duration, delay, easing: 'cubic-bezier(.2,0,0,1)', fill: 'backwards' })
      animation.startTime = start
      return animation
    })
    // 外层的淡入和缩放也交给同一浏览器时钟，否则内层继续展开、外层仍会在忙完后跳一下。
    const reveals = all.flatMap((c) => {
      const rank = Math.round(Math.abs(wrap(c.j - pos.get(), n)))
      if (mode === 'light' && rank === 0) return []
      const transform = mode === 'intro' ? `translateY(${rank ? 0 : 70}px) scale(${rank ? 0.8 : 0.86})` : 'none'
      const animation = c.el.parentElement!.animate([
        { opacity: 0, transform }, { opacity: 1, transform: 'translateY(0px) scale(1)' },
      ], {
        duration: mode === 'light' ? 500 : rank ? 900 : 1000,
        delay: mode === 'light' ? (rank === 1 ? 0 : 60) : rank === 0 ? 250 : rank === 1 ? 600 : 750,
        easing: 'cubic-bezier(.2,0,0,1)', fill: 'backwards',
      })
      animation.startTime = start
      return [animation]
    })
    let playing = true
    let takeover: ReturnType<typeof animate> | undefined
    const interrupt = () => {
      if (!playing || !cards.length) return
      playing = false
      // 只在交接那一刻读取浏览器实际姿态，避免主线程忙过一阵后从过时的位置接着拖。
      const first = cards[0]
      const x = new DOMMatrixReadOnly(getComputedStyle(first.el).transform).m41
      const f = Math.max(from, Math.min(1, x / (first.pose.x * spread.get())))
      fan.set(f)
      cards.forEach((c) => { c.el.style.transform = fanTransform(poseAt(wrap(c.j - pos.get(), n), n), spread.get(), f) })
      animations.forEach((animation) => animation.cancel())
      const elapsed = Number(document.timeline.currentTime) - start
      takeover = animate(fan, 1, { duration: Math.max(0.12, Math.min(duration, delay + duration - elapsed) / 1000), ease: EASE })
    }
    stop.current = interrupt
    const offPos = pos.on('change', interrupt)
    const offSpread = spread.on('change', () => {
      if (!playing) return
      // 尺寸变化只更新关键帧，沿用同一时钟，不能重新播放展开。
      animations.forEach((animation, i) => (animation.effect as KeyframeEffect).setKeyframes(frames(cards[i])))
    })
    const preference = matchMedia('(prefers-reduced-motion: reduce)')
    const finish = () => {
      if (!preference.matches) return
      playing = false
      takeover?.stop()
      fan.set(1)
      animations.forEach((animation) => animation.cancel())
      reveals.forEach((animation) => animation.cancel())
    }
    preference.addEventListener('change', finish)
    void Promise.all(animations.map((animation) => animation.finished)).then(() => { playing = false }).catch(() => {})
    reveals.forEach((animation) => { void animation.finished.catch(() => {}) })
    return () => {
      playing = false
      if (stop.current === interrupt) stop.current = () => {}
      offPos()
      offSpread()
      preference.removeEventListener('change', finish)
      animations.forEach((animation) => animation.cancel())
      reveals.forEach((animation) => animation.cancel())
      takeover?.stop()
    }
  }, [deck, pos, spread, order, n, mode, fan, reduced])
  return { fan, interrupt: () => stop.current() }
}

interface Target { id: number; label: string; page: string; pct: number | null; isNext: boolean }

/**
 * 桌面首页「舞台」：在读的几部排成扇形，当前这部在中间，左右切换；背景沿用流动模糊封面。
 * 冷启动时封面从中间展开、文字依次出现（开屏动画，可在外观设置关闭）。
 * 鼠标悬停两侧封面时，背景先换成那部的颜色。
 */
export function Stage({ items, active, onSelect, onPreview, onShuffle, onDownload, background, target, meta, entrance }: {
  items: ReadChapter[]
  active: number
  onSelect: (i: number) => void
  /** 鼠标悬停两侧封面时预览它的背景颜色；null 是移开 */
  onPreview: (i: number | null) => void
  onShuffle?: () => void
  onDownload: () => void
  background: ReactNode
  target: Target | null
  meta: string
  entrance: ReturnType<typeof useEntrance>
}) {
  const reduced = useReducedMotion()
  // 进场动画播完前用它的时间线，之后切换都用弹簧
  const { mode, entering } = entrance
  const intro = mode === 'intro'
  const light = mode === 'light'

  const cur = items[active]
  const m = cur.manga
  const n = items.length
  const navigate = useNavigate()
  const detailHref = useHref(`/manga/${m.id}`)
  const [deck, spread, fit] = useDeckSize()

  /*
   * pos 是连续的「中间是第几部」：拖动时封面跟着手走，松手按位置加惯性落到最近的一部，一次可以划过好几部。
   * goal 是正在落向的那一格（不取模）；选中项从外部变化（点两侧封面）时从它出发，走最短的方向。
   */
  const pos = useMotionValue(active)
  const goal = useRef(active)
  // 轻进场时两侧封面从中间那张背后略微展开；中间那张不受 fan 影响，从详情页飞回的封面落点不变
  // 查询补齐时可能只重排作品、不改变数量；原生关键帧也要跟着新顺序更新，但不重启时钟。
  const { fan, interrupt } = useFanEntrance(deck, pos, spread, items.map((c) => c.manga.id).join(','), n, mode, !!reduced)
  const settle = (to: number) => {
    const k = Math.round(to)
    goal.current = k
    animate(pos, k, reduced ? { duration: 0 } : spring.default)
    if (mod(k, n) !== active) onSelect(mod(k, n))
  }
  useEffect(() => {
    const from = goal.current
    if (mod(from, n) === active) return
    let d = mod(active - from, n)
    if (d > n / 2) d -= n
    goal.current = from + d
    animate(pos, from + d, reduced ? { duration: 0 } : spring.default)
  }, [active, n, pos, reduced])

  const step = () => POSES[1].x * spread.get() * fit
  // 拖过就不算点击：免得松手时落在中间那张上直接进了详情
  const dragged = useRef(false)
  const bind = useDrag(({ first, last, tap, movement: [mx], velocity: [vx], direction: [dx], memo }) => {
    // 轻点交给封面自己的点击。轻点只在松手时回调一次，没有起点，碰 pos 会把它变成 NaN，之后就拖不动了
    if (tap) return
    const start: number = first || memo === undefined ? pos.get() : memo
    if (first) {
      interrupt()
      pos.stop()
      dragged.current = false
    }
    if (Math.abs(mx) > 6) dragged.current = true
    pos.set(start - mx / step())
    if (last) {
      // 惯性：松手时的速度（px/ms）按 0.12 秒折算成多划的距离，最多多走 1 部。
      // 手拖多远就转多远，不限圈数；只限制惯性，免得轻甩一下转过头
      settle(pos.get() - dx * Math.min(1, (vx * 120) / step()))
    }
    return start
  }, { axis: 'x', filterTaps: true, enabled: n > 1 })
  // 触控板横向轻扫同样跟手，停下后落到最近的一部
  const wheelTimer = useRef(0)
  const onWheel = (e: WheelEvent<HTMLDivElement>) => {
    if (n < 2 || Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return
    interrupt()
    pos.stop()
    pos.set(pos.get() + e.deltaX / step())
    clearTimeout(wheelTimer.current)
    wheelTimer.current = window.setTimeout(() => settle(pos.get()), 140)
  }
  // 悬停稍停一下再换色，鼠标只是扫过两侧封面时不闪
  const hoverTimer = useRef(0)
  const hover = (j: number | null) => {
    clearTimeout(hoverTimer.current)
    hoverTimer.current = window.setTimeout(() => onPreview(j), j === null ? 200 : 120)
  }
  const select = (j: number) => {
    clearTimeout(hoverTimer.current)
    interrupt()
    onSelect(j)
  }
  useEffect(() => () => clearTimeout(hoverTimer.current), [])

  // 进场时各元素依次上浮（.rise / .rise-light，见 index.css）；d 是开屏的延迟秒数，l 是轻进场的
  const delay = (d: number, l: number) => (entering ? { '--d': `${entering === 'intro' ? d : l}s` } as CSSProperties : undefined)
  const rise = entering === 'intro' ? 'rise' : entering && 'rise-light'
  const riseEach = rise && `${rise}-each`

  return (
    <section aria-label={t('home.continue')} className="relative isolate -mt-[var(--nav-h)] pt-[var(--nav-h)]" data-desktop-layout="stage" data-sfw={sfwAttr(m.source?.displayName)}>
      {/* 背景：流动模糊封面原样保留；开屏时整体淡入并从略大缩回，轻进场只轻微缩回。
          裁切放在外层、缩放放在里层：缩放的元素自己带 overflow 时，放大的那圈会溢出到下一段，露出一条灰带 */}
      <div aria-hidden className="absolute inset-x-0 top-0 bottom-0.5 -z-20 overflow-hidden">
        <motion.div
          className="absolute inset-0"
          initial={intro ? { opacity: 0, scale: 1.12 } : light ? { scale: 1.04 } : false}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: intro ? 1.4 : 1, ease: EASE }}
        >
          {background}
        </motion.div>
      </div>
      {/* 文字居中在封面下方，压暗中下部保证对比，底部融入底色 */}
      <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_60%_45%_at_50%_80%,var(--scrim-b),transparent_75%),linear-gradient(var(--scrim-a),var(--scrim-a))]" />
      <div aria-hidden className="fade-to-bg absolute inset-0 -z-10 [--from:45%]" />

      <div className="wrap flex flex-col items-center gap-[30px] pt-14 pb-12">
        {/* 封面区可以左右拖动或横向轻扫切换，也可以直接点两侧的封面 */}
        <div
          ref={deck}
          {...bind()}
          onWheel={onWheel}
          onClickCapture={(e) => {
            if (!dragged.current) return
            dragged.current = false
            e.preventDefault()
            e.stopPropagation()
          }}
          style={{ height: DECK_H * fit }}
          className="relative w-full max-w-[1100px] cursor-grab touch-pan-y select-none active:cursor-grabbing"
        >
          <div className="absolute inset-x-0 top-0" style={{ height: DECK_H, transform: fit < 1 ? `scale(${fit})` : undefined, transformOrigin: '50% 0' }}>
            {items.map((c, j) => (
              <FanCard key={c.manga.id} c={c} j={j} n={n} center={j === active} pos={pos} fan={fan} spread={spread} entrance={entering} onSelect={() => select(j)} onHover={(on) => hover(on ? j : null)} />
            ))}
          </div>
        </div>

        {n > 1 && (
          <div aria-hidden style={delay(0.95, 0.2)} className={cn('flex items-center gap-1.5', rise)}>
            {items.map((c, j) => <Dot key={c.manga.id} j={j} n={n} pos={pos} />)}
          </div>
        )}

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={m.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.16 }}
            className="flex w-full flex-col items-center"
          >
            <div className="flex w-full max-w-[760px] flex-col items-center gap-3 text-center">
              <span style={delay(0.85, 0.06)} className={cn('text-[13px] font-bold tracking-[.12em] text-muted', rise)}>{t('home.continueAgo', { time: timeAgo(sec(cur.lastReadAt)) })}</span>
              <h1 title={m.title} style={delay(0.92, 0.1)} className={cn('m-0 line-clamp-2 font-cjk text-[46px] font-black tracking-[-.02em] text-balance break-words xl:text-[60px]', m.title.length > 22 && 'text-[36px] xl:text-[40px]', m.title.length > 40 && 'text-[28px] xl:text-[32px]',
                // 行高放在字号之后：tailwind-merge 换字号时会把前面的行高一起去掉
                'leading-[1.12]', rise)}>{m.title}</h1>
              <span style={delay(1, 0.14)} className={cn('max-w-full truncate text-[15px] text-muted num', rise)}>
                {[meta, target && `${target.isNext ? t('home.nextUp') : ''}${target.label} · ${target.page}`].filter(Boolean).join(' · ')}
              </span>
              {target?.pct != null && (
                <span style={delay(1.08, 0.18)} className={cn('prog mt-1 w-[300px] max-w-[80%]', rise)}>
                  <motion.i style={{ width: '100%', transformOrigin: 'left' }} initial={entering ? { scaleX: 0 } : false} animate={{ scaleX: target.pct / 100 }} transition={{ duration: entering === 'intro' ? 1.1 : 0.8, delay: entering === 'intro' ? 1.35 : entering ? 0.3 : 0, ease: EASE }} />
                </span>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
        {/* 按钮不随作品淡出淡入：都是玻璃，父元素带透明度会让它们采不到背景 */}
        <div data-home-actions style={delay(1.15, 0.2)} className={cn('flex flex-wrap items-center justify-center gap-3', riseEach)}>
          {target ? (
            <Link to={`/manga/${m.id}/chapter/${target.id}`} viewTransition className="solid h-[54px] px-[30px] text-base no-underline">
              <Play className="size-4 fill-current" strokeWidth={1.6} />
              {t('home.continue')}
            </Link>
          ) : (
            <span className="solid h-[54px] px-[30px] text-base opacity-60">{t('home.allRead')}</span>
          )}
          {/* 背后只是氛围光，折射看不出来，关掉透镜省开销 */}
          <Glass suspendRefract
            as="a"
            href={detailHref}
            className="gbtn h-[54px] rounded-full px-6 text-[15px] no-underline"
            onClick={(e) => {
              if (e.ctrlKey || e.metaKey || e.shiftKey) return
              e.preventDefault()
              navigate(`/manga/${m.id}`, { viewTransition: true })
            }}
          >
            {t('home.details')}
          </Glass>
          <Can permission="DOWNLOAD_CHAPTERS">
            <Glass suspendRefract as="button" type="button" className="gicon size-[54px] rounded-full" onClick={onDownload} aria-label={t('home.downloadRest')} title={t('home.downloadRest')}>
              <Download className="size-5" strokeWidth={1.8} />
            </Glass>
          </Can>
          {onShuffle && (
            <Glass suspendRefract as="button" type="button" className="gicon size-[54px] rounded-full" onClick={() => { interrupt(); onShuffle() }} aria-label={t('home.shuffleContinue')} title={t('home.shuffle')}>
              <Shuffle className="size-5" strokeWidth={1.8} />
            </Glass>
          )}
        </div>
      </div>
    </section>
  )
}

/**
 * 扇形里的一张封面。中间那张是进详情的链接（封面飞入详情页靠它的 .cv），两侧是切换按钮。
 * 外层铺满封面区、带透视，开屏时整体淡入；里层的位置全由 pos 推算，拖动时不经过 React 渲染。
 */
function FanCard({ c, j, n, center, pos, fan, spread, entrance, onSelect, onHover }: {
  c: ReadChapter
  j: number
  n: number
  center: boolean
  pos: MotionValue<number>
  fan: MotionValue<number>
  spread: MotionValue<number>
  entrance: Entrance | null
  onSelect: () => void
  onHover: (on: boolean) => void
}) {
  const m = c.manga
  const off = useTransform(pos, (p) => wrap(j - p, n))
  const x = useTransform([off, fan, spread], ([o, f, s]: number[]) => poseAt(o, n).x * s * f)
  const rotateY = useTransform([off, fan], ([o, f]: number[]) => poseAt(o, n).rotateY * f)
  const scale = useTransform([off, fan], ([o, f]: number[]) => 1 - (1 - poseAt(o, n).scale) * f)
  const opacity = useTransform(off, (o) => poseAt(o, n).opacity)
  const zIndex = useTransform(off, (o) => 10 - Math.round(Math.abs(o) * 2))
  // 开屏时按离中间远近错开出场。轻进场只淡入两侧，中间那张原样不动：
  // 从详情页返回时它是封面飞回的落点，带初始位移或透明度会飞到错的位置再跳一下
  const [rank] = useState(() => Math.round(Math.abs(wrap(j - pos.get(), n))))
  const initial = entrance === 'intro' ? { opacity: 0, y: rank ? 0 : 70, scale: rank ? 0.8 : 0.86 } : entrance === 'light' && rank ? { opacity: 0 } : false
  // 不让浏览器原生拖拽图片和链接，鼠标拖动才能用来切换
  const cover = <CoverImg src={m.thumbnailUrl} draggable={false} />
  // 悬停只认真的鼠标移动：点选后封面滑动、下一张滑到静止的光标下时，浏览器补发的进入事件没有位移，不算
  const hovering = useRef(false)
  useEffect(() => { hovering.current = false }, [center])
  return (
    <motion.div
      className="pointer-events-none absolute inset-0 [perspective:1400px]"
      style={{ zIndex }}
      initial={nativeEntrance() ? false : initial}
      animate={nativeEntrance() ? undefined : { opacity: 1, y: 0, scale: 1 }}
      transition={entrance === 'light' ? { duration: 0.5, delay: rank === 1 ? 0 : 0.06, ease: EASE } : { duration: rank ? 0.9 : 1, delay: rank === 0 ? 0.25 : rank === 1 ? 0.6 : 0.75, ease: EASE }}
      data-sfw={sfwAttr(m.source?.displayName)}
    >
      <motion.div data-fan-card={j} className="pointer-events-auto absolute top-0 left-1/2 -ml-[138px] h-[414px] w-[276px]" style={{ x, rotateY, scale, opacity }}>
        {center ? (
          <Link to={`/manga/${m.id}`} viewTransition draggable={false} data-hero-art-link aria-label={t('home.viewDetails', { title: m.title })} className="cv size-full rounded-[18px] shadow-[0_36px_70px_rgba(0,0,0,.38),0_0_0_1px_rgba(255,255,255,.08)]">
            {cover}
          </Link>
        ) : (
          <button
            type="button"
            onClick={onSelect}
            // 按住拖动时封面会从光标下滑过，也不算悬停
            onPointerMove={(e) => {
              if (hovering.current || e.pointerType !== 'mouse' || e.buttons || !(e.movementX || e.movementY)) return
              hovering.current = true
              onHover(true)
            }}
            onPointerLeave={() => {
              if (!hovering.current) return
              hovering.current = false
              onHover(false)
            }}
            aria-label={t('home.switchTo', { title: m.title })} className="cv size-full cursor-[inherit] rounded-[14px] shadow-[0_20px_40px_rgba(0,0,0,.2)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-text">
            {cover}
          </button>
        )}
      </motion.div>
    </motion.div>
  )
}

/** 指示条的一格：跟着 pos 连续变化，拖动途中就能看出正在往哪一部去 */
function Dot({ j, n, pos }: { j: number; n: number; pos: MotionValue<number> }) {
  const near = useTransform(pos, (p) => Math.max(0, 1 - Math.abs(wrap(j - p, n))))
  const width = useTransform(near, (v) => 6 + 16 * v)
  return (
    <motion.span className="relative h-1.5 overflow-hidden rounded-full bg-(--track)" style={{ width }}>
      <motion.span className="absolute inset-0 bg-text" style={{ opacity: near }} />
    </motion.span>
  )
}
