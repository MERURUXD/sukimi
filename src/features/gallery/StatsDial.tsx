import { memo, useEffect, useLayoutEffect, useRef, type CSSProperties, type RefObject } from 'react'
import type { Intro } from './statsIntro'
import { cn } from '@/lib/cn'
import { clamp01 } from './canvasMath'
import { LOAD_CAP, chase, loadTarget } from './loadRing'
import type { HeatDay, ReadingStats } from './stats'
import { easeOut, seg, type Pager } from './statsPager'
import { PAGE } from './useReadChapters'

export type Tip = { kind: 'hour'; h: number } | null

/** 加载时扫光转一圈的秒数，和 gallery.css 的 .gallery-sweep 一致 */
const SWEEP_S = 1.6
const NO_HOURS: number[] = Array(24).fill(0)

/**
 * 表盘整体（含外圈年轮和文字）以时钟的 360 为单位有多宽：年轮刻度到 230，月份到 248，
 * 「最长连续」的字在 272 外，两边再各留一点
 */
export const DIAL_UNITS = 580

/** 鼠标带动表盘最多倾斜多少度 */
const CLOCK_TILT = 24

/**
 * 表盘朝着鼠标在窗口里的位置倾斜（大数字不倾斜，错开一点有层次）；只在鼠标下生效，减少动态效果时不动。
 * 直接写 transform，不进 React 状态。往第二屏去的前 15% 先把倾斜收平，之后表盘只放大淡出，不再带着角度
 */
export function useDialTilt(ref: RefObject<HTMLDivElement | null>, reduced: boolean, pager: Pager) {
  useEffect(() => {
    const el = ref.current
    if (!el || reduced) return
    const cur = { x: 0, y: 0 }
    const to = { x: 0, y: 0 }
    const ping = el.querySelector<HTMLElement>('.gallery-ping')
    let raf = 0
    let last = 0
    let flat = -1
    const frame = (now: number) => {
      const k = 1 - Math.exp(-Math.min(48, now - last) / 150)
      last = now
      cur.x += (to.x - cur.x) * k
      cur.y += (to.y - cur.y) * k
      const f = 1 - seg(pager.p, 0, 0.15)
      flat = f
      // 法线朝向鼠标：鼠标在右，右边缘退后；鼠标在下，下边缘退后
      el.style.transform = `rotateX(${(-cur.y * f).toFixed(2)}deg) rotateY(${(cur.x * f).toFixed(2)}deg)`
      raf = Math.abs(to.x - cur.x) > 0.02 || Math.abs(to.y - cur.y) > 0.02 ? requestAnimationFrame(frame) : 0
      if (ping) ping.style.animationPlayState = raf || pager.p !== 0 || pager.animating ? 'paused' : ''
    }
    const kick = () => {
      if (raf) return
      last = performance.now()
      raf = requestAnimationFrame(frame)
    }
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      to.x = (e.clientX / window.innerWidth - 0.5) * 2 * CLOCK_TILT
      to.y = (e.clientY / window.innerHeight - 0.5) * 2 * CLOCK_TILT
      kick()
    }
    const onLeave = () => {
      to.x = 0
      to.y = 0
      kick()
    }
    const off = pager.subscribe(() => {
      if (flat !== 1 - seg(pager.p, 0, 0.15)) kick()
    })
    window.addEventListener('pointermove', onMove)
    document.documentElement.addEventListener('pointerleave', onLeave)
    return () => {
      off()
      window.removeEventListener('pointermove', onMove)
      document.documentElement.removeEventListener('pointerleave', onLeave)
      cancelAnimationFrame(raf)
      el.style.transform = ''
    }
  }, [ref, reduced, pager])
}

/**
 * 加载时的外圈进度，盖在虚线外圈上。每帧直接改 SVG 属性，不进 React 状态：
 * 大书库要取好一阵，每帧重绘整页太浪费。算法见 loadRing.ts；汇总出来后滑满并淡出。
 */
function LoadRing({ size, fetched, expected, active, done, reduced, transform }: { size: number; fetched: number; expected: number | null; active: boolean; done: boolean; reduced: boolean; transform: string }) {
  const ref = useRef<SVGCircleElement>(null)
  const props = useRef({ fetched, expected, active, done })
  props.current = { fetched, expected, active, done }
  const c = size / 2
  const r = c - 14 * (size / 360)
  const len = 2 * Math.PI * r
  useEffect(() => {
    const el = ref.current
    if (!el) return
    let shown = 0
    let last = performance.now()
    let pageAt = last
    let seen = -1
    let doneAt = 0
    let from = 0
    let raf = 0
    const paint = (v: number, opacity: number) => {
      el.style.strokeDashoffset = `${(len * (1 - v)).toFixed(2)}`
      el.style.opacity = `${opacity}`
    }
    const frame = (now: number) => {
      const p = props.current
      const dt = Math.min(64, now - last)
      last = now
      if (p.done) {
        if (reduced) return paint(1, 0)
        if (!doneAt) {
          doneAt = now
          from = shown
        }
        const k = clamp01((now - doneAt) / 600)
        paint(from + (1 - from) * easeOut(k), 1 - k * k)
        if (k < 1) raf = requestAnimationFrame(frame)
        return
      }
      if (!p.active) {
        // 落地前、失败时停在原处；重新开始时从这一刻算等待
        pageAt = now
      } else {
        if (p.fetched !== seen) {
          seen = p.fetched
          pageAt = now
        }
        const target = loadTarget(p.fetched, p.expected, PAGE, reduced ? 0 : now - pageAt)
        shown = reduced ? Math.max(shown, target) : chase(shown, target, dt)
      }
      paint(Math.min(LOAD_CAP, shown), 1)
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [len, reduced])
  return (
    <svg aria-hidden className="pointer-events-none absolute inset-0 overflow-visible" width={size} height={size} style={{ transform }}>
      <circle
        ref={ref}
        cx={c}
        cy={c}
        r={r}
        fill="none"
        stroke="rgba(255,255,255,.6)"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeDasharray={len}
        strokeDashoffset={len}
        transform={`rotate(-90 ${c} ${c})`}
      />
    </svg>
  )
}

export interface YearRing {
  days: HeatDay[]
  /** 近半年最长的一段连续阅读（下标，含两端） */
  run: { from: number; to: number; len: number } | null
  /** 手机上按周画：182 根太细，挤成一圈灰 */
  weekly: boolean
}

const monthOf = (t: number) => `${new Date(t).getMonth() + 1} 月`

/** 时钟外面的一圈：近半年每天（手机每周）一根刻度，从正下方开始顺时针走到现在；最长连续的那一段点亮 */
const YearRingSvg = memo(function YearRingSvg({ ring, intro }: { ring: YearRing; intro: Intro }) {
  const ref = useRef<SVGSVGElement>(null)
  const t = intro.t
  const { days, run, weekly } = ring
  const bars = weekly
    ? Array.from({ length: days.length / 7 }, (_, w) => {
        const week = days.slice(w * 7, w * 7 + 7)
        return { date: week[0].date, n: week.reduce((a, d) => a + d.count, 0), future: week.every((d) => d.future), hot: !!run && w * 7 + 6 >= run.from && w * 7 <= run.to }
      })
    : days.map((d, i) => ({ date: d.date, n: d.count, future: d.future, hot: !!run && i >= run.from && i <= run.to }))
  const max = Math.max(1, ...bars.map((b) => b.n))
  const angle = (i: number) => 180 + ((i + 0.5) / bars.length) * 360
  const at = (i: number, r: number) => {
    const a = (angle(i) * Math.PI) / 180
    return { x: Math.sin(a) * r, y: -Math.cos(a) * r }
  }
  const months = bars.flatMap((b, i) => {
    const d = new Date(b.date)
    return (weekly ? d.getDate() <= 7 : d.getDate() === 1) ? [{ i, label: monthOf(b.date) }] : []
  })
  const runMid = run && run.len > 1 ? (weekly ? (run.from + run.to) / 14 - 0.5 : (run.from + run.to) / 2) : -1
  const runAt = at(Math.max(0, runMid), 274)
  const w = weekly ? 6 : 2.2
  const H = DIAL_UNITS / 2
  useLayoutEffect(() => {
    const rects = ref.current?.querySelectorAll<SVGRectElement>('rect')
    const labels = ref.current?.querySelector('g')
    return intro.subscribe(() => {
      rects?.forEach((el, i) => {
        const b = bars[i]
        const grow = easeOut((intro.t - 0.22 - i / bars.length * 0.4) / 0.35)
        const len = (b.n ? 4 + b.n / max * 22 : 3) * (0.25 + 0.75 * grow)
        el.setAttribute('y', String(-(204 + len)))
        el.setAttribute('height', String(len))
        el.setAttribute('opacity', String(clamp01(grow * 3)))
      })
      labels?.setAttribute('opacity', String(easeOut((intro.t - 0.45) / 0.4)))
    })
  }, [intro, bars, max])
  return (
    <svg ref={ref} aria-hidden className="pointer-events-none absolute overflow-visible" viewBox={`${-H} ${-H} ${H * 2} ${H * 2}`} style={{ inset: `${-((DIAL_UNITS - 360) / 2 / 360) * 100}%` }}>
      {bars.map((b, i) => {
        const grow = easeOut((t - 0.22 - (i / bars.length) * 0.4) / 0.35)
        const len = (b.n ? 4 + (b.n / max) * 22 : 3) * (0.25 + 0.75 * grow)
        return (
          <rect
            key={b.date}
            x={-w / 2}
            y={-(204 + len)}
            width={w}
            height={len}
            rx={w / 2}
            opacity={clamp01(grow * 3)}
            fill={b.future ? 'rgba(255,255,255,.05)' : !b.n ? 'rgba(255,255,255,.1)' : b.hot ? 'rgba(255,255,255,.92)' : 'rgba(255,255,255,.42)'}
            transform={`rotate(${angle(i).toFixed(2)})`}
          />
        )
      })}
      <g opacity={easeOut((t - 0.45) / 0.4)}>
        {months.map(({ i, label }) => {
          const p = at(i, 248)
          return (
            <text key={i} x={p.x} y={p.y + 4} fill="rgba(255,255,255,.4)" fontSize={weekly ? 13 : 10} textAnchor="middle">
              {label}
            </text>
          )
        })}
        {runMid >= 0 && run && (
          <text x={runAt.x} y={runAt.y + 4} fill="#fff" fontSize={weekly ? 14 : 10.5} fontWeight={700} textAnchor="middle">
            近半年最长连续 {run.len} 天
          </text>
        )}
      </g>
    </svg>
  )
})

/**
 * 24 小时时钟，外面可以再套一圈近半年年轮。几层叠在不同深度的平面上：底光、外圈与辐条在最后，刻度居中，
 * 越高的刻度越往前浮，「现在」和读得最多的那格最前；鼠标带动整体倾斜时各层错开，才有立体感。
 */
export const Clock = memo(function Clock({
  stats,
  intro,
  flat,
  size,
  tip,
  onTip,
  load,
  read,
  failed,
  reduced,
  year,
  className,
}: {
  /** 还在加载时为 null：只摆出空刻度和外圈 */
  stats: ReadingStats | null
  intro: Intro
  flat?: boolean
  size: number
  tip: Tip
  onTip: (t: Tip) => void
  /** 一进来就在加载：外圈不再跟着进场淡入，加载时扫光、走进度；landed 为已读话数是否已落地 */
  load?: { fetched: number; landed: boolean } | null
  /** 已读话数，用来估算加载进度 */
  read?: number | null
  failed?: boolean
  reduced?: boolean
  year?: YearRing | null
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const t = intro.t
  const k = size / 360
  const c = size / 2
  const hours = stats?.hours ?? NO_HOURS
  const peak = stats?.peak ?? -1
  const max = Math.max(1, ...hours)
  const timed = hours.reduce((a, b) => a + b, 0)
  const now = new Date()
  const nowDeg = (now.getHours() + now.getMinutes() / 60) * 15
  const radius = 112 * k
  const hourTip = tip?.kind === 'hour' ? tip.h : -1
  const barLen = (n: number) => (6 + (n / max) * 44) * k
  // 加载时外圈已经摆出来了（挂上时自己淡入），进场就不再从 0 淡入一遍
  const ringIn = load ? 1 : easeOut((t - 0.05) / 0.5)
  // 扫光等已读话数落地再开始；减少动态效果或加载失败时不扫
  const sweep = !stats && !!load?.landed && !reduced && !failed
  const z = (px: number) => flat ? '' : `translateZ(${(px * k).toFixed(1)}px)`
  useLayoutEffect(() => {
    const rings = ref.current?.querySelectorAll<HTMLElement>('[data-clock-ring]')
    const marks = ref.current?.querySelectorAll<HTMLElement>('[data-clock-hour]')
    const dashed = ref.current?.querySelector<HTMLElement>('[data-clock-dashed]')
    return intro.subscribe(() => {
      const e = load ? 1 : easeOut((intro.t - 0.05) / 0.5)
      rings?.forEach((el) => { el.style.opacity = String(e) })
      if (dashed) dashed.style.rotate = `${(1 - e) * -40}deg`
      marks?.forEach((el, h) => {
        const grow = easeOut((intro.t - 0.08 - h * 0.022) / 0.4)
        el.style.height = `${Math.max(4, (6 + hours[h] / max * 44 * grow) * k)}px`
      })
    })
  }, [intro, load, hours, max, k])
  return (
    <div
      ref={ref}
      role="img"
      aria-label={stats ? `24 小时阅读时钟：有阅读时间的 ${timed} 话${peak >= 0 ? `，${peak} 点读得最多` : ''}` : '24 小时阅读时钟：正在汇总'}
      className={cn('flex-none', className ?? 'relative', load && !reduced && 'gallery-clock-in')}
      style={{ width: size, height: size, transformStyle: flat ? undefined : 'preserve-3d' }}
      onMouseLeave={() => onTip(null)}
    >
      <div data-clock-ring aria-hidden className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,.07),transparent_66%)]" style={{ transform: z(-90), opacity: ringIn }} />
      <div data-clock-ring aria-hidden className="absolute rounded-full border border-white/9" style={{ inset: -8 * k, transform: z(-64), opacity: ringIn }} />
      <div data-clock-ring aria-hidden className="absolute rounded-full border border-white/7" style={{ inset: 64 * k, transform: z(-36), opacity: ringIn }} />
      {/* 每三小时一根辐条，夹在两根刻度之间，从内圈向外淡出 */}
      {Array.from({ length: 8 }, (_, i) => (
        <div data-clock-ring key={i} aria-hidden className="absolute size-0" style={{ left: c, top: c, transform: `rotate(${i * 45 + 7.5}deg) ${z(-48)}`, opacity: ringIn }}>
          <span className="absolute w-px bg-[linear-gradient(to_top,transparent,rgba(255,255,255,.16))]" style={{ left: -0.5, bottom: 78 * k, height: 90 * k }} />
        </div>
      ))}
      {year && (
        <div className="absolute inset-0" style={{ transform: z(-28) }}>
          <YearRingSvg ring={year} intro={intro} />
        </div>
      )}
      <div data-clock-ring data-clock-dashed aria-hidden className="absolute rounded-full border border-dashed border-white/10" style={{ inset: 14 * k, opacity: ringIn, rotate: `${(1 - ringIn) * -40}deg`, transform: z(-24) }} />
      {load && <LoadRing size={size} fetched={load.fetched} expected={read ?? null} active={load.landed && !failed} done={!!stats} reduced={!!reduced} transform={z(-24)} />}
      {hours.map((n, h) => {
        const grow = easeOut((t - 0.08 - h * 0.022) / 0.4)
        const hot = h === peak
        const on = h === hourTip
        return (
          <div key={h} className="absolute size-0" style={{ left: c, top: c, transform: `rotate(${h * 15}deg) ${z((n / max) * 34 + (hot ? 12 : 0))}` }}>
            <span
              className="absolute flex items-end justify-center"
              style={{ left: -11 * k, bottom: radius, width: 22 * k, height: 52 * k }}
              onMouseEnter={stats ? () => onTip({ kind: 'hour', h }) : undefined}
              onClick={stats ? () => onTip(on ? null : { kind: 'hour', h }) : undefined}
            >
              <span
                data-clock-hour
                className={cn('block rounded-full transition-[background-color,box-shadow] duration-200', sweep && 'gallery-sweep')}
                style={{
                  width: 8 * k,
                  // 从加载时的最短刻度（6）长到实际长度，汇总出来时不会先缩一下
                  height: Math.max(4, (6 + (n / max) * 44 * grow) * k),
                  background: hot || on ? '#fff' : sweep ? 'rgba(255,255,255,.8)' : n ? 'rgba(255,255,255,.26)' : 'rgba(255,255,255,.1)',
                  // 扫光按钟点错开，像秒针顺时针扫过（周期见 gallery.css）
                  animationDelay: sweep ? `${((h / 24 - 1) * SWEEP_S).toFixed(3)}s` : undefined,
                  boxShadow: hot ? '0 0 14px rgba(255,255,255,.85)' : on ? '0 0 10px rgba(255,255,255,.6)' : undefined,
                }}
              />
            </span>
          </div>
        )
      })}
      {/* 现在几点 */}
      <div data-clock-ring aria-hidden className="absolute size-0" style={{ left: c, top: c, transform: `rotate(${nowDeg}deg) ${z(54)}`, opacity: ringIn }}>
        <span className="gallery-ping absolute size-3 rounded-full border-[1.5px] border-white" style={{ left: -6, bottom: radius + 54 * k }} />
        <span className="absolute size-2.5 rounded-full bg-white shadow-[0_0_14px_#fff]" style={{ left: -5, bottom: radius + 55 * k }} />
      </div>
      {(
        [
          ['0', { left: c, top: 2, transform: 'translateX(-50%)' }],
          ['6', { right: 0, top: c, transform: 'translateY(-50%)' }],
          ['12', { left: c, bottom: 0, transform: 'translateX(-50%)' }],
          ['18', { left: 0, top: c, transform: 'translateY(-50%)' }],
        ] as [string, CSSProperties][]
      ).map(([label, style]) => (
        <span data-clock-ring key={label} aria-hidden className="absolute text-[11px] text-faint" style={{ ...style, transform: `${style.transform ?? ''} ${z(22)}`, opacity: ringIn }}>
          {label}
        </span>
      ))}
      {stats && hourTip >= 0 && (
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
})

/**
 * 四项数字下面的小条图，和表盘一样用圆头竖条：比例类按比例点亮，时间类按高低画；
 * 进场时从左往右长出来。右对齐的一组整体靠右，最后一根贴齐页边距
 */
export const Strip = memo(function Strip({ bars, width, height, right, intro, at, label }: { bars: { v: number; on?: boolean; lit?: boolean }[]; width: number; height: number; right?: boolean; intro: Intro; at: number; label: string }) {
  const ref = useRef<SVGSVGElement>(null)
  const t = intro.t
  const step = width / bars.length
  const span = (bars.length - 1) * step + 3
  const off = right ? width - span : 0
  const max = Math.max(1e-9, ...bars.map((b) => b.v))
  useLayoutEffect(() => {
    const rects = ref.current?.querySelectorAll('rect')
    return intro.subscribe(() => rects?.forEach((el, i) => {
      const g = easeOut((intro.t - at - i * 0.008) / 0.3)
      const h = (3 + bars[i].v / max * (height - 3)) * g
      el.setAttribute('y', String(height - h))
      el.setAttribute('height', String(h))
    }))
  }, [intro, bars, at, height, max])
  return (
    <svg ref={ref} role="img" aria-label={label} width={width} height={height} className="block overflow-visible">
      {bars.map((b, i) => {
        const g = easeOut((t - at - i * 0.008) / 0.3)
        const h = (3 + (b.v / max) * (height - 3)) * g
        return <rect key={i} x={off + i * step} y={height - h} width={3} height={h} rx={1.5} fill={b.lit ? 'rgba(255,255,255,.95)' : b.on ? 'rgba(255,255,255,.5)' : 'rgba(255,255,255,.14)'} />
      })}
    </svg>
  )
})
