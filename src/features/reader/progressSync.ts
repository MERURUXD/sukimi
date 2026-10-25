import { useApolloClient, useMutation } from '@apollo/client/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { captureUser } from '@/api/userContext'
import { toastError } from '@/components/ui/toast'
import { syncTrackProgress } from '@/features/tracking/sync'
import { progressAt, progressOnLeave, progressVariables, type Progress } from './progress'
import { SaveProgress } from './queries'

type Chapter = { id: number; sourceOrder: number; lastPageRead: number; isRead: boolean }

/**
 * 进度回写：翻页后 0.6 秒写一次，读到最后一页标为已读；离开或换话时立即写。
 * 返回最近一次写入成功的页码（还没写过为 null），以及换话前调用的 leave。
 */
export function useProgressSync(mangaId: number, chapter: Chapter, page: number, end: boolean, last: number) {
  const { id, sourceOrder, lastPageRead, isRead } = chapter
  const client = useApolloClient()
  const [save] = useMutation(SaveProgress)
  // still：记下这次进度产生时的账号；0.6 秒后真正写入（或离开时补写）前账号换了就放弃，
  // 否则旧阅读页的章节会带着新账号的令牌被标为已读、并同步到新账号的追踪
  const pending = useRef<(Progress & { still: () => void }) | null>(null)
  const [synced, setSynced] = useState<number | null>(null)
  const flush = useCallback(() => {
    const p = pending.current
    if (!p) return
    pending.current = null
    try {
      p.still()
    } catch {
      return
    }
    save({ variables: progressVariables(id, p) })
      .then(() => {
        setSynced(p.page)
        // 读完一话顺带推到追踪网站，详情页的追踪进度随之刷新
        if (p.read) void syncTrackProgress(client, mangaId, p.still)
      })
      .catch((e) => toastError('进度同步失败', e))
  }, [save, id, client, mangaId])

  useEffect(() => {
    const p = progressAt({ lastPageRead, isRead }, page, end)
    if (!p) return
    pending.current = { ...p, still: captureUser() }
    const t = setTimeout(flush, 600)
    return () => clearTimeout(t)
  }, [page, end, lastPageRead, isRead, flush])
  useEffect(() => flush, [flush])

  const leave = useCallback(
    (to: { sourceOrder: number }) => {
      const p = progressOnLeave({ sourceOrder, isRead }, to, last)
      if (p) pending.current = { ...p, still: captureUser() }
      flush()
    },
    [flush, sourceOrder, isRead, last],
  )

  return { synced, leave }
}
