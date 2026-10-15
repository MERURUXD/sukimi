import type { ApolloClient } from '@apollo/client'
import type { BgmSubject } from '../bangumi/rating'
import { BindTrack, SearchTracker } from './queries'

export async function bindBgmSubject(client: ApolloClient, mangaId: number, trackerId: number, subject: Pick<BgmSubject, 'id' | 'name' | 'nameCn'>, still: () => void) {
  still()
  const remoteId = String(subject.id)
  const keywords = [...new Set([subject.name.trim(), subject.nameCn.trim()].filter(Boolean))]
  // bindTrack 依赖服务端保存的搜索记录；公开评分接口和 Apollo 缓存都不能代替这次搜索。
  for (const query of keywords) {
    const result = await client.query({ query: SearchTracker, variables: { trackerId, query }, fetchPolicy: 'network-only' })
    still()
    if (!result.data?.searchTracker.trackSearches.some((item) => item.remoteId === remoteId)) continue
    await client.mutate({ mutation: BindTrack, variables: { mangaId, trackerId, remoteId, private: null } })
    still()
    return
  }
  throw new Error('追踪服务未找到所选 Bangumi 条目，请打开追踪设置手动搜索绑定')
}
