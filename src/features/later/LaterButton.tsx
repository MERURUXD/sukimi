import { ClockCheck, ClockPlus } from 'lucide-react'
import { useEffect, type CSSProperties } from 'react'
import { Glass } from '@/components/glass/Glass'
import { useLibraryView } from '@/features/library/store'
import { cn } from '@/lib/cn'
import { caughtUp } from './later'
import { useLaterActions, useLaterToggle } from './useLater'
import { t } from '@/i18n'

/** 详情页的「稍后再看」开关；在这里读完已有章节回到详情页时也顺手移出 */
export function LaterButton({ manga, hasChapters, style, className }: {
  manga: { id: number; unreadCount: number; lastReadChapter?: { lastReadAt: string } | null }
  /** 章节还没取到时为 undefined，先不判断是否读完 */
  hasChapters: boolean | undefined
  style?: CSSProperties
  className?: string
}) {
  const { remove } = useLaterActions()
  const autoRemove = useLibraryView((s) => s.laterAutoRemove)
  const { on, at, ready, busy, toggle } = useLaterToggle(manga.id)
  const lastReadAt = Number(manga.lastReadChapter?.lastReadAt ?? 0)

  // 手机上按钮用样式藏起来但仍挂载，自动移出才不会因为换了布局失效
  const finished = at !== undefined && autoRemove && hasChapters !== undefined && caughtUp({ hasChapters, unread: manga.unreadCount, lastReadAt }, at)
  useEffect(() => {
    if (finished) remove([manga.id]).catch(() => {})
  }, [finished, manga.id, remove])

  const Icon = on ? ClockCheck : ClockPlus
  // 只放在详情页顶部，背后是封面取色的氛围光，关掉透镜省开销
  return (
    <Glass suspendRefract as="button" type="button" style={style} className={cn('gicon rounded-full', on && 'bg-g-hi', className)}
      onClick={toggle} disabled={busy || !ready} aria-pressed={on} aria-label={on ? t('misc.later.unaction') : t('misc.later.action')} title={on ? t('misc.later.active') : t('misc.later.action')}>
      <Icon className="size-5" strokeWidth={1.8} />
    </Glass>
  )
}
