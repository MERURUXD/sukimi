import { useQuery } from '@apollo/client/react'
import { CalendarClock, ChevronDown, ChevronLeft, ChevronRight, Star } from 'lucide-react'
import { createContext, useContext, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { Link } from 'react-router'
import type { CalendarChaptersQuery } from '@/api/gql/graphql'
import { Glass } from '@/components/glass/Glass'
import { CoverImg } from '@/components/manga/CoverImg'
import { LoadError } from '@/components/ui/LoadError'
import { useFavorites } from '@/features/favorite/useFavorites'
import { useNsfwBlur } from '@/features/nsfw/useNsfw'
import { t } from '@/i18n'
import { cn } from '@/lib/cn'
import { sfwAttr } from '@/lib/devSafe'
import { chapterLabel, ms, sec } from '@/lib/format'
import { riseStep, useIntro } from '@/lib/intro'
import { buildWeek, leftovers, seriesOf, weekStart, type CalendarDay, type DayEntry, type Series } from './calendar'
import { addDays, clockLabel, daysBetween, intervalLabel, regularLabel, startOfDay, weekdayName, type Prediction } from './predict'
import { CALENDAR_LIMIT, CalendarChapters, calendarFilter } from './queries'

type Manga = CalendarChaptersQuery['chapters']['nodes'][number]['manga']

const WEEK_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const
/** 往前最多翻到近半年的窗口，往后两个月 */
const MIN_WEEK = -25
const MAX_WEEK = 8
/** 整周总览时每天先露出的条数，多的折叠成「还有 N 部」；选中单日时全部展开 */
const DAY_CAP = 6
const LATE_CAP = 6
const ROW_GRID = 'grid grid-cols-1 gap-x-5 gap-y-1 md:grid-cols-2 xl:grid-cols-3'

/** 特别关心的漫画 id；整页取一次往下传，标题前标一颗实心星 */
const Favorites = createContext<ReadonlyMap<number, number>>(new Map())

function FavoriteMark({ id }: { id: number }) {
  if (!useContext(Favorites).has(id)) return null
  return <Star className="size-3.5 flex-none fill-current" strokeWidth={2.2} aria-label={t('home.section.favorite')} />
}

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
    <button type="button" onClick={onClick} className={cn('min-h-9 self-start border-0 bg-transparent px-2.5 text-left text-[13px] font-medium text-muted hover:text-text', className)}>
      {t('home.week.moreLeft', { n })}
    </button>
  )
}

/** 过去显示实际更新，今天以后显示推算；无法推算的另列。 */
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
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [favOnly, setFavOnly] = useState(false)
  const [lateOpen, setLateOpen] = useState(false)
  const favorites = useFavorites().ids
  const cap = useCapped<DayEntry<Manga>>()

  const chapters = useMemo(
    () => (query.data?.chapters.nodes ?? []).map((c) => ({ ...c, uploadDate: ms(c.uploadDate), fetchedAt: sec(c.fetchedAt) })),
    [query.data],
  )
  const series = useMemo(() => seriesOf(chapters, now), [chapters, now])
  const start = addDays(weekStart(now), offset * 7)
  const rawWeek = useMemo(() => buildWeek(chapters, series, start, now), [chapters, series, start, now])
  const rawRest = useMemo(() => leftovers(series), [series])

  const activeFavOnly = favOnly && favorites.size > 0
  const week = useMemo(
    () => (activeFavOnly ? rawWeek.map((d) => ({ ...d, entries: d.entries.filter((e) => favorites.has(e.mangaId)) })) : rawWeek),
    [rawWeek, activeFavOnly, favorites],
  )
  const rest = useMemo(() => {
    if (!activeFavOnly) return rawRest
    const keep = <T extends { mangaId: number }>(xs: T[]) => xs.filter((s) => favorites.has(s.mangaId))
    return {
      late: keep(rawRest.late),
      stalled: keep(rawRest.stalled),
      irregular: keep(rawRest.irregular),
      few: keep(rawRest.few),
      ended: keep(rawRest.ended),
    }
  }, [rawRest, activeFavOnly, favorites])

  if (query.error && !query.data) return <LoadError message={query.error.message} onRetry={() => void query.refetch().catch(() => {})} />
  if (!query.data) return <CalendarSkeleton />

  const today = startOfDay(now)
  const doneCount = new Set(week.flatMap((d) => d.entries.filter((e) => e.kind === 'done').map((e) => e.mangaId))).size
  const predCount = new Set(week.flatMap((d) => d.entries.filter((e) => e.kind === 'pred').map((e) => e.mangaId))).size
  const summary = [
    doneCount ? t(offset === 0 ? 'updates.cal.doneThis' : 'updates.cal.doneOther', { n: doneCount }) : null,
    predCount ? t(doneCount ? 'updates.cal.predictedMore' : 'updates.cal.predicted', { n: predCount }) : null,
  ].filter(Boolean).join(t('updates.cal.sep'))
  const end = addDays(start, 6)
  const range = `${new Date(start).getMonth() + 1}/${new Date(start).getDate()} – ${new Date(end).getMonth() + 1}/${new Date(end).getDate()}`

  const changeOffset = (next: number) => {
    setOffset(next)
    setSelectedDay(null)
  }

  // 本周先看今天和接下来几天，再往回看已经更新的（和「最近」一样新的在前）
  const selected = selectedDay !== null ? week.find((d) => d.day === selectedDay) ?? null : null
  const withEntries = week.filter((d) => d.entries.length > 0)
  const shownDays = selected ? [selected] : [...withEntries.filter((d) => d.day >= today), ...withEntries.filter((d) => d.day < today).reverse()]

  return (
    <Favorites.Provider value={favorites}>
      <section aria-label={t('updates.cal.aria')} className="pb-6">
        <div className="mt-4 mb-4 flex flex-wrap items-center justify-between gap-3 md:mt-5">
          <div className="flex min-w-0 flex-wrap items-center gap-2.5">
            <p className="m-0 text-[13px] text-muted md:text-sm">{summary || (offset < 0 ? t('updates.cal.noNew') : t('updates.cal.noPlanned'))}</p>
            {favorites.size > 0 && (
              <button
                type="button"
                aria-pressed={activeFavOnly}
                aria-label={t('updates.cal.favoritesOnlyAria')}
                onClick={() => setFavOnly((v) => !v)}
                className={cn('fopt', activeFavOnly && 'inc')}
              >
                <Star className={cn('size-3.5', activeFavOnly && 'fill-current')} strokeWidth={2} />
                {t('updates.cal.favoritesOnly')}
              </button>
            )}
          </div>
          <div className="flex flex-none items-center gap-1.5">
            <Glass flat as="button" type="button" className="gicon size-10 rounded-full" disabled={offset <= MIN_WEEK} onClick={() => changeOffset(offset - 1)} aria-label={t('updates.cal.prev')}>
              <ChevronLeft className="size-[18px]" strokeWidth={1.8} />
            </Glass>
            <Glass flat as="button" type="button" className="gbtn min-h-10 min-w-[104px] rounded-full text-[13px] num" onClick={() => changeOffset(0)} aria-label={t('updates.cal.backToThis')} title={t('updates.cal.backToThis')}>
              {offset === 0 ? t('updates.cal.thisWeek') : range}
            </Glass>
            <Glass flat as="button" type="button" className="gicon size-10 rounded-full" disabled={offset >= MAX_WEEK} onClick={() => changeOffset(offset + 1)} aria-label={t('updates.cal.next')}>
              <ChevronRight className="size-[18px]" strokeWidth={1.8} />
            </Glass>
          </div>
        </div>

        <WeekStrip
          week={week}
          today={today}
          selectedDay={selectedDay}
          onSelect={(day) => setSelectedDay((cur) => (cur === day ? null : day))}
        />

        {shownDays.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center text-muted">
            <p className="m-0">{t('updates.cal.weekEmpty')}</p>
            {activeFavOnly && (
              <Glass flat as="button" type="button" className="gbtn rounded-full text-text" onClick={() => setFavOnly(false)}>
                {t('updates.viewAll')}
              </Glass>
            )}
          </div>
        ) : (
          <div className="mt-2">
            {shownDays.map((d, di) => (
              <DaySection
                key={d.day}
                d={d}
                today={today}
                now={now}
                focused={selected !== null}
                onShowFullWeek={() => setSelectedDay(null)}
                entries={selected ? d.entries : cap.visible(d.day, d.entries, DAY_CAP)}
                hidden={selected ? 0 : cap.hidden(d.day, d.entries, DAY_CAP)}
                onExpand={() => cap.expand(d.day)}
                riseBase={intro ? di * 3 : undefined}
              />
            ))}
          </div>
        )}

        {predCount > 0 && (
          <p className="mt-6 mb-0 text-xs text-faint">{t('updates.cal.predNote')}</p>
        )}

        {rest.late.length > 0 && (
          <div className="mt-10">
            <h2 className="m-0 mb-2.5 flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5 text-lg font-bold lg:text-xl">
              {t('updates.cal.late')}
              <span className="text-[13px] font-medium text-muted num">{t('updates.cal.dayTitles', { count: rest.late.length })}</span>
              <span className="text-[13px] font-medium text-muted">{t('updates.cal.lateHint')}</span>
            </h2>
            <div className={ROW_GRID}>
              {(lateOpen ? rest.late : rest.late.slice(0, LATE_CAP)).map((s) => (
                <SeriesRow key={s.mangaId} s={s} sub={t('updates.cal.lateSub', { interval: intervalLabel(s.prediction.interval), n: s.prediction.late })} />
              ))}
            </div>
            {!lateOpen && rest.late.length > LATE_CAP && <MoreButton n={rest.late.length - LATE_CAP} onClick={() => setLateOpen(true)} className="mt-1.5" />}
          </div>
        )}

        <Unpredicted rest={rest} />
        {query.data.chapters.nodes.length >= CALENDAR_LIMIT && (
          <p className="mt-6 text-xs text-muted">{t('updates.cal.limit', { n: CALENDAR_LIMIT.toLocaleString('en-US') })}</p>
        )}
      </section>
    </Favorites.Provider>
  )
}

function dayHead(day: number, today: number) {
  const d = new Date(day)
  const diff = daysBetween(today, day)
  const isRelative = diff === 0 || diff === 1 || diff === -1
  return {
    name: diff === 0 ? t('format.today') : diff === 1 ? t('updates.tomorrow') : diff === -1 ? t('format.yesterday') : weekdayName(d.getDay()),
    weekday: weekdayName(d.getDay()),
    short: t(`updates.cal.weekShort.${WEEK_KEYS[d.getDay()]}`),
    date: `${d.getMonth() + 1}/${d.getDate()}`,
    dayNum: d.getDate(),
    month: d.getMonth() + 1,
    isToday: diff === 0,
    isRelative,
  }
}

function WeekStrip({
  week,
  today,
  selectedDay,
  onSelect,
}: {
  week: CalendarDay<Manga>[]
  today: number
  selectedDay: number | null
  onSelect: (day: number) => void
}) {
  const buttons = useRef<Array<HTMLButtonElement | null>>([])
  const onKey = (e: KeyboardEvent, i: number) => {
    const next = e.key === 'ArrowRight' ? (i + 1) % week.length
      : e.key === 'ArrowLeft' ? (i + week.length - 1) % week.length
      : e.key === 'Home' ? 0
      : e.key === 'End' ? week.length - 1
      : null
    if (next === null) return
    e.preventDefault()
    buttons.current[next]?.focus()
  }
  return (
    <div role="group" aria-label={t('updates.cal.pickDay')} className="grid grid-cols-7 gap-1 sm:gap-2">
      {week.map((d, i) => {
        const h = dayHead(d.day, today)
        const doneN = d.entries.filter((e) => e.kind === 'done').length
        const predN = d.entries.length - doneN
        const total = d.entries.length
        const isSelected = selectedDay === d.day
        const showMonth = i === 0 || h.dayNum === 1
        return (
          <button
            key={d.day}
            ref={(el) => { buttons.current[i] = el }}
            type="button"
            aria-pressed={isSelected}
            aria-label={total ? t('updates.cal.dayAria', { name: h.name, date: h.date, n: total }) : t('updates.cal.dayAriaNone', { name: h.name, date: h.date })}
            onClick={() => onSelect(d.day)}
            onKeyDown={(e) => onKey(e, i)}
            className={cn(
              'flex min-h-[72px] flex-col items-center justify-between rounded-2xl border-0 px-1 py-2.5 text-center transition-colors sm:min-h-[92px] sm:items-stretch sm:px-3.5 sm:py-3 sm:text-left',
              isSelected
                ? 'bg-text text-bg shadow-[0_8px_22px_rgba(0,0,0,.18)]'
                : h.isToday
                  ? 'bg-accent-soft text-text hover:bg-hover'
                  : total > 0
                    ? 'bg-transparent text-text hover:bg-hover'
                    : 'bg-transparent text-faint hover:bg-hover/60',
            )}
          >
            <span className="flex w-full items-center justify-center gap-1 sm:justify-between">
              <span className={cn('text-[11px] font-semibold sm:hidden', isSelected ? 'opacity-80' : h.isToday ? 'text-text' : 'text-muted')}>
                {h.short}
              </span>
              <span className={cn('text-xs font-semibold max-sm:hidden', isSelected ? 'opacity-80' : h.isToday ? 'text-text' : total > 0 ? 'text-muted' : 'text-faint')}>
                {h.isToday ? h.name : h.weekday}
              </span>
              {h.isToday && !isSelected && <span aria-hidden className="size-1.5 rounded-full bg-accent max-sm:hidden" />}
            </span>

            <span className={cn(
              'mt-1 grid place-items-center text-[15px] leading-none font-extrabold num sm:mt-2 sm:block sm:text-[22px]',
              h.isToday && !isSelected && 'max-sm:size-7 max-sm:rounded-full max-sm:bg-accent max-sm:text-sm max-sm:text-on-accent',
            )}>
              <span className="sm:hidden">{h.dayNum}</span>
              <span className="max-sm:hidden">{showMonth ? h.date : h.dayNum}</span>
            </span>

            <span aria-hidden className="mt-1.5 flex h-1.5 items-center justify-center gap-1 sm:hidden">
              {doneN > 0 && <span className="size-1.5 rounded-full bg-current" />}
              {predN > 0 && <span className="size-1.5 rounded-full border-[1.5px] border-current opacity-70" />}
            </span>

            <span aria-hidden className="mt-2.5 flex min-h-4 items-center gap-2.5 text-[11px] font-semibold num max-sm:hidden">
              {doneN > 0 && (
                <span className="inline-flex items-center gap-1">
                  <i className="block size-1.5 rounded-full bg-current" />
                  {doneN}
                </span>
              )}
              {predN > 0 && (
                <span className={cn('inline-flex items-center gap-1', isSelected ? 'opacity-75' : 'text-muted')}>
                  <i className="block size-1.5 rounded-full border-[1.5px] border-current" />
                  {predN}
                </span>
              )}
              {total === 0 && <span className="opacity-35">—</span>}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function DaySection({
  d,
  today,
  now,
  focused,
  onShowFullWeek,
  entries,
  hidden,
  onExpand,
  riseBase,
}: {
  d: CalendarDay<Manga>
  today: number
  now: number
  focused: boolean
  onShowFullWeek: () => void
  entries: DayEntry<Manga>[]
  hidden: number
  onExpand: () => void
  riseBase?: number
}) {
  const h = dayHead(d.day, today)
  const totalDone = d.entries.filter((e) => e.kind === 'done').length
  const totalPred = d.entries.length - totalDone
  const countSummary = [
    totalDone ? t('updates.cal.dayDoneCount', { n: totalDone }) : null,
    totalPred ? t('updates.cal.dayPredCount', { n: totalPred }) : null,
  ].filter(Boolean).join(' · ')

  const doneItems = entries.filter((e) => e.kind === 'done')
  const predItems = entries.filter((e) => e.kind === 'pred')
  const mixed = doneItems.length > 0 && predItems.length > 0

  return (
    <div className="mt-7">
      <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="m-0 flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5 text-lg font-bold lg:text-xl">
          <span>{h.name}</span>
          <span className="text-[13px] font-medium text-muted num">
            {h.isRelative ? `${h.weekday} ${h.date}` : h.date}
          </span>
          {countSummary && <span className="text-[13px] font-medium text-muted num">{countSummary}</span>}
        </h2>
        {focused && (
          <button type="button" onClick={onShowFullWeek} className="min-h-9 border-0 bg-transparent px-1 text-[13px] font-medium text-muted hover:text-text">
            {t('updates.cal.showFullWeek')}
          </button>
        )}
      </div>

      {d.entries.length === 0 ? (
        <p className="m-0 py-10 text-center text-sm text-muted">{t('updates.cal.dayEmpty')}</p>
      ) : mixed ? (
        <div className="flex flex-col gap-4">
          <div>
            <h3 className="m-0 mb-1.5 px-2.5 text-xs font-semibold tracking-wide text-muted">{t('updates.cal.doneGroup')}</h3>
            <div className={ROW_GRID}>
              {doneItems.map((e, i) => (
                <CalendarRow key={`${e.kind}${e.mangaId}`} e={e} now={now} rise={riseBase !== undefined ? riseStep(riseBase + i) : undefined} />
              ))}
            </div>
          </div>
          <div>
            <h3 className="m-0 mb-1.5 px-2.5 text-xs font-semibold tracking-wide text-muted">{t('updates.cal.predGroup')}</h3>
            <div className={ROW_GRID}>
              {predItems.map((e, i) => (
                <CalendarRow key={`${e.kind}${e.mangaId}`} e={e} now={now} rise={riseBase !== undefined ? riseStep(riseBase + doneItems.length + i) : undefined} />
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className={ROW_GRID}>
          {entries.map((e, i) => (
            <CalendarRow key={`${e.kind}${e.mangaId}`} e={e} now={now} rise={riseBase !== undefined ? riseStep(riseBase + i) : undefined} />
          ))}
        </div>
      )}

      {hidden > 0 && <MoreButton n={hidden} onClick={onExpand} className="mt-1.5" />}
    </div>
  )
}

/** 当天更新的章节标题；一天出了好几话时前面加话数，截断时也看得到 */
function doneLabel(e: Extract<DayEntry<Manga>, { kind: 'done' }>) {
  const title = chapterLabel(e.latest)
  return e.count > 1 ? t('updates.cal.doneLabel', { count: e.count, title }) : title
}

function entrySub(e: DayEntry<Manga>, now: number) {
  if (e.kind === 'done') return doneLabel(e)
  const p = e.prediction
  const soon = daysBetween(startOfDay(now), p.next) <= 1
  return p.minute !== undefined && soon ? t('updates.cal.aroundClock', { clock: clockLabel(p.minute) }) : t('updates.cal.intervalSub', { interval: intervalLabel(p.interval), regular: regularLabel(p) })
}

function CalendarRow({ e, now, rise }: { e: DayEntry<Manga>; now: number; rise?: CSSProperties }) {
  const pred = e.kind === 'pred'
  const source = e.manga.source?.displayName
  return (
    <Link
      to={`/manga/${e.mangaId}`}
      viewTransition
      data-sfw={sfwAttr(source)}
      data-nsfw={useNsfwBlur(e.manga)}
      style={rise}
      className={cn('group flex min-h-[76px] min-w-0 items-center gap-3.5 rounded-2xl px-2.5 py-2 text-text no-underline transition-colors hover:bg-hover', rise && 'rise')}
    >
      <span className="cv relative w-[50px] flex-none rounded-lg shadow-[0_6px_16px_rgba(0,0,0,.16)] sm:w-[54px]">
        <CoverImg src={e.manga.thumbnailUrl} loading="lazy" />
        {pred && <span aria-hidden className="absolute inset-0 bg-bg/25 transition-opacity duration-200 group-hover:opacity-0" />}
        {!pred && e.count > 1 && (
          <span aria-hidden className="pointer-events-none absolute right-1 bottom-1 rounded-full bg-text/85 px-1.5 py-0.5 text-[10px] leading-none font-bold text-bg num">
            +{e.count}
          </span>
        )}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex min-w-0 items-center gap-1.5">
          <FavoriteMark id={e.mangaId} />
          <span className={cn('truncate text-[15px] leading-snug', pred ? 'font-medium text-text/85' : 'font-semibold text-text')}>
            {e.manga.title}
          </span>
        </span>
        <span className="flex min-w-0 items-center gap-1.5 text-[13px] text-muted num">
          {pred && <CalendarClock className="size-3.5 flex-none opacity-75" strokeWidth={1.8} aria-hidden />}
          {/* 整行照常朗读标题和副标题；预计的只靠图标区分，读屏另补一句 */}
          {pred && <span className="sr-only">{t('updates.cal.predGroup')}</span>}
          <span className="truncate">{entrySub(e, now)}</span>
        </span>
        {source && <span className="truncate text-xs text-faint">{source}</span>}
      </span>
    </Link>
  )
}

function SeriesRow({ s, sub }: { s: Series<Manga>; sub: string }) {
  const source = s.manga.source?.displayName
  return (
    <Link
      to={`/manga/${s.mangaId}`}
      viewTransition
      data-sfw={sfwAttr(source)}
      data-nsfw={useNsfwBlur(s.manga)}
      className="flex min-h-[76px] min-w-0 items-center gap-3.5 rounded-2xl px-2.5 py-2 text-text no-underline transition-colors hover:bg-hover"
    >
      <span className="cv w-[50px] flex-none rounded-lg shadow-[0_6px_16px_rgba(0,0,0,.16)] sm:w-[54px]">
        <CoverImg src={s.manga.thumbnailUrl} loading="lazy" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex min-w-0 items-center gap-1.5">
          <FavoriteMark id={s.mangaId} />
          <span className="truncate text-[15px] leading-snug font-medium text-text">{s.manga.title}</span>
        </span>
        <span className="truncate text-[13px] text-muted num">{sub}</span>
        {source && <span className="truncate text-xs text-faint">{source}</span>}
      </span>
    </Link>
  )
}

const REASONS = ['stalled', 'irregular', 'few', 'ended'] as const

function Unpredicted({ rest }: { rest: ReturnType<typeof leftovers<Manga>> }) {
  const [open, setOpen] = useState(false)
  const groups = REASONS.map((k) => ({ k, items: rest[k] as Series<Manga>[] })).filter((g) => g.items.length)
  if (!groups.length) return null
  return (
    <div className="mt-8">
      <button type="button" className="flex min-h-11 items-center gap-1.5 border-0 bg-transparent p-0 text-left text-sm text-muted hover:text-text" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span>
          <span className="font-semibold text-text">{t('updates.cal.skip')}</span>
          {' · '}
          {groups.map((g) => t('updates.cal.skipItem', { reason: t(`updates.cal.reason.${g.k}`), n: g.items.length })).join(t('updates.cal.sep'))}
        </span>
        <ChevronDown className={cn('size-4 flex-none transition-transform', open && 'rotate-180')} strokeWidth={1.8} />
      </button>
      {open && groups.map((g) => (
        <div key={g.k} className="mt-4">
          <h3 className="m-0 mb-1.5 px-2.5 text-xs font-semibold tracking-wide text-muted">{t(`updates.cal.reason.${g.k}`)}</h3>
          <div className={ROW_GRID}>
            {g.items.map((s) => <SeriesRow key={s.mangaId} s={s} sub={unpredictedSub(s.prediction)} />)}
          </div>
        </div>
      ))}
    </div>
  )
}

function unpredictedSub(p: Prediction) {
  if (p.kind === 'none') return p.reason === 'few' ? t('updates.cal.fewSub') : p.reason === 'once' ? t('updates.cal.onceSub') : t('updates.cal.endedSub')
  const last = p.days[p.days.length - 1]
  const d = new Date(last)
  return p.late > 0 ? t('updates.cal.lastChapter', { date: `${d.getMonth() + 1}/${d.getDate()}` }) : t('updates.cal.roughly', { interval: intervalLabel(p.interval) })
}

function CalendarSkeleton() {
  return (
    <div className="mt-4 md:mt-5" aria-hidden>
      <div className="mb-4 flex items-center justify-between gap-3">
        <span className="skel h-4 w-44 rounded-full" />
        <span className="skel h-10 w-48 rounded-full" />
      </div>
      <div className="grid grid-cols-7 gap-1 sm:gap-2">
        {Array.from({ length: 7 }, (_, i) => (
          <span key={i} className="skel h-[72px] rounded-2xl sm:h-[92px]" style={riseStep(i)} />
        ))}
      </div>
      <div className={cn('mt-8', ROW_GRID)}>
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex items-center gap-3.5 px-2.5 py-2">
            <span className="skel aspect-[2/3] w-[50px] flex-none rounded-lg sm:w-[54px]" style={riseStep(i + 2)} />
            <span className="flex flex-1 flex-col gap-2">
              <span className="skel h-3.5 w-3/5 rounded-full" style={riseStep(i + 2)} />
              <span className="skel h-3 w-2/5 rounded-full" style={riseStep(i + 2)} />
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
