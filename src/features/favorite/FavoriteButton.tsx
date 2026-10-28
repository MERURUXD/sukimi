import { Star } from 'lucide-react'
import { useState, type CSSProperties } from 'react'
import { StaleSessionError } from '@/api/userContext'
import { Glass } from '@/components/glass/Glass'
import { toast, toastError } from '@/components/ui/toast'
import { cn } from '@/lib/cn'
import { useFavoriteActions, useFavorites } from './useFavorites'
import { t } from '@/i18n'

/** 详情页的「特别关心」开关；只有书库里的漫画才会检查更新，不在书库时不显示 */
export function FavoriteButton({ mangaId, style, className }: { mangaId: number; style?: CSSProperties; className?: string }) {
  const { map } = useFavorites()
  const { setFavorite } = useFavoriteActions()
  const [busy, setBusy] = useState(false)
  const on = !!map?.has(mangaId)

  const toggle = async () => {
    setBusy(true)
    try {
      await setFavorite([mangaId], !on)
      toast(on ? t('misc.favorite.off') : t('misc.favorite.on'))
    } catch (e) {
      if (!(e instanceof StaleSessionError)) toastError(on ? t('misc.favorite.offFailed') : t('misc.favorite.onFailed'), e)
    } finally {
      setBusy(false)
    }
  }

  // 只放在详情页顶部，背后是封面取色的氛围光，关掉透镜省开销
  return (
    <Glass suspendRefract as="button" type="button" style={style} className={cn('gicon rounded-full', on && 'bg-g-hi', className)}
      onClick={toggle} disabled={busy || !map} aria-pressed={on} aria-label={on ? t('misc.favorite.unaction') : t('misc.favorite.action')} title={on ? t('misc.favorite.active') : t('misc.favorite.action')}>
      <Star className={cn('size-5', on && 'fill-current')} strokeWidth={1.8} />
    </Glass>
  )
}
