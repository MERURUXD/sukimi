import { useApolloClient, useQuery } from '@apollo/client/react'
import { AnimatePresence } from 'motion/react'
import { ChevronRight, ListChecks, Minus, Plus, Star } from 'lucide-react'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router'
import { toast, toastError } from '@/components/ui/toast'
import { captureUser, StaleSessionError } from '@/api/userContext'
import type { BgmSubject } from '@/features/bangumi/rating'
import { BgmBlock, BgmGuess, BgmLine } from '@/features/bangumi/CommunityRating'
import { introRise as rise } from '@/features/manga/intro'
import { SourceIcon } from '@/features/browse/SourceIcon'
import { Select } from '@/features/settings/parts'
import { chapterNo } from '@/lib/format'
import { cn } from '@/lib/cn'
import { MangaTracks, Trackers, type Tracker, type TrackRecord } from './queries'
import { bindBgmSubject } from './bindBgmSubject'
import { Stars } from './Stars'
import { TrackDialog } from './TrackPanel'
import { isRated, scoreString, scoreValue, scoreWord, starScale, statusLabel } from './tracking'
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

/** Bangumi 追踪：按名字认，演示和验收页里叫「Bangumi（演示）」之类 */
const isBgm = (t: Tracker) => /bangumi/i.test(t.name)
/** 绑定记录里的条目号；Bangumi 的 remoteId 就是条目号 */
const subjectId = (r: TrackRecord) => Number(r.remoteId) || 0

/**
 * 详情页里的追踪。宽屏（≥1280）在头部右侧空白处直接展开面板（placement="side"），顶端与书名对齐；
 * 更窄时在正文里显示占满一行的信息条（placement="inline"），点一下直接打开完整的追踪设置。
 * 两处各挂一份，按宽度只显示其一。
 * 另附 Bangumi 站内评分：绑定了 Bangumi 就用绑定的条目，没绑定（含不在书库）按标题猜，查公开接口、与追踪账号无关
 */
/** delay：宽屏右栏随详情页进场时的起始延迟，给了就逐行错开进场（不给则不播） */
export function TrackSummary({ mangaId, title, inLibrary = true, placement, delay, className, style }: { mangaId: number; title: string; inLibrary?: boolean; placement: 'inline' | 'side'; delay?: number; className?: string; style?: CSSProperties }) {
  const trackers = useQuery(Trackers).data?.trackers.nodes
  const records = useQuery(MangaTracks, { variables: { id: mangaId }, skip: !inLibrary }).data?.manga.trackRecords.nodes
  const client = useApolloClient()
  const [dialog, setDialog] = useState(false)
  const opener = useRef<HTMLElement | null>(null)
  const wide = useWide()
  if (wide !== (placement === 'side')) return null
  if (inLibrary && (!trackers || !records)) return null

  const rows = (inLibrary ? records ?? [] : []).flatMap((r) => {
    const t = trackers?.find((x) => x.id === r.trackerId)
    return t ? [{ t, r }] : []
  })
  const unbound = inLibrary ? trackers?.filter((t) => t.isLoggedIn && !records?.some((r) => r.trackerId === t.id)) ?? [] : []
  const bgm = trackers?.find(isBgm)
  const bgmBound = rows.some(({ t }) => isBgm(t))
  // 只有在书库、Bangumi 已登录且未过期时才能直接绑定
  const canBind = inLibrary && bgm && bgm.isLoggedIn && !bgm.isTokenExpired && !bgmBound ? bgm : null
  const bind = canBind
    ? async (subject: BgmSubject) => {
        const still = captureUser()
        try {
          await bindBgmSubject(client, mangaId, canBind.id, subject, still)
          await client.refetchQueries({ include: [MangaTracks] })
          still()
          toast(`已绑定到 ${canBind.name}`)
          return true
        } catch (err) {
          if (!(err instanceof StaleSessionError)) toastError('绑定失败', err)
          return false
        }
      }
    : undefined

  // 每个追踪面板占 4 行，行间 40ms；后面的块接在前一个面板之后
  const at = (n: number) => (wide && delay !== undefined ? delay + n * 40 : undefined)
  const openDialog = (el: HTMLElement) => {
    opener.current = el
    setDialog(true)
  }

  return (
    <section aria-label={inLibrary ? '追踪' : 'Bangumi 站内评分'} style={style} className={cn('flex flex-col', wide ? 'gap-9' : 'gap-1', className)}>
      {rows.map(({ t, r }, i) =>
        wide ? (
          <TrackPanel key={r.id} t={t} r={r} onDetail={openDialog} delay={at(i * 4)} />
        ) : (
          <div key={r.id} className="flex flex-col">
            <TrackStrip t={t} r={r} onOpen={openDialog} />
            {isBgm(t) && subjectId(r) > 0 && <BgmLine id={subjectId(r)} mine={scoreValue(r.displayScore)} />}
          </div>
        ),
      )}
      {!bgmBound && <BgmGuess mangaId={mangaId} title={title} placement={placement} onBind={bind} delay={at(rows.length * 4)} />}
      {inLibrary && !rows.length && unbound.length > 0 && (
        <button type="button" style={rise(at(5)).style} className={cn('-ml-1 inline-flex min-h-9 items-center gap-1.5 self-start rounded-full px-1 text-[13px] font-semibold text-muted transition-colors hover:text-text', rise(at(5)).className)} onClick={(e) => openDialog(e.currentTarget)}>
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
  const rated = isRated(r.displayScore, t.scores)
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
      aria-label={`${t.name} 追踪：${status ? statusLabel(status.name) : '未设置'}，读到第 ${chapterNo(r.lastChapterRead)} 话，${rated ? `评分 ${r.displayScore}` : '未评分'}。打开追踪设置`}
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
        <span className={value}>{rated ? r.displayScore : '—'}</span>
        {rated && scale && score > 0 ? <MiniStars value={score} max={scale} /> : <span className={sub}>{rated ? word || '已评分' : '未评分'}</span>}
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

function TrackPanel({ t, r, onDetail, delay }: { t: Tracker; r: TrackRecord; onDetail: (el: HTMLElement) => void; delay?: number }) {
  const save = useSaveTrack(r)
  // 详情页进场：标题、进度、星星、站内评分依次错开 40ms
  const row = (n: number, className?: string) => {
    const p = rise(delay === undefined ? undefined : delay + n * 40)
    return { style: p.style, className: cn(className, p.className) }
  }
  const bgmDelay = delay === undefined ? undefined : delay + 120
  const scale = starScale(t.scores)
  const score = scoreValue(r.displayScore)
  const total = r.totalChapters
  const read = r.lastChapterRead
  // 直接在原值上加减，3.5 话减一是 2.5，和完整设置里的加减一致
  const step = (d: number) => {
    const n = Math.max(0, read + d)
    save({ lastChapterRead: total > 0 ? Math.min(n, total) : n })
  }
  // 退出登录或登录过期时绑定还在，但写不进网站：只读展示，引导去重新登录
  if (!t.isLoggedIn || t.isTokenExpired) {
    const status = t.statuses.find((x) => x.value === r.status)
    return (
      <div className="flex flex-col items-start gap-2">
        <div {...row(0, 'flex w-full items-center gap-2.5')}>
          <SourceIcon s={{ iconUrl: t.icon, displayName: t.name }} size={28} />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate font-semibold">{t.name}</span>
            <span className="truncate text-[13px] text-muted">{r.title}</span>
          </span>
        </div>
        <span {...row(1, 'text-sm text-muted num')}>
          {[status ? statusLabel(status.name) : null, `读到 ${chapterNo(read)} 话`, isRated(r.displayScore, t.scores) ? `评分 ${r.displayScore}` : null].filter(Boolean).join(' · ')}
        </span>
        <Link to="/settings/tracking" {...row(2, 'text-[13px] font-semibold text-danger')}>
          {t.isTokenExpired ? '登录已过期' : '已退出登录'}，去设置里重新登录后才能修改和同步
        </Link>
        {/* 站内评分查的是公开接口，和追踪登录无关，照常显示 */}
        {isBgm(t) && subjectId(r) > 0 && <div {...row(3, 'w-full')}><BgmBlock id={subjectId(r)} mine={starScale(t.scores) === 10 ? scoreValue(r.displayScore) : 0} delay={bgmDelay} /></div>}
      </div>
    )
  }
  const status = t.statuses.find((x) => x.value === r.status)
  return (
    <div className="flex flex-col items-start gap-5">
      <div {...row(0, 'flex w-full items-center gap-2.5')}>
        <SourceIcon s={{ iconUrl: t.icon, displayName: t.name }} size={28} />
        <span className="flex min-w-0 flex-1 flex-col">
          {/* 状态只展示，改状态在「详细设置」里 */}
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate font-semibold">{t.name}</span>
            {status && <span className="flex-none rounded-full bg-hover px-2 py-px text-[11px] font-semibold text-muted">{statusLabel(status.name)}</span>}
          </span>
          <span className="truncate text-[13px] text-muted">{r.title}</span>
        </span>
        <button type="button" className="-mr-1 inline-flex min-h-9 flex-none items-center rounded-full pl-2 text-[13px] font-semibold text-muted transition-colors hover:text-text" onClick={(e) => onDetail(e.currentTarget)}>
          详细设置
          <ChevronRight className="size-4" />
        </button>
      </div>

      <div {...row(1, 'flex items-center gap-3')}>
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
        <span {...row(2, '-ml-1')}>
          <Stars size="md" max={scale} value={Math.min(score, scale)} word={(v) => scoreWord(t.name, v)} onChange={(v) => save({ scoreString: scoreString(t.scores, v) })} />
        </span>
      ) : t.scores.length > 0 ? (
        <span {...row(2)}>
          <Select
            label="评分"
            value={r.displayScore}
            options={(t.scores.includes(r.displayScore) ? t.scores : [r.displayScore, ...t.scores]).map((s) => ({ value: s, label: s || '未评分' }))}
            onChange={(s) => save({ scoreString: s })}
            className="w-[120px]"
          />
        </span>
      ) : null}

      {isBgm(t) && subjectId(r) > 0 && <div {...row(3, 'w-full')}><BgmBlock id={subjectId(r)} mine={scale === 10 ? score : 0} delay={bgmDelay} /></div>}
    </div>
  )
}
