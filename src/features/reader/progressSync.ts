import { useApolloClient, useMutation } from '@apollo/client/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { captureUser } from '@/api/userContext'
import { toastError } from '@/components/ui/toast'
import { syncTrackProgress } from '@/features/tracking/sync'
import { progressAt, progressOnLeave, progressVariables, type Progress } from './progress'
import { SaveProgress } from './queries'
import { t } from '@/i18n'

type Chapter = { id: number; sourceOrder: number; lastPageRead: number; isRead: boolean }
type Pending = Progress & { still: () => void; pin?: boolean }

/**
 * 进度回写：翻页后 0.6 秒写一次，读到最后一页标为已读；离开或换话时立即写。
 * 返回最近一次写入成功的页码（还没写过为 null），以及换话前调用的 leave。
 * 这次不用写时清掉待写入的页，离开才不会把已经取消的页码发出去。
 * 每次写入有序号，后到的旧响应不覆盖更新的页码。
 */
export function useProgressSync(mangaId: number, chapter: Chapter, page: number, end: boolean, last: number) {
  const { id, sourceOrder, lastPageRead, isRead } = chapter
  const client = useApolloClient()
  const [save] = useMutation(SaveProgress)
  // still：记下这次进度产生时的账号；0.6 秒后真正写入（或离开时补写）前账号换了就放弃，
  // 否则旧阅读页的章节会带着新账号的令牌被标为已读、并同步到新账号的追踪
  const pending = useRef<Pending | null>(null)
  const [synced, setSynced] = useState<number | null>(null)
  const seq = useRef(0)
  const latest = useRef(0)
  const inflight = useRef(0)
  // 最近一次已经落地的写入。旧响应后到时用它把缓存改回去
  const accepted = useRef<{ seq: number; variables: ReturnType<typeof progressVariables>; data: object } | null>(null)
  const decided = useRef<Pending | null>(null)
  const reported = useRef<Pending | null>(null)
  const mounted = useRef(true)
  const pageNow = useRef(page)
  pageNow.current = page
  const flushRef = useRef<() => void>(() => {})
  // 已读话打开时停在这一页；用户还没翻页就不要把上次记下的页码盖掉
  const opened = useRef({ id, page, turned: false })
  if (opened.current.id !== id) opened.current = { id, page, turned: false }

  const flush = useCallback(() => {
    const p = pending.current
    if (!p) return
    pending.current = null
    try {
      p.still()
    } catch {
      return
    }
    const my = ++seq.current
    latest.current = my
    decided.current = p
    inflight.current++
    const variables = progressVariables(id, p)
    // 旧响应若后到，服务端可能刚被写成更早的页。没有更新的请求在途时，把最新的一次再写回去
    const correct = () => {
      const keep = decided.current
      if (!keep || inflight.current !== 0 || pending.current) return
      if (!keep.pin && pageNow.current !== keep.page) return
      try {
        keep.still()
      } catch {
        return
      }
      pending.current = keep
      flushRef.current()
    }
    save({
      variables,
      update(cache, result) {
        if (my === latest.current) {
          if (result.data) accepted.current = { seq: my, variables, data: result.data }
          return
        }
        const saved = accepted.current
        if (saved?.seq === latest.current) {
          cache.write({ dataId: 'ROOT_MUTATION', query: SaveProgress, variables: saved.variables, result: saved.data })
          return
        }
        const keep = decided.current
        const cacheId = cache.identify({ __typename: 'ChapterType', id })
        if (!keep || !cacheId) return
        cache.modify({
          id: cacheId,
          fields: {
            lastPageRead: () => keep.page,
            isRead: (existing: boolean) => (keep.read ? true : existing),
          },
        })
      },
    })
      .then(() => {
        if (my !== latest.current) return
        // 换话会先卸载阅读页，不能因此跳过已经保存成功的追踪同步；只停止更新页面状态。
        if (mounted.current) setSynced(p.page)
        // 读完一话顺带推到追踪网站，详情页的追踪进度随之刷新。补写同一页时不再推一次
        if (p.read && reported.current !== p) {
          reported.current = p
          void syncTrackProgress(client, mangaId, p.still)
        }
      })
      .catch((e) => {
        if (my === latest.current) toastError(t('reader.progressSyncFailed'), e)
      })
      .finally(() => {
        inflight.current--
        if (my !== latest.current) correct()
      })
  }, [save, id, client, mangaId])
  flushRef.current = flush

  useEffect(() => {
    if (page !== opened.current.page) opened.current.turned = true
    // 已读话在翻页之前不写：打开时停在第 1 页，不能把上次的页码写成 0
    const p = isRead && !opened.current.turned ? null : progressAt({ lastPageRead, isRead }, page, end)
    if (!p) {
      pending.current = null
      return
    }
    pending.current = { ...p, still: captureUser() }
    const t = setTimeout(flush, 600)
    return () => clearTimeout(t)
  }, [page, end, lastPageRead, isRead, flush])
  useEffect(() => flush, [flush])
  // 开发环境 StrictMode 会先卸载再挂上：卸载时关掉，重新挂上时再打开，避免成功的写入被丢掉
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  const leave = useCallback(
    (to: { sourceOrder: number }) => {
      const p = progressOnLeave({ sourceOrder, isRead }, to, last)
      // pin：这一页是换话时定下的，和当前画面页码可以不同，旧响应后到时仍要保住它
      if (p) pending.current = { ...p, still: captureUser(), pin: true }
      flush()
    },
    [flush, sourceOrder, isRead, last],
  )

  return { synced, leave }
}
