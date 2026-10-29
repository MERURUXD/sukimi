import type { ApolloCache } from '@apollo/client'
import { useApolloClient, useQuery } from '@apollo/client/react'
import { useCallback, useMemo } from 'react'
import { useAuth } from '@/api/auth'
import { captureUser } from '@/api/userContext'
import { NO_EDIT, parseTags, serializeTags, tagsKey, tagsPrefix, type TagEdit } from './tags'
import { RemoveTags, SetTags, TagMetas } from './queries'
import { t } from '@/i18n'

type Node = { __typename?: 'GlobalMetaType'; key: string; value: string }

const EMPTY = new Map<number, TagEdit>()

function patch(cache: ApolloCache, userId: number, fn: (nodes: readonly Node[]) => Node[]) {
  cache.updateQuery({ query: TagMetas, variables: { prefix: tagsPrefix(userId) } }, (d) => d && { metas: { ...d.metas, nodes: fn(d.metas.nodes) } })
}

/**
 * 每次写的是一部漫画的整份标签，所以先改缓存、再按顺序发请求：
 * 连点几下时下一次读到的已经是上一次的结果，请求也不会后发先至把新值盖回旧值
 */
let queue: Promise<unknown> = Promise.resolve()

/**
 * 当前账号所有漫画的标签编辑（漫画 id → 编辑）；取到前是空表。
 * 同一份查询全站共用，网格里的每个格子不要各自调用，由页面取一次往下传。
 */
export function useTags({ skip = false } = {}) {
  const userId = useAuth((s) => s.user?.id)
  const q = useQuery(TagMetas, {
    variables: { prefix: tagsPrefix(userId ?? 0) },
    fetchPolicy: 'cache-and-network',
    skip: skip || userId === undefined,
  })
  const map = useMemo(() => (q.data && userId !== undefined ? parseTags(userId, q.data.metas.nodes) : undefined), [q.data, userId])
  return { map, edits: map ?? EMPTY, ready: map !== undefined, error: q.error }
}

/** 一部漫画的编辑 */
export function useMangaTags(mangaId: number) {
  const tags = useTags()
  return { edit: tags.edits.get(mangaId) ?? NO_EDIT, all: tags.edits, ready: tags.ready }
}

export function useTagActions() {
  const client = useApolloClient()
  /**
   * change 拿缓存里此刻的值算出新值，不用渲染时拿到的：同一帧里连点几下也不会互相覆盖。
   * 整份覆盖写入；改完什么都不剩就删掉这个键。失败时重新取一次，把先改的缓存纠正回来
   */
  const save = useCallback((mangaId: number, change: (edit: TagEdit) => TagEdit) => {
    const still = captureUser()
    const userId = useAuth.getState().user?.id
    if (userId === undefined) return Promise.reject(new Error(t('misc.tags.notLoggedIn')))
    const key = tagsKey(userId, mangaId)
    const cached = client.cache.readQuery({ query: TagMetas, variables: { prefix: tagsPrefix(userId) } })
    // 还没取到现有标签就写，会把服务端上的整份盖掉
    if (!cached) return Promise.reject(new Error(t('misc.tags.notReady')))
    const value = serializeTags(change(parseTags(userId, cached.metas.nodes).get(mangaId) ?? NO_EDIT))
    patch(client.cache, userId, (nodes) => {
      const rest = nodes.filter((n) => n.key !== key)
      return value === null ? rest : [...rest, { __typename: 'GlobalMetaType', key, value }]
    })
    const run = queue.then(async () => {
      still()
      if (value === null) await client.mutate({ mutation: RemoveTags, variables: { keys: [key] } })
      else await client.mutate({ mutation: SetTags, variables: { key, value } })
    })
    queue = run.catch(() => {})
    return run.catch((e: unknown) => {
      // 请求期间换了账号：缓存已经是新账号的，不必纠正
      if (useAuth.getState().user?.id === userId) void client.refetchQueries({ include: [TagMetas] })
      throw e
    })
  }, [client])
  return { save }
}
