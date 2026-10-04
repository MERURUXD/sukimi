import { graphql } from '@/api/gql'

// 这些变更都返回最新的完整队列，直接写回实时状态（api/live.ts），不等订阅推送

export const DequeueDownloads = graphql(`
  mutation DequeueDownloads($ids: [Int!]!) {
    dequeueChapterDownloads(input: { ids: $ids }) {
      downloadStatus {
        state
        queue {
          ...DownloadItem
        }
      }
    }
  }
`)

export const RequeueDownloads = graphql(`
  mutation RequeueDownloads($ids: [Int!]!) {
    enqueueChapterDownloads(input: { ids: $ids }) {
      downloadStatus {
        state
        queue {
          ...DownloadItem
        }
      }
    }
  }
`)

export const ReorderDownload = graphql(`
  mutation ReorderDownload($id: Int!, $to: Int!) {
    reorderChapterDownload(input: { chapterId: $id, to: $to }) {
      downloadStatus {
        state
        queue {
          ...DownloadItem
        }
      }
    }
  }
`)

export const ReorderDownloads = graphql(`
  mutation ReorderDownloads($reorders: [ChapterDownloadReorderInput!]!) {
    reorderChapterDownloads(input: { reorders: $reorders }) {
      downloadStatus {
        state
        queue {
          ...DownloadItem
        }
      }
    }
  }
`)

export const ClearDownloads = graphql(`
  mutation ClearDownloads {
    clearDownloader(input: {}) {
      downloadStatus {
        state
        queue {
          ...DownloadItem
        }
      }
    }
  }
`)
