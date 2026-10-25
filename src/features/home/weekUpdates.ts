import type { RecentUpdatesQuery } from '../../api/gql/graphql.ts'

export const WEEK_UPDATES_PAGE = 1000

export interface WeekUpdatesSnapshot {
  start: number
  data: RecentUpdatesQuery
}

/** 只有整周都取完才替换画面；跨日的快照不再覆盖当前查询。 */
export function completeWeekUpdates(start: number, data: RecentUpdatesQuery | undefined, saved?: WeekUpdatesSnapshot) {
  if (data && !data.chapters.pageInfo.hasNextPage) return data
  return saved?.start === start && !saved.data.chapters.pageInfo.hasNextPage ? saved.data : undefined
}

/** 分页保留服务端原始条数，隐藏迁移章节等展示筛选留给首页。 */
export function mergeWeekUpdates(previous: RecentUpdatesQuery, next: RecentUpdatesQuery): RecentUpdatesQuery {
  if (!next.chapters.nodes.length && next.chapters.pageInfo.hasNextPage) throw new Error('这一周的更新未取完整，请重试')
  return { chapters: { ...next.chapters, nodes: [...previous.chapters.nodes, ...next.chapters.nodes] } }
}
