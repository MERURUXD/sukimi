import { useQuery } from '@apollo/client/react'
import { AnimatePresence } from 'motion/react'
import { BookmarkCheck, Loader2, Search } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router'
import { resetOnUserContext } from '@/api/userContext'
import { Glass } from '@/components/glass/Glass'
import { CoverImg } from '@/components/manga/CoverImg'
import { Seg } from '@/components/ui/Seg'
import { useMultiSourceSearch, type SearchResults } from '@/features/browse/multiSearch'
import { Sources, type Source, type SourceManga } from '@/features/browse/queries'
import { SourceIcon } from '@/features/browse/SourceIcon'
import { sfwAttr } from '@/lib/devSafe'
import { migrationSources } from './migrate'
import { MangaChapters, MangaDetail } from './queries'
import { MigrateDialog } from './MigrateDialog'

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
 * 换源迁移：在其他来源里找同一部漫画，把已读、书签、分类搬过去（追踪网站的绑定也一并绑到新漫画）。
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
      <p className="mt-2 mb-7 max-w-[60ch] text-[15px] text-muted">在其他来源里找到同一部漫画，把已读进度、书签、分类和追踪绑定搬过去。</p>

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
