import { useApolloClient, useQuery } from '@apollo/client/react'
import { AnimatePresence, motion } from 'motion/react'
import { BookmarkCheck, Loader2, Search } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { DeleteDownloads, UpdateChapters } from '@/api/chapters'
import { resetOnUserContext } from '@/api/userContext'
import { Glass, MotionGlass } from '@/components/glass/Glass'
import { CoverImg } from '@/components/manga/CoverImg'
import { Seg } from '@/components/ui/Seg'
import { toast, toastError } from '@/components/ui/toast'
import { spring } from '@/design/motion'
import { useMultiSourceSearch, type SearchResults } from '@/features/browse/multiSearch'
import { Sources, type Source, type SourceManga } from '@/features/browse/queries'
import { SourceIcon } from '@/features/browse/SourceIcon'
import { Switch } from '@/features/settings/parts'
import { sfwAttr } from '@/lib/devSafe'
import { cn } from '@/lib/cn'
import { migrationSources, planMigration } from './migrate'
import { MangaChapters, MangaDetail, MigrationTarget, SetMangaCategories, SetMangaInLibrary, type Chapter, type Manga } from './queries'

/** 搜过的关键词结果留在内存里，看完候选的详情返回时不用重新搜 */
const searched = new Map<string, SearchResults>()
resetOnUserContext(() => searched.clear())

type Candidate = SourceManga & { source: Source }

export function MigratePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  return <MigrateView mangaId={Number(id)} onDone={(to) => navigate(`/manga/${to}`, { replace: true })} />
}

/**
 * 换源迁移：在其他来源里找同一部漫画，把已读、书签、分类搬过去。
 * 服务端没有迁移接口，按步骤调用现有的变更完成。
 */
export function MigrateView({ mangaId, onDone }: { mangaId: number; onDone: (to: number) => void }) {
  const manga = useQuery(MangaDetail, { variables: { id: mangaId } }).data?.manga
  const chapters = useQuery(MangaChapters, { variables: { mangaId } }).data?.chapters.nodes
  const all = useQuery(Sources).data?.sources.nodes
  const [scope, setScope] = useState<'lang' | 'all'>('lang')
  const [input, setInput] = useState('')
  const [q, setQ] = useState('')
  const [picked, setPicked] = useState<Candidate | null>(null)

  // 标题到了以后用它作为默认关键词
  useEffect(() => {
    if (manga?.title && !q) {
      setInput(manga.title)
      setQ(manga.title)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manga?.title])

  const sameLang = useMemo(() => migrationSources(all ?? [], manga?.source ?? null, 'lang'), [all, manga?.source])
  const everySource = useMemo(() => migrationSources(all ?? [], manga?.source ?? null, 'all'), [all, manga?.source])
  // 同语言一个来源都没有时直接搜全部
  const effectiveScope = sameLang.length === 0 ? 'all' : scope
  const sources = effectiveScope === 'lang' ? sameLang : everySource
  const results = useMultiSourceSearch(q, sources, searched)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setQ(input.trim())
  }

  const withHits = sources.filter((s) => results[s.id]?.items.some((m) => m.id !== mangaId))
  const pending = sources.filter((s) => !results[s.id] || results[s.id].status === 'loading')
  const empty = sources.filter((s) => results[s.id]?.status === 'done' && !results[s.id].items.some((m) => m.id !== mangaId))
  const failed = sources.filter((s) => results[s.id]?.status === 'error')
  const read = chapters?.filter((c) => c.isRead).length ?? 0

  return (
    <div className="wrap pt-8 pb-20">
      <h1 className="m-0 font-cjk text-[32px] font-black sm:text-[40px]">换源迁移</h1>
      <p className="mt-2 mb-7 max-w-[60ch] text-[15px] text-muted">在其他来源里找到同一部漫画，把已读进度、书签和分类搬过去。</p>

      {manga && (
        <div className="mb-8 flex items-center gap-4" data-sfw={sfwAttr(manga.source?.displayName)}>
          <span className="cv w-16 flex-none rounded-lg">
            <CoverImg src={manga.thumbnailUrl} />
          </span>
          <span className="flex min-w-0 flex-col gap-1">
            <span className="text-xs font-bold tracking-[.08em] text-muted">当前</span>
            <span className="truncate text-lg font-bold">{manga.title}</span>
            <span className="text-sm text-muted">
              {[manga.source?.displayName, chapters ? `${chapters.length} 话 · 已读 ${read} 话` : null].filter(Boolean).join(' · ')}
            </span>
          </span>
        </div>
      )}

      <div className="mb-8 flex flex-wrap items-center gap-2.5">
        <form onSubmit={submit} className="min-w-0 flex-[1_1_360px]">
          <Glass as="label" className="flex h-12 items-center gap-2.5 rounded-full px-[18px] text-muted">
            <Search className="size-5 flex-none" strokeWidth={1.8} />
            <span className="sr">搜索候选</span>
            <input
              type="search"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="用标题在其他来源里搜索，回车开始"
              className="min-w-0 flex-1 border-0 bg-transparent text-[15px] text-text outline-none placeholder:text-faint"
            />
          </Glass>
        </form>
        {sameLang.length > 0 && (
          <Seg
            label="搜索范围"
            value={effectiveScope}
            onChange={setScope}
            items={[
              { value: 'lang', label: '同语言来源', count: sameLang.length },
              { value: 'all', label: '全部来源', count: everySource.length },
            ]}
          />
        )}
      </div>

      {all && sources.length === 0 && <p className="py-12 text-center text-muted">没有其他可以搜索的来源，先到发现页安装扩展。</p>}

      {withHits.map((s) => (
        <section key={s.id} aria-label={s.displayName} className="mb-8">
          <div className="mb-3 flex items-center gap-2.5">
            <SourceIcon s={s} size={28} />
            <h2 className="m-0 flex-1 truncate text-base font-bold">{s.displayName}</h2>
          </div>
          <div className="no-scrollbar -mx-1 flex snap-x gap-3.5 overflow-x-auto px-1 pb-1">
            {results[s.id].items
              .filter((m) => m.id !== mangaId)
              .map((m) => (
                <CandidateTile key={m.id} m={m} source={s} onPick={() => setPicked({ ...m, source: s })} />
              ))}
          </div>
        </section>
      ))}

      {q && (
        <p className="text-sm leading-relaxed text-muted" role="status">
          {pending.length > 0 && <span className="mr-3 inline-flex items-center gap-1.5"><Loader2 className="size-4 animate-spin" />还在搜索 {pending.length} 个来源</span>}
          {empty.length > 0 && <span className="mr-3">没有结果：{empty.map((s) => s.displayName).join('、')}</span>}
          {failed.length > 0 && <span>搜索失败：{failed.map((s) => s.displayName).join('、')}</span>}
        </p>
      )}

      <AnimatePresence>
        {picked && manga && chapters && (
          <MigrateDialog key={picked.id} from={manga} fromChapters={chapters} target={picked} onClose={() => setPicked(null)} onDone={onDone} />
        )}
      </AnimatePresence>
    </div>
  )
}

function CandidateTile({ m, source, onPick }: { m: SourceManga; source: Source; onPick: () => void }) {
  return (
    <button type="button" onClick={onPick} data-sfw={sfwAttr(source.displayName)} className="group flex w-[120px] flex-none snap-start flex-col gap-2 text-left sm:w-[136px]">
      <span className="cv rounded-xl shadow-[0_12px_28px_rgba(0,0,0,.28)] transition-transform duration-200 group-hover:-translate-y-[3px]">
        <CoverImg src={m.thumbnailUrl} loading="lazy" />
        {m.inLibrary && (
          <span className="absolute bottom-2 left-2 z-[2] inline-flex h-6 items-center gap-1 rounded-full border border-white/20 bg-black/45 px-2 text-[11px] font-bold text-white backdrop-blur-[14px]">
            <BookmarkCheck className="size-3.5" strokeWidth={2.2} />
            已在书库
          </span>
        )}
      </span>
      <span className="line-clamp-2 text-sm font-semibold">{m.title}</span>
      {m.author && <span className="-mt-1.5 truncate text-xs text-muted">{m.author}</span>}
    </button>
  )
}

type Target = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; chapters: { id: number; chapterNumber: number; isRead: boolean; isBookmarked: boolean }[] }

function MigrateDialog({ from, fromChapters, target, onClose, onDone }: {
  from: NonNullable<Manga>
  fromChapters: readonly Chapter[]
  target: Candidate
  onClose: () => void
  onDone: (to: number) => void
}) {
  const client = useApolloClient()
  const [info, setInfo] = useState<Target>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const [read, setRead] = useState(true)
  const [bookmarks, setBookmarks] = useState(true)
  const [categories, setCategories] = useState(true)
  const [keepOld, setKeepOld] = useState(false)
  const [deleteDownloads, setDeleteDownloads] = useState(false)
  const [step, setStep] = useState<string | null>(null)

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
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !step && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, step])

  const plan = useMemo(() => (info.status === 'ready' ? planMigration(fromChapters, info.chapters) : null), [info, fromChapters])
  const cats = from.categories.nodes.filter((c) => !c.default).map((c) => c.id)
  const downloaded = fromChapters.filter((c) => c.isDownloaded).map((c) => c.id)

  const run = async () => {
    if (!plan) return
    try {
      setStep('加入书库')
      await client.mutate({ mutation: SetMangaInLibrary, variables: { id: target.id, inLibrary: true } })
      if (categories && cats.length) {
        setStep('复制分类')
        await client.mutate({ mutation: SetMangaCategories, variables: { id: target.id, add: cats } })
      }
      if (read && plan.read.length) {
        setStep('标记已读')
        await client.mutate({ mutation: UpdateChapters, variables: { ids: plan.read, patch: { isRead: true } } })
      }
      if (bookmarks && plan.bookmarked.length) {
        setStep('复制书签')
        await client.mutate({ mutation: UpdateChapters, variables: { ids: plan.bookmarked, patch: { isBookmarked: true } } })
      }
      if (!keepOld) {
        if (deleteDownloads && downloaded.length) {
          setStep('删除旧的下载')
          await client.mutate({ mutation: DeleteDownloads, variables: { ids: downloaded } })
        }
        setStep('旧的移出书库')
        await client.mutate({ mutation: SetMangaInLibrary, variables: { id: from.id, inLibrary: false } })
      }
      // 书库列表在别的页面，没法就地改；清掉让它下次打开时重新查询（本地快照会先顶上）
      client.cache.evict({ id: 'ROOT_QUERY', fieldName: 'mangas', args: { condition: { inLibrary: true } } })
      client.cache.gc()
      toast(keepOld ? `已复制到「${target.source.displayName}」` : `已迁移到「${target.source.displayName}」`)
      onDone(target.id)
    } catch (e) {
      toastError(`${step ?? '迁移'}失败`, e)
      setStep(null)
    }
  }

  const summary = plan && [
    read && plan.read.length ? `标记 ${plan.read.length} 话已读` : null,
    bookmarks && plan.bookmarked.length ? `${plan.bookmarked.length} 个书签` : null,
    categories && cats.length ? `${cats.length} 个分类` : null,
  ].filter(Boolean)

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center p-4" role="presentation">
      <motion.div className="absolute inset-0 bg-black/45" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !step && onClose()} />
      <MotionGlass
        dense
        role="dialog"
        aria-modal="true"
        aria-label={`迁移到 ${target.source.displayName}`}
        initial={{ opacity: 0, scale: 0.94, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={spring.fast}
        className="no-scrollbar relative flex max-h-[calc(100dvh-32px)] w-[min(480px,100%)] flex-col gap-5 overflow-y-auto rounded-[26px] p-6 [--g-drop:0_30px_80px_rgba(0,0,0,.5)]"
      >
        <div className="flex gap-4" data-sfw={sfwAttr(target.source.displayName)}>
          <span className="cv w-[72px] flex-none rounded-lg">
            <CoverImg src={target.thumbnailUrl} />
          </span>
          <span className="flex min-w-0 flex-col gap-1">
            <span className="text-xs font-bold tracking-[.08em] text-muted">迁移到 · {target.source.displayName}</span>
            <span className="line-clamp-2 text-lg leading-snug font-bold">{target.title}</span>
            {target.author && <span className="truncate text-sm text-muted">{target.author}</span>}
            <Link to={`/manga/${target.id}`} className="text-sm font-semibold text-text">查看详情</Link>
          </span>
        </div>

        <div className="text-sm leading-relaxed text-muted" role="status">
          {info.status === 'loading' && (
            <span className="inline-flex items-center gap-1.5"><Loader2 className="size-4 animate-spin" />正在从来源获取章节…</span>
          )}
          {info.status === 'error' && (
            <span>
              获取章节失败：{info.message}
              <button type="button" className="ml-2 font-semibold text-text" onClick={() => { setInfo({ status: 'loading' }); setAttempt((n) => n + 1) }}>重试</button>
            </span>
          )}
          {info.status === 'ready' && plan && (
            <span>
              新来源 {info.chapters.length} 话，当前 {fromChapters.length} 话，按话数对上 {plan.matched} 话。
              {plan.maxRead >= 0 ? ` 你读到第 ${plan.maxRead} 话。` : ' 当前还没有读过的章节。'}
            </span>
          )}
        </div>

        <div className="flex flex-col gap-3.5">
          <Option label="已读进度" hint={plan ? `${plan.read.length} 话` : undefined} on={read} onChange={setRead} />
          <Option label="书签" hint={plan ? `${plan.bookmarked.length} 个` : undefined} on={bookmarks} onChange={setBookmarks} />
          <Option label="分类" hint={cats.length ? `${cats.length} 个` : '默认分类'} on={categories} onChange={setCategories} disabled={!cats.length} />
        </div>

        <div className="flex flex-col gap-3">
          <Seg
            label="旧的这部"
            value={keepOld ? 'keep' : 'move'}
            onChange={(v) => setKeepOld(v === 'keep')}
            items={[
              { value: 'move', label: '移出书库' },
              { value: 'keep', label: '两部都保留' },
            ]}
            className="grid grid-cols-2 [&>button]:justify-center"
          />
          {!keepOld && downloaded.length > 0 && (
            <Option label="删除旧来源已下载的章节" hint={`${downloaded.length} 话，释放空间`} on={deleteDownloads} onChange={setDeleteDownloads} />
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
          <button type="button" className="gbtn rounded-full hover:bg-hover" disabled={!!step} onClick={onClose}>取消</button>
          <button type="button" className="solid min-h-11" disabled={!plan || !!step} onClick={() => void run()}>
            {keepOld ? '复制' : '迁移'}
          </button>
        </div>
      </MotionGlass>
    </div>
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
