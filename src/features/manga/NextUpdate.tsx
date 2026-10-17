import { AnimatePresence } from 'motion/react'
import { CalendarClock } from 'lucide-react'
import { useEffect, useId, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { Popover } from '@/components/ui/Popover'
import { isStalled } from '@/features/updates/calendar'
import { daysBetween, intervalLabel, predict, regularLabel, shortText, type Prediction } from '@/features/updates/predict'
import { cn } from '@/lib/cn'
import { ms, sec } from '@/lib/format'
import type { Chapter, Manga } from './queries'

export type NextPrediction = Extract<Prediction, { kind: 'next' }>

/** 详情页要显示的推算：推算不出、或者晚太久当作停更的都不显示 */
export function mangaPrediction(manga: Pick<Manga, 'status' | 'updateStrategy'>, chapters: readonly Chapter[]): NextPrediction | null {
  const p = predict(
    chapters.map((c) => ({ uploadDate: ms(c.uploadDate), fetchedAt: sec(c.fetchedAt) })),
    { status: manga.status, updateStrategy: manga.updateStrategy },
  )
  return p.kind === 'next' && !isStalled(p) ? p : null
}

/** 元信息那一行末尾的「预计周三 10/21 更新」，点开看最近几话的更新节奏 */
export function NextUpdate({ p, className, style }: { p: NextPrediction; className?: string; style?: CSSProperties }) {
  const [open, setOpen] = useState(false)
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width: 767px)').matches)
  const id = useId()
  useEffect(() => {
    const q = window.matchMedia('(max-width: 767px)')
    const update = () => { setMobile(q.matches); setOpen(false) }
    q.addEventListener('change', update)
    return () => q.removeEventListener('change', update)
  }, [])
  const label = '更新节奏'
  const button = (
    <button
      type="button"
      style={style}
      className={cn('inline-flex cursor-pointer items-center gap-1 border-0 bg-transparent p-0 text-inherit underline decoration-dashed decoration-1 underline-offset-4 hover:text-text', p.late > 0 && 'text-text', className)}
      aria-expanded={open}
      aria-controls={open ? id : undefined}
      aria-haspopup="dialog"
      onClick={() => setOpen((v) => !v)}
    >
      <CalendarClock className="size-3.5 flex-none" strokeWidth={1.9} aria-hidden />
      {shortText(p)}
    </button>
  )
  const content = <Rhythm p={p} titled={!mobile} />
  return (
    <>
      {mobile ? button : (
        <Popover id={id} open={open} onClose={() => setOpen(false)} label={label} align="left" rootClassName="inline-block" className="w-[320px] max-w-[calc(100vw-32px)] p-4" trigger={button}>
          {content}
        </Popover>
      )}
      {mobile && createPortal(
        <AnimatePresence>{open && <BottomSheet id={id} label={label} onClose={() => setOpen(false)}><div className="px-2 pb-2">{content}</div></BottomSheet>}</AnimatePresence>,
        document.body,
      )}
    </>
  )
}

/**
 * 最近几个发布日按真实间隔排在一条线上，末尾虚线圈是预计的下一次。
 * titled=false：底部弹层自己有标题，这里不再重复
 */
function Rhythm({ p, titled }: { p: NextPrediction; titled: boolean }) {
  const days = p.days.slice(-8)
  const gaps = days.slice(1).map((d, i) => daysBetween(days[i], d))
  const slack = Math.max(1, Math.round(p.interval * 0.2))
  const onTime = gaps.filter((g) => Math.abs(g - p.interval) <= slack).length
  const W = 288
  const pad = 8
  const span = Math.max(1, p.next - days[0])
  const x = (t: number) => pad + ((t - days[0]) / span) * (W - pad * 2)
  const md = (t: number) => `${new Date(t).getMonth() + 1}/${new Date(t).getDate()}`
  const lastX = x(days[days.length - 1])
  return (
    <div className="text-sm">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        {titled && <span className="font-semibold">更新节奏</span>}
        <span className="text-xs text-muted">{intervalLabel(p.interval)} · {regularLabel(p)}</span>
      </div>
      <svg viewBox={`0 0 ${W} 40`} className="block w-full overflow-visible text-text" aria-hidden>
        <line x1={pad} y1={12} x2={lastX} y2={12} stroke="currentColor" strokeOpacity={0.3} />
        <line x1={lastX} y1={12} x2={W - pad} y2={12} stroke="currentColor" strokeOpacity={0.45} strokeDasharray="3 3" />
        {days.map((d) => <circle key={d} cx={x(d)} cy={12} r={3.5} fill="currentColor" />)}
        <circle cx={W - pad} cy={12} r={5} fill="none" stroke="currentColor" strokeDasharray="2 2" />
        <text x={pad} y={34} fontSize={11} fill="currentColor" fillOpacity={0.5}>{md(days[0])}</text>
        {lastX - pad > 60 && W - pad - lastX > 30 && <text x={lastX} y={34} fontSize={11} textAnchor="middle" fill="currentColor" fillOpacity={0.6}>{md(days[days.length - 1])}</text>}
        <text x={W - pad} y={34} fontSize={11} textAnchor="end" fill="currentColor">{p.late > 0 ? '应在' : '预计'} {md(p.next)}</text>
      </svg>
      <p className="m-0 mt-2.5 leading-relaxed text-muted">
        {gaps.length > 0 && <>最近 {gaps.length} 次间隔里 {onTime} 次准时<br /></>}
        最近一次 {md(days[days.length - 1])}
        {p.late > 0 && `，比平时晚了 ${p.late} 天`}
      </p>
      <p className="m-0 mt-2 text-xs leading-relaxed text-muted">
        {p.approx ? '来源没给发布日期，按服务端抓到的时间推算，仅供参考。' : '按最近几话的发布日期推算，仅供参考。'}
      </p>
      <Link to="/updates?view=calendar" className="mt-2 inline-block text-xs font-semibold text-text no-underline hover:underline">在更新日历里看</Link>
    </div>
  )
}
