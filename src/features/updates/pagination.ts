import type { ApolloCache, TypedDocumentNode } from '@apollo/client'
import type { UpdatesFeedAllQuery, UpdatesFeedAllQueryVariables } from '../../api/gql/graphql.ts'

export const UPDATES_PAGE = 60

/**
 * 返回时刷新整个已加载范围：只请求第一页会把往下加载出的章节从缓存里截掉，
 * 列表变短、每天的话数跳动、滚动位置被夹回上方（和阅读历史同一个问题）。
 * 数的是服务端原始条数，不是隐藏迁移章节之后的条数。
 * 三个筛选的文档形状相同，只是缓存键不同。
 */
export function updatesVariables(cache: ApolloCache, query: TypedDocumentNode<UpdatesFeedAllQuery, UpdatesFeedAllQueryVariables>, filter: object) {
  const cached = cache.readQuery({ query, variables: { first: UPDATES_PAGE, offset: 0, filter } })
  return { first: Math.max(UPDATES_PAGE, cached?.chapters.nodes.length ?? 0), offset: 0, filter }
}
