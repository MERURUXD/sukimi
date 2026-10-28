import { AnimatePresence } from 'motion/react'
import { ChevronRight, ExternalLink, RefreshCw, Search, X } from 'lucide-react'
import { useEffect, useState, type CSSProperties, type FormEvent } from 'react'
import { MotionGlass } from '@/components/glass/Glass'
import { Dialog, usePopMotion } from '@/components/ui/Dialog'
import { scoreWord } from '@/features/tracking/tracking'
import { cn } from '@/lib/cn'
import { timeAgo } from '@/lib/format'
import { searchSubjects, setBgmMatch, useBgmGuess, useBgmSubject, type BgmMatch, type BgmState } from './api'
import { shortCount, subjectUrl, type BgmSubject } from './rating'
import { introRise as rise } from '@/features/manga/intro'
import './CommunityRating.css'
import { t } from '@/i18n'

const word = (s: BgmSubject) => scoreWord('bangumi', Math.round(s.score))
const facts = (s: BgmSubject) => [word(s), s.rank ? `#${s.rank}` : t('bangumi.unranked'), t('bangumi.people', { n: shortCount(s.total) })].filter(Boolean).join(' · ')

/* ───────── 柱状图：1–10 分各有多少人，自己打的那一分标亮并在下方写「你」 ───────── */

/** 数据没到时的占位高度：摆成大致的山形，来数据后原地长到真实高度 */
const WAIT = [8, 8, 10, 14, 22, 34, 46, 52, 40, 24]

/**
 * counts 为 null 时显示占位柱。带数据挂载时从底部逐根长出，delay 是起始延迟（详情页进场时接在评分行之后）；
 * 先占位、后来数据时不再等 delay，直接过渡
 */
function Histogram({ counts, mine = 0, height, labels = 'ends', delay = 0 }: { counts: number[] | null; mine?: number; height: number; labels?: 'ends' | 'all'; delay?: number }) {
  // 只看挂载那一刻：占位换成数据时用高度过渡，不再整组重播
  const [grow] = useState(() => counts !== null)
  const max = Math.max(1, ...(counts ?? []))
  return (
    <div aria-hidden>
      <div className="flex items-end gap-[3px]" style={{ height, '--d': `${delay}ms` } as CSSProperties}>
        {(counts ?? WAIT).map((n, i) => (
          <span
            key={i}
            className={cn('bgm-bar flex-1 rounded-[2px]', !counts ? 'wait bg-text/10' : i + 1 === mine ? 'bg-text' : 'bg-text/20', counts && grow && 'grow')}
            style={{ height: counts ? `${Math.max(3, (n / max) * 100)}%` : `${n}%`, '--i': i } as CSSProperties}
          />
        ))}
      </div>
      <div className="mt-1 flex gap-[3px] text-center text-[11px] leading-none text-faint num">
        {Array.from({ length: 10 }, (_, i) => {
          const s = i + 1
          const text = counts && s === mine ? t('bangumi.you') : labels === 'all' || s === 1 || s === 5 || s === 10 ? String(s) : ''
          return <span key={i} className={cn('flex-1', counts && s === mine && 'font-semibold text-text')}>{text}</span>
        })}
      </div>
    </div>
  )
}

/** 分数从 0 数上来，和柱子一起到位；减少动态效果时直接显示 */
function Score({ value, delay = 0 }: { value: number; delay?: number }) {
  const [shown, setShown] = useState(() => (value && !matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : value))
  useEffect(() => {
    if (!value || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let frame = 0
    const start = performance.now() + delay
    const tick = (now: number) => {
      const p = Math.min(1, Math.max(0, (now - start) / 600))
      setShown(value * (1 - (1 - p) ** 3))
      if (p < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    // 后台标签页等不跑逐帧回调时，到点直接落到最终分数，不卡在 0.0
    const done = setTimeout(() => setShown(value), delay + 700)
    return () => {
      cancelAnimationFrame(frame)
      clearTimeout(done)
    }
  }, [value, delay])
  return <>{value ? shown.toFixed(1) : '—'}</>
}

/** 读屏用的分布说明：图本身 aria-hidden */
const describe = (s: BgmSubject) => t('bangumi.describe', { score: s.score.toFixed(1), facts: facts(s), top: s.counts.indexOf(Math.max(...s.counts)) + 1 })

function Status({ state, id, onRetry, className }: { state: BgmState; id?: number; onRetry: () => void; className?: string }) {
  if (state === 'loading') return <span className={cn('text-[13px] text-muted', className)}>{t('bangumi.querying')}</span>
  // 公开接口对未登录访问的 NSFW 条目也返回 404，不能断言条目不存在
  if (state === 'missing')
    return (
      <span className={cn('text-[13px] text-muted', className)}>
        {t('bangumi.missing')}
        {id ? <a href={subjectUrl(id)} target="_blank" rel="noreferrer" className="ml-1 font-semibold text-muted hover:text-text">{t('bangumi.openOn')}</a> : null}
      </span>
    )
  return (
    <button type="button" className={cn('self-start text-[13px] font-semibold text-muted hover:text-text', className)} onClick={onRetry}>
      {t('bangumi.loadFailed')}
    </button>
  )
}

/* ───────── 宽屏：追踪面板里星星下方那一段 ───────── */

/**
 * 已绑定 Bangumi 追踪时，用绑定的条目号查；mine 是自己的评分（0 为未评）。
 * delay 是详情页进场时这一行的延迟：柱子和分数接在它之后
 */
export function BgmBlock({ id, mine, delay = 0 }: { id: number; mine: number; delay?: number }) {
  const { subject, state, at, refresh } = useBgmSubject(id)
  const [open, setOpen] = useState(false)
  // 缓存秒开时跟着进场节奏走；数据晚到就立刻长，不再补等
  const [cached] = useState(() => subject !== null)
  const start = cached ? delay + 60 : 0
  const waiting = !subject && state === 'loading'
  return (
    // 固定最小高度，查询前后右栏不跳
    <div className="flex min-h-[74px] w-full flex-col justify-end gap-2.5">
      {subject || waiting ? (
        <>
          <div className="flex min-h-8 items-baseline gap-2">
            {subject ? (
              <>
                <span className="flex min-w-0 flex-1 items-baseline gap-2" role="img" aria-label={describe(subject)}>
                  <span className="text-[11px] font-semibold tracking-[.06em] text-faint">{t('bangumi.inSite')}</span>
                  <span className="text-[22px] leading-none font-bold num"><Score value={subject.score} delay={start} /></span>
                  <span className="rise min-w-0 truncate text-xs text-muted num" style={{ '--d': `${start}ms` } as CSSProperties}>{facts(subject)}</span>
                </span>
                <button type="button" className="-mr-1 inline-flex min-h-8 flex-none items-center self-center rounded-full pl-2 text-[13px] font-semibold text-muted transition-colors hover:text-text" onClick={() => setOpen(true)}>
                  {t('bangumi.more')}
                  <ChevronRight className="size-4" />
                </button>
              </>
            ) : (
              <span className="flex items-baseline gap-2 self-center">
                <span className="text-[11px] font-semibold tracking-[.06em] text-faint">{t('bangumi.inSite')}</span>
                <span className="text-[13px] text-muted">{t('bangumi.queryingShort')}</span>
              </span>
            )}
          </div>
          <Histogram counts={subject?.counts ?? null} mine={mine} height={44} delay={start} />
        </>
      ) : (
        <Status state={state} id={id} onRetry={refresh} />
      )}
      <Detail open={open} subject={subject} at={at} state={state} mine={mine} onRefresh={refresh} onClose={() => setOpen(false)} />
    </div>
  )
}

/* ───────── 窄屏：追踪信息条下方的一行，点开看完整面板 ───────── */

export function BgmLine({ id, mine }: { id: number; mine: number }) {
  const { subject, state, at, refresh } = useBgmSubject(id)
  const [open, setOpen] = useState(false)
  return (
    <>
      {subject ? <LineButton subject={subject} state={state} onOpen={() => setOpen(true)} onRetry={refresh} /> : <Status state={state} id={id} onRetry={refresh} className="py-2.5" />}
      <Detail open={open} subject={subject} at={at} state={state} mine={mine} onRefresh={refresh} onClose={() => setOpen(false)} />
    </>
  )
}

function LineButton({ subject, state, guess, onOpen, onRetry }: { subject: BgmSubject | null; state: BgmState; guess?: boolean; onOpen: () => void; onRetry: () => void }) {
  if (!subject && state !== 'missing') return <Status state={state} onRetry={onRetry} className="min-h-10 px-0 py-2.5" />
  return (
    <button type="button" onClick={onOpen} className="-mx-2 flex min-h-10 items-center gap-2 rounded-2xl px-2 py-2 text-left transition-colors hover:bg-hover active:bg-hover">
      <span className="text-[11px] font-semibold tracking-[.06em] text-faint">{t('bangumi.inSiteFull')}</span>
      {subject ? (
        <>
          <b className="text-[17px] leading-none num"><Score value={subject.score} /></b>
          <span className="min-w-0 flex-1 truncate text-[13px] text-muted num">{guess ? t('bangumi.maybe', { name: subject.nameCn || subject.name }) : facts(subject)}</span>
        </>
      ) : (
        <span className="min-w-0 flex-1 truncate text-[13px] text-muted">{t('bangumi.noMatchSearch')}</span>
      )}
      <ChevronRight className="size-4 flex-none text-muted" />
    </button>
  )
}

/* ───────── 未绑定 Bangumi 追踪：按标题猜条目，可换、可否定、可直接绑定 ───────── */

/**
 * placement 与追踪一致：side 是宽屏右栏，inline 是窄屏正文里的一行。
 * onBind 只在漫画已在书库、Bangumi 追踪已登录时传入
 */
export function BgmGuess({ mangaId, title, placement, onBind, delay }: { mangaId: number; title: string; placement: 'side' | 'inline'; onBind?: (subject: BgmSubject) => Promise<boolean>; delay?: number }) {
  const g = useBgmGuess(mangaId, title)
  const [cached] = useState(() => g.subject !== null)
  const [open, setOpen] = useState<null | 'detail' | 'search'>(null)
  const [binding, setBinding] = useState(false)
  const subject = g.subject
  const rejected = g.match?.sure && !g.match.id
  const bind = onBind && subject ? async () => {
    setBinding(true)
    try { return await onBind(subject) } finally { setBinding(false) }
  } : undefined
  const detail = (
    <Detail
      open={open !== null}
      subject={open === 'search' ? null : subject}
      at={g.at}
      state={g.state}
      mine={0}
      guess={{ mangaId, title, match: g.match, search: open === 'search' || !subject, onSearch: () => setOpen('search'), onPicked: () => setOpen('detail'), bind, binding }}
      onRefresh={g.refresh}
      onClose={() => setOpen(null)}
    />
  )

  if (placement === 'inline')
    return (
      <>
        <LineButton subject={rejected ? null : subject} state={rejected ? 'missing' : g.state} guess={!g.match?.sure} onOpen={() => setOpen(subject && !rejected ? 'detail' : 'search')} onRetry={g.refresh} />
        {detail}
      </>
    )

  const shown = subject && !rejected ? subject : null
  // 详情页进场时逐行错开；缓存秒开时柱子和分数接在评分行之后，数据晚到就立刻长
  const row = (n: number) => rise(delay === undefined ? undefined : delay + n * 40)
  const start = cached && delay !== undefined ? delay + 100 : 0
  return (
    <div className="flex w-full flex-col items-start gap-4">
      <div {...row(0)} className={cn('flex w-full items-center gap-2.5', row(0).className)}>
        <span className="grid size-7 flex-none place-items-center rounded-[8px] bg-hover text-[13px] font-bold" aria-hidden>b</span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-semibold">{t('bangumi.title')}</span>
          <span className="truncate text-[13px] text-muted">
            {shown ? (g.match?.sure ? shown.nameCn || shown.name : t('bangumi.maybe', { name: shown.nameCn || shown.name })) : g.state === 'loading' ? t('bangumi.matching') : rejected ? t('bangumi.rejected') : t('bangumi.noMatch')}
          </span>
        </span>
        <button type="button" className="-mr-1 inline-flex min-h-9 flex-none items-center rounded-full pl-2 text-[13px] font-semibold text-muted transition-colors hover:text-text" onClick={() => setOpen('search')}>
          {shown ? t('bangumi.change') : t('bangumi.manual')}
          <ChevronRight className="size-4" />
        </button>
      </div>

      {shown || (!rejected && g.state === 'loading') ? (
        <>
          {/* 查询中先摆占位，数据到了原地长出来，右栏不跳 */}
          <div {...row(1)} className={cn('flex items-baseline gap-2.5', row(1).className)} role={shown ? 'img' : undefined} aria-label={shown ? describe(shown) : undefined}>
            <span className={cn('text-[36px] leading-none font-bold num', !shown && 'text-faint')}>{shown ? <Score value={shown.score} delay={start} /> : '—'}</span>
            <span className="flex flex-col text-xs text-muted num">
              <span className="text-text">{shown ? [word(shown), shown.rank ? t('bangumi.rank', { n: shown.rank }) : t('bangumi.unranked')].filter(Boolean).join(' · ') : ' '}</span>
              <span>{shown ? t('bangumi.ratedBy', { n: shortCount(shown.total) }) : ' '}</span>
            </span>
          </div>
          <div {...row(2)} className={cn('w-full', row(2).className)}><Histogram counts={shown?.counts ?? null} height={44} delay={start} /></div>
          {shown && (
            <>
              <span {...row(3)} className={cn('text-xs text-muted num', row(3).className)}>{collections(shown).map(([k, n]) => `${shortCount(n)} ${k}`).join(' · ')}</span>
              <div {...row(4)} className={cn('flex flex-wrap gap-2', row(4).className)}>
                {/* 手动选定（sure）后仍可直接绑定 */}
                {bind && (
                  <button type="button" className="fopt cta" disabled={binding} onClick={() => void bind()}>{binding ? t('bangumi.binding') : g.match?.sure ? t('bangumi.bind') : t('bangumi.confirmBind')}</button>
                )}
                {!g.match?.sure && !bind && <button type="button" className="fopt" onClick={() => setBgmMatch(mangaId, shown.id)}>{t('bangumi.isThis')}</button>}
                {!g.match?.sure && <button type="button" className="fopt" onClick={() => setBgmMatch(mangaId, 0)}>{t('bangumi.notThis')}</button>}
                <button type="button" className="fopt" onClick={() => setOpen('detail')}>{t('bangumi.more')}</button>
              </div>
            </>
          )}
        </>
      ) : g.state === 'error' ? (
        <Status state="error" onRetry={g.refresh} />
      ) : null}
      {detail}
    </div>
  )
}

const collections = (s: BgmSubject): [string, number][] => [
  [t('bangumi.col.wish'), s.collection.wish],
  [t('bangumi.col.doing'), s.collection.doing],
  [t('bangumi.col.collect'), s.collection.collect],
  [t('bangumi.col.onHold'), s.collection.onHold],
  [t('bangumi.col.dropped'), s.collection.dropped],
]

/* ───────── 完整面板：弹窗，内容过长时在面板内滚动 ───────── */

interface GuessProps {
  mangaId: number
  title: string
  match: BgmMatch | null
  /** 显示手动搜索 */
  search: boolean
  onSearch: () => void
  onPicked: () => void
  bind?: () => Promise<boolean>
  binding: boolean
}

function Detail({ open, subject, at, state, mine, guess, onRefresh, onClose }: { open: boolean; subject: BgmSubject | null; at: number; state: BgmState; mine: number; guess?: GuessProps; onRefresh: () => void; onClose: () => void }) {
  const pop = usePopMotion()

  return (
    <AnimatePresence>
      {open && (
        <Dialog label={t('bangumi.title')} onClose={onClose} className="place-items-end p-3 sm:place-items-center sm:p-4">
          <MotionGlass
            dense
            {...pop}
            className="no-scrollbar relative flex max-h-[calc(100dvh-24px)] w-[min(460px,100%)] flex-col gap-6 overflow-y-auto overscroll-contain rounded-[26px] p-6 [--g-drop:0_30px_80px_rgba(0,0,0,.5)]"
          >
            <div className="flex items-center gap-3">
              <h2 className="m-0 min-w-0 flex-1 truncate text-lg font-bold">{guess?.search ? t('bangumi.searchTitle') : subject ? subject.nameCn || subject.name : t('bangumi.title')}</h2>
              <button type="button" className="gicon size-10 flex-none" aria-label={t('common.close')} onClick={onClose}>
                <X className="size-5" />
              </button>
            </div>

            {guess?.search ? (
              <Picker guess={guess} />
            ) : subject ? (
              <>
                <div className="flex items-baseline gap-3" role="img" aria-label={describe(subject)}>
                  <span className="text-[44px] leading-none font-bold num"><Score value={subject.score} /></span>
                  <span className="flex flex-col text-sm text-muted num">
                    <span className="text-text">{[word(subject), subject.rank ? t('bangumi.rank', { n: subject.rank }) : t('bangumi.unranked')].filter(Boolean).join(' · ')}</span>
                    <span>{t('bangumi.ratedBy', { n: shortCount(subject.total) })}{subject.name && subject.nameCn && subject.name !== subject.nameCn ? ` · ${subject.name}` : ''}</span>
                  </span>
                </div>
                <Histogram counts={subject.counts} mine={mine} height={88} labels="all" />
                <div className="grid grid-cols-5 gap-1 text-center">
                  {collections(subject).map(([k, n]) => (
                    <span key={k} className="flex flex-col gap-1">
                      <b className="text-[17px] leading-none num">{shortCount(n)}</b>
                      <span className="text-xs text-muted">{k}</span>
                    </span>
                  ))}
                </div>
                {subject.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {subject.tags.map((t) => <span key={t.name} className="plain rounded-full px-3 py-1 text-xs">{t.name} <span className="text-faint num">{shortCount(t.count)}</span></span>)}
                  </div>
                )}
                {guess && (guess.bind || !guess.match?.sure) && (
                  <div className="flex flex-wrap gap-2">
                    {guess.bind && <button type="button" className="fopt cta" disabled={guess.binding} onClick={() => void guess.bind!().then((ok) => { if (ok) onClose() })}>{guess.binding ? t('bangumi.binding') : guess.match?.sure ? t('bangumi.bind') : t('bangumi.confirmBind')}</button>}
                    {!guess.match?.sure && !guess.bind && <button type="button" className="fopt" onClick={() => setBgmMatch(guess.mangaId, subject.id)}>{t('bangumi.isThis')}</button>}
                    {!guess.match?.sure && <button type="button" className="fopt" onClick={() => { setBgmMatch(guess.mangaId, 0); onClose() }}>{t('bangumi.notThis')}</button>}
                    {!guess.match?.sure && <button type="button" className="fopt" onClick={guess.onSearch}>{t('bangumi.change')}</button>}
                  </div>
                )}
                {guess?.match?.sure && (
                  <button type="button" className="self-start text-[13px] font-semibold text-muted hover:text-text" onClick={guess.onSearch}>{t('bangumi.changeItem')}</button>
                )}
                <div className="flex items-center justify-between gap-3 text-xs text-muted">
                  <button type="button" className="inline-flex min-h-8 items-center gap-1.5 hover:text-text" onClick={onRefresh} disabled={state === 'loading'}>
                    <RefreshCw className={cn('size-3.5', state === 'loading' && 'animate-spin')} />
                    {state === 'loading' ? t('bangumi.refreshing') : at ? t('bangumi.updatedAgo', { time: timeAgo(at) }) : t('bangumi.refresh')}
                  </button>
                  <a href={subjectUrl(subject.id)} target="_blank" rel="noreferrer" className="inline-flex min-h-8 items-center gap-1 font-semibold text-muted no-underline hover:text-text">
                    {t('bangumi.openOn')}
                    <ExternalLink className="size-3.5" />
                  </a>
                </div>
              </>
            ) : (
              <Status state={state} onRetry={onRefresh} />
            )}
          </MotionGlass>
        </Dialog>
      )}
    </AnimatePresence>
  )
}

/** 手动搜索：默认填漫画标题，挑一部就记为确认过的匹配 */
function Picker({ guess }: { guess: GuessProps }) {
  const [input, setInput] = useState(guess.title)
  const [results, setResults] = useState<BgmSubject[] | null>(null)
  // 打开时就用标题搜，所以一开始是 loading
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('loading')
  const search = (q: string) =>
    searchSubjects(q).then(
      (list) => { setResults(list); setState('idle') },
      () => setState('error'),
    )
  const run = (q: string) => {
    if (!q.trim()) return
    setState('loading')
    void search(q.trim())
  }
  useEffect(() => { void search(guess.title) }, [guess.title])
  const submit = (e: FormEvent) => {
    e.preventDefault()
    void run(input)
  }
  return (
    <>
      <form onSubmit={submit}>
        <label className="plain flex h-11 items-center gap-2.5 rounded-full px-4 text-muted">
          <Search className="size-4 flex-none" />
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={t('bangumi.searchPlaceholder')} aria-label={t('bangumi.searchTitle')} className="min-w-0 flex-1 bg-transparent text-[15px] text-text outline-none" />
        </label>
      </form>
      {state === 'loading' && <span className="text-sm text-muted">{t('bangumi.searching')}</span>}
      {state === 'error' && <button type="button" className="self-start text-sm font-semibold text-muted hover:text-text" onClick={() => void run(input)}>{t('bangumi.searchFailed')}</button>}
      {state === 'idle' && results?.length === 0 && <span className="text-sm text-muted">{t('bangumi.noneFound')}</span>}
      {state === 'idle' && results && results.length > 0 && (
        <ul className="m-0 -mx-2 flex list-none flex-col p-0">
          {results.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                className={cn('flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left transition-colors hover:bg-hover', guess.match?.id === s.id && 'bg-hover')}
                onClick={() => { setBgmMatch(guess.mangaId, s.id); guess.onPicked() }}
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-semibold">{s.nameCn || s.name}</span>
                  <span className="truncate text-[13px] text-muted">{[s.platform, s.nameCn && s.name !== s.nameCn ? s.name : '', s.series ? '' : t('bangumi.single')].filter(Boolean).join(' · ')}</span>
                </span>
                <span className="flex flex-none flex-col items-end text-xs text-muted num">
                  <b className="text-[15px] text-text">{s.score ? s.score.toFixed(1) : '—'}</b>
                  {t('bangumi.people', { n: shortCount(s.total) })}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
