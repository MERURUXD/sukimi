import { graphql } from '@/api/gql'

export const FetchChapterPages = graphql(`
  mutation FetchChapterPages($chapterId: Int!) {
    fetchChapterPages(input: { chapterId: $chapterId }) {
      pages
      chapter {
        id
        pageCount
      }
    }
  }
`)

export const SaveProgress = graphql(`
  mutation SaveProgress($id: Int!, $lastPageRead: Int!, $isRead: Boolean) {
    updateChapter(input: { id: $id, patch: { lastPageRead: $lastPageRead, isRead: $isRead } }) {
      chapter {
        id
        lastPageRead
        isRead
        lastReadAt
        manga {
          id
          unreadCount
          lastReadChapter {
            id
            lastReadAt
          }
        }
      }
    }
  }
`)
