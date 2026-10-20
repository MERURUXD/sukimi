import { useQuery } from '@apollo/client/react'
import { ChevronDown, ChevronLeft, ChevronRight, Star } from 'lucide-react'
import { createContext, useContext, useMemo, useState, type CSSProperties } from 'react'
import { Link } from 'react-router'
import type { CalendarChaptersQuery } from '@/api/gql/graphql'
import { Glass } from '@/components/glass/Glass'
import { CoverImg } from '@/components/manga/CoverImg'
import { LoadError } from '@/components/ui/LoadError'
import { useNsfwBlur } from '@/features/nsfw/useNsfw'
import { useFavorites } from '@/features/favorite/useFavorites'
import { cn } from '@/lib/cn'
import { sfwAttr } from '@/lib/devSafe'
import { chapterLabel, ms, sec } from '@/lib/format'
import { riseStep, useIntro } from '@/lib/intro'
import { buildWeek, leftovers, seriesOf, weekStart, type CalendarDay, type DayEntry, type Series } from './calendar'
import { addDays, clockLabel, daysBetween, intervalLabel, regularLabel, startOfDay, type Prediction } from './predict'
import { CALENDAR_LIMIT, CalendarChapters, calendarFilter } from './queries'

type Manga = CalendarChaptersQuery['chapters']['nodes'][number]['manga']

const WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
/** 往前最多翻到近半年的窗口，往后两个月 */
const MIN_WEEK = -25
const MAX_WEEK = 8
/** 每天先露出的条数，多的折叠成「还有 N 部」；只多一部时不折，免得按钮比内容还占地方 */
const DAY_CAP_COLUMN = 4
const DAY_CAP_AGENDA = 6
const LATE_CAP = 6

/** 特别关心的漫画 id；日历里的格子很多，整页取一次往下传，标题前标一颗实心星 */
const Favorites = createContext<ReadonlyMap<number, number>>(new Map())

function FavoriteMark({ id }: { id: number }) {
  if (!useContext(Favorites).has(id)) return null
  return <Star className="mr-1 inline size-3 -translate-y-px fill-current" strokeWidth={2.2} aria-label="特别关心" />
}

/** 超出上限的折叠起来，点开后整天展开 */
function useCapped<T>() {
  const [open, setOpen] = useState<ReadonlySet<number>>(new Set())
  return {
    visible: (day: number, items: T[], cap: number) => (open.has(day) || items.length <= cap + 1 ? items : items.slice(0, cap)),
    hidden: (day: number, items: T[], cap: number) => (open.has(day) || items.length <= cap + 1 ? 0 : items.length - cap),
    expand: (day: number) => setOpen((s) => new Set(s).add(day)),
  }
}

function MoreButton({ n, onClick, className }: { n: number; onClick: () => void; className?: string }) {
  return (
    <button type="button" onClick={onClick} className={cn('min-h-9 self-start border-0 bg-transparent p-0 text-left text-xs text-muted hover:text-text', className)}>
      还有 {n} 部
    </button>
  )
}

/**
 * 更新日历：一周七天，过去按来源发布日期显示实际的更新，今天以后显示按规律推算的预计更新；
 * 晚了的、推算不出的放在下面。桌面七列，手机是按天的日程列表。
 */
export function UpdateCalendar() {
  // 进页面时定下「现在」，过午夜也不跟着跳；窗口起点按天取整，同一天里重复进入能用缓存
  const [now] = useState(() => Date.now())
  const query = useQuery(CalendarChapters, {
    variables: { filter: calendarFilter(startOfDay(now)), first: CALENDAR_LIMIT },
    fetchPolicy: 'cache-and-network',
  })
  const [introWanted] = useState(() => !query.data)
  const intro = useIntro(introWanted, !!query.data)
  const [offset, setOffset] = useState(0)
  const [lateOpen, setLateOpen] = useState(false)
  const favorites = useFavorites().ids

  const chapters = useMemo(
    () => (query.data?.chapters.nodes ?? []).map((c) => ({ ...c, uploadDate: ms(c.uploadDate), fetchedAt: sec(c.fetchedAt) })),
    [query.data],
  )
  const series = useMemo(() => seriesOf(chapters, now), [chapters, now])
  const start = addDays(weekStart(now), offset * 7)
  const week = useMemo(() => buildWeek(chapters, series, start, now), [chapters, series, start, now])
  const rest = useMemo(() => leftovers(series), [series])

  if (query.error && !query.data) return <LoadError message={query.error.message} onRetry={() => void query.refetch().catch(() => {})} />
  if (!query.data) return <CalendarSkeleton />

  const today = startOfDay(now)
  const doneCount = new Set(week.flatMap((d) => d.entries.filter((e) => e.kind === 'done').map((e) => e.mangaId))).size
  const predCount = new Set(week.flatMap((d) => d.entries.filter((e) => e.kind === 'pred').map((e) => e.mangaId))).size
  const summary = [
    doneCount ? `${offset === 0 ? '本周' : '这周'}已更新 ${doneCount} 部` : null,
    predCount ? `预计${doneCount ? '还有' : ''} ${predCount} 部` : null,
  ].filter(Boolean).join('，')
  const end = addDays(start, 6)
  const range = `${new Date(start).getMonth() + 1}/${new Date(start).getDate()} – ${new Date(end).getMonth() + 1}/${new Date(end).getDate()}`

  return (
    <Favorites.Provider value={favorites}>
    <section aria-label="更新日历" className="pb-6">
      <div className="mt-5 mb-4 flex items-center justify-between gap-3">
        <p className="m-0 min-w-0 text-[13px] text-muted md:text-sm">{summary || (offset < 0 ? '这周没有新章节' : '这周没有预计的更新')}</p>
        <div className="flex flex-none items-center gap-1.5">
          <Glass as="button" type="button" className="gicon size-10 rounded-full" disabled={offset <= MIN_WEEK} onClick={() => setOffset((o) => o - 1)} aria-label="上一周">
            <ChevronLeft className="size-[18px]" strokeWidth={1.8} />
          </Glass>
          <Glass as="button" type="button" className="gbtn min-w-[92px] rounded-full num" onClick={() => setOffset(0)} aria-label="回到本周" title="回到本周">
            {offset === 0 ? '本周' : range}
          </Glass>
          <Glass as="button" type="button" className="gicon size-10 rounded-full" disabled={offset >= MAX_WEEK} onClick={() => setOffset((o) => o + 1)} aria-label="下一周">
            <ChevronRight className="size-[18px]" strokeWidth={1.8} />
          </Glass>
        </div>
      </div>

      <WeekColumns week={week} today={today} now={now} intro={intro} />
      <WeekAgenda week={week} today={today} now={now} intro={intro} />
      <Legend />

      {rest.late.length > 0 && (
        <div className="mt-9">
          <h2 className="m-0 mb-2 flex items-baseline gap-2.5 text-lg font-bold">
            晚了
            <span className="text-[13px] font-medium text-muted">按规律该出新话了，还没有出</span>
          </h2>
          <div className="grid gap-x-6 md:grid-cols-[repeat(auto-fill,minmax(280px,1fr))]">
            {(lateOpen ? rest.late : rest.late.slice(0, LATE_CAP)).map((s) => (
              <SeriesRow key={s.mangaId} s={s} sub={`${intervalLabel(s.prediction.interval)}更新 · 晚了 ${s.prediction.late} 天`} />
            ))}
          </div>
          {!lateOpen && rest.late.length > LATE_CAP && <MoreButton n={rest.late.length - LATE_CAP} onClick={() => setLateOpen(true)} className="mt-1 ml-1" />}
        </div>
      )}

      <Unpredicted rest={rest} />
      {query.data.chapters.nodes.length >= CALENDAR_LIMIT && (
        <p className="mt-6 text-xs text-muted">近半年的章节太多，只按最近 {CALENDAR_LIMIT.toLocaleString('en-US')} 话推算。</p>
      )}
    </section>
    </Favorites.Provider>
  )
}

function dayHead(day: number, today: number) {
  const d = new Date(day)
  const diff = daysBetween(today, day)
  return { name: diff === 0 ? '今天' : diff === 1 ? '明天' : diff === -1 ? '昨天' : WEEK[d.getDay()], date: `${d.getMonth() + 1}/${d.getDate()}`, isToday: diff === 0 }
}

/** 桌面：七列并排，不画格子线，靠列间距分开 */
function WeekColumns({ week, today, now, intro }: { week: CalendarDay<Manga>[]; today: number; now: number; intro: boolean }) {
  const cap = useCapped<DayEntry<Manga>>()
  return (
    <div className="grid grid-cols-7 gap-x-3 max-md:hidden">
      {week.map((d, i) => {
        const h = dayHead(d.day, today)
        return (
          <div key={d.day} className={cn('flex min-w-0 flex-col gap-4', intro && 'rise')} style={intro ? riseStep(i) : undefined}>
            <div className={cn('flex items-baseline gap-1.5 text-sm', h.isToday ? 'font-bold text-text' : 'text-muted', d.day < today && !h.isToday && 'text-faint')}>
              {h.name}
              <span className="text-xs font-medium num">{h.date}</span>
            </div>
            {cap.visible(d.day, d.entries, DAY_CAP_COLUMN).map((e) => (
              <EntryTile key={`${e.kind}${e.mangaId}`} e={e} now={now} />
            ))}
            {cap.hidden(d.day, d.entries, DAY_CAP_COLUMN) > 0 && <MoreButton n={cap.hidden(d.day, d.entries, DAY_CAP_COLUMN)} onClick={() => cap.expand(d.day)} />}
            {d.entries.length === 0 && <span className="text-xs text-faint">—</span>}
          </div>
        )
      })}
    </div>
  )
}

/** 当天更新的章节标题；一天出了好几话时前面加话数，截断时也看得到 */
function doneLabel(e: Extract<DayEntry<Manga>, { kind: 'done' }>) {
  const title = chapterLabel(e.latest)
  return e.count > 1 ? `${e.count} 话 · ${title}` : title
}

function entrySub(e: DayEntry<Manga>, now: number) {
  if (e.kind === 'done') return doneLabel(e)
  const p = e.prediction
  const soon = daysBetween(startOfDay(now), p.next) <= 1
  return p.minute !== undefined && soon ? `约 ${clockLabel(p.minute)}` : `${intervalLabel(p.interval)} · ${regularLabel(p)}`
}

function EntryTile({ e, now }: { e: DayEntry<Manga>; now: number }) {
  const pred = e.kind === 'pred'
  return (
    <Link
      to={`/manga/${e.mangaId}`}
      viewTransition
      data-sfw={sfwAttr(e.manga.source?.displayName)}
      data-nsfw={useNsfwBlur(e.manga)}
      className="group flex min-w-0 flex-col gap-1.5 text-text no-underline"
      aria-label={`${e.manga.title}，${pred ? '预计更新' : '已更新'}`}
    >
      <span className={cn('cv w-full max-w-[112px] rounded-lg transition-opacity', pred && 'opacity-45 outline-1 outline-offset-2 outline-dashed outline-text/50 group-hover:opacity-70')}>
        <CoverImg src={e.manga.thumbnailUrl} loading="lazy" />
      </span>
      <span className={cn('line-clamp-2 min-h-[2.75em] text-[13px] leading-snug break-words', pred ? 'text-muted' : 'font-semibold')}><FavoriteMark id={e.mangaId} />{e.manga.title}</span>
      <span className="truncate text-xs text-muted num">{entrySub(e, now)}</span>
    </Link>
  )
}

/** 手机：上面一条七天的日期，下面按天列出；点日期跳到那一天 */
function WeekAgenda({ week, today, now, intro }: { week: CalendarDay<Manga>[]; today: number; now: number; intro: boolean }) {
  const cap = useCapped<DayEntry<Manga>>()
  // 本周先看今天和接下来几天，再往回看已经更新的（和「最近」一样新的在前）
  const withEntries = week.filter((d) => d.entries.length)
  const shown = [...withEntries.filter((d) => d.day >= today), ...withEntries.filter((d) => d.day < today).reverse()]
  return (
    <div className="md:hidden">
      <div className="mb-3 grid grid-cols-7">
        {week.map((d) => {
          const h = dayHead(d.day, today)
          const n = d.entries.length
          return (
            <button
              key={d.day}
              type="button"
              disabled={!n}
              onClick={() => document.getElementById(`cal-${d.day}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              className={cn('flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-2xl border-0 bg-transparent p-0 text-xs', h.isToday ? 'font-bold text-text' : n ? 'text-muted' : 'text-faint')}
              aria-label={`${h.name} ${h.date}，${n ? `${n} 部` : '没有更新'}`}
            >
              <span>{WEEK[new Date(d.day).getDay()].slice(1)}</span>
              <span className={cn('grid size-7 place-items-center rounded-full text-sm num', h.isToday && 'bg-accent text-on-accent')}>{new Date(d.day).getDate()}</span>
              <span className={cn('size-1 rounded-full', n ? 'bg-text/60' : 'bg-transparent')} aria-hidden />
            </button>
          )
        })}
      </div>
      {shown.length === 0 && <p className="py-14 text-center text-muted">这周没有更新</p>}
      {shown.map((d, di) => {
        const h = dayHead(d.day, today)
        return (
          <div key={d.day} id={`cal-${d.day}`} className="scroll-mt-[calc(var(--nav-h,0px)+12px)]">
            <h3 className={cn('m-0 mt-5 mb-1.5 flex items-baseline gap-2 text-base font-bold', intro && 'rise')} style={intro ? riseStep(di * 2) : undefined}>
              {h.name}
              <span className="text-xs font-medium text-muted num">{h.isToday || h.name === '明天' || h.name === '昨天' ? `${WEEK[new Date(d.day).getDay()]} ${h.date}` : h.date}</span>
            </h3>
            {cap.visible(d.day, d.entries, DAY_CAP_AGENDA).map((e, i) => (
              <AgendaRow key={`${e.kind}${e.mangaId}`} e={e} now={now} rise={intro ? riseStep(di * 2 + i + 1) : undefined} />
            ))}
            {cap.hidden(d.day, d.entries, DAY_CAP_AGENDA) > 0 && <MoreButton n={cap.hidden(d.day, d.entries, DAY_CAP_AGENDA)} onClick={() => cap.expand(d.day)} className="pl-1" />}
          </div>
        )
      })}
    </div>
  )
}

function AgendaRow({ e, now, rise }: { e: DayEntry<Manga>; now: number; rise?: CSSProperties }) {
  const pred = e.kind === 'pred'
  return (
    <Link
      to={`/manga/${e.mangaId}`}
      viewTransition
      data-sfw={sfwAttr(e.manga.source?.displayName)}
      data-nsfw={useNsfwBlur(e.manga)}
      style={rise}
      className={cn('flex min-h-[64px] items-center gap-3 rounded-2xl py-2 pr-2 pl-1 text-text no-underline transition-colors hover:bg-hover', rise && 'rise')}
    >
      <span className={cn('cv w-[38px] flex-none rounded-md', pred && 'opacity-45 outline-1 outline-offset-2 outline-dashed outline-text/50')}>
        <CoverImg src={e.manga.thumbnailUrl} loading="lazy" />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className={cn('truncate', pred ? 'text-muted' : 'font-semibold')}><FavoriteMark id={e.mangaId} />{e.manga.title}</span>
        <span className="truncate text-xs text-muted num">{pred ? `预计 · ${entrySub(e, now)}` : entrySub(e, now)}</span>
      </span>
    </Link>
  )
}

function Legend() {
  return (
    <div className="mt-6 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
      <span className="flex items-center gap-1.5">
        <i className="block h-3 w-2 rounded-[2px] bg-text/70" aria-hidden />
        已发布的更新
      </span>
      <span className="flex items-center gap-1.5">
        <i className="block h-3 w-2 rounded-[2px] bg-text/70 opacity-45 outline-1 outline-offset-1 outline-dashed outline-text/60" aria-hidden />
        按最近几话的规律推算，仅供参考
      </span>
    </div>
  )
}

function SeriesRow({ s, sub }: { s: Series<Manga>; sub: string }) {
  return (
    <Link
      to={`/manga/${s.mangaId}`}
      viewTransition
      data-sfw={sfwAttr(s.manga.source?.displayName)}
      data-nsfw={useNsfwBlur(s.manga)}
      className="flex min-h-[64px] min-w-0 items-center gap-3 rounded-2xl py-2 pr-2 pl-1 text-text no-underline transition-colors hover:bg-hover"
    >
      <span className="cv w-[38px] flex-none rounded-md">
        <CoverImg src={s.manga.thumbnailUrl} loading="lazy" />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate font-medium"><FavoriteMark id={s.mangaId} />{s.manga.title}</span>
        <span className="truncate text-xs text-muted num">{sub}</span>
      </span>
    </Link>
  )
}

const REASONS = { stalled: '很久没更新', irregular: '更新不太规律', few: '最近发的话太少', ended: '已完结或只抓一次' } as const

/** 推算不出的：默认收起，只给一行各类的数量 */
function Unpredicted({ rest }: { rest: ReturnType<typeof leftovers<Manga>> }) {
  const [open, setOpen] = useState(false)
  const groups = (Object.keys(REASONS) as (keyof typeof REASONS)[]).map((k) => ({ k, items: rest[k] as Series<Manga>[] })).filter((g) => g.items.length)
  if (!groups.length) return null
  return (
    <div className="mt-8">
      <button type="button" className="flex min-h-11 items-center gap-1.5 border-0 bg-transparent p-0 text-left text-sm text-muted hover:text-text" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span>
          <span className="font-semibold text-text">不预测</span>
          {' · '}
          {groups.map((g) => `${REASONS[g.k]} ${g.items.length} 部`).join('，')}
        </span>
        <ChevronDown className={cn('size-4 flex-none transition-transform', open && 'rotate-180')} strokeWidth={1.8} />
      </button>
      {open && groups.map((g) => (
        <div key={g.k} className="mt-3">
          <h3 className="m-0 mb-1 text-sm font-semibold text-muted">{REASONS[g.k]}</h3>
          <div className="grid gap-x-6 md:grid-cols-[repeat(auto-fill,minmax(280px,1fr))]">
            {g.items.map((s) => <SeriesRow key={s.mangaId} s={s} sub={unpredictedSub(s.prediction)} />)}
          </div>
        </div>
      ))}
    </div>
  )
}

function unpredictedSub(p: Prediction) {
  if (p.kind === 'none') return p.reason === 'few' ? '近半年只更新过一两次' : p.reason === 'once' ? '设置为只抓一次' : '已完结'
  const last = p.days[p.days.length - 1]
  const d = new Date(last)
  return p.late > 0 ? `最近一话 ${d.getMonth() + 1}/${d.getDate()}` : `${intervalLabel(p.interval)}左右 · 不太规律`
}

function CalendarSkeleton() {
  return (
    <div className="mt-[70px] grid grid-cols-7 gap-x-3 max-md:grid-cols-1 max-md:gap-y-3" aria-hidden>
      {Array.from({ length: 7 }, (_, i) => (
        <div key={i} className="flex flex-col gap-3 max-md:flex-row max-md:items-center">
          <span className="skel aspect-[2/3] w-full max-w-[112px] rounded-lg max-md:w-[38px]" style={riseStep(i)} />
          <span className="skel h-3 w-2/3 rounded-full" style={riseStep(i)} />
        </div>
      ))}
    </div>
  )
}
