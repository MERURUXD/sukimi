import { graphql } from './gql'

// 章节相关的变更：书库批量操作和详情页共用。
// 返回字段带上所属漫画的计数，Apollo 归一化缓存会顺带刷新书库封面上的角标。

export const UpdateChapters = graphql(`
  mutation UpdateChapters($ids: [Int!]!, $patch: UpdateChapterPatchInput!) {
    updateChapters(input: { ids: $ids, patch: $patch }) {
      chapters {
        id
        isRead
        isBookmarked
        lastPageRead
        manga {
          id
          unreadCount
          bookmarkCount
        }
      }
    }
  }
`)

export const EnqueueDownloads = graphql(`
  mutation EnqueueDownloads($ids: [Int!]!) {
    enqueueChapterDownloads(input: { ids: $ids }) {
      downloadStatus {
        state
      }
    }
  }
`)

export const DeleteDownloads = graphql(`
  mutation DeleteDownloads($ids: [Int!]!) {
    deleteDownloadedChapters(input: { ids: $ids }) {
      chapters {
        id
        isDownloaded
        manga {
          id
          downloadCount
        }
      }
    }
  }
`)
