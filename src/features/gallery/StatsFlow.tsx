import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useCallback, useLayoutEffect, useRef, type CSSProperties, type MouseEvent } from 'react'
import { Link } from 'react-router'
import { Glass } from '@/components/glass/Glass'
import { CoverImg } from '@/components/manga/CoverImg'
import type { LibraryManga } from '@/features/library/queries'
import { rgbCss } from '@/lib/coverColor'
import { count } from '@/lib/format'
import type { Rgb } from '@/lib/palette'
import { isCompleted } from './hooks'
import { ease, seg, type Pager } from './statsPager'
import { authorsOf, genresOf, type Taste } from './taste'

export interface Ranked {
  manga: LibraryManga
  rank: number
  read: number
  total: number | null
}

/** 某一段的进度，写成 CSS：p 由页面每帧写到 --p 上，这里不用跟着重绘 */
const cssSeg = (a: number, b: number, max = 1) => `clamp(0, calc((var(--p) - ${a}) / ${b - a}), ${max})`

/** 封面翻页的尺寸：正中一张平放，两侧斜着往后退 */
export function flowLayout(cw: number, phone: boolean) {
  return phone
    ? { cw, ch: cw * 1.5, gap1: cw * 0.82, gap: cw * 0.43, rot: 40, z1: cw * 0.71, zs: cw * 0.3, persp: cw * 5.2 }
    : { cw, ch: cw * 1.5, gap1: cw * 0.88, gap: cw * 0.575, rot: 36, z1: cw * 0.71, zs: cw * 0.33, persp: cw * 5.8 }
}
export type FlowLayout = ReturnType<typeof flowLayout>

/** 偏离正中 d 张的封面在哪：两侧只留三张左右，越远越往后退、越暗，避免挤成一排书脊 */
function pose(L: FlowLayout, d: number) {
  const ad = Math.abs(d)
  const a = Math.min(ad, 1)
  const b = Math.max(ad - 1, 0)
  const s = Math.sign(d)
  return {
    x: s * (a * L.gap1 + b * L.gap),
    z: -a * L.z1 - b * L.zs,
    ry: -s * a * L.rot,
    shade: a * 0.28 + Math.min(b, 3) * 0.12,
    op: ad <= 1 ? 1 : Math.max(0, 1 - (ad - 1) * 0.32 - Math.max(0, ad - 2) * 0.24 - Math.max(0, ad - 3) * 0.4),
  }
}

/** 正中左右各挂几张；再远的已经淡没了 */
const SPAN = 4

/**
 * 3D 封面翻页。位置每帧直接写 transform：翻页和两屏切换都不经过 React 重绘。
 * 进场：穿过表盘之后，封面从画面深处依次飞到位置上，正中那张最先到，往两边一张张展开。
 * 不给封面挂换页的过渡名：在 3D 透视里挂了，浏览器会整个中止换页动画
 */
export function CoverFlow({ ranked, idx, pager, L, width, cy, moved }: { ranked: Ranked[]; idx: number; pager: Pager; L: FlowLayout; width: number; cy: number; moved: () => boolean }) {
  const cards = useRef(new Map<number, HTMLDivElement>())
  const cx = width / 2
  const paint = useCallback(() => {
    const p = pager.p
    const cur = pager.cur
    for (const [i, el] of cards.current) {
      const d = i - cur
      const ad = Math.abs(d)
      const q = pose(L, d)
      const t = ease(seg(p, 0.26 + Math.min(ad, 8) * 0.035, 0.72 + Math.min(ad, 8) * 0.03))
      const far = 1 - t
      const x = cx - L.cw / 2 + q.x * (1 - far * 0.85)
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${(cy - L.ch / 2).toFixed(1)}px, ${(q.z - far * 1600).toFixed(1)}px) rotateY(${(q.ry * t).toFixed(2)}deg)`
      el.style.opacity = (Math.min(t * 1.4, 1) * q.op).toFixed(3)
      el.style.zIndex = String(1000 - Math.round(ad * 10))
      el.style.pointerEvents = p > 0.98 && ad < 3.5 ? '' : 'none'
      ;(el.lastElementChild as HTMLElement).style.opacity = q.shade.toFixed(3)
    }
  }, [pager, L, cx, cy])
  // 挂上新的封面（翻过去之后）时先摆好位置再显示，不闪一下
  useLayoutEffect(() => {
    paint()
    return pager.subscribe(paint)
  }, [pager, paint, idx])

  const onClick = (i: number) => (e: MouseEvent) => {
    // 刚拖动过不算点击；点的不是正中那张时先把它翻过来
    if (moved()) return e.preventDefault()
    if (i !== Math.round(pager.cur)) {
      e.preventDefault()
      pager.flip(i)
    }
  }

  const from = Math.max(0, idx - SPAN)
  const to = Math.min(ranked.length - 1, idx + SPAN)
  return (
    <div className="absolute inset-0" style={{ perspective: L.persp, perspectiveOrigin: `${cx}px ${cy}px` }}>
      {ranked.slice(from, to + 1).map((it, k) => {
        const i = from + k
        const center = i === idx
        return (
          <div
            key={it.manga.id}
            ref={(el) => {
              if (el) cards.current.set(i, el)
              else cards.current.delete(i)
            }}
            className="absolute top-0 left-0 opacity-0"
            style={{ width: L.cw, height: L.ch }}
          >
            {/* 落在地面上的一团软阴影，不做镜面倒影 */}
            <span aria-hidden className="absolute left-[4%] w-[92%] rounded-[50%] bg-[radial-gradient(closest-side,rgba(0,0,0,.75),transparent)] blur-[6px]" style={{ top: `calc(100% - ${L.cw * 0.075}px)`, height: L.cw * 0.18 }} />
            <Link
              to={`/manga/${it.manga.id}`}
              viewTransition
              draggable={false}
              onClick={onClick(i)}
              tabIndex={center ? 0 : -1}
              aria-hidden={center ? undefined : true}
              aria-label={`第 ${it.rank} 名：${it.manga.title}，已读 ${it.read} 话`}
              className="cv relative block size-full rounded-[10px] shadow-[0_30px_70px_-18px_rgba(0,0,0,.75)] after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:shadow-[inset_0_0_0_1px_rgba(255,255,255,.14),inset_0_1px_0_rgba(255,255,255,.32)]"
            >
              <CoverImg src={it.manga.thumbnailUrl} loading="lazy" draggable={false} />
            </Link>
            {/* 两侧的封面压暗 */}
            <span aria-hidden className="pointer-events-none absolute inset-0 rounded-[10px] bg-black" />
          </div>
        )
      })}
    </div>
  )
}

const statusOf = (m: LibraryManga) => (isCompleted(m) ? '已完结' : m.status === 'ONGOING' ? '连载中' : null)

/** 正中那部的信息：名次、书名、作者 · 题材 · 连载状态、读到哪了 */
export function FlowInfo({ it, tone, phone, onStep, first, last }: { it: Ranked; tone: Rgb; phone: boolean; onStep?: (d: -1 | 1) => void; first: boolean; last: boolean }) {
  const m = it.manga
  const caught = it.total != null && it.total > 0 && it.read >= it.total
  const pct = it.total ? Math.min(100, (it.read / it.total) * 100) : 0
  const meta = [authorsOf(m.author).join('、'), genresOf(m.genre).slice(0, 3).join(' / '), statusOf(m)].filter(Boolean).join(' · ')
  const arrow = (d: -1 | 1) =>
    onStep && (
      <Glass as="button" type="button" onClick={() => onStep(d)} disabled={d < 0 ? first : last} aria-label={d < 0 ? '上一部' : '下一部'} className="grid size-11 flex-none place-items-center rounded-full text-text disabled:opacity-35">
        {d < 0 ? <ChevronLeft className="size-5" strokeWidth={2} /> : <ChevronRight className="size-5" strokeWidth={2} />}
      </Glass>
    )
  return (
    <div className="flex items-center justify-center gap-6" style={{ opacity: cssSeg(0.68, 0.9), translate: `0 calc((1 - ${cssSeg(0.68, 0.9)}) * 10px)` }}>
      {arrow(-1)}
      <div key={m.id} aria-live="polite" className="gallery-info-in flex w-[min(440px,calc(100vw-48px))] min-w-0 flex-col items-center text-center">
        <span className="text-xs font-bold tracking-[.2em] text-muted num">
          NO.{it.rank}
          {it.rank === 1 && ' · 读得最多'}
        </span>
        <span className={`mt-2 max-w-full truncate font-cjk font-black ${phone ? 'text-xl' : 'text-2xl'}`}>{m.title}</span>
        {meta && <span className="mt-1.5 max-w-full truncate text-xs text-muted">{meta}</span>}
        <span className={`flex items-center gap-3 ${phone ? 'mt-3' : 'mt-4'}`}>
          {it.total != null && it.total > 0 && (
            <span aria-hidden className="block h-1 overflow-hidden rounded-sm bg-white/14" style={{ width: phone ? 140 : 180 }}>
              <span className="block h-full rounded-sm transition-[width] duration-500" style={{ width: `${pct}%`, background: rgbCss(mix(tone, 0.72)) }} />
            </span>
          )}
          <span className="text-xs font-bold whitespace-nowrap num">
            {count(it.read)} / {it.total == null ? '—' : count(it.total)} 话{caught && ' · 已追平'}
          </span>
        </span>
      </div>
      {arrow(1)}
    </div>
  )
}

/** 往白里调：封面主色常常很暗，直接拿来画细条看不清 */
const mix = ([r, g, b]: Rgb, k: number): Rgb => [r + (1 - r) * k, g + (1 - g) * k, b + (1 - b) * k]

/**
 * 口味：常读的题材（按已读话数平分算占比）和作者。翻到哪部，它的题材和作者亮起来，其余变暗。
 * 进场时从上往下逐行出现，占比的细条从 0 长出来
 */
export function TastePanel({ taste, it, tone, phone }: { taste: Taste; it: Ranked | undefined; tone: Rgb; phone: boolean }) {
  const mine = new Set(it ? genresOf(it.manga.genre) : [])
  const who = new Set(it ? authorsOf(it.manga.author) : [])
  const gmax = taste.genres[0]?.pct || 1
  const cols = phone ? 2 : 1
  let row = 0
  const rowStyle = (dim: boolean): CSSProperties => {
    const j = row++
    const a = 0.66 + j * 0.022
    const b = 0.84 + j * 0.016
    return { opacity: cssSeg(a, b, dim ? 0.38 : 1), translate: `0 calc((1 - ${cssSeg(a, b)}) * 10px)`, transition: 'opacity .35s' }
  }
  const head = (text: string) => (
    <h3 className="m-0 text-xs font-bold tracking-[.32em] text-muted" style={rowStyle(false)}>
      {text}
    </h3>
  )
  return (
    <section aria-label="口味" className="flex w-full flex-col">
      {head('口味')}
      {taste.genres.length ? (
        <ul className={`m-0 mt-3 grid list-none p-0 ${phone ? 'gap-x-6 gap-y-3.5' : 'gap-y-[22px]'}`} style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {taste.genres.map((g) => {
            const on = mine.has(g.name)
            const a = 0.74 + row * 0.02
            return (
              <li key={g.name} style={rowStyle(!!it && !on)}>
                <span className="flex items-baseline justify-between gap-3">
                  <span className="truncate font-cjk font-black" style={{ fontSize: phone ? 16 : Math.round(18 + (g.pct / gmax) * 12) }}>
                    {g.name}
                  </span>
                  <span className="text-[15px] font-bold num md:text-lg">
                    {/* 读得很少的题材四舍五入成 0 像是没读过 */}
                    {g.pct < 1 ? '<1' : Math.round(g.pct)}
                    <span className="ml-0.5 text-[11px] text-muted">%</span>
                  </span>
                </span>
                <span aria-hidden className="mt-2 block h-1">
                  <span
                    className="block h-full rounded-sm transition-[background-color] duration-300"
                    style={{ width: `calc(${((g.pct / gmax) * 100).toFixed(1)}% * ${cssSeg(a, a + 0.22)})`, background: on ? rgbCss(mix(tone, 0.72)) : '#f4f4f5' }}
                  />
                </span>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="m-0 mt-3 text-sm text-muted" style={rowStyle(false)}>
          读过的作品还没有题材标签
        </p>
      )}
      {taste.authors.length > 0 && (
        <>
          <div className={phone ? 'mt-5' : 'mt-9'}>{head('最常读的作者')}</div>
          <ul className={`m-0 mt-3 list-none p-0 ${phone ? 'grid grid-cols-3 gap-3' : 'flex flex-col gap-4'}`}>
            {taste.authors.map((a) => (
              <li key={a.name} className={phone ? 'min-w-0' : 'flex items-baseline justify-between gap-3'} style={rowStyle(!!it && !who.has(a.name))}>
                <span className={`block truncate font-cjk font-black ${phone ? 'text-sm' : 'text-lg'}`}>{a.name}</span>
                <span className={`text-xs whitespace-nowrap text-muted num ${phone ? 'mt-0.5 block' : ''}`}>
                  {a.works} 部 · {count(a.read)} 话
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
