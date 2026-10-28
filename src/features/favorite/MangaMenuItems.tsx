import { useFragment, useQuery } from '@apollo/client/react'
import { Archive, ArchiveRestore, ClockCheck, ClockPlus, ExternalLink, Star } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { StaleSessionError } from '@/api/userContext'
import { toast, toastError } from '@/components/ui/toast'
import { useLater, useLaterActions } from '@/features/later/useLater'
import { MangaCategories, MangaCategoryIds } from '@/features/shelf/queries'
import { isShelved } from '@/features/shelf/shelf'
import { useShelf, useShelfActions } from '@/features/shelf/useShelf'
import { cn } from '@/lib/cn'
import { useFavoriteActions, useFavorites } from './useFavorites'
import { t } from '@/i18n'

/**
 * 封面右键 / 长按菜单里的选项（发现、书库、更新页共用）；只在菜单打开时挂载，格子不必各自查列表。
 * 特别关心、搁置只对书库里的漫画显示：不在书库的服务端本来就不会检查更新。
 */
export function MangaMenuItems({ mangaId, inLibrary, onDone }: { mangaId: number; inLibrary: boolean; onDone: () => void }) {
  const later = useLater()
  const { add, remove } = useLaterActions()
  const favorites = useFavorites({ skip: !inLibrary })
  const { setFavorite } = useFavoriteActions()
  const shelf = useShelf()
  const { setShelved } = useShelfActions()
  // 分类先看缓存（书库列表取过就有）；发现、更新页直接打开时缓存里没有，菜单打开时补取一次
  const cats = useFragment({ fragment: MangaCategoryIds, from: { __typename: 'MangaType', id: mangaId } })
  useQuery(MangaCategories, { variables: { id: mangaId }, skip: !inLibrary || cats.complete })
  const [busy, setBusy] = useState(false)
  const laterOn = !!later.map?.has(mangaId)
  const favoriteOn = !!favorites.map?.has(mangaId)
  const shelfOn = cats.complete && isShelved(cats.data, shelf.ids)

  const run = async (action: () => Promise<void>, done: string) => {
    setBusy(true)
    try {
      await action()
      toast(done)
      onDone()
    } catch (e) {
      if (!(e instanceof StaleSessionError)) toastError(t('misc.menu.failed'), e)
    } finally {
      setBusy(false)
    }
  }

  const LaterIcon = laterOn ? ClockCheck : ClockPlus
  return <>
    {inLibrary && (
      <button type="button" role="menuitemcheckbox" aria-checked={favoriteOn} className="opt" disabled={busy || !favorites.map}
        onClick={() => run(() => setFavorite([mangaId], !favoriteOn), favoriteOn ? t('misc.favorite.off') : t('misc.favorite.on'))}>
        <Star className={cn('size-5', favoriteOn && 'fill-current')} strokeWidth={1.8} />
        <span className="flex-1">{favoriteOn ? t('misc.favorite.unaction') : t('misc.favorite.action')}</span>
      </button>
    )}
    {inLibrary && (
      <button type="button" role="menuitemcheckbox" aria-checked={shelfOn} className="opt" disabled={busy || !shelf.ready || !cats.complete}
        onClick={() => run(() => setShelved([mangaId], !shelfOn), shelfOn ? t('misc.shelf.off') : t('misc.shelf.on'))}>
        {shelfOn ? <ArchiveRestore className="size-5" strokeWidth={1.8} /> : <Archive className="size-5" strokeWidth={1.8} />}
        <span className="flex-1">{shelfOn ? t('misc.shelf.unaction') : t('misc.shelf.action')}</span>
      </button>
    )}
    <button type="button" role="menuitemcheckbox" aria-checked={laterOn} className="opt" disabled={busy || !later.map}
      onClick={() => run(() => (laterOn ? remove([mangaId]) : add(mangaId)), laterOn ? t('misc.later.off') : t('misc.later.on'))}>
      <LaterIcon className="size-5" strokeWidth={1.8} />
      <span className="flex-1">{laterOn ? t('misc.later.unaction') : t('misc.later.action')}</span>
    </button>
    <Link to={`/manga/${mangaId}`} role="menuitem" viewTransition className="opt text-text no-underline" onClick={onDone}>
      <ExternalLink className="size-5" strokeWidth={1.8} />
      {t('misc.menu.openDetail')}
    </Link>
  </>
}
