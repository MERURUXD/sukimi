import { Star } from 'lucide-react'
import { useState, type CSSProperties } from 'react'
import { StaleSessionError } from '@/api/userContext'
import { Glass } from '@/components/glass/Glass'
import { toast, toastError } from '@/components/ui/toast'
import { cn } from '@/lib/cn'
import { useFavoriteActions, useFavorites } from './useFavorites'

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
      toast(on ? '已取消特别关心' : '已设为特别关心')
    } catch (e) {
      if (!(e instanceof StaleSessionError)) toastError('操作失败', e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Glass as="button" type="button" style={style} className={cn('gicon rounded-full', on && 'bg-g-hi', className)}
      onClick={toggle} disabled={busy || !map} aria-pressed={on} aria-label={on ? '取消特别关心' : '特别关心'} title={on ? '已特别关心' : '特别关心'}>
      <Star className={cn('size-5', on && 'fill-current')} strokeWidth={1.8} />
    </Glass>
  )
}
