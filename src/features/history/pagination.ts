import type { ApolloCache } from '@apollo/client'
import { HistoryDocument } from '../../api/gql/graphql.ts'

export const HISTORY_PAGE = 100

export function historyVariables(cache: ApolloCache) {
  const cached = cache.readQuery({ query: HistoryDocument, variables: { first: HISTORY_PAGE, offset: 0 } })
  // 返回时刷新整个已加载范围，避免第一页响应截短列表，让浏览器把滚动位置夹回上方。
  return { first: Math.max(HISTORY_PAGE, cached?.chapters.nodes.length ?? 0), offset: 0 }
}
