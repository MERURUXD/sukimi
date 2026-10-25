import { useApolloClient } from '@apollo/client/react'
import { useEffect } from 'react'
import { useAuth } from '@/api/auth'
import { isDemo, isDevLab } from '@/lib/demo'
import { laterPrefix } from '@/features/later/later'
import { LaterMetas } from '@/features/later/queries'
import { nsfwPrefix } from '@/features/nsfw/nsfw'
import { NsfwMetas, RemoveNsfwMetas, SetNsfwMetas } from '@/features/nsfw/queries'
import { LEGACY_HEIR_ID, legacyMetasDoneKey, planPrefixMove } from './legacyMetas'

const PREFIXES = [laterPrefix, nsfwPrefix]

/**
 * 升级到多用户服务端后，第一个账号把旧单用户（id 0）的「稍后再看」和 NSFW 标记搬到自己的键下。
 * 先写新键，成功后才删旧键；中途失败下次启动会接着搬。搬完在本机记一笔，之后不再查询。
 */
export function LegacyMetasMigrate() {
  const client = useApolloClient()
  const userId = useAuth((s) => s.user?.id)
  const legacy = useAuth((s) => s.user?.legacy)
  useEffect(() => {
    if (isDemo || isDevLab || userId !== LEGACY_HEIR_ID || legacy) return
    const doneKey = legacyMetasDoneKey(userId)
    try {
      if (localStorage.getItem(doneKey)) return
    } catch {
      /* 存储不可用就每次都查一遍，没有旧键时只是多一次请求 */
    }
    let alive = true
    void (async () => {
      let moved = false
      for (const prefix of PREFIXES) {
        const query = prefix === laterPrefix ? LaterMetas : NsfwMetas
        const [old, current] = await Promise.all(
          [0, userId].map((id) => client.query({ query, variables: { prefix: prefix(id) }, fetchPolicy: 'network-only' }).then((r) => r.data?.metas.nodes ?? [])),
        )
        const plan = planPrefixMove(prefix(0), prefix(userId), old, current)
        if (!plan.remove.length) continue
        if (plan.set.length) await client.mutate({ mutation: SetNsfwMetas, variables: { metas: plan.set } })
        await client.mutate({ mutation: RemoveNsfwMetas, variables: { keys: plan.remove } })
        moved = true
      }
      if (!alive) return
      try {
        localStorage.setItem(doneKey, '1')
      } catch {
        /* 下次启动再查一遍 */
      }
      // 正在显示的清单和标记还是搬之前的，重新取一次
      if (moved) void client.refetchQueries({ include: [LaterMetas, NsfwMetas] })
    })().catch(() => {})
    return () => {
      alive = false
    }
  }, [client, userId, legacy])
  return null
}
