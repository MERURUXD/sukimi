import { ClockCheck, ClockPlus } from 'lucide-react'
import { useEffect, useState, type CSSProperties } from 'react'
import { StaleSessionError } from '@/api/userContext'
import { Glass } from '@/components/glass/Glass'
import { toast, toastError } from '@/components/ui/toast'
import { useLibraryView } from '@/features/library/store'
import { cn } from '@/lib/cn'
import { caughtUp } from './later'
import { useLater, useLaterActions } from './useLater'
import { t } from '@/i18n'

/** 详情页的「稍后再看」开关；在这里读完已有章节回到详情页时也顺手移出 */
export function LaterButton({ manga, hasChapters, style, className }: {
  manga: { id: number; unreadCount: number; lastReadChapter?: { lastReadAt: string } | null }
  /** 章节还没取到时为 undefined，先不判断是否读完 */
  hasChapters: boolean | undefined
  style?: CSSProperties
  className?: string
}) {
  const { map } = useLater()
  const { add, remove } = useLaterActions()
  const autoRemove = useLibraryView((s) => s.laterAutoRemove)
  const [busy, setBusy] = useState(false)
  const at = map?.get(manga.id)
  const on = at !== undefined
  const lastReadAt = Number(manga.lastReadChapter?.lastReadAt ?? 0)

  const finished = on && autoRemove && hasChapters !== undefined && caughtUp({ hasChapters, unread: manga.unreadCount, lastReadAt }, at)
  useEffect(() => {
    if (finished) remove([manga.id]).catch(() => {})
  }, [finished, manga.id, remove])

  const toggle = async () => {
    setBusy(true)
    try {
      if (on) await remove([manga.id])
      else await add(manga.id)
      toast(on ? t('misc.later.off') : t('misc.later.on'))
    } catch (e) {
      if (!(e instanceof StaleSessionError)) toastError(on ? t('misc.later.offFailed') : t('misc.later.onFailed'), e)
    } finally {
      setBusy(false)
    }
  }

  const Icon = on ? ClockCheck : ClockPlus
  // 只放在详情页顶部，背后是封面取色的氛围光，关掉透镜省开销
  return (
    <Glass suspendRefract as="button" type="button" style={style} className={cn('gicon rounded-full', on && 'bg-g-hi', className)}
      onClick={toggle} disabled={busy || !map} aria-pressed={on} aria-label={on ? t('misc.later.unaction') : t('misc.later.action')} title={on ? t('misc.later.active') : t('misc.later.action')}>
      <Icon className="size-5" strokeWidth={1.8} />
    </Glass>
  )
}
