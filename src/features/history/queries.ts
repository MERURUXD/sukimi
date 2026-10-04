import { graphql } from '@/api/gql'
import type { HistoryQuery } from '@/api/gql/graphql'

export const HISTORY_PAGE = 100

export const History = graphql(`
  query History($first: Int!, $offset: Int!) {
    chapters(filter: { lastReadAt: { greaterThan: "0" } }, order: [{ by: LAST_READ_AT, byType: DESC }], first: $first, offset: $offset) {
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
