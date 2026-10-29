import { useContext, type ReactNode } from 'react'
import { Check, Plus } from 'lucide-react'
import { toastError } from '@/components/ui/toast'
import { StaleSessionError } from '@/api/userContext'
import { cn } from '@/lib/cn'
import { isStopTag } from '@/features/gallery/taste'
import { addTag, cleanTag, removeTag, sourceTags, type TagEdit } from './tags'
import { TagTarget } from './target'
import { useTagActions } from './useTags'
import { t } from '@/i18n'

/** 外站（Bangumi）的一个标签：点一下加入或移出我的标签；已是来源标签或无意义的词只显示 */
export function ExternalTag({ name, children }: { name: string; children: ReactNode }) {
  const target = useContext(TagTarget)
  const plain = <span className="plain rounded-full px-3 py-1 text-xs">{children}</span>
  if (!target || isStopTag(name) || !cleanTag(name)) return plain
  return <Toggle mangaId={target.mangaId} genre={target.genre} edit={target.edit} name={cleanTag(name)}>{children}</Toggle>
}

function Toggle({ mangaId, genre, edit, name, children }: { mangaId: number; genre: readonly string[]; edit: TagEdit; name: string; children: ReactNode }) {
  const { save } = useTagActions()
  const lower = name.toLowerCase()
  const mine = edit.add.some((a) => a.toLowerCase() === lower)
  const fromSource = sourceTags(genre, edit).shown.some((g) => g.toLowerCase() === lower)
  if (fromSource) {
    return (
      <span className="plain inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs" title={t('misc.tags.fromSource', { name })}>
        <Check className="size-3 text-muted" />
        {children}
      </span>
    )
  }
  const toggle = () => save(mangaId, (e) => (mine ? removeTag(e, name) : addTag(e, name))).catch((e: unknown) => {
    if (!(e instanceof StaleSessionError)) toastError(t('misc.tags.saveFailed'), e)
  })
  return (
    <button
      type="button"
      className={cn('plain inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs transition-colors hover:text-text', mine && 'bg-g-hi')}
      aria-pressed={mine}
      aria-label={t(mine ? 'misc.tags.inMine' : 'misc.tags.addMine', { name })}
      title={t(mine ? 'misc.tags.inMine' : 'misc.tags.addMine', { name })}
      onClick={() => void toggle()}
    >
      {mine ? <Check className="size-3" /> : <Plus className="size-3 text-muted" />}
      {children}
    </button>
  )
}
