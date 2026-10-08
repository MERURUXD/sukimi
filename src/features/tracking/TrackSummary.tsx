import { useQuery } from '@apollo/client/react'
import { AnimatePresence } from 'motion/react'
import { ChevronRight, ListChecks, Minus, Plus, Star } from 'lucide-react'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router'
import { SourceIcon } from '@/features/browse/SourceIcon'
import { Select } from '@/features/settings/parts'
import { chapterNo } from '@/lib/format'
import { cn } from '@/lib/cn'
import { MangaTracks, Trackers, type Tracker, type TrackRecord } from './queries'
import { Stars } from './Stars'
import { TrackDialog } from './TrackPanel'
import { scoreString, scoreValue, scoreWord, starScale, statusLabel } from './tracking'
import { useSaveTrack } from './useSaveTrack'

const WIDE = '(min-width: 1280px)'

function useWide() {
  const [on, setOn] = useState(() => window.matchMedia(WIDE).matches)
  useEffect(() => {
    const query = window.matchMedia(WIDE)
    const update = () => setOn(query.matches)
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  return on
}

/**
 * 详情页里的追踪。宽屏（≥1280）在头部右侧空白处直接展开面板（placement="side"），顶端与书名对齐；
 * 更窄时在正文里显示占满一行的信息条（placement="inline"），点一下直接打开完整的追踪设置。
 * 两处各挂一份，按宽度只显示其一
 */
export function TrackSummary({ mangaId, title, placement, className, style }: { mangaId: number; title: string; placement: 'inline' | 'side'; className?: string; style?: CSSProperties }) {
  const trackers = useQuery(Trackers).data?.trackers.nodes
  const records = useQuery(MangaTracks, { variables: { id: mangaId } }).data?.manga.trackRecords.nodes
  const [dialog, setDialog] = useState(false)
  const opener = useRef<HTMLElement | null>(null)
  const wide = useWide()
  if (!trackers || !records || wide !== (placement === 'side')) return null

  const rows = records.flatMap((r) => {
    const t = trackers.find((x) => x.id === r.trackerId)
    return t ? [{ t, r }] : []
  })
  const unbound = trackers.filter((t) => t.isLoggedIn && !records.some((r) => r.trackerId === t.id))
  if (!rows.length && !unbound.length) return null

  const openDialog = (el: HTMLElement) => {
    opener.current = el
    setDialog(true)
  }

  return (
    <section aria-label="追踪" style={style} className={cn('flex flex-col', wide ? 'gap-9' : 'gap-1', className)}>
      {rows.map(({ t, r }) => (wide ? <TrackPanel key={r.id} t={t} r={r} onDetail={openDialog} /> : <TrackStrip key={r.id} t={t} r={r} onOpen={openDialog} />))}
      {!rows.length && (
        <button type="button" className="-ml-1 inline-flex min-h-9 items-center gap-1.5 self-start rounded-full px-1 text-[13px] font-semibold text-muted transition-colors hover:text-text" onClick={(e) => openDialog(e.currentTarget)}>
          <ListChecks className="size-4" strokeWidth={1.8} />
          追踪到 {unbound.map((t) => t.name).join(' / ')}
          <ChevronRight className="size-4" />
        </button>
      )}
      {createPortal(
        <AnimatePresence>{dialog && <TrackDialog mangaId={mangaId} title={title} onClose={() => { setDialog(false); opener.current?.focus({ preventScroll: true }) }} />}</AnimatePresence>,
        document.body,
      )}
    </section>
  )
}

/* ───────── 窄屏：占满一行的信息条，状态 / 进度 / 评分三栏，只靠留白分隔 ───────── */

function TrackStrip({ t, r, onOpen }: { t: Tracker; r: TrackRecord; onOpen: (el: HTMLElement) => void }) {
  const status = t.statuses.find((s) => s.value === r.status)
  const score = scoreValue(r.displayScore)
  const scale = starScale(t.scores)
  const word = scoreWord(t.name, score)
  const cell = 'flex min-w-0 flex-col items-center gap-1'
  const caption = 'text-[11px] leading-none font-semibold tracking-[.06em] text-faint'
  const value = 'text-[19px] leading-none font-bold num'
  const sub = 'max-w-full truncate text-[11px] leading-none text-muted'
  return (
    <button
      type="button"
      onClick={(e) => onOpen(e.currentTarget)}
      aria-label={`${t.name} 追踪：${status ? statusLabel(status.name) : '未设置'}，读到第 ${chapterNo(r.lastChapterRead)} 话，${score ? `${r.displayScore} 分` : '未评分'}。打开追踪设置`}
      className="-mx-2 grid grid-cols-3 items-start rounded-2xl px-2 py-2.5 transition-colors hover:bg-hover active:bg-hover"
    >
      <span className={cell}>
        <span className={caption}>状态</span>
        <span className={value}>{status ? statusLabel(status.name) : '—'}</span>
        <span className={cn(sub, 'inline-flex items-center gap-1')}>
          <SourceIcon s={{ iconUrl: t.icon, displayName: t.name }} size={12} />
          <span className="truncate">{t.name}</span>
        </span>
      </span>
      <span className={cell}>
        <span className={caption}>进度</span>
        <span className={value}>{chapterNo(r.lastChapterRead)}</span>
        <span className={sub}>{r.totalChapters > 0 ? `共 ${r.totalChapters} 话` : '话'}</span>
      </span>
      <span className={cell}>
        <span className={caption}>评分</span>
        <span className={value}>{score > 0 ? r.displayScore : '—'}</span>
        {score > 0 && scale ? <MiniStars value={score} max={scale} /> : <span className={sub}>{score > 0 ? word || '已评分' : '未评分'}</span>}
      </span>
    </button>
  )
}

/** 信息条里的小星星，只展示不交互 */
function MiniStars({ value, max }: { value: number; max: number }) {
  const per = max / 5
  return (
    <span className="flex h-[11px] items-center gap-px" aria-hidden>
      {Array.from({ length: 5 }, (_, i) => {
        const fill = Math.max(0, Math.min(1, (value - i * per) / per))
        return (
          <span key={i} className="relative size-[11px]">
            <Star className="absolute inset-0 size-[11px] text-faint" strokeWidth={2} />
            <Star className="absolute inset-0 size-[11px] fill-current text-muted" strokeWidth={2} style={{ clipPath: `inset(0 ${100 - fill * 100}% 0 0)` }} />
          </span>
        )
      })}
    </span>
  )
}

/* ───────── 宽屏：直接展开，内容全部左对齐 ───────── */

function TrackPanel({ t, r, onDetail }: { t: Tracker; r: TrackRecord; onDetail: (el: HTMLElement) => void }) {
  const save = useSaveTrack(r)
  const scale = starScale(t.scores)
  const score = scoreValue(r.displayScore)
  const total = r.totalChapters
  const read = r.lastChapterRead
  const step = (d: number) => {
    const n = Math.max(0, Math.floor(read) + d)
    save({ lastChapterRead: total > 0 ? Math.min(n, total) : n })
  }
  return (
    <div className="flex flex-col items-start gap-5">
      <div className="flex w-full items-center gap-2.5">
        <SourceIcon s={{ iconUrl: t.icon, displayName: t.name }} size={28} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-semibold">{t.name}</span>
          <span className="truncate text-xs text-muted">{r.title}</span>
        </span>
        <button type="button" className="-mr-1 inline-flex min-h-9 flex-none items-center rounded-full pl-2 text-[13px] font-semibold text-muted transition-colors hover:text-text" onClick={(e) => onDetail(e.currentTarget)}>
          详细设置
          <ChevronRight className="size-4" />
        </button>
      </div>
      {t.isTokenExpired && <Link to="/settings/tracking" className="-mt-2 text-[13px] font-semibold text-danger">登录已过期，去设置里重新登录</Link>}

      <div role="group" aria-label="阅读状态" className="flex flex-wrap gap-1.5">
        {t.statuses.map((s) => (
          <button key={s.value} type="button" className={cn('fopt', r.status === s.value && 'inc')} aria-pressed={r.status === s.value} onClick={() => r.status !== s.value && save({ status: s.value })}>
            {statusLabel(s.name)}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <button type="button" className="gicon size-10 disabled:opacity-40" aria-label="少一话" disabled={read <= 0} onClick={() => step(-1)}>
          <Minus className="size-4" />
        </button>
        <span className="min-w-[7.5em] text-center text-sm text-muted num" aria-live="polite">
          读到 <b className="text-[19px] font-bold text-text">{chapterNo(read)}</b> / {total > 0 ? total : '?'} 话
        </span>
        <button type="button" className="gicon size-10 disabled:opacity-40" aria-label="多一话" disabled={total > 0 && read >= total} onClick={() => step(1)}>
          <Plus className="size-4" />
        </button>
      </div>

      {scale ? (
        <span className="-ml-1">
          <Stars size="md" max={scale} value={Math.min(score, scale)} word={(v) => scoreWord(t.name, v)} onChange={(v) => save({ scoreString: scoreString(t.scores, v) })} />
        </span>
      ) : t.scores.length > 0 ? (
        <Select
          label="评分"
          value={r.displayScore}
          options={(t.scores.includes(r.displayScore) ? t.scores : [r.displayScore, ...t.scores]).map((s) => ({ value: s, label: s || '未评分' }))}
          onChange={(s) => save({ scoreString: s })}
          className="w-[120px]"
        />
      ) : null}
    </div>
  )
}
