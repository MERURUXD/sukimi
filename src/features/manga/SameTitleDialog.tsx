import { useQuery } from '@apollo/client/react'
import { AnimatePresence, motion } from 'motion/react'
import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { MotionGlass } from '@/components/glass/Glass'
import { CoverImg } from '@/components/manga/CoverImg'
import { spring } from '@/design/motion'
import type { LibraryManga } from '@/features/library/queries'
import { sfwAttr } from '@/lib/devSafe'
import { MigrateDialog, type MigrateTarget } from './MigrateDialog'
import { MangaChapters, MangaDetail } from './queries'

/**
 * 把一部漫画加入书库时，书库里已有同名的（换了来源）：问是迁移过来、还是照常加入。
 * 选「迁移」后接着用换源迁移的对话框，已读、书签、分类的搬法与换源迁移页完全一致。
 */
export function SameTitleDialog({ target, matches, onAdd, onClose, onMigrated }: {
  target: MigrateTarget
  matches: readonly LibraryManga[]
  /** 不迁移，只加入书库 */
  onAdd: () => void
  onClose: () => void
  onMigrated: () => void
}) {
  const [from, setFrom] = useState<number | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !from && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, from])

  if (from !== null) return <MigrateFrom fromId={from} target={target} onBack={() => setFrom(null)} onDone={onMigrated} />

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center p-4" role="presentation">
      <motion.div className="absolute inset-0 bg-black/45" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
      <MotionGlass
        dense
        role="dialog"
        aria-modal="true"
        aria-label="书库里已有同名漫画"
        initial={{ opacity: 0, scale: 0.94, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={spring.fast}
        className="no-scrollbar relative flex max-h-[calc(100dvh-32px)] w-[min(480px,100%)] flex-col gap-5 overflow-y-auto rounded-[26px] p-6 [--g-drop:0_30px_80px_rgba(0,0,0,.5)]"
      >
        <div className="flex flex-col gap-1.5">
          <h2 className="m-0 text-lg font-bold">书库里已有同名漫画</h2>
          <p className="m-0 text-sm leading-relaxed text-muted">
            「{target.title}」在书库里已经有来自其他来源的版本。可以把它的已读进度、书签和分类迁移到「{target.source.displayName}」这一版，也可以两部都保留。
          </p>
        </div>

        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {matches.map((m) => (
            <li key={m.id} data-sfw={sfwAttr(m.source?.displayName)} className="flex items-center gap-3.5">
              <span className="cv w-12 flex-none rounded-md">
                <CoverImg src={m.thumbnailUrl} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-semibold">{m.title}</span>
                <span className="truncate text-xs text-muted">{[m.source?.displayName, m.unreadCount ? `${m.unreadCount} 话未读` : '已读完'].filter(Boolean).join(' · ')}</span>
              </span>
              <button type="button" className="solid min-h-10 flex-none" onClick={() => setFrom(m.id)}>
                迁移
              </button>
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap items-center justify-end gap-2.5">
          <button type="button" className="gbtn rounded-full hover:bg-hover" onClick={onClose}>取消</button>
          <button type="button" className="gbtn rounded-full hover:bg-hover" onClick={onAdd}>只加入书库</button>
        </div>
      </MotionGlass>
    </div>
  )
}

/** 取旧漫画的详情和章节，备齐了接上迁移对话框；取消回到上一步的选择 */
function MigrateFrom({ fromId, target, onBack, onDone }: { fromId: number; target: MigrateTarget; onBack: () => void; onDone: () => void }) {
  const manga = useQuery(MangaDetail, { variables: { id: fromId } }).data?.manga
  const chapters = useQuery(MangaChapters, { variables: { mangaId: fromId } }).data?.chapters.nodes
  if (!manga || !chapters) {
    return (
      <div className="fixed inset-0 z-[70] grid place-items-center bg-black/45" role="status" aria-label="正在读取旧漫画">
        <Loader2 className="size-6 animate-spin text-white" />
      </div>
    )
  }
  return (
    <AnimatePresence>
      <MigrateDialog key={fromId} from={manga} fromChapters={chapters} target={target} onClose={onBack} onDone={onDone} />
    </AnimatePresence>
  )
}
