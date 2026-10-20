import { ClockCheck, ClockPlus, ExternalLink, Star } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { StaleSessionError } from '@/api/userContext'
import { toast, toastError } from '@/components/ui/toast'
import { useLater, useLaterActions } from '@/features/later/useLater'
import { cn } from '@/lib/cn'
import { useFavoriteActions, useFavorites } from './useFavorites'

/**
 * 封面右键 / 长按菜单里的选项（发现、书库、更新页共用）；只在菜单打开时挂载，格子不必各自查列表。
 * 特别关心只对书库里的漫画显示：不在书库的服务端不会检查更新。
 */
export function MangaMenuItems({ mangaId, inLibrary, onDone }: { mangaId: number; inLibrary: boolean; onDone: () => void }) {
  const later = useLater()
  const { add, remove } = useLaterActions()
  const favorites = useFavorites({ skip: !inLibrary })
  const { setFavorite } = useFavoriteActions()
  const [busy, setBusy] = useState(false)
  const laterOn = !!later.map?.has(mangaId)
  const favoriteOn = !!favorites.map?.has(mangaId)

  const run = async (action: () => Promise<void>, done: string) => {
    setBusy(true)
    try {
      await action()
      toast(done)
      onDone()
    } catch (e) {
      if (!(e instanceof StaleSessionError)) toastError('操作失败', e)
    } finally {
      setBusy(false)
    }
  }

  const LaterIcon = laterOn ? ClockCheck : ClockPlus
  return <>
    {inLibrary && (
      <button type="button" role="menuitemcheckbox" aria-checked={favoriteOn} className="opt" disabled={busy || !favorites.map}
        onClick={() => run(() => setFavorite([mangaId], !favoriteOn), favoriteOn ? '已取消特别关心' : '已设为特别关心')}>
        <Star className={cn('size-5', favoriteOn && 'fill-current')} strokeWidth={1.8} />
        <span className="flex-1">{favoriteOn ? '取消特别关心' : '特别关心'}</span>
      </button>
    )}
    <button type="button" role="menuitemcheckbox" aria-checked={laterOn} className="opt" disabled={busy || !later.map}
      onClick={() => run(() => (laterOn ? remove([mangaId]) : add(mangaId)), laterOn ? '已移出稍后再看' : '已加入稍后再看')}>
      <LaterIcon className="size-5" strokeWidth={1.8} />
      <span className="flex-1">{laterOn ? '移出稍后再看' : '稍后再看'}</span>
    </button>
    <Link to={`/manga/${mangaId}`} role="menuitem" viewTransition className="opt text-text no-underline" onClick={onDone}>
      <ExternalLink className="size-5" strokeWidth={1.8} />
      打开详情
    </Link>
  </>
}
