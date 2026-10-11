import { useApolloClient } from '@apollo/client/react'
import { motion } from 'motion/react'
import { Loader2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { DeleteDownloads, UpdateChapters } from '@/api/chapters'
import { captureUser, StaleSessionError } from '@/api/userContext'
import { syncTrackProgress } from '@/features/tracking/sync'
import { MotionGlass } from '@/components/glass/Glass'
import { CoverImg } from '@/components/manga/CoverImg'
import { Seg } from '@/components/ui/Seg'
import { toast, toastError } from '@/components/ui/toast'
import { spring } from '@/design/motion'
import { Switch } from '@/features/settings/parts'
import { sfwAttr } from '@/lib/devSafe'
import { cn } from '@/lib/cn'
import { planMigration } from './migrate'
import { MigrationTarget, SetMangaCategories, SetMangaInLibrary, type Chapter, type Manga } from './queries'

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
    const still = captureUser()
    try {
      setStep('加入书库')
      await client.mutate({ mutation: SetMangaInLibrary, variables: { id: target.id, inLibrary: true } })
      if (categories && cats.length) {
        still()
        setStep('复制分类')
        await client.mutate({ mutation: SetMangaCategories, variables: { id: target.id, add: cats } })
      }
      if (read && plan.read.length) {
        still()
        setStep('标记已读')
        await client.mutate({ mutation: UpdateChapters, variables: { ids: plan.read, patch: { isRead: true } } })
        // 新漫画若已绑定追踪，把复制过来的已读进度推过去
        void syncTrackProgress(client, target.id, still)
      }
      if (bookmarks && plan.bookmarked.length) {
        still()
        setStep('复制书签')
        await client.mutate({ mutation: UpdateChapters, variables: { ids: plan.bookmarked, patch: { isBookmarked: true } } })
      }
      if (!keepOld) {
        if (deleteDownloads && downloaded.length) {
          still()
          setStep('删除旧的下载')
          await client.mutate({ mutation: DeleteDownloads, variables: { ids: downloaded } })
        }
        still()
        setStep('旧的移出书库')
        await client.mutate({ mutation: SetMangaInLibrary, variables: { id: from.id, inLibrary: false } })
      }
      still()
      // 书库列表在别的页面，没法就地改；清掉让它下次打开时重新查询（本地快照会先顶上）
      client.cache.evict({ id: 'ROOT_QUERY', fieldName: 'mangas', args: { condition: { inLibrary: true } } })
      client.cache.gc()
      toast(keepOld ? `已复制到「${target.source.displayName}」` : `已迁移到「${target.source.displayName}」`)
      onDone(target.id)
    } catch (e) {
      // 中途换了账号：后面的步骤不再发出，对话框早已随页面卸载，不用提示
      if (e instanceof StaleSessionError) return
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
