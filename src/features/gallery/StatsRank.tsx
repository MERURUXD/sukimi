import { ChevronLeft, ChevronRight, Lock } from 'lucide-react'
import { useLayoutEffect, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Glass } from '@/components/glass/Glass'
import { CoverImg } from '@/components/manga/CoverImg'
import type { LibraryManga } from '@/features/library/queries'
import { count } from '@/lib/format'
import { cn } from '@/lib/cn'
import { clamp01 } from './canvasMath'
import { ease, seg, type Pager } from './statsPager'

export interface Ranked {
  manga: LibraryManga
  rank: number
  read: number
  total: number | null
  /** 已读页数估算：没取过页数的章节按这部的平均页数补 */
  pages: number
  /** NSFW 作品：占着名次，封面换成锁、书名和题材都不显示（manga 已经抹掉这些字段） */
  masked?: boolean
}

/** 排行里给 NSFW 作品用的替身：数字照常，能认出是哪部的字段都去掉 */
export const maskRanked = (m: LibraryManga): LibraryManga => ({ ...m, title: 'NSFW 作品', thumbnailUrl: null, author: null, artist: null, genre: [] })

/** 排行一组几部：前三名放大摆成领奖台，后五部排成一行 */
export const GROUP = 8

/** 前三名封面的倾角：只有第一名明显歪一点，真实封面杂，都歪着会乱 */
const TILT = [-4, 1.5, -1]

export interface RankLayout {
  phone: boolean
  /** 舞台左边和宽度（排版坐标） */
  left: number
  width: number
  top: number
  bottom: number
  /** 大标题字号 */
  headFs: number
  /** 第一名、二三名、后五部的封面宽 */
  cw1: number
  cw2: number
  shelfW: number
  u: number
}

/** 两屏共用的大标题：上面一行小字，下面一句双色大字 */
export function BigHead({ eyebrow, fs, phone, children, ref }: { eyebrow: string; fs: number; phone: boolean; children: ReactNode; ref?: (el: HTMLDivElement | null) => void }) {
  return (
    <div ref={ref} className="min-w-0">
      <span className="text-xs font-bold tracking-[.32em] text-muted">{eyebrow}</span>
      <h2 className={cn('m-0 font-cjk font-black tracking-[-0.05em] [overflow-wrap:anywhere]', phone ? 'mt-2.5' : 'mt-3.5')} style={{ fontSize: fs, lineHeight: 1.12 }}>
        {children}
      </h2>
    </div>
  )
}

function Cover({ it, className, style }: { it: Ranked; className?: string; style?: CSSProperties }) {
  return (
    <span className={cn('cv', className)} style={style}>
      {it.masked ? (
        <span className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-white/6 text-[10px] font-bold tracking-[.2em] text-muted" aria-hidden>
          <Lock className="size-1/4 max-w-7" strokeWidth={1.6} />
          NSFW
        </span>
      ) : (
        <CoverImg src={it.manga.thumbnailUrl} loading="lazy" draggable={false} />
      )}
    </span>
  )
}

const label = (it: Ranked) => `第 ${it.rank} 名：${it.manga.title}，已读 ${it.read} 话`
const no = (n: number) => String(n).padStart(2, '0')

/**
 * 第二屏：已读排行。一组八部，前三名像领奖台一样放大，大名次垫在封面旁边，后五部排成一行。
 * 切屏的进出场每帧直接写样式（不经过 React）：进来时标题先到，前三名从低处错落升起、转到各自的角度，
 * 书架随后；去第三屏时整组往上飘走。换组时新的一组依次浮上来
 */
export function RankScreen({ ranked, group, pager, L, moved }: { ranked: Ranked[]; group: number; pager: Pager; L: RankLayout; moved: () => boolean }) {
  const head = useRef<HTMLDivElement | null>(null)
  const pods = useRef<(HTMLElement | null)[]>([])
  const shelf = useRef<(HTMLElement | null)[]>([])
  const foot = useRef<(HTMLElement | null)[]>([])
  // 第一次显示的那组不播换组动画（进场由切屏负责）；换过一次以后每组都播
  const [prev, setPrev] = useState(group)
  const [swapped, setSwapped] = useState(false)
  if (group !== prev) {
    setPrev(group)
    setSwapped(true)
  }
  const groups = Math.ceil(ranked.length / GROUP)
  const items = ranked.slice(group * GROUP, group * GROUP + GROUP)
  const top3 = items.slice(0, 3)
  const rest = items.slice(3)
  const { phone, u } = L

  useLayoutEffect(() => {
    const paint = () => {
      const a = clamp01(pager.p)
      const b = clamp01(pager.p - 1)
      const style = (el: HTMLElement | null | undefined, o: number, t: string, f = '') => {
        if (!el) return
        el.style.opacity = o.toFixed(3)
        el.style.transform = t
        el.style.filter = f
      }
      {
        const t = ease(seg(a, 0.28, 0.66))
        const o = ease(seg(b, 0, 0.42))
        style(head.current, t * (1 - o), `translateY(${((1 - t) * 36 - o * 60).toFixed(1)}px)`)
      }
      pods.current.forEach((el, j) => {
        const t = ease(seg(a, 0.32 + j * 0.07, 0.8 + j * 0.06))
        const o = ease(seg(b, j * 0.05, 0.5 + j * 0.05))
        style(el, Math.min(1, t * 1.5) * (1 - o), `translateY(${((1 - t) * 150 - o * 130).toFixed(1)}px) rotate(${((1 - t) * (j === 1 ? 5 : -5)).toFixed(2)}deg) scale(${(1 - o * 0.08).toFixed(4)})`, o > 0.01 ? `blur(${(o * 5).toFixed(2)}px)` : '')
        const n = el?.querySelector<HTMLElement>('[data-rank]')
        if (n) n.style.translate = `${((1 - t) * -48).toFixed(1)}px 0`
      })
      shelf.current.forEach((el, j) => {
        const t = ease(seg(a, 0.56 + j * 0.04, 0.92 + j * 0.02))
        const o = ease(seg(b, j * 0.025, 0.38 + j * 0.025))
        style(el, t * (1 - o), `translateY(${((1 - t) * 50 - o * 60).toFixed(1)}px)`)
      })
      // 玻璃按钮的透明度写在它自己身上，不放祖先，免得背景采样跟着变
      const f = seg(a, 0.8, 1) * (1 - seg(b, 0, 0.25))
      // 翻到头的箭头变暗也乘在这里：每帧写的透明度会盖过 disabled 的样式
      foot.current.forEach((el) => el && (el.style.opacity = (f * ((el as HTMLButtonElement).disabled ? 0.35 : 1)).toFixed(3)))
    }
    paint()
    return pager.subscribe(paint)
  }, [pager, group, ranked])

  const guard = (e: MouseEvent) => {
    // 刚拖动过不算点击
    if (moved()) e.preventDefault()
  }
  const lift = (i: number): CSSProperties | undefined => (swapped ? ({ '--d': `${i * 60}ms` } as CSSProperties) : undefined)
  const swapIn = swapped ? 'stats-group-in' : ''

  const podium = top3.map((it, j) => {
    const first = j === 0
    const cw = first ? L.cw1 : L.cw2
    const side = phone && first
    const done = it.total != null && it.total > 0 && it.read >= it.total
    return (
      <Link
        key={it.manga.id}
        ref={(el) => {
          pods.current[j] = el
        }}
        to={`/manga/${it.manga.id}`}
        viewTransition
        draggable={false}
        onClick={guard}
        aria-label={label(it)}
        className={cn('stats-pod relative isolate grid min-w-0 items-start', phone && first && 'col-span-2')}
        style={{ gridTemplateColumns: `${cw}px ${side ? 'minmax(0, 1fr)' : 'auto'}`, gridTemplateAreas: side ? '"cover rank" "cover info"' : '"cover rank" "info info"', columnGap: side ? 14 : 0, justifyContent: 'start', '--tilt': `${TILT[j]}deg` } as CSSProperties}
      >
        <span className={swapIn} style={{ gridArea: 'cover', ...lift(j) }}>
          <Cover it={it} className="stats-pod-cover rounded-[4px] shadow-[-12px_24px_40px_rgba(0,0,0,.45)]" style={{ width: cw, height: cw * 1.5 }} />
        </span>
        <span
          data-rank
          aria-hidden
          className="relative -z-10 font-bold leading-[.8] tracking-[-0.08em] num transition-colors duration-500"
          style={{ gridArea: 'rank', fontSize: Math.round(side ? cw * 0.9 : cw * (first ? 0.87 : 0.8)), margin: side ? 0 : '-0.06em 0 0 -0.14em', color: first ? 'rgba(255,255,255,.16)' : 'rgba(255,255,255,.11)' }}
        >
          {no(it.rank)}
        </span>
        <span className={cn('min-w-0', swapIn)} style={{ gridArea: 'info', paddingTop: side ? 0 : Math.round((phone ? 12 : 22) * u), alignSelf: side ? 'end' : undefined, ...lift(j + 1) }}>
          <span className="block truncate font-cjk leading-tight font-bold" style={{ fontSize: phone ? 14 : Math.round((first ? 22 : 16) * u), marginBottom: phone ? 4 : 8 }}>
            {it.manga.title}
          </span>
          <span className={cn('flex flex-wrap items-baseline', phone ? 'gap-x-2' : 'gap-x-3')}>
            <span className="leading-none font-bold tracking-[-0.04em] num" style={{ fontSize: Math.round((phone ? (first ? 28 : 22) : first ? 40 : 30) * (phone ? 1 : u)) }}>
              {count(it.read)}
              <span className="ml-1 font-cjk text-[11px] font-bold tracking-normal text-muted">话</span>
            </span>
            {it.pages > 0 && <span className="text-[11px] whitespace-nowrap text-muted num">约 {count(it.pages)} 页</span>}
          </span>
          {it.total != null && it.total > 0 && (
            <span className="mt-2.5 flex items-center gap-2.5 text-[10px] whitespace-nowrap text-white/45 num">
              <span aria-hidden className="block h-0.5 flex-none overflow-hidden rounded-sm bg-white/10" style={{ width: Math.round((phone ? 60 : 110) * (phone ? 1 : u)) }}>
                <span className="block h-full rounded-sm bg-white/70" style={{ width: `${Math.min(100, (it.read / it.total) * 100)}%` }} />
              </span>
              {count(it.read)} / {count(it.total)} 话{done && ' · 已追平'}
            </span>
          )}
        </span>
      </Link>
    )
  })

  const shelfEls = rest.map((it, j) => (
    <Link
      key={it.manga.id}
      ref={(el) => {
        shelf.current[j] = el
      }}
      to={`/manga/${it.manga.id}`}
      viewTransition
      draggable={false}
      onClick={guard}
      aria-label={label(it)}
      className={cn('min-w-0', phone ? 'flex flex-col items-center gap-1.5' : 'grid items-end gap-x-3.5')}
      style={phone ? undefined : { gridTemplateColumns: `${L.shelfW}px minmax(0, 1fr)` }}
    >
      <span className={cn(swapIn, !phone && 'row-span-2')} style={lift(j + 3)}>
        <Cover it={it} className="rounded-[3px] shadow-[0_8px_14px_rgba(0,0,0,.3)]" style={{ width: L.shelfW, height: L.shelfW * 1.5 }} />
      </span>
      {phone ? (
        <span className="text-[11px] font-bold text-white/45 num">{no(it.rank)}</span>
      ) : (
        <>
          <span className={cn('min-w-0', swapIn)} style={lift(j + 4)}>
            <span className="block text-[17px] font-bold text-white/30 num">{no(it.rank)}</span>
            <span className="mt-0.5 block truncate text-xs font-bold">{it.manga.title}</span>
          </span>
          <span className={cn('self-start text-xs text-muted num', swapIn)} style={lift(j + 4)}>
            {count(it.read)} 话
          </span>
        </>
      )}
    </Link>
  ))

  const arrow = (d: -1 | 1) => (
    <Glass
      as="button"
      type="button"
      ref={(el: HTMLElement | null) => {
        foot.current[d < 0 ? 1 : 2] = el
      }}
      onClick={() => pager.flip(group + d)}
      disabled={d < 0 ? group === 0 : group >= groups - 1}
      aria-label={d < 0 ? '上一组' : '下一组'}
      className="grid size-10 place-items-center rounded-full text-text"
    >
      {d < 0 ? <ChevronLeft className="size-[18px]" strokeWidth={2} /> : <ChevronRight className="size-[18px]" strokeWidth={2} />}
    </Glass>
  )

  return (
    <section aria-label="已读排行" className="absolute flex flex-col" style={{ left: L.left, width: L.width, top: L.top, bottom: L.bottom, gap: Math.round((phone ? 16 : 26) * u), justifyContent: phone ? 'flex-start' : 'center' }}>
      <BigHead
        ref={(el) => {
          head.current = el
        }}
        eyebrow={`02 / 已读排行 · 前 ${ranked.length} 部`}
        fs={L.headFs}
        phone={phone}
      >
        总有些故事，<span className="whitespace-nowrap text-white/30">读得更多。</span>
      </BigHead>
      <div className={cn('grid', phone ? 'grid-cols-2 gap-x-[6%] gap-y-5' : 'items-end gap-[4%]')} style={phone ? undefined : { gridTemplateColumns: '1.45fr 1fr 1fr' }}>
        {podium}
      </div>
      {rest.length > 0 && <div className={phone ? 'flex justify-between' : 'grid grid-cols-5 gap-6 pt-1'}>{shelfEls}</div>}
      {groups > 1 && (
        <div className="flex items-center justify-end gap-3">
          <span
            ref={(el) => {
              foot.current[0] = el
            }}
            className="mr-1 text-xs font-bold text-muted num"
          >
            {no(group + 1)} / {no(groups)}
          </span>
          {arrow(-1)}
          {arrow(1)}
        </div>
      )}
    </section>
  )
}
