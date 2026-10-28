import type { ApolloClient } from '@apollo/client'
import { BindTrack, SearchTracker } from './queries'
import { t } from '../../i18n/core.ts'

/** 所有关键词都没搜到目标条目 */
export class RemoteNotFoundError extends Error {
  constructor() {
    super(t('track.notFoundRemote'))
  }
}

/**
 * 把漫画绑定到追踪网站上已知的条目。
 * bindTrack 依赖服务端保存的搜索记录，缓存和公开接口都不能代替：
 * 依次用关键词搜一遍，搜到目标条目（remoteId 对得上）才发绑定，都没搜到就抛 RemoteNotFoundError
 */
export async function bindRemote(
  client: ApolloClient,
  { mangaId, trackerId, remoteId, keywords, isPrivate = null }: { mangaId: number; trackerId: number; remoteId: string; keywords: readonly string[]; isPrivate?: boolean | null },
  still: () => void,
) {
  still()
  for (const query of new Set(keywords.map((k) => k.trim()).filter(Boolean))) {
    const result = await client.query({ query: SearchTracker, variables: { trackerId, query }, fetchPolicy: 'network-only' })
    still()
    if (!result.data?.searchTracker.trackSearches.some((item) => item.remoteId === remoteId)) continue
    await client.mutate({ mutation: BindTrack, variables: { mangaId, trackerId, remoteId, private: isPrivate } })
    still()
    return
  }
  throw new RemoteNotFoundError()
}
