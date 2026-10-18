import { useLayoutEffect, useRef } from 'react'
import { CoverImg } from '@/components/manga/CoverImg'
import { count } from '@/lib/format'
import { cn } from '@/lib/cn'
import { clamp01 } from './canvasMath'
import { BigHead } from './StatsRank'
import { ease, seg, type Pager } from './statsPager'
import { tasteHeadline, type Taste } from './taste'

export interface TasteLayout {
  phone: boolean
  left: number
  width: number
  top: number
  bottom: number
  headFs: number
  /** 题材名的字号 */
  genreFs: number
  u: number
}

/**
 * 第三屏：口味。大标题直接说结论（最常读的两个题材），下面是题材占比和最常读的作者。
 * 进场每帧直接写样式：标题先出，题材一行行升起、细条跟着长满，作者从右侧滑进来
 */
export function TasteScreen({ taste, coverOf, pager, L }: { taste: Taste; coverOf: (id: number) => string | null; pager: Pager; L: TasteLayout }) {
  const head = useRef<HTMLDivElement | null>(null)
  const rows = useRef<(HTMLElement | null)[]>([])
  const fills = useRef<(HTMLElement | null)[]>([])
  const side = useRef<(HTMLElement | null)[]>([])
  const empty = useRef<HTMLParagraphElement>(null)
  const gmax = taste.genres[0]?.pct || 1
  const h = tasteHeadline(taste.genres)
  const { phone, u } = L

  useLayoutEffect(() => {
    const paint = () => {
      const b = clamp01(pager.p - 1)
      const style = (el: HTMLElement | null | undefined, o: number, t: string) => {
        if (!el) return
        el.style.opacity = o.toFixed(3)
        el.style.transform = t
      }
      const t = ease(seg(b, 0.34, 0.7))
      style(head.current, t, `translateY(${((1 - t) * 40).toFixed(1)}px)`)
      style(empty.current, ease(seg(b, 0.4, 0.8)), '')
      rows.current.forEach((el, k) => {
        const t = ease(seg(b, 0.4 + k * 0.05, 0.8 + k * 0.035))
        style(el, t, `translateY(${((1 - t) * 36).toFixed(1)}px)`)
        const f = fills.current[k]
        if (f) f.style.transform = `scaleX(${((taste.genres[k]?.pct ?? 0) / gmax * ease(seg(b, 0.55 + k * 0.05, 1))).toFixed(4)})`
      })
      side.current.forEach((el, k) => {
        const t = ease(seg(b, 0.48 + k * 0.06, 0.9 + k * 0.025))
        style(el, t, `translateX(${((1 - t) * 48).toFixed(1)}px)`)
      })
    }
    paint()
    return pager.subscribe(paint)
  }, [pager, taste, gmax])

  const genres = taste.genres.length ? (
    <ol className="m-0 flex list-none flex-col p-0" style={{ gap: Math.round((phone ? 10 : 18) * u) }}>
      {taste.genres.map((g, k) => (
        <li
          key={g.name}
          ref={(el) => {
            rows.current[k] = el
          }}
          className="grid items-baseline gap-x-5"
          style={{ gridTemplateColumns: 'minmax(0, 1fr) auto', rowGap: phone ? 6 : 9, color: `rgba(255,255,255,${(1 - k * 0.13).toFixed(2)})` }}
        >
          <span className="min-w-0 font-cjk font-black tracking-[-0.03em] [overflow-wrap:anywhere]" style={{ fontSize: L.genreFs, lineHeight: 1.15 }}>
            {g.name}
            {!phone && (
              <span className="ml-3.5 font-sans text-[11px] font-normal tracking-normal whitespace-nowrap text-white/40 num">
                {count(g.read)} 话 · {g.works} 部
              </span>
            )}
          </span>
          <span className="font-bold num" style={{ fontSize: phone ? 18 : Math.round(26 * u) }}>
            {/* 读得很少的题材四舍五入成 0 像是没读过 */}
            {g.pct < 1 ? '<1' : Math.round(g.pct)}
            <span className="ml-0.5 text-[.5em] text-muted">%</span>
          </span>
          <span aria-hidden className="col-span-2 block h-[3px] overflow-hidden rounded-sm bg-white/5">
            <span
              ref={(el) => {
                fills.current[k] = el
              }}
              className="block h-full origin-left rounded-sm bg-current"
              style={{ transform: 'scaleX(0)' }}
            />
          </span>
        </li>
      ))}
    </ol>
  ) : (
    <p ref={empty} className="m-0 text-sm leading-[1.9] text-muted">
      读过的作品还没有题材标签。
      <br />
      等来源补上题材后，这里会按已读话数排出你的口味。
    </p>
  )

  const cw = phone ? 30 : Math.round(44 * u)
  const authors = taste.authors.length > 0 && (
    <div className="flex min-w-0 flex-col" style={{ gap: Math.round((phone ? 12 : 28) * u), paddingTop: phone ? 0 : 6 }}>
      <span
        ref={(el) => {
          side.current[0] = el
        }}
        className="text-xs font-bold tracking-[.32em] text-muted"
      >
        最常读的作者
      </span>
      {taste.authors.map((a, k) => (
        <div
          key={a.name}
          ref={(el) => {
            side.current[k + 1] = el
          }}
          className="grid items-center"
          style={{ gridTemplateColumns: `${Math.round(cw * 1.4)}px minmax(0, 1fr)`, columnGap: phone ? 14 : 20 }}
        >
          {/* 这位作者读得最多的两部，叠着放 */}
          <span aria-hidden className="relative isolate block" style={{ height: cw * 1.6 }}>
            {a.ids.slice(0, 2).map((id, i) => (
              <span
                key={id}
                className={cn('absolute block overflow-hidden rounded-[2px] bg-white/6 shadow-[0_8px_16px_rgba(0,0,0,.4)]', i === 1 && '-z-10 rotate-6 brightness-70')}
                style={{ width: cw, height: cw * 1.5, left: i * cw * 0.36, top: i * cw * 0.13 }}
              >
                <CoverImg src={coverOf(id)} loading="lazy" draggable={false} />
              </span>
            ))}
          </span>
          <span className="min-w-0">
            <span className="block truncate font-cjk font-bold" style={{ fontSize: phone ? 17 : Math.round(22 * u) }}>
              {a.name}
            </span>
            <span className={cn('block text-[11px] text-muted num', phone ? 'mt-0.5' : 'mt-1.5')}>
              {a.works} 部 · {count(a.read)} 话{a.pages > 0 && ` · 至少 ${count(a.pages)} 页`}
            </span>
          </span>
        </div>
      ))}
    </div>
  )

  return (
    <section aria-label="口味" className="absolute flex flex-col" style={{ left: L.left, width: L.width, top: L.top, bottom: L.bottom, gap: Math.round((phone ? 24 : 46) * u), justifyContent: phone ? 'flex-start' : 'center' }}>
      <BigHead
        ref={(el) => {
          head.current = el
        }}
        eyebrow="03 / 口味 · 按已读话数"
        fs={L.headFs}
        phone={phone}
      >
        {h.lead}
        {h.strong}
        <span className="whitespace-nowrap text-white/30">{h.tail}</span>
      </BigHead>
      <div className={phone ? 'flex flex-col gap-7' : 'grid items-start gap-x-[9%]'} style={phone ? undefined : { gridTemplateColumns: 'minmax(0, 1.55fr) minmax(0, 1fr)' }}>
        <div className="min-w-0">{genres}</div>
        {authors}
      </div>
    </section>
  )
}
