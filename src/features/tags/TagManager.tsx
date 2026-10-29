import { Check, Pencil, Trash2, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { toast, toastError } from '@/components/ui/toast'
import { StaleSessionError } from '@/api/userContext'
import { cn } from '@/lib/cn'
import { cleanTag, removeTag, renameTag, tagUsage, type TagEdit } from './tags'
import { useTagActions, useTags } from './useTags'
import { t } from '@/i18n'

/**
 * 设置里的标签管理：列出自己加过的标签和各用在几部上，可以统一改名（改成已有的就合并）或从所有作品删除。
 * 来源标签按作品隐藏，不在这里管；新加标签在详情页
 */
export function TagManager() {
  const { edits, ready, error } = useTags()
  const { saveAll } = useTagActions()
  const [editing, setEditing] = useState<{ from: string; name: string } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const usage = tagUsage(edits.values())

  const run = (change: (edit: TagEdit) => TagEdit, done: string) =>
    saveAll(change).then(
      () => toast(done),
      (e: unknown) => {
        if (!(e instanceof StaleSessionError)) toastError(t('misc.tags.saveFailed'), e)
      },
    )

  const rename = (e: FormEvent) => {
    e.preventDefault()
    if (!editing) return
    const name = cleanTag(editing.name)
    if (!name) return
    setEditing(null)
    if (name === editing.from) return
    // 改成别的已有标签（不只是改大小写）就是合并
    const into = usage.find((u) => u.name.toLowerCase() === name.toLowerCase() && u.name.toLowerCase() !== editing.from.toLowerCase())
    const from = editing.from
    void run((x) => renameTag(x, from, name), t(into ? 'misc.tags.merged' : 'misc.tags.renamed', { name: into?.name ?? name }))
  }

  const del = (name: string, n: number) => {
    if (confirmDelete !== name) {
      setConfirmDelete(name)
      setTimeout(() => setConfirmDelete((v) => (v === name ? null : v)), 3000)
      return
    }
    setConfirmDelete(null)
    void run((x) => removeTag(x, name), t('misc.tags.deleted', { name, count: n, n }))
  }

  const input =
    'h-11 min-w-0 flex-1 rounded-full border border-line bg-transparent px-4 text-text outline-none placeholder:text-faint focus:border-[var(--muted)]'

  if (!ready) return <p className="m-0 py-2 text-sm text-muted">{t(error ? 'misc.tags.loadFailed' : 'misc.tags.loading')}</p>

  return (
    <div className="flex flex-col gap-1">
      {usage.length === 0 && <p className="m-0 py-2 text-sm text-muted">{t('misc.tags.manageNone')}</p>}
      {usage.map(({ name, count }) => (
        <div key={name} className="flex items-center gap-2 rounded-2xl py-1.5 pr-1 pl-3 transition-colors hover:bg-hover">
          {editing?.from === name ? (
            <form onSubmit={rename} className="flex flex-1 items-center gap-2">
              <input
                autoFocus
                className={input}
                value={editing.name}
                maxLength={60}
                aria-label={t('misc.tags.rename', { name })}
                onChange={(e) => setEditing({ from: name, name: e.target.value })}
                onKeyDown={(e) => e.key === 'Escape' && setEditing(null)}
              />
              <button type="submit" className="gicon size-10" aria-label={t('misc.tags.saveName')} disabled={!cleanTag(editing.name)}>
                <Check className="size-5" />
              </button>
              <button type="button" className="gicon size-10" aria-label={t('common.cancel')} onClick={() => setEditing(null)}>
                <X className="size-5" />
              </button>
            </form>
          ) : (
            <>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{name}</span>
                <span className="text-[13px] text-muted num">{t('misc.tags.used', { count, n: count })}</span>
              </span>
              <button type="button" className="gicon size-10" aria-label={t('misc.tags.rename', { name })} onClick={() => setEditing({ from: name, name })}>
                <Pencil className="size-[18px]" />
              </button>
              <button
                type="button"
                className={cn('gbtn min-h-10 px-3', confirmDelete === name ? 'text-danger' : '')}
                aria-label={t('misc.tags.delete', { name })}
                onClick={() => del(name, count)}
              >
                <Trash2 className="size-[18px]" />
                {confirmDelete === name && t('cfg.cat.confirmAgain')}
              </button>
            </>
          )}
        </div>
      ))}
    </div>
  )
}
