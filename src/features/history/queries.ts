import { graphql } from '@/api/gql'
import type { HistoryQuery } from '@/api/gql/graphql'

// 刷新范围随已加载条数变化；不同范围共用历史缓存，同时与其他章节查询隔离。
export const History = graphql(`
  query History($first: Int!, $offset: Int!) {
    chapters(filter: { lastReadAt: { greaterThan: "0" } }, order: [{ by: LAST_READ_AT, byType: DESC }], first: $first, offset: $offset) @connection(key: "ReadingHistory") {
      totalCount
      pageInfo {
        hasNextPage
      }
      nodes {
        id
        name
        chapterNumber
        lastPageRead
        pageCount
        isRead
        lastReadAt
        meta {
          key
          value
        }
        manga {
          id
          title
          thumbnailUrl
          source {
            id
            displayName
            contentWarning
          }
          # NSFW 判定要看分类（features/nsfw）
          categories {
            nodes {
              id
            }
          }
        }
      }
    }
  }
`)

export type HistoryItem = HistoryQuery['chapters']['nodes'][number]

export const HideHistory = graphql(`
  mutation HideHistory($ids: [Int!]!, $key: String!, $value: String!) {
    setChapterMetas(input: { items: [{ chapterIds: $ids, metas: [{ key: $key, value: $value }] }] }) {
      metas {
        chapterId
        key
        value
      }
    }
  }
`)
