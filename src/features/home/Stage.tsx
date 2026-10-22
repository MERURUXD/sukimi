import { useDrag } from '@use-gesture/react'
import { animate, AnimatePresence, motion, useMotionValue, useReducedMotion, useTransform, type MotionValue } from 'motion/react'
import { Download, Play, Shuffle } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type WheelEvent } from 'react'
import { Link, useHref, useNavigate } from 'react-router'
import { Can } from '@/features/auth/Can'
import { Glass } from '@/components/glass/Glass'
import { CoverImg } from '@/components/manga/CoverImg'
import { spring } from '@/design/motion'
import { useAppearance } from '@/design/settings'
import { cn } from '@/lib/cn'
import { sfwAttr } from '@/lib/devSafe'
import { sec, timeAgo } from '@/lib/format'
import type { ReadChapter } from './queries'

/** 打开网页时的路径。开屏动画只在首页就是第一页时播一次，从别的页回来不播 */
const bootPath = location.pathname
let introPlayed = false
/** 首页大图区已经显示过内容（任一布局）：之后再换到舞台（例如窗口从手机宽度拉宽）也不播 */
export const markIntroPlayed = () => { introPlayed = true }

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
    const measure = () => {
      const f = fitOf()
      setFit(f)
      spread.set(Math.max(0.5, Math.min(1, (el.clientWidth / f / 2 - 16 - 105) / POSES[2].x)))
    }
    measure()
    const ro = new ResizeObserver(measure)
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

interface Target { id: number; label: string; page: string; pct: number | null; isNext: boolean }

/**
 * 桌面首页「舞台」：在读的几部排成扇形，当前这部在中间，左右切换；背景沿用流动模糊封面。
 * 冷启动时封面从中间展开、文字依次出现（开屏动画，可在外观设置关闭）。
 */
export function Stage({ items, active, onSelect, onShuffle, onDownload, background, target, meta }: {
  items: ReadChapter[]
  active: number
  onSelect: (i: number) => void
  onShuffle?: () => void
  onDownload: () => void
  background: ReactNode
  target: Target | null
  meta: string
}) {
  const reduced = useReducedMotion()
  const introOn = useAppearance((s) => s.homeIntro)
  const [intro] = useState(() => introOn && !reduced && !introPlayed && location.pathname === bootPath)
  // 开屏动画播完前用它的时间线，之后切换都用弹簧
  const [entering, setEntering] = useState(intro)
  useEffect(() => {
    if (!entering) return
    const t = setTimeout(() => setEntering(false), 2400)
    return () => clearTimeout(t)
  }, [entering])

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
  const fan = useMotionValue(intro ? 0 : 1)
  useEffect(() => {
    if (intro) animate(fan, 1, { duration: 0.9, delay: 0.6, ease: EASE })
  }, [intro, fan])
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
    pos.stop()
    pos.set(pos.get() + e.deltaX / step())
    clearTimeout(wheelTimer.current)
    wheelTimer.current = window.setTimeout(() => settle(pos.get()), 140)
  }
  // 开屏时各元素依次上浮（.rise，见 index.css），d 为延迟秒数
  const delay = (d: number) => (entering ? { '--d': `${d}s` } as CSSProperties : undefined)

  return (
    <section aria-label="继续阅读" className="relative isolate -mt-[var(--nav-h)] pt-[var(--nav-h)]" data-desktop-layout="stage" data-sfw={sfwAttr(m.source?.displayName)}>
      {/* 背景：流动模糊封面原样保留；开屏时整体淡入并从略大缩回 */}
      <motion.div
        aria-hidden
        className="absolute inset-x-0 top-0 bottom-0.5 -z-20 overflow-hidden"
        initial={intro ? { opacity: 0, scale: 1.12 } : false}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.4, ease: EASE }}
      >
        {background}
      </motion.div>
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
              <FanCard key={c.manga.id} c={c} j={j} n={n} center={j === active} pos={pos} fan={fan} spread={spread} intro={intro} onSelect={() => onSelect(j)} />
            ))}
          </div>
        </div>

        {n > 1 && (
          <div aria-hidden style={delay(0.95)} className={cn('flex items-center gap-1.5', entering && 'rise')}>
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
              <span style={delay(0.85)} className={cn('text-[13px] font-bold tracking-[.12em] text-muted', entering && 'rise')}>继续阅读 · {timeAgo(sec(cur.lastReadAt))}</span>
              <h1 title={m.title} style={delay(0.92)} className={cn('m-0 line-clamp-2 font-cjk text-[46px] font-black tracking-[-.02em] text-balance break-words xl:text-[60px]', m.title.length > 22 && 'text-[36px] xl:text-[40px]', m.title.length > 40 && 'text-[28px] xl:text-[32px]',
                // 行高放在字号之后：tailwind-merge 换字号时会把前面的行高一起去掉
                'leading-[1.12]', entering && 'rise')}>{m.title}</h1>
              <span style={delay(1)} className={cn('max-w-full truncate text-[15px] text-muted num', entering && 'rise')}>
                {[meta, target && `${target.isNext ? '接着读 · ' : ''}${target.label} · ${target.page}`].filter(Boolean).join(' · ')}
              </span>
              {target?.pct != null && (
                <span style={delay(1.08)} className={cn('prog mt-1 w-[300px] max-w-[80%]', entering && 'rise')}>
                  <motion.i initial={entering ? { width: 0 } : false} animate={{ width: `${target.pct}%` }} transition={{ duration: 1.1, delay: entering ? 1.35 : 0, ease: EASE }} />
                </span>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
        {/* 按钮不随作品淡出淡入：都是玻璃，父元素带透明度会让它们采不到背景 */}
        <div data-home-actions style={delay(1.15)} className={cn('flex flex-wrap items-center justify-center gap-3', entering && 'rise-each')}>
          {target ? (
            <Link to={`/manga/${m.id}/chapter/${target.id}`} viewTransition className="solid h-[54px] px-[30px] text-base no-underline">
              <Play className="size-4 fill-current" strokeWidth={1.6} />
              继续阅读
            </Link>
          ) : (
            <span className="solid h-[54px] px-[30px] text-base opacity-60">已全部读完</span>
          )}
          <Glass
            as="a"
            href={detailHref}
            className="gbtn h-[54px] rounded-full px-6 text-[15px] no-underline"
            onClick={(e) => {
              if (e.ctrlKey || e.metaKey || e.shiftKey) return
              e.preventDefault()
              navigate(`/manga/${m.id}`, { viewTransition: true })
            }}
          >
            漫画详情
          </Glass>
          <Can permission="DOWNLOAD_CHAPTERS">
            <Glass as="button" type="button" className="gicon size-[54px] rounded-full" onClick={onDownload} aria-label="下载后续章节" title="下载后续章节">
              <Download className="size-5" strokeWidth={1.8} />
            </Glass>
          </Can>
          {onShuffle && (
            <Glass as="button" type="button" className="gicon size-[54px] rounded-full" onClick={onShuffle} aria-label="换一批继续阅读" title="换一批">
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
function FanCard({ c, j, n, center, pos, fan, spread, intro, onSelect }: {
  c: ReadChapter
  j: number
  n: number
  center: boolean
  pos: MotionValue<number>
  fan: MotionValue<number>
  spread: MotionValue<number>
  intro: boolean
  onSelect: () => void
}) {
  const m = c.manga
  const off = useTransform(pos, (p) => wrap(j - p, n))
  const x = useTransform([off, fan, spread], ([o, f, s]: number[]) => poseAt(o, n).x * s * f)
  const rotateY = useTransform([off, fan], ([o, f]: number[]) => poseAt(o, n).rotateY * f)
  const scale = useTransform([off, fan], ([o, f]: number[]) => 1 - (1 - poseAt(o, n).scale) * f)
  const opacity = useTransform(off, (o) => poseAt(o, n).opacity)
  const zIndex = useTransform(off, (o) => 10 - Math.round(Math.abs(o) * 2))
  // 开屏时按离中间远近错开出场
  const [rank] = useState(() => Math.round(Math.abs(wrap(j - pos.get(), n))))
  // 不让浏览器原生拖拽图片和链接，鼠标拖动才能用来切换
  const cover = <CoverImg src={m.thumbnailUrl} draggable={false} />
  return (
    <motion.div
      className="pointer-events-none absolute inset-0 [perspective:1400px]"
      style={{ zIndex }}
      initial={intro ? { opacity: 0, y: rank ? 0 : 70, scale: rank ? 0.8 : 0.86 } : false}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: rank ? 0.9 : 1, delay: rank === 0 ? 0.25 : rank === 1 ? 0.6 : 0.75, ease: EASE }}
      data-sfw={sfwAttr(m.source?.displayName)}
    >
      <motion.div className="pointer-events-auto absolute top-0 left-1/2 -ml-[138px] h-[414px] w-[276px]" style={{ x, rotateY, scale, opacity }}>
        {center ? (
          <Link to={`/manga/${m.id}`} viewTransition draggable={false} data-hero-art-link aria-label={`查看《${m.title}》详情`} className="cv size-full rounded-[18px] shadow-[0_36px_70px_rgba(0,0,0,.38),0_0_0_1px_rgba(255,255,255,.08)]">
            {cover}
          </Link>
        ) : (
          <button type="button" onClick={onSelect} aria-label={`切换到《${m.title}》`} className="cv size-full cursor-[inherit] rounded-[14px] shadow-[0_20px_40px_rgba(0,0,0,.2)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-text">
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
