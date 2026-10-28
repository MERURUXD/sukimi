import { useApolloClient, useMutation, useQuery } from '@apollo/client/react'
import { AnimatePresence } from 'motion/react'
import { ArrowDownToLine, ArrowUpFromLine, ExternalLink, ListChecks, Loader2, Minus, Plus, RefreshCw, Search, Unlink, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { Glass, MotionGlass } from '@/components/glass/Glass'
import { confirm } from '@/components/ui/Confirm'
import { Dialog, usePopMotion } from '@/components/ui/Dialog'
import { toast, toastError } from '@/components/ui/toast'
import { StaleSessionError } from '@/api/userContext'
import { SourceIcon } from '@/features/browse/SourceIcon'
import { Select, Switch } from '@/features/settings/parts'
import { chapterNo } from '@/lib/format'
import { cn } from '@/lib/cn'
import { httpUrl } from '@/lib/url'
import { BindTrack, FetchTrack, MangaTracks, SearchTracker, Trackers, UnbindTrack, type Tracker, type TrackRecord } from './queries'
import { pullTrackProgress, pushTrackProgress } from './sync'
import { Stars } from './Stars'
import { fromDateInput, scoreString, scoreValue, scoreWord, starScale, statusLabel, toDateInput } from './tracking'
import { useSaveTrack } from './useSaveTrack'
import { t as tl } from '@/i18n'

/** 详情页的「追踪」按钮：角标是已绑定的数量 */
export function TrackButton({ mangaId, title }: { mangaId: number; title: string }) {
  const [open, setOpen] = useState(false)
  const bound = useQuery(MangaTracks, { variables: { id: mangaId } }).data?.manga.trackRecords.nodes.length ?? 0
  return (
    <>
      <Glass as="button" type="button" className={cn('gicon relative rounded-full', bound > 0 && 'bg-g-hi')} onClick={() => setOpen(true)} aria-label={bound ? tl('track.boundAria', { n: bound }) : tl('track.title')} title={tl('track.title')}>
        <ListChecks className="size-5" strokeWidth={1.8} />
        {bound > 0 && <span className="absolute -top-1 -right-1 grid h-5 min-w-5 place-items-center rounded-full bg-solid px-1 text-[11px] font-bold text-on-solid num">{bound}</span>}
      </Glass>
      <AnimatePresence>{open && <TrackDialog mangaId={mangaId} title={title} onClose={() => setOpen(false)} />}</AnimatePresence>
    </>
  )
}

export function TrackDialog({ mangaId, title, onClose }: { mangaId: number; title: string; onClose: () => void }) {
  const trackers = useQuery(Trackers).data?.trackers.nodes
  const records = useQuery(MangaTracks, { variables: { id: mangaId }, fetchPolicy: 'cache-and-network' }).data?.manga.trackRecords.nodes
  const client = useApolloClient()
  const [syncing, setSyncing] = useState<'push' | 'pull' | null>(null)
  const loggedIn = trackers?.filter((t) => t.isLoggedIn) ?? []
  const pop = usePopMotion()

  const sync = async (dir: 'push' | 'pull') => {
    setSyncing(dir)
    try {
      if (dir === 'push') {
        const n = await pushTrackProgress(client, mangaId)
        toast(n ? tl('track.syncedUp') : tl('track.upToDateSite'))
      } else {
        const n = await pullTrackProgress(client, mangaId)
        toast(n ? tl('track.syncedDown', { n }) : tl('track.upToDateLocal'))
      }
    } catch (e) {
      if (!(e instanceof StaleSessionError)) toastError(tl('track.syncFailed'), e)
    } finally {
      setSyncing(null)
    }
  }

  return (
    <Dialog label={tl('track.title')} onClose={onClose}>
      <MotionGlass
        dense
        {...pop}
        className="no-scrollbar relative flex max-h-[calc(100dvh-32px)] w-[min(560px,100%)] flex-col gap-6 overflow-y-auto overscroll-contain rounded-[26px] p-6 [--g-drop:0_30px_80px_rgba(0,0,0,.5)]"
      >
        <div className="flex items-center gap-3">
          <h2 className="m-0 flex-1 text-lg font-bold">{tl('track.title')}</h2>
          <button type="button" className="gicon size-10" aria-label={tl('common.close')} onClick={onClose}>
            <X className="size-5" />
          </button>
        </div>

        {records && records.length > 0 && (
          <div className="-mt-2 flex flex-col gap-1.5">
            <div className="flex flex-wrap gap-2">
              <button type="button" className="gbtn min-h-10 rounded-full hover:bg-hover" disabled={!!syncing} onClick={() => void sync('pull')}>
                <ArrowDownToLine className={cn('size-4', syncing === 'pull' && 'animate-pulse')} />
                {tl('track.toLocal')}
              </button>
              <button type="button" className="gbtn min-h-10 rounded-full hover:bg-hover" disabled={!!syncing} onClick={() => void sync('push')}>
                <ArrowUpFromLine className={cn('size-4', syncing === 'push' && 'animate-pulse')} />
                {tl('track.toSite')}
              </button>
            </div>
            <p className="m-0 text-xs leading-relaxed text-muted">
              {tl('track.syncHint')}
            </p>
          </div>
        )}

        {!trackers && <span className="text-sm text-muted">{tl('manga.loading')}</span>}
        {trackers && loggedIn.length === 0 && (
          <p className="m-0 text-sm leading-relaxed text-muted">
            {tl('track.noLogin')}
            <Link to="/settings/tracking" className="ml-1 font-semibold text-text">{tl('track.goLogin')}</Link>
          </p>
        )}

        {loggedIn.map((t) => {
          const record = records?.find((r) => r.trackerId === t.id)
          return (
            <section key={t.id} aria-label={t.name} className="flex flex-col gap-3.5">
              <div className="flex items-center gap-2.5">
                <SourceIcon s={{ iconUrl: t.icon, displayName: t.name }} size={28} />
                <h3 className="m-0 flex-1 text-base font-bold">{t.name}</h3>
                {t.isTokenExpired && <span className="text-xs text-danger">{tl('track.expired')}</span>}
              </div>
              {record ? <RecordEditor key={`${record.id}:${record.lastChapterRead}`} t={t} r={record} /> : <Binder t={t} mangaId={mangaId} title={title} />}
            </section>
          )
        })}
      </MotionGlass>
    </Dialog>
  )
}

/* ───────── 已绑定：改状态、进度、评分、日期 ───────── */

function RecordEditor({ t, r }: { t: Tracker; r: TrackRecord }) {
  const save = useSaveTrack(r)
  const [refresh, { loading: refreshing }] = useMutation(FetchTrack)
  const [unbind] = useMutation(UnbindTrack, {
    // 解除后从这部漫画的绑定列表里去掉
    update: (cache) => {
      cache.evict({ id: cache.identify({ __typename: 'TrackRecordType', id: r.id }) })
      cache.gc()
    },
  })
  // 网站上的进度变了（刷新、同步后）由外面换 key 重新挂载，输入框跟着更新
  const [chapters, setChapters] = useState(String(r.lastChapterRead))

  const saveChapters = (v: number) => {
    const n = Math.max(0, r.totalChapters > 0 ? Math.min(v, r.totalChapters) : v)
    setChapters(String(n))
    if (n !== r.lastChapterRead) save({ lastChapterRead: n })
  }

  const remove = async () => {
    const ok = await confirm({ title: tl('track.unbindTitle', { name: t.name }), body: tl('track.unbindBody'), ok: tl('track.unbind'), danger: true })
    if (!ok) return
    // 支持删除的网站，再问一次要不要连网站上的记录一起删
    const deleteRemote =
      t.supportsTrackDeletion &&
      (await confirm({ title: tl('track.deleteTitle', { name: t.name }), body: tl('track.deleteBody'), ok: tl('track.deleteOk'), danger: true }))
    try {
      await unbind({ variables: { recordId: r.id, deleteRemoteTrack: deleteRemote || null } })
      toast(tl('track.unbound'))
    } catch (e) {
      toastError(tl('track.unbindFailed'), e)
    }
  }

  const statuses = t.statuses.map((s) => ({ value: s.value, label: statusLabel(s.name) }))
  const scale = starScale(t.scores)
  const remote = httpUrl(r.remoteUrl)
  return (
    <div className="flex flex-col gap-3.5 pl-[38px]">
      <div className="flex items-start gap-2">
        <span className="min-w-0 flex-1 text-[15px] leading-snug font-semibold">{r.title}</span>
        {remote && (
          <a href={remote} target="_blank" rel="noreferrer" className="gicon size-9 text-muted hover:text-text" aria-label={tl('track.openOn', { name: t.name })} title={tl('track.openOn', { name: t.name })}>
            <ExternalLink className="size-4" />
          </a>
        )}
        <button type="button" className="gicon size-9 text-muted hover:text-text" disabled={refreshing} aria-label={tl('track.refreshFromSite')} title={tl('track.refreshFromSite')} onClick={() => void refresh({ variables: { recordId: r.id } }).catch((e) => toastError(tl('track.refreshFailed'), e))}>
          <RefreshCw className={cn('size-4', refreshing && 'animate-spin')} />
        </button>
        <button type="button" className="gicon size-9 text-muted hover:text-danger" aria-label={tl('track.unbindAria')} title={tl('track.unbindAria')} onClick={() => void remove()}>
          <Unlink className="size-4" />
        </button>
      </div>

      <div role="group" aria-label={tl('track.statusGroup')} className="flex flex-wrap gap-1.5">
        {statuses.map((s) => (
          <button key={s.value} type="button" className={cn('fopt', r.status === s.value && 'inc')} aria-pressed={r.status === s.value} onClick={() => r.status !== s.value && save({ status: s.value })}>
            {s.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <span className="flex items-center gap-1.5">
          <span className="mr-1 text-sm text-muted">{tl('track.readTo')}</span>
          <button type="button" className="gicon size-9" aria-label={tl('track.less')} onClick={() => saveChapters(Number(chapters) - 1)}>
            <Minus className="size-4" />
          </button>
          <label className="plain flex h-10 w-[72px] items-center rounded-[12px] px-2.5">
            <input
              inputMode="decimal"
              aria-label={tl('track.jumpAria')}
              value={chapters}
              onChange={(e) => setChapters(e.target.value)}
              onBlur={() => saveChapters(Number(chapters) || 0)}
              onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
              className="w-full min-w-0 border-0 bg-transparent text-center text-text outline-none num"
            />
          </label>
          <button type="button" className="gicon size-9" aria-label={tl('track.more')} onClick={() => saveChapters(Number(chapters) + 1)}>
            <Plus className="size-4" />
          </button>
          <span className="text-sm text-muted num">{tl('track.ofTotal', { total: r.totalChapters > 0 ? r.totalChapters : '?' })}</span>
        </span>
        {!scale && t.scores.length > 0 && (
          <span className="flex items-center gap-2">
            <span className="text-sm text-muted">{tl('track.rating')}</span>
            <Select
              label={tl('track.rating')}
              value={r.displayScore}
              options={(t.scores.includes(r.displayScore) ? t.scores : [r.displayScore, ...t.scores]).map((s) => ({ value: s, label: s || tl('track.unrated') }))}
              onChange={(scoreString) => save({ scoreString })}
              className="w-[110px]"
            />
          </span>
        )}
      </div>
      {/* 能画成星星的评分单独一行，和详情页宽屏面板同一个控件 */}
      {scale && (
        <span className="-ml-1">
          <Stars size="md" max={scale} value={Math.min(scoreValue(r.displayScore), scale)} word={(v) => scoreWord(t.name, v)} onChange={(v) => save({ scoreString: scoreString(t.scores, v) })} />
        </span>
      )}

      {t.supportsReadingDates && (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <DateField label={tl('track.start')} value={r.startDate} onChange={(startDate) => save({ startDate })} />
          <DateField label={tl('track.finish')} value={r.finishDate} onChange={(finishDate) => save({ finishDate })} />
        </div>
      )}
      {t.supportsPrivateTracking && (
        <label className="flex items-center gap-3 text-sm">
          <span className="flex-1 text-muted">{tl('track.private')}</span>
          <Switch on={r.private} onChange={(v) => save({ private: v })} label={tl('track.privateShort')} />
        </label>
      )}
    </div>
  )
}

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (ms: string) => void }) {
  return (
    <span className="flex items-center gap-2">
      <span className="text-sm text-muted">{label}</span>
      <label className="plain flex h-10 items-center rounded-[12px] px-2.5">
        <input
          type="date"
          aria-label={tl('track.dateAria', { label })}
          value={toDateInput(value)}
          onChange={(e) => onChange(fromDateInput(e.target.value))}
          className="border-0 bg-transparent text-sm text-text outline-none [color-scheme:inherit]"
        />
      </label>
    </span>
  )
}

/* ───────── 未绑定：搜索条目并绑定 ───────── */

function Binder({ t, mangaId, title }: { t: Tracker; mangaId: number; title: string }) {
  const client = useApolloClient()
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState(title)
  const [q, setQ] = useState('')
  const { data, loading, error } = useQuery(SearchTracker, { variables: { trackerId: t.id, query: q }, skip: !q })
  const [bind] = useMutation(BindTrack)
  const [binding, setBinding] = useState<string | null>(null)
  const [hidden, setHidden] = useState(false)

  if (!open)
    return (
      <div className="pl-[38px]">
        <button type="button" className="gbtn min-h-10 rounded-full bg-g-hi" onClick={() => { setOpen(true); setQ(title) }}>
          <Search className="size-4" />
          {tl('track.searchBind')}
        </button>
      </div>
    )

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setQ(input.trim())
  }
  const pick = async (remoteId: string) => {
    setBinding(remoteId)
    try {
      await bind({ variables: { mangaId, trackerId: t.id, remoteId, private: t.supportsPrivateTracking ? hidden : null } })
      // 绑定列表在漫画上，重新查一次（新记录不在旧列表里）
      await client.refetchQueries({ include: [MangaTracks] })
      toast(tl('track.boundTo', { name: t.name }))
    } catch (err) {
      toastError(tl('track.bindFailed'), err)
    } finally {
      setBinding(null)
    }
  }
  const results = data?.searchTracker.trackSearches

  return (
    <div className="flex flex-col gap-3 pl-[38px]">
      <form onSubmit={submit}>
        <label className="plain flex h-11 items-center gap-2.5 rounded-full px-4 text-muted">
          <Search className="size-[18px] flex-none" strokeWidth={1.8} />
          <span className="sr">{tl('track.searchOn', { name: t.name })}</span>
          <input type="search" value={input} onChange={(e) => setInput(e.target.value)} className="min-w-0 flex-1 border-0 bg-transparent text-text outline-none" />
        </label>
      </form>
      {t.supportsPrivateTracking && (
        <label className="flex items-center gap-3 text-sm">
          <span className="flex-1 text-muted">{tl('track.bindPrivate')}</span>
          <Switch on={hidden} onChange={setHidden} label={tl('track.bindPrivate')} />
        </label>
      )}
      {loading && <span className="inline-flex items-center gap-1.5 text-sm text-muted"><Loader2 className="size-4 animate-spin" />{tl('track.searching')}</span>}
      {error && <span className="text-sm text-danger">{tl('track.searchFailed', { reason: error.message.split('\n')[0] })}</span>}
      {results?.length === 0 && <span className="text-sm text-muted">{tl('track.notFound')}</span>}
      <div className="flex flex-col gap-1">
        {results?.map((s) => (
          <button
            key={s.remoteId}
            type="button"
            disabled={!!binding}
            onClick={() => void pick(s.remoteId)}
            className="-mx-2 flex items-start gap-3 rounded-2xl p-2 text-left transition-colors hover:bg-hover disabled:opacity-60"
          >
            <span className="w-12 flex-none overflow-hidden rounded-md bg-track">
              {s.coverUrl && <img src={s.coverUrl} alt="" loading="lazy" className="aspect-[2/3] w-full object-cover" />}
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="line-clamp-2 font-semibold">{s.title}</span>
              <span className="text-xs text-muted">
                {[s.publishingType, s.publishingStatus, s.startDate, s.totalChapters > 0 ? tl('track.chaptersN', { n: chapterNo(s.totalChapters) }) : null].filter(Boolean).join(' · ')}
              </span>
              {s.summary && <span className="line-clamp-2 text-[13px] text-faint">{s.summary}</span>}
            </span>
            {binding === s.remoteId && <Loader2 className="mt-1 size-4 flex-none animate-spin" />}
          </button>
        ))}
      </div>
    </div>
  )
}
