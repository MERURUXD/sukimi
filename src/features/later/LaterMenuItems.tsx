import { ClockCheck, ClockPlus, ExternalLink } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { StaleSessionError } from '@/api/userContext'
import { toast, toastError } from '@/components/ui/toast'
import { useLater, useLaterActions } from './useLater'

/** 封面长按 / 右键菜单里的选项；只在菜单打开时挂载，网格里每个格子不必各自查列表 */
export function LaterMenuItems({ mangaId, onDone }: { mangaId: number; onDone: () => void }) {
  const { map } = useLater()
  const { add, remove } = useLaterActions()
  const [busy, setBusy] = useState(false)
  const on = !!map?.has(mangaId)

  const toggle = async () => {
    setBusy(true)
    try {
      if (on) await remove([mangaId])
      else await add(mangaId)
      toast(on ? '已移出稍后再看' : '已加入稍后再看')
      onDone()
    } catch (e) {
      if (!(e instanceof StaleSessionError)) toastError('操作失败', e)
    } finally {
      setBusy(false)
    }
  }

  const Icon = on ? ClockCheck : ClockPlus
  return <>
    <button type="button" role="menuitemcheckbox" aria-checked={on} className="opt" disabled={busy || !map} onClick={toggle}>
      <Icon className="size-5" strokeWidth={1.8} />
      <span className="flex-1">{on ? '移出稍后再看' : '稍后再看'}</span>
    </button>
    <Link to={`/manga/${mangaId}`} viewTransition className="opt text-text no-underline" onClick={onDone}>
      <ExternalLink className="size-5" strokeWidth={1.8} />
      打开详情
    </Link>
  </>
}
