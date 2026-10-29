import { AnimatePresence } from 'motion/react'
import { EyeOff, Plus, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { MotionGlass } from '@/components/glass/Glass'
import { Dialog, usePopMotion } from '@/components/ui/Dialog'
import { toastError } from '@/components/ui/toast'
import { StaleSessionError } from '@/api/userContext'
import { addTag, cleanTag, hasTag, hideSource, knownTags, removeTag, sourceTags, type TagEdit } from './tags'
import { useMangaTags, useTagActions } from './useTags'
import { t } from '@/i18n'

/** 补全最多列这么多个，再多就得靠输入筛 */
const SUGGEST_MAX = 12

/** 详情页的标签编辑：来源标签点一下隐藏 / 恢复，自己的标签可加可删，每次改动立即保存 */
export function TagEditor({ open, mangaId, genre, onClose }: { open: boolean; mangaId: number; genre: readonly string[]; onClose: () => void }) {
  const pop = usePopMotion()
  return (
    <AnimatePresence>
      {open && (
        <Dialog label={t('misc.tags.edit')} onClose={onClose} className="place-items-end p-3 sm:place-items-center sm:p-4">
          <MotionGlass
            dense
            {...pop}
            className="no-scrollbar relative flex max-h-[calc(100dvh-24px)] w-[min(460px,100%)] flex-col gap-5 overflow-y-auto overscroll-contain rounded-[26px] p-6 [--g-drop:0_30px_80px_rgba(0,0,0,.5)]"
          >
            <div className="flex items-center gap-3">
              <h2 className="m-0 min-w-0 flex-1 truncate text-lg font-bold">{t('misc.tags.edit')}</h2>
              <button type="button" className="gicon size-10 flex-none" aria-label={t('common.close')} onClick={onClose}>
                <X className="size-5" />
              </button>
            </div>
            <Body mangaId={mangaId} genre={genre} />
          </MotionGlass>
        </Dialog>
      )}
    </AnimatePresence>
  )
}

function Body({ mangaId, genre }: { mangaId: number; genre: readonly string[] }) {
  const stored = useMangaTags(mangaId)
  const { save } = useTagActions()
  const edit = stored.edit
  const [input, setInput] = useState('')

  const apply = (change: (edit: TagEdit) => TagEdit) => save(mangaId, change).catch((e: unknown) => {
    if (!(e instanceof StaleSessionError)) toastError(t('misc.tags.saveFailed'), e)
  })

  const { hidden } = sourceTags(genre, edit)
  const source = sourceTags(genre).shown
  const q = cleanTag(input).toLowerCase()
  const suggest = knownTags(stored.all.values())
    .filter((name) => !hasTag(genre, edit, name) && (!q || name.toLowerCase().includes(q)))
    .slice(0, SUGGEST_MAX)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!cleanTag(input)) return
    const name = input
    apply((e) => addTag(e, name))
    setInput('')
  }

  return (
    <>
      {source.length > 0 && (
        <section className="flex flex-col gap-2.5">
          <h3 className="m-0 flex items-baseline text-[13px] font-semibold text-muted">
            <span className="flex-1">{t('misc.tags.source')}</span>
            <span className="text-xs font-normal text-faint">{t('misc.tags.sourceHint')}</span>
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {source.map((name) => {
              const off = hidden.includes(name)
              return (
                <button key={name} type="button" className={off ? 'fopt exc' : 'fopt inc'} aria-pressed={!off} aria-label={t(off ? 'misc.tags.unhide' : 'misc.tags.hide', { name })} onClick={() => apply((e) => hideSource(e, name, !off))}>
                  {off && <EyeOff className="size-3.5" />}
                  {name}
                </button>
              )
            })}
          </div>
        </section>
      )}
      <section className="flex flex-col gap-2.5">
        <h3 className="m-0 text-[13px] font-semibold text-muted">{t('misc.tags.mine')}</h3>
        {edit.add.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {edit.add.map((name) => (
              <button key={name} type="button" className="fopt inc" aria-label={t('misc.tags.remove', { name })} onClick={() => apply((e) => removeTag(e, name))}>
                {name}
                <X className="size-3.5 text-muted" />
              </button>
            ))}
          </div>
        ) : (
          <span className="text-sm text-muted">{t('misc.tags.mineEmpty')}</span>
        )}
        <form onSubmit={submit} className="plain flex h-11 items-center gap-2 rounded-full pr-1.5 pl-4">
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={t('misc.tags.placeholder')} aria-label={t('misc.tags.placeholder')} maxLength={60} enterKeyHint="done" className="min-w-0 flex-1 bg-transparent text-[15px] text-text outline-none" />
          <button type="submit" className="fopt cta min-h-8 px-3 disabled:opacity-40" disabled={!cleanTag(input)}>{t('misc.tags.add')}</button>
        </form>
        {suggest.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="text-xs text-faint">{t('misc.tags.suggest')}</span>
            <div className="flex flex-wrap gap-1.5">
              {suggest.map((name) => (
                <button key={name} type="button" className="fopt" aria-label={t('misc.tags.addMine', { name })} onClick={() => { apply((e) => addTag(e, name)); setInput('') }}>
                  <Plus className="size-3.5" />
                  {name}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>
    </>
  )
}
