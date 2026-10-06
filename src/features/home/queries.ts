import { graphql } from '@/api/gql'
import type { RecentReadsQuery, RecentUpdatesQuery } from '@/api/gql/graphql'

// 最近读过的章节（按阅读时间倒序），页面里按漫画去重得到「继续阅读 / 最近阅读」
export const RecentReads = graphql(`
  query RecentReads {
    chapters(filter: { lastReadAt: { greaterThan: "0" } }, order: [{ by: LAST_READ_AT, byType: DESC }], first: 150) {
      nodes {
        id
        name
        chapterNumber
        sourceOrder
        lastPageRead
        pageCount
        isRead
        lastReadAt
        # 历史里删掉的记录（features/history）首页也不显示
        meta {
          key
          value
        }
        manga {
          id
          title
          thumbnailUrl
          author
          genre
          description
          inLibrary
          unreadCount
          source {
            id
            displayName
          }
          firstUnreadChapter {
            id
            name
            chapterNumber
            lastPageRead
            pageCount
            lastReadAt
          }
        }
      }
    }
  }
`)

export type ReadChapter = RecentReadsQuery['chapters']['nodes'][number]

// 书库里最近抓到的新章节；filter 由调用方给出，至少包含 inLibrary
export const RecentUpdates = graphql(`
  query RecentUpdates($first: Int!, $offset: Int!, $filter: ChapterFilterInput!) {
    chapters(
      filter: $filter
      order: [{ by: FETCHED_AT, byType: DESC }, { by: SOURCE_ORDER, byType: DESC }]
      first: $first
      offset: $offset
    ) {
      totalCount
      pageInfo {
        hasNextPage
      }
      nodes {
        id
        name
        chapterNumber
        sourceOrder
        fetchedAt
        uploadDate
        isRead
        isDownloaded
        isBookmarked
        lastPageRead
        pageCount
        mangaId
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

export type UpdateChapter = RecentUpdatesQuery['chapters']['nodes'][number]

export const IN_LIBRARY = { inLibrary: { equalTo: true } } as const
