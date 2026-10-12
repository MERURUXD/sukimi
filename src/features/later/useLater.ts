import type { ApolloCache } from '@apollo/client'
import { useApolloClient, useQuery } from '@apollo/client/react'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useAuth } from '@/api/auth'
import { captureUser, StaleSessionError } from '@/api/userContext'
import { toastError } from '@/components/ui/toast'
import { useLibraryView } from '@/features/library/store'
import { caughtUp, laterKey, parseLater } from './later'
import { LaterMangas, LaterMetas, RemoveLater, SetLater, type LaterManga } from './queries'

type Node = { __typename?: 'GlobalMetaType'; key: string; value: string }

/** 写入成功后直接改缓存里的列表；缓存里还没有列表时不管，等查询去取 */
function patch(cache: ApolloCache, fn: (nodes: readonly Node[]) => Node[]) {
  cache.updateQuery({ query: LaterMetas }, (d) => d && { metas: { ...d.metas, nodes: fn(d.metas.nodes) } })
}

/** 漫画 id → 加入时间（秒）；还没取到时为 undefined */
export function useLater({ skip = false } = {}) {
  const q = useQuery(LaterMetas, { fetchPolicy: 'cache-and-network', skip })
  const map = useMemo(() => (q.data ? parseLater(q.data.metas.nodes) : undefined), [q.data])
  return { map, loading: q.loading, error: q.error, refetch: q.refetch }
}

export function useLaterActions() {
  const client = useApolloClient()
  const add = useCallback(async (mangaId: number) => {
    const still = captureUser()
    const userId = useAuth.getState().user?.id
    const meta: Node = { __typename: 'GlobalMetaType', key: laterKey(mangaId), value: String(Math.floor(Date.now() / 1000)) }
    await client.mutate({
      mutation: SetLater,
      variables: { key: meta.key, value: meta.value },
      // 请求期间换了账号：缓存已经是新账号的，不能把上一个账号的写进去
      update: (cache) => useAuth.getState().user?.id === userId && patch(cache, (nodes) => [...nodes.filter((n) => n.key !== meta.key), meta]),
    })
    still()
  }, [client])
  const remove = useCallback(async (mangaIds: readonly number[]) => {
    if (!mangaIds.length) return
    const still = captureUser()
    const userId = useAuth.getState().user?.id
    const keys = new Set(mangaIds.map(laterKey))
    await client.mutate({
      mutation: RemoveLater,
      variables: { keys: [...keys] },
      update: (cache) => useAuth.getState().user?.id === userId && patch(cache, (nodes) => nodes.filter((n) => !keys.has(n.key))),
    })
    still()
  }, [client])
  return { add, remove }
}

/** 列表里的漫画按加入时间从新到旧；加入时间放进 inLibraryAt，书库的「加入时间」排序就按它排 */
export type LaterItem = LaterManga & { laterAt: number }

/**
 * 「稍后再看」的完整列表（书库标签与首页书架用）。
 * 开着自动移出时，加入后已经读完已有章节的在这里顺手移出，不另外轮询。
 */
export function useLaterList({ skip = false } = {}) {
  const later = useLater({ skip })
  const ids = useMemo(() => (later.map ? [...later.map.keys()].sort((a, b) => a - b) : []), [later.map])
  const q = useQuery(LaterMangas, { variables: { ids }, skip: skip || !ids.length, fetchPolicy: 'cache-and-network' })
  const autoRemove = useLibraryView((s) => s.laterAutoRemove)
  const { remove } = useLaterActions()

  const { items, done } = useMemo(() => {
    const map = later.map
    if (!map) return { items: undefined, done: [] as number[] }
    // id 列表刚变、新查询还没回来时，先只显示还在列表里的
    const data = q.data ?? q.previousData
    const nodes = ids.length ? data?.mangas.nodes.filter((m) => map.has(m.id)) : []
    if (!nodes) return { items: undefined, done: [] as number[] }
    const done: number[] = []
    const items: LaterItem[] = []
    for (const m of nodes) {
      const at = map.get(m.id)!
      const finished = caughtUp({
        hasChapters: !!m.latestFetchedChapter,
        unread: m.unreadCount,
        lastReadAt: Number(m.lastReadChapter?.lastReadAt ?? 0),
      }, at)
      if (autoRemove && finished) done.push(m.id)
      else items.push({ ...m, inLibraryAt: String(at), laterAt: at })
    }
    items.sort((a, b) => b.laterAt - a.laterAt)
    return { items, done }
  }, [later.map, ids.length, q.data, q.previousData, autoRemove])

  // 同一批只发一次；失败后下次数据变化再试
  const removing = useRef(new Set<number>())
  useEffect(() => {
    const todo = done.filter((id) => !removing.current.has(id))
    if (!todo.length) return
    todo.forEach((id) => removing.current.add(id))
    remove(todo)
      .catch((e) => { if (!(e instanceof StaleSessionError)) toastError('自动移出稍后再看失败', e) })
      .finally(() => todo.forEach((id) => removing.current.delete(id)))
  }, [done, remove])

  return {
    items,
    loading: later.loading || q.loading,
    error: later.error ?? q.error,
    refetch: async () => {
      await later.refetch()
      if (ids.length) await q.refetch()
    },
  }
}
