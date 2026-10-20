import type { ApolloCache } from '@apollo/client'
import { useApolloClient, useQuery } from '@apollo/client/react'
import { useCallback, useMemo } from 'react'
import { useAuth } from '@/api/auth'
import { captureUser } from '@/api/userContext'
import { favoriteKey, favoritePrefix, parseFavorites } from './favorite'
import { FavoriteMetas, RemoveFavorites, SetFavorites } from './queries'

type Node = { __typename?: 'GlobalMetaType'; key: string; value: string }

const EMPTY = new Map<number, number>()

/** 写入成功后直接改该账号缓存里的列表；缓存里还没有列表时不管，等查询去取 */
function patch(cache: ApolloCache, userId: number, fn: (nodes: readonly Node[]) => Node[]) {
  cache.updateQuery({ query: FavoriteMetas, variables: { prefix: favoritePrefix(userId) } }, (d) => d && { metas: { ...d.metas, nodes: fn(d.metas.nodes) } })
}

/**
 * 当前账号的 漫画 id → 标记时间（秒）。还没取到时 map 为 undefined；
 * 只用来高亮、排序的地方用 `ids`（取到前是空表），不必各自判断。
 * 同一份查询全站共用，网格里的每个格子不要各自调用，由页面取一次往下传。
 */
export function useFavorites({ skip = false } = {}) {
  const userId = useAuth((s) => s.user?.id)
  const q = useQuery(FavoriteMetas, {
    variables: { prefix: favoritePrefix(userId ?? 0) },
    fetchPolicy: 'cache-and-network',
    skip: skip || userId === undefined,
  })
  const map = useMemo(() => (q.data && userId !== undefined ? parseFavorites(userId, q.data.metas.nodes) : undefined), [q.data, userId])
  return { map, ids: map ?? EMPTY, loading: q.loading, error: q.error }
}

export function useFavoriteActions() {
  const client = useApolloClient()
  /** 一次标记或取消多部；批量操作和单部开关共用 */
  const setFavorite = useCallback(async (mangaIds: readonly number[], on: boolean) => {
    if (!mangaIds.length) return
    const still = captureUser()
    const userId = useAuth.getState().user?.id
    if (userId === undefined) throw new Error('未登录，无法修改特别关心')
    // 请求期间换了账号：缓存已经是新账号的，不能把上一个账号的写进去
    const mine = () => useAuth.getState().user?.id === userId
    if (on) {
      const at = String(Math.floor(Date.now() / 1000))
      const metas = mangaIds.map((id): Node => ({ __typename: 'GlobalMetaType', key: favoriteKey(userId, id), value: at }))
      const keys = new Set(metas.map((m) => m.key))
      await client.mutate({
        mutation: SetFavorites,
        variables: { metas: metas.map(({ key, value }) => ({ key, value })) },
        update: (cache) => mine() && patch(cache, userId, (nodes) => [...nodes.filter((n) => !keys.has(n.key)), ...metas]),
      })
    } else {
      const keys = new Set(mangaIds.map((id) => favoriteKey(userId, id)))
      await client.mutate({
        mutation: RemoveFavorites,
        variables: { keys: [...keys] },
        update: (cache) => mine() && patch(cache, userId, (nodes) => nodes.filter((n) => !keys.has(n.key))),
      })
    }
    still()
  }, [client])
  return { setFavorite }
}
