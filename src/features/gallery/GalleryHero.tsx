import { ArrowDown, ArrowRight, ChevronLeft } from 'lucide-react'
import type { CSSProperties } from 'react'
import { Link } from 'react-router'
import { count } from '@/lib/format'
import { cn } from '@/lib/cn'
import { armReadMorph, plainClick } from './readMorph'

export const GALLERY = '/library/gallery'

export const monthLabel = (d = new Date()) => `书库画廊 · ${d.getFullYear()} 年 ${d.getMonth() + 1} 月`

export interface HeroStats {
  works: number
  chapters: number | null
  /** 已读话数；总话数还没到时为 null */
  read: number | null
  ongoing: number
  done: number
  /** 墙上和全部作品里能看到的部数（去掉 NSFW）；数字统计仍按 works */
  shown?: number
}

/** 首屏封面墙区域的类名：首页和画布过渡的第一帧共用，两边排版才完全一致。占满一屏：下面的全部作品默认收起 */
export const HERO_BOX = 'relative flex h-svh min-h-[560px] flex-col pt-[var(--nav-h)] md:min-h-[680px]'

/**
 * 首屏的文字和两扇「门」，直接放在封面墙上，不再套玻璃面板：
 * 左边是标题和「进入画布」，右边是大号的已读话数，点它进阅读档案（数字会飞过去变成档案页的主角）。
 * 手机上是左下角的一段文字，两扇门并排在最下面。
 *
 * 画布的进入过渡会在原位置摆出同一份（decorative），再让它淡出、上移。透明度和位移由外层的
 * CSS 变量 --fade、--lift 给出，只读在每个元素自身上（和画布上其他界面的写法一致）。
 */
export function HeroCopy({
  stats,
  mobile,
  decorative,
  intro,
  late,
  morph,
  onBrowse,
  onBack,
  backLabel,
}: {
  stats: HeroStats
  mobile: boolean
  decorative?: boolean
  intro?: boolean
  /** 从书库飞进来时：等封面上了墙再淡入。首页入口的文字由换页时间轴控制。 */
  late?: boolean
  /** 标题和首页橱窗里的是同一句，由换页动画位移过去（见 index.css 的 gallery-title），所以不再自己淡入 */
  morph?: boolean
  /** 点「浏览全部」切到全部作品那一页 */
  onBrowse?: () => void
  /** 返回来路（从书库来的，墙上那块封面飞回书库的原位；从首页来的回首页） */
  onBack?: () => void
  /** 返回键的无障碍名称，按来路写「返回首页」或「返回书库」 */
  backLabel?: string
}) {
  const chapterText = stats.chapters == null ? '—' : count(stats.chapters)
  const base = decorative && '[opacity:var(--fade,1)] [translate:0_var(--lift,0px)]'
  const fx = cn(base, late ? 'gallery-late' : intro && 'rise')
  const titleFx = morph ? cn(base) : fx
  const d = (ms: number) => ({ '--d': `${ms}ms` }) as CSSProperties
  const tab = decorative ? -1 : undefined
  const browse = (
    <a
      href="#all"
      tabIndex={tab}
      onClick={(e) => {
        if (!onBrowse) return
        e.preventDefault()
        onBrowse()
      }}
      className={cn('flex items-center gap-1.5 font-medium text-muted no-underline hover:text-text', mobile ? 'text-[13px]' : 'text-sm')}
    >
      浏览全部 {count(stats.shown ?? stats.works)} 部
      <ArrowDown className={cn('size-4', onBrowse && !decorative && 'gallery-nudge')} strokeWidth={2} />
    </a>
  )
  // 返回：放在最上面那行小字前面，不抢两扇门的风头
  const back = (
    <button type="button" tabIndex={tab} onClick={onBack} aria-label={backLabel} className="-ml-1 flex items-center gap-0.5 rounded-full py-1 pr-2 pl-0.5 font-medium text-muted hover:text-text">
      <ChevronLeft className="size-4" strokeWidth={2} />
      返回
    </button>
  )
  const door = <ReadDoor read={stats.read} mobile={mobile} decorative={decorative} className={fx} style={d(mobile ? 120 : 160)} />
  const canvas = (
    <Link
      to={`${GALLERY}/canvas`}
      state={{ from: 'gallery' }}
      data-enter-canvas
      tabIndex={tab}
      className={cn('solid no-underline', mobile ? 'h-[46px] min-h-0 px-[22px] text-[15px]' : 'h-[52px] text-base')}
    >
      进入画布
      {!mobile && <ArrowRight className="size-[18px]" strokeWidth={2} />}
    </Link>
  )
  if (mobile) {
    return (
      // 底部留出标签栏的高度：首屏占满一屏，标签栏浮在上面
      <div data-hero-ui className="wrap mt-auto flex flex-col gap-3 pb-[calc(var(--tabbar-h)+14px)]" aria-hidden={decorative || undefined} inert={decorative || undefined}>
        <div data-hero-fade data-gallery-copy="meta" className={cn('flex items-center gap-3 text-xs', fx)}>
          {back}
          <p className="m-0 font-medium tracking-[.3em] text-muted">书库画廊</p>
        </div>
        <h1 className={cn('gallery-title m-0 font-cjk text-[34px] leading-[1.06] font-black tracking-[-0.02em]', titleFx)} style={d(40)}>
          每一部收藏，
          <br />
          都在这面墙上。
        </h1>
        <p data-hero-fade data-gallery-copy="summary" className={cn('m-0 text-sm text-muted num', fx)} style={d(80)}>
          {count(stats.works)} 部作品 · {chapterText} 话 · {count(stats.done)} 部已完结
        </p>
        <div className="mt-1 flex items-center justify-between gap-4">
          <span data-hero-fade data-gallery-copy="actions" className={fx} style={d(120)}>
            {canvas}
          </span>
          {door}
        </div>
        <div data-hero-fade data-gallery-copy="browse" className={cn('flex justify-center pt-1', fx)} style={d(160)}>
          {browse}
        </div>
      </div>
    )
  }
  return (
    <div
      data-hero-ui
      className="wrap mt-auto flex flex-wrap items-end justify-between gap-x-16 gap-y-10 pb-[clamp(40px,7vh,76px)]"
      aria-hidden={decorative || undefined}
      inert={decorative || undefined}
    >
      <div className="flex max-w-[660px] flex-col gap-5">
        <div data-hero-fade data-gallery-copy="meta" className={cn('flex items-center gap-4 text-[13px]', fx)}>
          {back}
          <p className="m-0 font-medium tracking-[.32em] text-muted">{monthLabel()}</p>
        </div>
        <h1 className={cn('gallery-title m-0 font-cjk text-[clamp(44px,5.2vw,84px)] leading-[1.06] font-black tracking-[-0.02em]', titleFx)} style={d(40)}>
          每一部收藏，
          <br />
          都在这面墙上。
        </h1>
        <p data-hero-fade data-gallery-copy="summary" className={cn('m-0 text-[17px] text-muted num', fx)} style={d(80)}>
          {count(stats.works)} 部作品 · {chapterText} 话 · {count(stats.ongoing)} 部连载中 · {count(stats.done)} 部已完结
        </p>
        <div data-hero-fade data-gallery-copy="actions" className={cn('mt-2 flex items-center gap-7', fx)} style={d(120)}>
          {canvas}
          {browse}
        </div>
      </div>
      {door}
    </div>
  )
}

/**
 * 阅读档案的入口：大号的已读话数。悬停时背后画出一圈时钟刻度，预告点进去是什么样子；
 * 点下去，这个数字飞成档案页的大数字（换页动画，见 readMorph）。
 */
function ReadDoor({ read, mobile, decorative, className, style }: { read: number | null; mobile: boolean; decorative?: boolean; className?: string; style?: CSSProperties }) {
  const value = read == null ? '—' : count(read)
  return (
    <Link
      to={`${GALLERY}/stats`}
      state={{ from: 'gallery' }}
      viewTransition
      tabIndex={decorative ? -1 : undefined}
      aria-label={`阅读档案：已读 ${value} 话`}
      data-hero-fade
      data-gallery-copy="read"
      onClick={(e) => plainClick(e) && armReadMorph()}
      className={cn('group relative flex flex-none flex-col text-text no-underline', mobile ? 'items-end gap-0.5' : 'items-end gap-1.5', className)}
      style={style}
    >
      {!mobile && <ClockHint />}
      <span className={cn('font-medium text-muted', mobile ? 'text-[11px] tracking-[.2em]' : 'text-[13px] tracking-[.32em]')}>已读章节</span>
      <span className="flex items-baseline gap-1.5">
        {/* 只给数字本身挂过渡名：两页的数字字体一样，飞的时候不变形 */}
        <span
          data-gallery-read={decorative ? undefined : ''}
          className={cn('leading-[.95] font-bold tracking-[-0.045em] num', mobile ? 'text-[34px]' : 'text-[clamp(64px,7.4vw,120px)]')}
        >
          {value}
        </span>
        <span className={cn('font-cjk font-bold text-muted', mobile ? 'text-sm' : 'text-xl')}>话</span>
      </span>
      <span className={cn('flex items-center gap-1.5 font-semibold', mobile ? 'text-[13px]' : 'text-[15px]')}>
        阅读档案
        <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" strokeWidth={2} />
      </span>
    </Link>
  )
}

/** 悬停时在数字背后画出的一圈时钟刻度（阅读档案的阅读时钟） */
function ClockHint() {
  return (
    <svg
      aria-hidden
      viewBox="-150 -150 300 300"
      className="pointer-events-none absolute top-1/2 left-1/2 -z-10 size-[320px] -translate-x-1/2 -translate-y-1/2 scale-90 -rotate-12 opacity-0 transition-[opacity,scale,rotate] duration-700 ease-[cubic-bezier(.2,.8,.2,1)] group-hover:scale-100 group-hover:rotate-0 group-hover:opacity-100 group-focus-visible:scale-100 group-focus-visible:rotate-0 group-focus-visible:opacity-100"
    >
      <circle r="138" fill="none" stroke="currentColor" strokeOpacity=".18" strokeDasharray="2 6" />
      {Array.from({ length: 24 }, (_, h) => (
        <line key={h} y1={-104} y2={h % 6 ? -114 : -122} stroke="currentColor" strokeOpacity={h % 6 ? 0.22 : 0.5} strokeWidth="3" strokeLinecap="round" transform={`rotate(${h * 15})`} />
      ))}
    </svg>
  )
}

/** 从画廊首页带进画布的首屏位置（视口坐标），画布第一帧按它摆放 */
export interface HeroLayout {
  left: number
  top: number
  width: number
  height: number
}

/** 首屏的暗角：中间透出墙，四周和上下压到底色；文字压在下方，下半部分压得更深。桌面和手机各一种 */
export const HERO_VIGNETTE = {
  desktop:
    'radial-gradient(ellipse 62% 50% at 50% 40%, color-mix(in srgb, var(--bg) 12%, transparent) 0%, color-mix(in srgb, var(--bg) 55%, transparent) 62%, color-mix(in srgb, var(--bg) 92%, transparent) 100%), linear-gradient(180deg, color-mix(in srgb, var(--bg) 55%, transparent) 0%, transparent 20%, transparent 42%, color-mix(in srgb, var(--bg) 78%, transparent) 72%, var(--bg) 100%)',
  mobile:
    'linear-gradient(180deg, color-mix(in srgb, var(--bg) 55%, transparent) 0%, color-mix(in srgb, var(--bg) 10%, transparent) 22%, color-mix(in srgb, var(--bg) 25%, transparent) 48%, color-mix(in srgb, var(--bg) 92%, transparent) 80%, var(--bg) 100%)',
}
