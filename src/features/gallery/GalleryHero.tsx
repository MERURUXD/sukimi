import { ArrowDown, ArrowRight, ChevronLeft, Share } from 'lucide-react'
import type { CSSProperties } from 'react'
import { Link } from 'react-router'
import { count } from '@/lib/format'
import { cn } from '@/lib/cn'
import { armReadMorph, plainClick } from './readMorph'
import { t } from '@/i18n'
import { monthName } from './dates'

export const GALLERY = '/library/gallery'

export const monthLabel = (d = new Date()) => t('gallery.monthLabel', { date: t('gallery.monthYear', { year: d.getFullYear(), month: monthName(d.getMonth()) }) })

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

/** 首页和画布过渡第一帧共用；占满一屏，全部作品默认收起。 */
export const HERO_BOX = 'relative flex h-svh min-h-[560px] flex-col pt-[var(--nav-h)] md:min-h-[680px]'

/**
 * 首屏文字与入口。画布过渡会在原位复制一份 decorative，再通过 --fade / --lift 淡出上移；
 * 这两个变量必须由各元素自身读取，不能放到带玻璃的祖先上。
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
  onShare,
}: {
  stats: HeroStats
  mobile: boolean
  decorative?: boolean
  intro?: boolean
  /** 从书库飞进来时：等封面上了墙再淡入。首页入口的文字由换页时间轴控制。 */
  late?: boolean
  /** 标题和首页橱窗里的是同一句，由换页动画位移过去（见 index.css 的 gallery-title），所以不再自己淡入 */
  morph?: boolean
  onBrowse?: () => void
  /** 来路决定返回动画：书库来路飞回原封面，首页来路收进首页取景窗。 */
  onBack?: () => void
  backLabel?: string
  onShare?: () => void
}) {
  const chapterText = stats.chapters == null ? '—' : count(stats.chapters)
  const nWorks = t('gallery.worksN', { count: stats.works, n: count(stats.works) })
  const nChapters = stats.chapters == null ? t('gallery.chaptersText', { n: chapterText }) : t('gallery.chaptersN', { count: stats.chapters, n: chapterText })
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
      {t('gallery.browseAll', { n: count(stats.shown ?? stats.works) })}
      <ArrowDown className={cn('size-4', onBrowse && !decorative && 'gallery-nudge')} strokeWidth={2} />
    </a>
  )
  const back = (
    <button type="button" tabIndex={tab} onClick={onBack} aria-label={backLabel} className="-ml-1 flex items-center gap-0.5 rounded-full py-1 pr-2 pl-0.5 font-medium text-muted hover:text-text">
      <ChevronLeft className="size-4" strokeWidth={2} />
      {t('gallery.back')}
    </button>
  )
  // 画布过渡的副本也要有；没有可露面作品时不能分享。
  const share = (stats.shown ?? stats.works) > 0 && (onShare || decorative) && (
    <button type="button" tabIndex={tab} onClick={onShare} className="flex items-center gap-1 rounded-full px-2 py-1 font-medium text-muted hover:text-text">
      <Share className="size-[15px]" strokeWidth={2} />
      {t('gallery.share')}
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
      {t('gallery.enterCanvas')}
      {!mobile && <ArrowRight className="size-[18px]" strokeWidth={2} />}
    </Link>
  )
  if (mobile) {
    return (
      <div data-hero-ui className="wrap mt-auto flex flex-col gap-3 pb-[calc(var(--tabbar-h)+14px)]" aria-hidden={decorative || undefined} inert={decorative || undefined}>
        <div data-hero-fade data-gallery-copy="meta" className={cn('flex items-center gap-3 text-xs', fx)}>
          {back}
          <p className="m-0 font-medium tracking-[.3em] text-muted">{t('gallery.name')}</p>
          {share}
        </div>
        <h1 className={cn('gallery-title m-0 font-cjk text-[34px] leading-[1.06] font-black tracking-[-0.02em]', titleFx)} style={d(40)}>
          {t('gallery.slogan1')}
          <br />
          {t('gallery.slogan2')}
        </h1>
        <p data-hero-fade data-gallery-copy="summary" className={cn('m-0 text-sm text-muted num', fx)} style={d(80)}>
          {[nWorks, nChapters, t('gallery.doneN', { n: count(stats.done) })].join(' · ')}
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
          {share}
        </div>
        <h1 className={cn('gallery-title m-0 font-cjk text-[clamp(44px,5.2vw,84px)] leading-[1.06] font-black tracking-[-0.02em]', titleFx)} style={d(40)}>
          {t('gallery.slogan1')}
          <br />
          {t('gallery.slogan2')}
        </h1>
        <p data-hero-fade data-gallery-copy="summary" className={cn('m-0 text-[17px] text-muted num', fx)} style={d(80)}>
          {[nWorks, nChapters, t('gallery.ongoingN', { n: count(stats.ongoing) }), t('gallery.doneN', { n: count(stats.done) })].join(' · ')}
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

/** 点击后数字由换页动画飞到档案页（见 readMorph）。 */
function ReadDoor({ read, mobile, decorative, className, style }: { read: number | null; mobile: boolean; decorative?: boolean; className?: string; style?: CSSProperties }) {
  const value = read == null ? '—' : count(read)
  return (
    <Link
      to={`${GALLERY}/stats`}
      state={{ from: 'gallery' }}
      viewTransition
      tabIndex={decorative ? -1 : undefined}
      aria-label={t('gallery.readAria', { count: read ?? 0, n: value })}
      data-hero-fade
      data-gallery-copy="read"
      onClick={(e) => plainClick(e) && armReadMorph()}
      className={cn('group relative flex flex-none flex-col text-text no-underline', mobile ? 'items-end gap-0.5' : 'items-end gap-1.5', className)}
      style={style}
    >
      {!mobile && <ClockHint />}
      <span className={cn('font-medium text-muted', mobile ? 'text-[11px] tracking-[.2em]' : 'text-[13px] tracking-[.32em]')}>{t('gallery.readChapters')}</span>
      <span className="flex items-baseline gap-1.5">
        {/* 只给数字本身挂过渡名：两页的数字字体一样，飞的时候不变形 */}
        <span
          data-gallery-read={decorative ? undefined : ''}
          className={cn('leading-[.95] font-bold tracking-[-0.045em] num', mobile ? 'text-[34px]' : 'text-[clamp(64px,7.4vw,120px)]')}
        >
          {value}
        </span>
        <span className={cn('font-cjk font-bold text-muted', mobile ? 'text-sm' : 'text-xl')}>{t('gallery.unit.chapter', { count: read ?? 0 })}</span>
      </span>
      <span className={cn('flex items-center gap-1.5 font-semibold', mobile ? 'text-[13px]' : 'text-[15px]')}>
        {t('gallery.archive')}
        <ArrowRight className="size-4 transition-transform duration-350 ease-spring-fast group-hover:translate-x-1" strokeWidth={2} />
      </span>
    </Link>
  )
}

function ClockHint() {
  return (
    <svg
      aria-hidden
      viewBox="-150 -150 300 300"
      className="pointer-events-none absolute top-1/2 left-1/2 -z-10 size-[320px] -translate-x-1/2 -translate-y-1/2 scale-90 -rotate-12 opacity-0 [transition:opacity_300ms_cubic-bezier(0.2,0,0,1),scale_var(--spring-slow-duration)_var(--spring-slow-ease),rotate_var(--spring-slow-duration)_var(--spring-slow-ease)] group-hover:scale-100 group-hover:rotate-0 group-hover:opacity-100 group-focus-visible:scale-100 group-focus-visible:rotate-0 group-focus-visible:opacity-100"
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

export const HERO_VIGNETTE = {
  desktop:
    'radial-gradient(ellipse 66% 54% at 50% 42%, color-mix(in srgb, var(--bg) 10%, transparent) 0%, color-mix(in srgb, var(--bg) 42%, transparent) 64%, color-mix(in srgb, var(--bg) 72%, transparent) 100%), linear-gradient(180deg, color-mix(in srgb, var(--bg) 35%, transparent) 0%, transparent 18%, transparent 44%, color-mix(in srgb, var(--bg) 76%, transparent) 74%, var(--bg) 100%)',
  mobile:
    'linear-gradient(180deg, color-mix(in srgb, var(--bg) 35%, transparent) 0%, color-mix(in srgb, var(--bg) 8%, transparent) 20%, color-mix(in srgb, var(--bg) 22%, transparent) 48%, color-mix(in srgb, var(--bg) 90%, transparent) 78%, var(--bg) 100%)',
}
