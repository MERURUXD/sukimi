import { AnimatePresence, motion } from 'motion/react'
import { ChevronRight, ExternalLink, RefreshCw, Search, X } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { Glass, MotionGlass } from '@/components/glass/Glass'
import { spring } from '@/design/motion'
import { scoreWord } from '@/features/tracking/tracking'
import { cn } from '@/lib/cn'
import { timeAgo } from '@/lib/format'
import { searchSubjects, setBgmMatch, useBgmGuess, useBgmSubject, type BgmMatch, type BgmState } from './api'
import { shortCount, subjectUrl, type BgmSubject } from './rating'

const word = (s: BgmSubject) => scoreWord('bangumi', Math.round(s.score))
const facts = (s: BgmSubject) => [word(s), s.rank ? `#${s.rank}` : '暂无排名', `${shortCount(s.total)} 人`].filter(Boolean).join(' · ')

/* ───────── 柱状图：1–10 分各有多少人，自己打的那一分标亮并在下方写「你」 ───────── */

function Histogram({ counts, mine = 0, height, labels = 'ends' }: { counts: number[]; mine?: number; height: number; labels?: 'ends' | 'all' }) {
  const max = Math.max(1, ...counts)
  return (
    <div aria-hidden>
      <div className="flex items-end gap-[3px]" style={{ height }}>
        {counts.map((n, i) => (
          <span key={i} className={cn('flex-1 rounded-[2px]', i + 1 === mine ? 'bg-text' : 'bg-text/20')} style={{ height: `${Math.max(3, (n / max) * 100)}%` }} />
        ))}
      </div>
      <div className="mt-1 flex gap-[3px] text-center text-[11px] leading-none text-faint num">
        {counts.map((_, i) => {
          const s = i + 1
          const text = s === mine ? '你' : labels === 'all' || s === 1 || s === 5 || s === 10 ? String(s) : ''
          return <span key={i} className={cn('flex-1', s === mine && 'font-semibold text-text')}>{text}</span>
        })}
      </div>
    </div>
  )
}

/** 读屏用的分布说明：图本身 aria-hidden */
const describe = (s: BgmSubject) => `Bangumi 站内评分 ${s.score.toFixed(1)}，${facts(s)}评分；最多人打 ${s.counts.indexOf(Math.max(...s.counts)) + 1} 分`

function Status({ state, id, onRetry, className }: { state: BgmState; id?: number; onRetry: () => void; className?: string }) {
  if (state === 'loading') return <span className={cn('text-[13px] text-muted', className)}>正在查询 Bangumi 站内评分…</span>
  // 公开接口对未登录访问的 NSFW 条目也返回 404，不能断言条目不存在
  if (state === 'missing')
    return (
      <span className={cn('text-[13px] text-muted', className)}>
        查不到站内评分：条目可能需要登录 Bangumi 才能查看，或已被删除。
        {id ? <a href={subjectUrl(id)} target="_blank" rel="noreferrer" className="ml-1 font-semibold text-muted hover:text-text">在 Bangumi 打开</a> : null}
      </span>
    )
  return (
    <button type="button" className={cn('self-start text-[13px] font-semibold text-muted hover:text-text', className)} onClick={onRetry}>
      站内评分加载失败，点此重试
    </button>
  )
}

/* ───────── 宽屏：追踪面板里星星下方那一段 ───────── */

/** 已绑定 Bangumi 追踪时，用绑定的条目号查；mine 是自己的评分（0 为未评） */
export function BgmBlock({ id, mine }: { id: number; mine: number }) {
  const { subject, state, at, refresh } = useBgmSubject(id)
  const [open, setOpen] = useState(false)
  return (
    // 固定最小高度，查询前后右栏不跳
    <div className="flex min-h-[74px] w-full flex-col justify-end gap-2.5">
      {subject ? (
        <>
          <div className="flex items-baseline gap-2">
            <span className="flex min-w-0 flex-1 items-baseline gap-2" role="img" aria-label={describe(subject)}>
              <span className="text-[11px] font-semibold tracking-[.06em] text-faint">站内</span>
              <span className="text-[22px] leading-none font-bold num">{subject.score ? subject.score.toFixed(1) : '—'}</span>
              <span className="min-w-0 truncate text-xs text-muted num">{facts(subject)}</span>
            </span>
            <button type="button" className="-mr-1 inline-flex min-h-8 flex-none items-center self-center rounded-full pl-2 text-[13px] font-semibold text-muted transition-colors hover:text-text" onClick={() => setOpen(true)}>
              更多
              <ChevronRight className="size-4" />
            </button>
          </div>
          <Histogram counts={subject.counts} mine={mine} height={44} />
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
      <span className="text-[11px] font-semibold tracking-[.06em] text-faint">Bangumi 站内</span>
      {subject ? (
        <>
          <b className="text-[17px] leading-none num">{subject.score ? subject.score.toFixed(1) : '—'}</b>
          <span className="min-w-0 flex-1 truncate text-xs text-muted num">{guess ? `可能是：${subject.nameCn || subject.name}` : facts(subject)}</span>
        </>
      ) : (
        <span className="min-w-0 flex-1 truncate text-xs text-muted">没有找到对应条目，点此手动搜索</span>
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
export function BgmGuess({ mangaId, title, placement, onBind }: { mangaId: number; title: string; placement: 'side' | 'inline'; onBind?: (id: number) => Promise<void> }) {
  const g = useBgmGuess(mangaId, title)
  const [open, setOpen] = useState<null | 'detail' | 'search'>(null)
  const [binding, setBinding] = useState(false)
  const subject = g.subject
  const rejected = g.match?.sure && !g.match.id
  const bind = onBind && subject ? async () => {
    setBinding(true)
    try { await onBind(subject.id) } finally { setBinding(false) }
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

  return (
    <div className="flex w-full flex-col items-start gap-4">
      <div className="flex w-full items-center gap-2.5">
        <span className="grid size-7 flex-none place-items-center rounded-[8px] bg-hover text-[13px] font-bold" aria-hidden>b</span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-semibold">Bangumi 站内评分</span>
          <span className="truncate text-xs text-muted">
            {subject && !rejected ? `${g.match?.sure ? '' : '可能是：'}${subject.nameCn || subject.name}` : g.state === 'loading' ? '正在按标题搜索…' : rejected ? '已排除自动匹配的条目' : '没有找到对应条目'}
          </span>
        </span>
        <button type="button" className="-mr-1 inline-flex min-h-9 flex-none items-center rounded-full pl-2 text-[13px] font-semibold text-muted transition-colors hover:text-text" onClick={() => setOpen('search')}>
          {subject && !rejected ? '换一个' : '手动搜索'}
          <ChevronRight className="size-4" />
        </button>
      </div>

      {subject && !rejected ? (
        <>
          <div className="flex items-baseline gap-2.5" role="img" aria-label={describe(subject)}>
            <span className="text-[36px] leading-none font-bold num">{subject.score ? subject.score.toFixed(1) : '—'}</span>
            <span className="flex flex-col text-xs text-muted num">
              <span className="text-text">{[word(subject), subject.rank ? `排名 #${subject.rank}` : '暂无排名'].filter(Boolean).join(' · ')}</span>
              <span>{shortCount(subject.total)} 人评分</span>
            </span>
          </div>
          <div className="w-full"><Histogram counts={subject.counts} height={44} /></div>
          <span className="text-xs text-muted num">{collections(subject).map(([k, n]) => `${shortCount(n)} ${k}`).join(' · ')}</span>
          <div className="flex flex-wrap gap-2">
            {/* 手动选定（sure）后仍可直接绑定 */}
            {bind && (
              <button type="button" className="fopt inc" disabled={binding} onClick={() => void bind()}>{binding ? '正在绑定…' : g.match?.sure ? '绑定追踪' : '确认并绑定追踪'}</button>
            )}
            {!g.match?.sure && !bind && <button type="button" className="fopt" onClick={() => setBgmMatch(mangaId, subject.id)}>就是这部</button>}
            {!g.match?.sure && <button type="button" className="fopt" onClick={() => setBgmMatch(mangaId, 0)}>不是这部</button>}
            <button type="button" className="fopt" onClick={() => setOpen('detail')}>更多</button>
          </div>
        </>
      ) : g.state === 'loading' ? (
        <div className="min-h-[120px]" />
      ) : g.state === 'error' ? (
        <Status state="error" onRetry={g.refresh} />
      ) : null}
      {detail}
    </div>
  )
}

const collections = (s: BgmSubject): [string, number][] => [
  ['想读', s.collection.wish],
  ['在读', s.collection.doing],
  ['读过', s.collection.collect],
  ['搁置', s.collection.onHold],
  ['抛弃', s.collection.dropped],
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
  bind?: () => Promise<void>
  binding: boolean
}

function Detail({ open, subject, at, state, mine, guess, onRefresh, onClose }: { open: boolean; subject: BgmSubject | null; at: number; state: BgmState; mine: number; guess?: GuessProps; onRefresh: () => void; onClose: () => void }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[70] grid place-items-end p-3 sm:place-items-center sm:p-4" role="presentation">
          <motion.div className="absolute inset-0 bg-black/45" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <MotionGlass
            dense
            role="dialog"
            aria-modal="true"
            aria-label="Bangumi 站内评分"
            initial={{ opacity: 0, scale: 0.94, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={spring.fast}
            className="no-scrollbar relative flex max-h-[calc(100dvh-24px)] w-[min(460px,100%)] flex-col gap-6 overflow-y-auto overscroll-contain rounded-[26px] p-6 [--g-drop:0_30px_80px_rgba(0,0,0,.5)]"
          >
            <div className="flex items-center gap-3">
              <h2 className="m-0 min-w-0 flex-1 truncate text-lg font-bold">{guess?.search ? '搜索 Bangumi 条目' : subject ? subject.nameCn || subject.name : 'Bangumi 站内评分'}</h2>
              <button type="button" className="gicon size-10 flex-none" aria-label="关闭" onClick={onClose}>
                <X className="size-5" />
              </button>
            </div>

            {guess?.search ? (
              <Picker guess={guess} />
            ) : subject ? (
              <>
                <div className="flex items-baseline gap-3" role="img" aria-label={describe(subject)}>
                  <span className="text-[44px] leading-none font-bold num">{subject.score ? subject.score.toFixed(1) : '—'}</span>
                  <span className="flex flex-col text-sm text-muted num">
                    <span className="text-text">{[word(subject), subject.rank ? `排名 #${subject.rank}` : '暂无排名'].filter(Boolean).join(' · ')}</span>
                    <span>{shortCount(subject.total)} 人评分{subject.name && subject.nameCn && subject.name !== subject.nameCn ? ` · ${subject.name}` : ''}</span>
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
                    {subject.tags.map((t) => <Glass as="span" key={t.name} className="rounded-full px-3 py-1 text-xs">{t.name} <span className="text-faint num">{shortCount(t.count)}</span></Glass>)}
                  </div>
                )}
                {guess && (guess.bind || !guess.match?.sure) && (
                  <div className="flex flex-wrap gap-2">
                    {guess.bind && <button type="button" className="fopt inc" disabled={guess.binding} onClick={() => void guess.bind!().then(onClose)}>{guess.binding ? '正在绑定…' : guess.match?.sure ? '绑定追踪' : '确认并绑定追踪'}</button>}
                    {!guess.match?.sure && !guess.bind && <button type="button" className="fopt" onClick={() => setBgmMatch(guess.mangaId, subject.id)}>就是这部</button>}
                    {!guess.match?.sure && <button type="button" className="fopt" onClick={() => { setBgmMatch(guess.mangaId, 0); onClose() }}>不是这部</button>}
                    {!guess.match?.sure && <button type="button" className="fopt" onClick={guess.onSearch}>换一个</button>}
                  </div>
                )}
                {guess?.match?.sure && (
                  <button type="button" className="self-start text-[13px] font-semibold text-muted hover:text-text" onClick={guess.onSearch}>换一个条目</button>
                )}
                <div className="flex items-center justify-between gap-3 text-xs text-muted">
                  <button type="button" className="inline-flex min-h-8 items-center gap-1.5 hover:text-text" onClick={onRefresh} disabled={state === 'loading'}>
                    <RefreshCw className={cn('size-3.5', state === 'loading' && 'animate-spin')} />
                    {state === 'loading' ? '正在刷新…' : at ? `${timeAgo(at)}更新 · 刷新` : '刷新'}
                  </button>
                  <a href={subjectUrl(subject.id)} target="_blank" rel="noreferrer" className="inline-flex min-h-8 items-center gap-1 font-semibold text-muted no-underline hover:text-text">
                    在 Bangumi 打开
                    <ExternalLink className="size-3.5" />
                  </a>
                </div>
              </>
            ) : (
              <Status state={state} onRetry={onRefresh} />
            )}
          </MotionGlass>
        </div>
      )}
    </AnimatePresence>,
    document.body,
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
        <Glass as="label" className="flex h-11 items-center gap-2.5 rounded-full px-4 text-muted">
          <Search className="size-4 flex-none" />
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="作品名，原名或中文名都可以" aria-label="搜索 Bangumi 条目" className="min-w-0 flex-1 bg-transparent text-[15px] text-text outline-none" />
        </Glass>
      </form>
      {state === 'loading' && <span className="text-sm text-muted">正在搜索…</span>}
      {state === 'error' && <button type="button" className="self-start text-sm font-semibold text-muted hover:text-text" onClick={() => void run(input)}>搜索失败，点此重试</button>}
      {state === 'idle' && results?.length === 0 && <span className="text-sm text-muted">没有搜到，换个写法试试</span>}
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
                  <span className="truncate text-xs text-muted">{[s.platform, s.nameCn && s.name !== s.nameCn ? s.name : '', s.series ? '' : '单册'].filter(Boolean).join(' · ')}</span>
                </span>
                <span className="flex flex-none flex-col items-end text-xs text-muted num">
                  <b className="text-[15px] text-text">{s.score ? s.score.toFixed(1) : '—'}</b>
                  {shortCount(s.total)} 人
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
