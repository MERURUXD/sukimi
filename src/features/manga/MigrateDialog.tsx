import { useApolloClient, useQuery } from '@apollo/client/react'
import { Loader2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '@/api/auth'
import { DeleteDownloads, UpdateChapters } from '@/api/chapters'
import { captureUser, StaleSessionError } from '@/api/userContext'
import { favoriteKey } from '@/features/favorite/favorite'
import { FavoriteMetas } from '@/features/favorite/queries'
import { laterKey } from '@/features/later/later'
import { mergeTags, NO_EDIT, parseTags, serializeTags, tagsKey } from '@/features/tags/tags'
import { TagMetas } from '@/features/tags/queries'
import { LaterMetas } from '@/features/later/queries'
import { useNsfwActions, useNsfwStore } from '@/features/nsfw/useNsfw'
import { useShelf } from '@/features/shelf/useShelf'
import { copyTracks, trackCopyPlan } from '@/features/tracking/migrateTracks'
import { syncTrackProgress } from '@/features/tracking/sync'
import { MotionGlass } from '@/components/glass/Glass'
import { CoverImg } from '@/components/manga/CoverImg'
import { Dialog, usePopMotion } from '@/components/ui/Dialog'
import { Seg } from '@/components/ui/Seg'
import { toast, toastError } from '@/components/ui/toast'
import { Switch } from '@/features/settings/parts'
import { sfwAttr } from '@/lib/devSafe'
import { cn } from '@/lib/cn'
import { planMetaCopy, planMigration } from './migrate'
import { CopyMigrationMarks, MigrationMarks, MigrationTarget, RemoveMigrationMarks, SetMangaCategories, SetMangaInLibrary, type Chapter, type Manga } from './queries'
import { t } from '@/i18n'

type Target = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; chapters: { id: number; chapterNumber: number; isRead: boolean; isBookmarked: boolean }[] }

/** 迁移对话框要的目标漫画信息：候选和详情页的漫画都满足 */
export interface MigrateTarget {
  id: number
  title: string
  thumbnailUrl: string | null
  author: string | null
  source: { displayName: string }
}

export function MigrateDialog({ from, fromChapters, target, onClose, onDone }: {
  from: NonNullable<Manga>
  fromChapters: readonly Chapter[]
  target: MigrateTarget
  onClose: () => void
  onDone: (to: number) => void
}) {
  const client = useApolloClient()
  const { copyManga } = useNsfwActions()
  const marked = useNsfwStore((s) => s.marks.manga[from.id] !== undefined)
  const [info, setInfo] = useState<Target>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const [read, setRead] = useState(true)
  const [bookmarks, setBookmarks] = useState(true)
  const [categories, setCategories] = useState(true)
  const [tracks, setTracks] = useState(true)
  const [later, setLater] = useState(true)
  const [fav, setFav] = useState(true)
  // 旧漫画上能带走的追踪网站数；查不到按没有处理，不挡迁移
  const [trackCount, setTrackCount] = useState(0)
  const [keepOld, setKeepOld] = useState(false)
  const [deleteDownloads, setDeleteDownloads] = useState(false)
  const [step, setStep] = useState<string | null>(null)
  const pop = usePopMotion()

  // 打开时从新来源拉取信息和章节：搜索结果里只有封面和标题
  useEffect(() => {
    let alive = true
    client
      .mutate({ mutation: MigrationTarget, variables: { id: target.id } })
      .then(({ data }) => alive && setInfo({ status: 'ready', chapters: data?.fetchMangaAndChapters?.chapters ?? [] }))
      .catch((e: Error) => alive && setInfo({ status: 'error', message: e.message.split('\n')[0] }))
    return () => {
      alive = false
    }
  }, [client, target.id, attempt])

  useEffect(() => {
    let alive = true
    trackCopyPlan(client, from.id, null)
      .then((p) => alive && setTrackCount(p.records.length))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [client, from.id])

  // 新旧两部的稍后再看、特别关心和自建标签；新漫画已有的不覆盖。查不到按没有处理，不挡迁移
  const userId = useAuth((s) => s.user?.id)
  const markKeys = useMemo(
    () => (userId === undefined ? [] : [from.id, target.id].flatMap((id) => [laterKey(userId, id), favoriteKey(userId, id), tagsKey(userId, id)])),
    [userId, from.id, target.id],
  )
  const markQuery = useQuery(MigrationMarks, { variables: { keys: markKeys }, skip: !markKeys.length, fetchPolicy: 'network-only' })
  const marksReady = !markKeys.length || !!markQuery.data || !!markQuery.error
  const metas = markQuery.data?.metas.nodes ?? []
  const hasLater = userId !== undefined && metas.some((m) => m.key === laterKey(userId, from.id))
  const hasFav = userId !== undefined && metas.some((m) => m.key === favoriteKey(userId, from.id))
  // 标签不设开关，总是跟着搬：换了来源就丢掉自己加的标签说不过去
  const hasTags = userId !== undefined && metas.some((m) => m.key === tagsKey(userId, from.id))

  const plan = useMemo(() => (info.status === 'ready' ? planMigration(fromChapters, info.chapters) : null), [info, fromChapters])
  // 搁置分类不算用户的分类：不计入「复制分类」，换源后照样保持搁置
  const shelf = useShelf().ids
  const shelved = from.categories.nodes.filter((c) => shelf.has(c.id)).map((c) => c.id)
  const cats = from.categories.nodes.filter((c) => !c.default && !shelf.has(c.id)).map((c) => c.id)
  const downloaded = fromChapters.filter((c) => c.isDownloaded).map((c) => c.id)
  const readCount = fromChapters.filter((c) => c.isRead).length

  const run = async () => {
    if (!plan) return
    const still = captureUser()
    // 失败提示要说停在哪一步：setStep 是异步的，catch 里读到的 step 还是点击那一刻的值
    let current = t('migrate.step.migrate')
    let trackFailed: string[] = []
    const go = (name: string) => {
      current = name
      setStep(name)
    }
    try {
      // 手动 NSFW 标记跟着漫画 id 走，先带过去，新版本加入书库后才不会露在首页和画廊里
      if (marked) {
        go(t('migrate.step.copyNsfw'))
        await copyManga(from.id, target.id)
        still()
      }
      go(t('migrate.step.addLib'))
      await client.mutate({ mutation: SetMangaInLibrary, variables: { id: target.id, inLibrary: true } })
      const addCats = [...(categories ? cats : []), ...shelved]
      if (addCats.length) {
        still()
        go(t('migrate.step.copyCats'))
        await client.mutate({ mutation: SetMangaCategories, variables: { id: target.id, add: addCats } })
      }
      const pairs: [string, string][] = []
      if (userId !== undefined) {
        if (later && hasLater) pairs.push([laterKey(userId, from.id), laterKey(userId, target.id)])
        if (fav && hasFav) pairs.push([favoriteKey(userId, from.id), favoriteKey(userId, target.id)])
      }
      const marks = planMetaCopy(metas, pairs, keepOld)
      // 标签是自己写的内容，新漫画已有标签时不能跳过：两边合并后写入
      if (userId !== undefined && hasTags) {
        const edits = parseTags(userId, metas)
        const value = serializeTags(mergeTags(edits.get(from.id) ?? NO_EDIT, edits.get(target.id)))
        if (value !== null) marks.set.push({ key: tagsKey(userId, target.id), value })
        if (!keepOld) marks.remove.push(tagsKey(userId, from.id))
      }
      if (marks.set.length) {
        still()
        const copied = new Set(marks.set.map((m) => m.key))
        const what = [
          userId !== undefined && copied.has(laterKey(userId, target.id)) && t('home.section.later'),
          userId !== undefined && copied.has(favoriteKey(userId, target.id)) && t('home.section.favorite'),
          userId !== undefined && copied.has(tagsKey(userId, target.id)) && t('misc.tags.title'),
        ]
        go(t('migrate.step.copyWhat', { what: what.filter(Boolean).join(t('migrate.step.and')) }))
        await client.mutate({ mutation: CopyMigrationMarks, variables: { metas: marks.set } })
      }
      if (tracks && trackCount > 0) {
        still()
        go(t('migrate.step.bindTrack'))
        // 放在标记已读之前：绑定好以后，下面的进度同步才能推到新漫画的追踪记录。
        // 个别网站绑不上不算迁移失败（旧漫画的绑定还在），做完后一并提示
        trackFailed = (await copyTracks(client, from.id, target.id, still)).failed
      }
      if (read && plan.read.length) {
        still()
        go(t('migrate.step.markRead'))
        await client.mutate({ mutation: UpdateChapters, variables: { ids: plan.read, patch: { isRead: true } } })
        // 新漫画若已绑定追踪，把复制过来的已读进度推过去
        void syncTrackProgress(client, target.id, still)
      }
      if (bookmarks && plan.bookmarked.length) {
        still()
        go(t('migrate.step.copyBookmarks'))
        await client.mutate({ mutation: UpdateChapters, variables: { ids: plan.bookmarked, patch: { isBookmarked: true } } })
      }
      if (!keepOld) {
        if (deleteDownloads && downloaded.length) {
          still()
          go(t('migrate.step.deleteOldDl'))
          await client.mutate({ mutation: DeleteDownloads, variables: { ids: downloaded } })
        }
        still()
        go(t('migrate.step.removeOld'))
        await client.mutate({ mutation: SetMangaInLibrary, variables: { id: from.id, inLibrary: false } })
        if (marks.remove.length) {
          still()
          go(t('migrate.step.cleanMarks'))
          await client.mutate({ mutation: RemoveMigrationMarks, variables: { keys: marks.remove } })
        }
      }
      still()
      // 稍后再看、特别关心、标签的清单各自缓存着，重新取一次
      if (marks.set.length || marks.remove.length) void client.refetchQueries({ include: [LaterMetas, FavoriteMetas, TagMetas] })
      // 书库列表在别的页面，没法就地改；清掉让它下次打开时重新查询（本地快照会先顶上）
      client.cache.evict({ id: 'ROOT_QUERY', fieldName: 'mangas', args: { condition: { inLibrary: true } } })
      client.cache.gc()
      const done = keepOld ? t('migrate.copied', { source: target.source.displayName }) : t('migrate.migrated', { source: target.source.displayName })
      toast(trackFailed.length ? t('migrate.trackFailed', { done, names: trackFailed.join(t('migrate.namesSep')) }) : done)
      onDone(target.id)
    } catch (e) {
      // 中途换了账号：后面的步骤不再发出，对话框早已随页面卸载，不用提示
      if (e instanceof StaleSessionError) return
      toastError(t('migrate.stepFailed', { step: current }), e)
      setStep(null)
    }
  }

  const summary = plan && [
    read && plan.read.length ? t('migrate.readN', { n: plan.read.length }) : null,
    bookmarks && plan.bookmarked.length ? t('migrate.bookmarksN', { n: plan.bookmarked.length }) : null,
    categories && cats.length ? t('migrate.catsN', { n: cats.length }) : null,
    tracks && trackCount ? t('migrate.tracksN', { n: trackCount }) : null,
    later && hasLater ? t('home.section.later') : null,
    fav && hasFav ? t('home.section.favorite') : null,
    hasTags ? t('misc.tags.title') : null,
  ].filter(Boolean)

  return (
    <Dialog label={t('migrate.dialogLabel', { source: target.source.displayName })} onClose={() => { if (!step) onClose() }} closeOnBackdrop={!step}>
      <MotionGlass
        dense
        {...pop}
        className="no-scrollbar relative flex max-h-[calc(100dvh-32px)] w-[min(480px,100%)] flex-col gap-5 overflow-y-auto rounded-[26px] p-6 [--g-drop:0_30px_80px_rgba(0,0,0,.5)]"
      >
        <div className="flex gap-4" data-sfw={sfwAttr(target.source.displayName)}>
          <span className="cv w-[72px] flex-none rounded-lg">
            <CoverImg src={target.thumbnailUrl} />
          </span>
          <span className="flex min-w-0 flex-col gap-1">
            <span className="text-xs font-bold tracking-[.08em] text-muted">{t('migrate.toHeading', { source: target.source.displayName })}</span>
            <span className="line-clamp-2 text-lg leading-snug font-bold">{target.title}</span>
            {target.author && <span className="truncate text-sm text-muted">{target.author}</span>}
            <Link to={`/manga/${target.id}`} className="text-sm font-semibold text-text">{t('migrate.viewDetails')}</Link>
          </span>
        </div>

        <div className="text-sm leading-relaxed text-muted" role="status">
          {info.status === 'loading' && (
            <span className="inline-flex items-center gap-1.5"><Loader2 className="size-4 animate-spin" />{t('migrate.fetching')}</span>
          )}
          {info.status === 'error' && (
            <span>
              {t('migrate.fetchFailed', { reason: info.message })}
              <button type="button" className="ml-2 font-semibold text-text" onClick={() => { setInfo({ status: 'loading' }); setAttempt((n) => n + 1) }}>{t('common.retry')}</button>
            </span>
          )}
          {info.status === 'ready' && plan && (
            <span>
              {t('migrate.counts', { to: info.chapters.length, from: fromChapters.length, matched: plan.matched })}
              {readCount ? t('migrate.readNote', { n: readCount }) : t('migrate.noRead')}
            </span>
          )}
        </div>

        <div className="flex flex-col gap-3.5">
          <Option label={t('migrate.opt.read')} hint={plan ? t('migrate.opt.readHint', { n: plan.read.length }) : undefined} on={read} onChange={setRead} />
          <Option label={t('migrate.opt.bookmarks')} hint={plan ? t('migrate.opt.bookmarksHint', { n: plan.bookmarked.length }) : undefined} on={bookmarks} onChange={setBookmarks} />
          <Option label={t('migrate.opt.categories')} hint={cats.length ? t('migrate.opt.catsHint', { n: cats.length }) : t('migrate.opt.defaultCat')} on={categories} onChange={setCategories} disabled={!cats.length} />
          {trackCount > 0 && <Option label={t('migrate.opt.tracks')} hint={t('migrate.opt.tracksHint', { n: trackCount })} on={tracks} onChange={setTracks} />}
          {hasLater && <Option label={t('home.section.later')} hint={t('migrate.opt.laterHint')} on={later} onChange={setLater} />}
          {hasFav && <Option label={t('home.section.favorite')} on={fav} onChange={setFav} />}
        </div>

        <div className="flex flex-col gap-3">
          <Seg
            glass={false}
            label={t('migrate.opt.old')}
            value={keepOld ? 'keep' : 'move'}
            onChange={(v) => setKeepOld(v === 'keep')}
            items={[
              { value: 'move', label: t('migrate.opt.move') },
              { value: 'keep', label: t('migrate.opt.keep') },
            ]}
            className="grid grid-cols-2 [&>button]:justify-center"
          />
          {!keepOld && downloaded.length > 0 && (
            <Option label={t('migrate.opt.delDl')} hint={t('migrate.opt.delDlHint', { n: downloaded.length })} on={deleteDownloads} onChange={setDeleteDownloads} />
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2.5">
          {summary && summary.length > 0 && !step && <span className="mr-auto text-xs text-muted">{summary.join(' · ')}</span>}
          {step && (
            <span className="mr-auto inline-flex items-center gap-1.5 text-sm text-muted" role="status">
              <Loader2 className="size-4 animate-spin" />
              {step}…
            </span>
          )}
          <button type="button" className="gbtn rounded-full hover:bg-hover" disabled={!!step} onClick={onClose}>{t('common.cancel')}</button>
          <button type="button" className="solid min-h-11" disabled={!plan || !marksReady || !!step} onClick={() => void run()}>
            {keepOld ? t('migrate.copy') : t('migrate.go')}
          </button>
        </div>
      </MotionGlass>
    </Dialog>
  )
}

function Option({ label, hint, on, onChange, disabled }: { label: string; hint?: string; on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <div className={cn('flex items-center gap-3', disabled && 'opacity-50')}>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-semibold">{label}</span>
        {hint && <span className="text-xs text-muted">{hint}</span>}
      </span>
      <Switch on={on && !disabled} onChange={onChange} label={label} disabled={disabled} />
    </div>
  )
}
