import { useApolloClient, useQuery } from '@apollo/client/react'
import { BookOpen, ChevronLeft, ChevronRight, Maximize, Minimize, Pause, Play, Share, Timer, X } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { Link } from 'react-router'
import { Glass } from '@/components/glass/Glass'
import { MovingGlassBackdrop } from '@/components/glass/MovingGlassBackdrop'
import { useSoftCover } from './softCover'
import { CoverImg } from '@/components/manga/CoverImg'
import { useAppearance } from '@/design/settings'
import { inCategory } from '@/features/library/category'
import type { LibraryManga } from '@/features/library/queries'
import { STATUS } from '@/features/manga/status'
import { useNsfw } from '@/features/nsfw/useNsfw'
import { count } from '@/lib/format'
import { cn } from '@/lib/cn'
import { GlassLink } from '@/components/glass/GlassLink'
import { poseTransform, tileTransform, type Pose, type TilePose } from './coverPose'
import type { useGalleryLibrary } from './hooks'
import { PosterShare } from './PosterShare'
import { GalleryPeek } from './queries'
import { hfit, mostlyLatin, vfit } from './titleFit'
import './gallery.css'
import { t as tl } from '@/i18n'

/** 封面卡片静止时的姿态，和进场动画（gallery-card）的终点一致 */
const CARD_REST = 'perspective(1400px) rotateY(16deg) rotateZ(-3deg)'
/** 同一个静止姿态写成和格子姿态同一串变换函数，飞进飞出时才能逐项插值 */
const CARD_POSE: Pose = { dx: 0, dy: 0, z: 0, ry: 16, rx: 0, rz: -3, s: 1 }
const CARD_PERSPECTIVE = 1400

/** 可选的切换间隔（秒） */
const INTERVALS = [5, 7, 10, 15]
/** 底部刻度最多显示这么多根，书多时只显示当前前后的一段 */
const MAX_TICKS = 48

/** 退出时淡出的界面元素。标在各个元素自身：玻璃的祖先不能带透明度 */
const UI = { 'data-play-ui': '' }

/** 怎么进的放映 */
export interface PlayEntry {
  /** 从第几部开始（作品 id） */
  id: number
  /** 从画布哪一格飞进来；直接打开网址时没有 */
  tile: TilePose | null
  /** 从作品详情页返回：封面由换页动画飞回，卡片直接停在原位 */
  restored?: boolean
}

type Category = ReturnType<typeof useGalleryLibrary>['categories'][number]

/**
 * 放映：自动轮播整个书库，给电视和大屏用。叠在画布上面，不另开页面：
 * 进出放映时封面在同一个页面里直接从画布那一格飞出、飞回，不靠换页动画（格子在 3D 透视里，换页动画接不住）。
 * 编号和顺序与画布一致。手机上只显示说明。
 */
export function PlayView({
  items,
  totals,
  categories,
  shelf,
  entry,
  closing,
  landing,
  tileW,
  mobile,
  reduced,
  onCurrent,
  onExit,
  onClosed,
  onCovered,
}: {
  items: readonly LibraryManga[]
  totals: ReadonlyMap<number, number> | null
  categories: readonly Category[]
  shelf: ReadonlySet<number>
  entry: PlayEntry
  /** 正在退出：界面淡出，封面飞回 landing 那一格 */
  closing: boolean
  landing: TilePose | null
  /** 画布格子的宽度 */
  tileW: number
  mobile: boolean
  reduced: boolean
  /** 当前放到哪一部，退出时画布把这一部摆到中心 */
  onCurrent: (id: number) => void
  onExit: () => void
  onClosed: () => void
  onCovered: (covered: boolean) => void
}) {
  const n = items.length
  const client = useApolloClient()
  const interval = useAppearance((s) => s.galleryInterval)
  const setInterval_ = useAppearance((s) => s.setGalleryInterval)

  const [idx, setIdx] = useState(() => Math.max(0, items.findIndex((m) => m.id === entry.id)))
  const [prev, setPrev] = useState(-1)
  // 换一部时轮换的序号，用作 key 让进场动画重播
  const [turn, setTurn] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [open, setOpen] = useState(true)
  const root = useRef<HTMLDivElement>(null)
  const card = useRef<HTMLAnchorElement | null>(null)
  const cur = n ? items[idx % n] : undefined
  const next = n ? items[(idx + 1) % n] : undefined
  const before = prev >= 0 && n ? items[prev % n] : undefined
  const flying = !!entry.tile && !reduced && !mobile
  // 背景：从画布飞进来时从封面卡片的位置圆形展开，退出时收回屏幕中心那一格
  const [revealed, setRevealed] = useState(!flying)
  const hasItem = !!cur
  // 分享这一部（见 openShare）
  const { test } = useNsfw()
  const [shareWork, setShareWork] = useState<LibraryManga | null>(null)
  const [sharing, setSharing] = useState(false)
  const resume = useRef(false)

  useEffect(() => {
    // 圆形揭幕后画布才被完整盖住；关闭前先恢复，反向收回时仍能看见原来的画布。
    const timer = (mobile || hasItem) && revealed && !closing ? window.setTimeout(() => onCovered(true), mobile || reduced ? 0 : 1450) : 0
    return () => { window.clearTimeout(timer); onCovered(false) }
  }, [hasItem, mobile, revealed, closing, reduced, onCovered])

  useEffect(() => {
    if (cur) onCurrent(cur.id)
  }, [cur, onCurrent])

  const idxRef = useRef(idx)
  idxRef.current = idx
  const go = useCallback(
    (i: number) => {
      if (!n) return
      const to = ((i % n) + n) % n
      if (to === idxRef.current) return
      setPrev(idxRef.current)
      setIdx(to)
      setTurn((t) => t + 1)
      // 新画面先收成一个点，下一帧再从左侧封面卡片的位置圆形展开
      setOpen(reduced)
    },
    [n, reduced],
  )
  useLayoutEffect(() => {
    if (open) return
    let r2 = 0
    const r1 = requestAnimationFrame(() => (r2 = requestAnimationFrame(() => setOpen(true))))
    return () => {
      cancelAnimationFrame(r1)
      cancelAnimationFrame(r2)
    }
  }, [open])

  /* 飞进来：卡片先叠在画布那一格上，再飞到左侧；背景随后展开 */
  useLayoutEffect(() => {
    const el = card.current
    if (!flying || !el || !entry.tile) return
    const a = el.animate([{ transform: tileTransform(el, entry.tile, tileW) }, { transform: poseTransform(el, CARD_PERSPECTIVE, CARD_POSE) }], {
      duration: 900,
      easing: 'cubic-bezier(.2,.8,.2,1)',
    })
    let r2 = 0
    const r1 = requestAnimationFrame(() => (r2 = requestAnimationFrame(() => setRevealed(true))))
    return () => {
      a.cancel()
      cancelAnimationFrame(r1)
      cancelAnimationFrame(r2)
    }
    // 只在挂上时飞一次
  }, [])

  /* 退出：界面淡出，背景收起，卡片飞回画布中心那一格，落地后收起放映 */
  useEffect(() => {
    if (!closing) return
    const fade = { duration: reduced ? 0 : 260, easing: 'ease-out', fill: 'forwards' } as const
    root.current?.querySelectorAll<HTMLElement>('[data-play-ui]').forEach((el) => el.animate([{ opacity: getComputedStyle(el).opacity }, { opacity: 0 }], fade))
    const el = card.current
    if (!el || reduced || mobile || !landing) {
      const t = setTimeout(onClosed, reduced || mobile ? 0 : 420)
      return () => clearTimeout(t)
    }
    // 换一部时卡片可能还在自己的进场动画里，先停掉，从静止姿态起飞
    el.style.animation = 'none'
    el.style.opacity = '1'
    const a = el.animate([{ transform: poseTransform(el, CARD_PERSPECTIVE, CARD_POSE) }, { transform: tileTransform(el, landing, tileW) }], {
      duration: 700,
      easing: 'cubic-bezier(.4,0,.2,1)',
      fill: 'forwards',
    })
    let done = false
    const end = () => {
      if (done) return
      done = true
      onClosed()
    }
    void a.finished.then(end, () => {})
    // 标签页在后台时动画不一定按时结束，到时间照样收起
    const t = setTimeout(end, 900)
    return () => {
      done = true
      clearTimeout(t)
    }
  }, [closing, landing, reduced, mobile, tileW, onClosed])

  /* 自动切换：每部停 interval 秒；暂停时记下剩余时间，继续时接着走（进度条和推镜用 CSS 动画，暂停同步停住） */
  const remaining = useRef(interval * 1000)
  useEffect(() => {
    remaining.current = interval * 1000
  }, [turn, interval])
  useEffect(() => {
    if (!playing || closing || n < 2) return
    const started = performance.now()
    const timer = setTimeout(() => go(idx + 1), remaining.current)
    return () => {
      clearTimeout(timer)
      remaining.current = Math.max(0, remaining.current - (performance.now() - started))
    }
  }, [playing, closing, idx, n, go, turn, interval])

  // 预取下一部的简介和封面，切过去时不闪
  useEffect(() => {
    if (!next) return
    void client.query({ query: GalleryPeek, variables: { id: next.id } }).catch(() => {})
    if (next.thumbnailUrl) new Image().src = next.thumbnailUrl
  }, [client, next])

  /* 全屏：照阅读器的写法，用整个页面进入全屏 */
  const [fullscreen, setFullscreen] = useState(!!document.fullscreenElement)
  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void document.documentElement.requestFullscreen().catch(() => {})
  }, [])
  useEffect(() => {
    const on = () => setFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', on)
    return () => document.removeEventListener('fullscreenchange', on)
  }, [])

  /* 键盘：← → 切换，空格暂停 / 继续，F 全屏，Esc 退出 */
  useEffect(() => {
    if (closing) return
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.target instanceof HTMLInputElement) return
      if (e.key === 'ArrowLeft') go(idx - 1)
      else if (e.key === 'ArrowRight') go(idx + 1)
      else if (e.key === ' ') {
        // 焦点在按钮上时空格本来会点按钮，这里统一当作暂停 / 继续
        setPlaying((p) => !p)
      } else if (e.key === 'f' || e.key === 'F') toggleFullscreen()
      else if (e.key === 'Escape' && !document.fullscreenElement) onExit()
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, idx, toggleFullscreen, closing, onExit])

  const peek = useQuery(GalleryPeek, { variables: { id: cur?.id ?? 0 }, skip: !cur })
  const description = peek.data?.manga.id === cur?.id ? peek.data?.manga.description : undefined
  const firstUnread = peek.data?.manga.id === cur?.id ? peek.data?.manga.firstUnreadChapter?.id : undefined

  const defaultId = categories.find((c) => c.default)?.id ?? 0
  const categoryOf = (m: LibraryManga) => {
    const c = categories.find((c) => inCategory(m, c.id, defaultId, shelf))
    return c ? (c.default ? tl('gallery.default') : c.name) : ''
  }
  const pad = (i: number) => String(i + 1).padStart(2, '0')
  const dur = { '--dur': `${interval}s` } as CSSProperties

  if (mobile) {
    return (
      <div role="dialog" aria-modal aria-label={tl('gallery.play.mode')} className="absolute inset-0 z-30 grid place-items-center bg-bg p-6 text-center">
        <div className="flex flex-col items-center gap-4">
          <p className="m-0 text-muted">{tl('gallery.play.desktopOnly')}</p>
          <button type="button" className="solid" onClick={onExit}>
            {tl('gallery.backToCanvas')}
          </button>
        </div>
      </div>
    )
  }

  /*
   * 分享这一部：打开时记下当前那一部并暂停放映，面板里的海报不会被自动切换换掉；关上后恢复原来的播放状态。
   * NSFW 作品（临时显示时也会出现在放映里）不给分享入口
   */
  const openShare = () => {
    if (!cur) return
    resume.current = playing
    setShareWork(cur)
    setSharing(true)
    setPlaying(false)
  }
  const closeShare = () => {
    setSharing(false)
    setPlaying(resume.current)
  }

  const cycle = () => setInterval_(INTERVALS[(INTERVALS.indexOf(interval) + 1) % INTERVALS.length] ?? 7)
  const scene = closing ? 'circle(0% at 50% 50%)' : `circle(${revealed ? '150%' : '0%'} at 18% 52%)`

  return (
    <MovingGlassBackdrop value="suspend">
    <div
      ref={root}
      role="dialog"
      aria-modal
      aria-label={tl('gallery.play.mode')}
      data-paused={playing ? undefined : ''}
      className={cn('gallery-play absolute inset-0 z-30 overflow-hidden', closing && 'pointer-events-none')}
      style={dur}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <PosterShare open={sharing} initial="work" work={shareWork} onClose={closeShare} />
      {/* 背景（不含玻璃，整层裁切没问题）：上一部垫底，新的一部从封面卡片的位置圆形展开 */}
      <div
        aria-hidden
        className="absolute inset-0 overflow-hidden bg-bg"
        style={{
          clipPath: scene,
          transition: reduced ? 'none' : closing ? 'clip-path .7s cubic-bezier(.5,0,.75,0)' : 'clip-path 1.2s cubic-bezier(.7,0,.2,1) .15s',
        }}
      >
        {cur && <PlayBackdrop key={turn} cur={cur} before={before} open={open} reduced={reduced} />}
        <div className="gallery-grain absolute inset-0" />
      </div>

      {cur && (
        <PlayStage
          key={turn}
          cardRef={card}
          cur={cur}
          no={pad(idx)}
          total={n}
          chapters={totals ? count(totals.get(cur.id) ?? 0) : '—'}
          category={categoryOf(cur)}
          description={description}
          firstUnread={firstUnread}
          peeked={peek.data?.manga.id === cur.id}
          card={turn > 0 ? 'enter' : flying || entry.restored ? 'still' : 'enter'}
        />
      )}

      {/* 进度条 */}
      {/* 减少动态效果时全局动画被压成一瞬间，进度条会一开始就满格，不显示 */}
      {cur && !reduced && (
        <div aria-hidden {...UI} className="absolute inset-x-0 top-0 h-[3px] bg-white/14">
          <div key={`${turn}-${interval}`} className="gallery-progress h-full bg-[#f4f4f5]" style={{ animationPlayState: playing && n > 1 && !closing ? undefined : 'paused' }} />
        </div>
      )}

      <header className="absolute inset-x-7 top-6 flex items-center justify-between gap-4">
        <div {...UI} className={cn('flex items-center gap-3.5', flying && 'gallery-up')} style={{ '--d': '.4s' } as CSSProperties}>
          <span className="grid size-11 place-items-center rounded-full bg-solid text-lg font-bold text-on-solid">S</span>
          <div className="flex flex-col gap-0.5">
            <span className="font-cjk text-lg font-black">{tl('gallery.play.mode')}</span>
            <span className="text-[13px] text-white/75 num">
              {tl('gallery.play.sub', { count: n, n: count(n), s: interval })}
            </span>
          </div>
        </div>
        <Glass {...UI} className={cn('flex items-center gap-1 rounded-full p-[5px]', flying && 'gallery-up')} style={{ '--d': '.45s' } as CSSProperties}>
          <button type="button" onClick={() => go(idx - 1)} aria-label={tl('gallery.play.prev')} className="grid size-[46px] place-items-center rounded-full hover:bg-hover">
            <ChevronLeft className="size-5" strokeWidth={2} />
          </button>
          <button type="button" onClick={() => setPlaying((p) => !p)} aria-label={playing ? tl('gallery.play.pause') : tl('gallery.play.resume')} className="grid size-[46px] place-items-center rounded-full bg-solid text-on-solid">
            {playing ? <Pause className="size-4 fill-current" strokeWidth={1.6} /> : <Play className="size-4 fill-current" strokeWidth={1.6} />}
          </button>
          <button type="button" onClick={() => go(idx + 1)} aria-label={tl('gallery.play.next')} className="grid size-[46px] place-items-center rounded-full hover:bg-hover">
            <ChevronRight className="size-5" strokeWidth={2} />
          </button>
          <button type="button" onClick={cycle} aria-label={tl('gallery.play.intervalAria', { s: interval })} title={tl('gallery.play.intervalTitle')} className="flex h-[46px] items-center gap-1.5 rounded-full px-3 text-sm font-semibold hover:bg-hover num">
            <Timer className="size-[18px]" strokeWidth={1.8} />
            {tl('gallery.play.seconds', { s: interval })}
          </button>
          {cur && !test(cur) && (
            <button type="button" onClick={openShare} aria-label={tl('gallery.play.shareAria')} title={tl('gallery.play.shareTitle')} className="grid size-[46px] place-items-center rounded-full hover:bg-hover">
              <Share className="size-[18px]" strokeWidth={1.8} />
            </button>
          )}
          <button type="button" onClick={toggleFullscreen} aria-label={fullscreen ? tl('gallery.play.exitFullscreen') : tl('gallery.play.fullscreen')} className="grid size-[46px] place-items-center rounded-full hover:bg-hover">
            {fullscreen ? <Minimize className="size-[18px]" strokeWidth={1.8} /> : <Maximize className="size-[18px]" strokeWidth={1.8} />}
          </button>
          {/* 工具条本身是玻璃，里面的按钮不再套一层 */}
          <button type="button" onClick={onExit} aria-label={tl('gallery.play.exitAria')} title={tl('gallery.play.exitTitle')} className="grid size-[46px] place-items-center rounded-full bg-white/10 text-text hover:bg-hover">
            <X className="size-[18px]" strokeWidth={2} />
          </button>
        </Glass>
      </header>

      {/* 底部刻度：点选跳到那一部；书多时只显示当前前后一段 */}
      {n > 1 && (
        <nav {...UI} aria-label={tl('gallery.allWorks')} className={cn('absolute bottom-[26px] left-1/2 flex -translate-x-1/2 items-end gap-0.5', flying && 'gallery-up')} style={{ '--d': '.6s' } as CSSProperties}>
          {tickWindow(idx, n).map((i) => {
            const on = i === idx
            return (
              <button
                key={i}
                type="button"
                onClick={() => go(i)}
                aria-label={items[i].title}
                aria-current={on || undefined}
                className="group flex h-12 w-5 items-end justify-center pb-1.5"
              >
                <span className={cn('block w-[3px] rounded-sm transition-[height,background-color] duration-[450ms] ease-[cubic-bezier(.2,.8,.2,1)] group-hover:bg-white/85', on ? 'h-[34px] bg-[#f4f4f5]' : 'h-3.5 bg-white/38')} />
              </button>
            )
          })}
        </nav>
      )}

      {/* 下一部预告 */}
      {next && n > 1 && (
        <Glass
          as="button"
          type="button"
          {...UI}
          onClick={() => go(idx + 1)}
          className={cn('absolute right-9 bottom-[26px] flex max-w-[300px] items-center gap-3.5 rounded-[22px] py-2 pr-[22px] pl-2 text-left', flying && 'gallery-up')}
          style={{ '--d': '.65s' } as CSSProperties}
        >
          <span className="cv w-[46px] flex-none rounded-lg">
            <CoverImg src={next.thumbnailUrl} />
          </span>
          <span className="flex min-w-0 flex-col gap-1">
            <span className="text-xs font-medium tracking-[.3em] text-white/72">{tl('gallery.play.next')}</span>
            <span className="truncate font-cjk text-[17px] font-bold">{next.title}</span>
          </span>
        </Glass>
      )}
    </div>
    </MovingGlassBackdrop>
  )
}

/** 当前前后各一半的刻度序号（循环） */
function tickWindow(idx: number, n: number) {
  if (n <= MAX_TICKS) return Array.from({ length: n }, (_, i) => i)
  const half = Math.floor(MAX_TICKS / 2)
  return Array.from({ length: MAX_TICKS }, (_, k) => (((idx - half + k) % n) + n) % n)
}

/** 一部作品的背景。每换一部重新挂载：上一部垫底，新的一部从封面卡片的位置圆形展开 */
function PlayBackdrop({ cur, before, open, reduced }: { cur: LibraryManga; before: LibraryManga | undefined; open: boolean; reduced: boolean }) {
  const [covered, setCovered] = useState(false)
  const [imageReady, setImageReady] = useState(!cur.thumbnailUrl)
  useEffect(() => {
    if (!open) return
    const timer = window.setTimeout(() => setCovered(true), reduced ? 0 : 1400)
    return () => window.clearTimeout(timer)
  }, [open, reduced])
  return (
    <>
      {/* 新图慢到时仍保留已加载的背景，揭幕结束与图片可见两项都满足才释放。 */}
      {before && !(covered && imageReady) && <div data-play-backdrop="previous" className="absolute inset-0"><Backdrop src={before.thumbnailUrl} still /></div>}
      <div
        data-play-backdrop="current"
        className="absolute inset-0 overflow-hidden"
        style={{ clipPath: `circle(${open ? '150%' : '0%'} at 18% 52%)`, transition: open && !reduced ? 'clip-path 1.3s cubic-bezier(.7,0,.2,1)' : 'none' }}
      >
        <Backdrop src={cur.thumbnailUrl} onReady={() => setImageReady(true)} />
      </div>
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(90deg, rgba(11,11,13,.78) 0%, rgba(11,11,13,.38) 42%, rgba(11,11,13,.18) 64%, rgba(11,11,13,.55) 100%), linear-gradient(180deg, rgba(11,11,13,.5) 0%, transparent 18%, transparent 62%, rgba(11,11,13,.88) 100%)',
        }}
      />
    </>
  )
}

/** 一部作品的画面。每换一部重新挂载，各段进场动画从头播放。 */
function PlayStage({
  cardRef,
  cur,
  no,
  total,
  chapters,
  category,
  description,
  firstUnread,
  peeked,
  card,
}: {
  cardRef: React.RefObject<HTMLAnchorElement | null>
  cur: LibraryManga
  no: string
  total: number
  chapters: string
  category: string
  description: string | null | undefined
  firstUnread: number | undefined
  peeked: boolean
  /** enter：卡片自己从后方转进来；still：停在静止姿态（从画布飞进来、从详情页返回时由别的动画负责） */
  card: 'enter' | 'still'
}) {
  const latin = mostlyLatin(cur.title)
  const titleH = Math.max(320, window.innerHeight - 96 - 160)
  const v = vfit(cur.title, titleH, { max: 150, min: 56, maxCols: 4, width: Math.min(420, window.innerWidth * 0.3) })
  const hSize = hfit(cur.title, Math.min(540, window.innerWidth * 0.38), { max: 140, min: 48, maxLines: 3 })
  const up = (i: number) => ({ '--d': `${0.5 + i * 0.06}s` }) as CSSProperties
  const status = STATUS[cur.status] ?? ''
  return (
    <>
      {/* 镂空大编号 */}
      <div aria-hidden {...UI} className="gallery-num absolute top-10 left-[52px] text-[min(420px,46vh)] leading-[.8] font-bold tracking-[-0.05em] text-transparent num [-webkit-text-stroke:2px_rgba(244,241,230,.45)]">
        {no}
      </div>

      {/* 左侧封面卡片：链到详情页，能接上封面过渡 */}
      <section aria-live="polite" aria-label={cur.title} className="absolute top-1/2 left-[clamp(48px,8vw,120px)] flex -translate-y-[42%] items-center gap-[clamp(32px,4vw,56px)]">
        <Link
          ref={cardRef}
          to={`/manga/${cur.id}`}
          viewTransition
          aria-label={tl('gallery.detailAria', { title: cur.title })}
          className={cn('cv relative z-10 w-[clamp(200px,19vw,280px)] flex-none rounded-2xl shadow-[0_60px_100px_-30px_rgba(0,0,0,.9),0_0_0_1px_rgba(255,255,255,.12)]', card === 'enter' && 'gallery-card')}
          style={{
            WebkitBoxReflect: 'below 14px linear-gradient(transparent 68%, rgba(255,255,255,.18))',
            transform: card === 'still' ? CARD_REST : undefined,
          } as CSSProperties}
        >
          <CoverImg src={cur.thumbnailUrl} />
        </Link>
        <div className="flex w-[min(400px,28vw)] flex-col gap-4">
          <p {...UI} className="gallery-up m-0 text-sm font-medium tracking-[.32em] text-white/80 num" style={up(0)}>
            {tl('gallery.play.nowPlaying', { no, total: count(total) })}
          </p>
          <p {...UI} className="gallery-up m-0 text-[30px] font-bold" style={up(1)}>
            {cur.author || cur.artist || tl('gallery.unknownAuthor')}
          </p>
          <div className="flex flex-wrap gap-2">
            {[category, status, tl('gallery.chaptersText', { n: chapters })].filter(Boolean).map((t, i) => (
              <span key={t} {...UI} className="gallery-up flex h-[30px] items-center rounded-full border border-white/18 bg-white/14 px-3 text-[13px] font-medium" style={{ '--d': `${0.62 + i * 0.03}s` } as CSSProperties}>
                {t}
              </span>
            ))}
          </div>
          {description && (
            <p {...UI} className="gallery-up m-0 line-clamp-4 text-base leading-[1.85] whitespace-pre-line text-white/82" style={up(3)}>
              {description}
            </p>
          )}
          {/* 进场动画放在每个按钮自身，「作品详情」是玻璃，祖先不能带透明度 */}
          <div className="mt-2 flex gap-3">
            {firstUnread ? (
              <Link {...UI} to={`/manga/${cur.id}/chapter/${firstUnread}`} viewTransition className="gallery-up solid h-[54px] px-7 text-base no-underline" style={up(4)}>
                <BookOpen className="size-[18px]" strokeWidth={1.8} />
                {Number(cur.lastReadChapter?.lastReadAt) > 0 ? tl('gallery.continue') : tl('gallery.start')}
              </Link>
            ) : (
              peeked && <span {...UI} className="gallery-up solid h-[54px] px-7 text-base opacity-60" style={up(4)}>{tl('gallery.allRead')}</span>
            )}
            <GlassLink {...UI} to={`/manga/${cur.id}`} viewTransition className="gallery-up gbtn h-[54px] rounded-full px-6 text-base font-semibold text-text no-underline" style={up(5)}>
              {tl('gallery.detail')}
            </GlassLink>
          </div>
        </div>
      </section>

      {/* 右侧书名：中日文竖排逐字落下；以西文为主的改横排 */}
      {latin ? (
        <h1
          {...UI}
          className="gallery-up absolute top-[110px] right-[100px] m-0 line-clamp-4 w-[min(540px,38vw)] text-right leading-[1.02] font-bold tracking-[-0.03em] text-[#f4f1e6] [overflow-wrap:anywhere] [text-shadow:0_12px_50px_rgba(0,0,0,.45)]"
          style={{ fontSize: hSize, '--d': '.3s' } as CSSProperties}
        >
          {cur.title}
        </h1>
      ) : (
        <>
          <h1
            {...UI}
            aria-label={cur.title}
            className="absolute top-24 right-[100px] m-0 flex flex-row-reverse gap-[.18em] font-cjk leading-none font-black text-[#f4f1e6] [text-shadow:0_12px_50px_rgba(0,0,0,.45)]"
            style={{ fontSize: v.size }}
          >
            {v.columns.map((col, c) => (
              <span key={c} aria-hidden className="flex flex-col">
                {[...col].map((ch, i) => {
                  const k = c * [...v.columns[0]].length + i
                  return (
                    <span key={i} className="gallery-char" style={{ '--d': `${(0.3 + Math.min(k, 16) * 0.06).toFixed(2)}s` } as CSSProperties}>
                      {ch}
                    </span>
                  )
                })}
              </span>
            ))}
          </h1>
          <p
            aria-hidden
            {...UI}
            className="gallery-up absolute top-[108px] m-0 font-cjk text-lg font-medium tracking-[.4em] text-[#f4f1e6]/82 [writing-mode:vertical-rl]"
            style={{ right: Math.round(100 + v.columns.length * v.size * 1.18 + 26), '--d': '.9s' } as CSSProperties}
          >
            {[cur.author || cur.artist ? tl('gallery.by', { author: cur.author || cur.artist }) : '', category].filter(Boolean).join(' · ')}
          </p>
        </>
      )}
    </>
  )
}

/** 放大、模糊的封面背景；still 时不推镜（垫底的上一部） */
function Backdrop({ src, still, onReady }: { src: string | null; still?: boolean; onReady?: () => void }) {
  const soft = useSoftCover(src)
  useEffect(() => { if (soft.ready) onReady?.() }, [soft.ready, onReady])
  return (
    <div className={cn('absolute inset-0 overflow-hidden', soft.ready && !soft.url && 'bg-[radial-gradient(ellipse_at_30%_40%,#32313b,#0b0b0d_80%)]')} data-soft-fallback={soft.ready && !soft.url ? '' : undefined}>
      <div className={cn('absolute -inset-[8%]', !still && 'gallery-kb')}>
        {soft.url && <img src={soft.url} data-soft-cover alt="" draggable={false} onLoad={onReady} className="size-full object-cover" />}
      </div>
    </div>
  )
}
