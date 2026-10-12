import { graphql } from '@/api/gql'
import type { LibraryMangasQuery } from '@/api/gql/graphql'

// 书库、「稍后再看」共用同一组字段，书库网格、筛选和排序直接复用；改字段时递增 persist.ts 的 VERSION
export const LibraryMangaFields = graphql(`
  fragment LibraryMangaFields on MangaType {
    id
    title
    thumbnailUrl
    author
    artist
    genre
    status
    inLibraryAt
    unreadCount
    downloadCount
    bookmarkCount
    source {
      id
      displayName
    }
    categories {
      nodes {
        id
      }
    }
    lastReadChapter {
      id
      lastReadAt
      # 首页「好久没看」按历史删除规则隐藏
      meta {
        key
        value
      }
    }
    # 首页「还没开始读」：Tachiyomi 时期导入的已读章节没有阅读时间，只有已读标记
    latestReadChapter {
      id
    }
    latestFetchedChapter {
      id
      fetchedAt
    }
    latestUploadedChapter {
      id
      uploadDate
    }
    # 按评分排序用；分制按追踪网站的评分档位折算
    trackRecords {
      nodes {
        id
        trackerId
        displayScore
      }
    }
  }
`)

// 书库一次取全量（几千部也只有几百 KB），筛选、排序、搜索都在本地做
export const LibraryMangas = graphql(`
  query LibraryMangas {
    mangas(condition: { inLibrary: true }) {
      totalCount
      nodes {
        ...LibraryMangaFields
      }
    }
    # 评分档位跟书库一起进快照，离线用快照时也能按评分排序
    trackers {
      nodes {
        id
        scores
      }
    }
  }
`)

export type LibraryManga = LibraryMangasQuery['mangas']['nodes'][number]

export const Categories = graphql(`
  query Categories {
    categories(order: [{ by: ORDER }]) {
      nodes {
        id
        name
        order
        default
      }
    }
  }
`)

export const UpdateLibrary = graphql(`
  mutation UpdateLibrary($categories: [Int!]) {
    updateLibrary(input: { categories: $categories }) {
      updateStatus {
        jobsInfo {
          isRunning
          finishedJobs
          totalJobs
        }
      }
    }
  }
`)

// 停止的是服务端唯一的更新任务，不区分是哪个账号发起的
export const UpdateStop = graphql(`
  mutation UpdateStop {
    updateStop(input: {}) {
      clientMutationId
    }
  }
`)

export const SetInLibrary = graphql(`
  mutation SetInLibrary($ids: [Int!]!, $inLibrary: Boolean!) {
    updateMangas(input: { ids: $ids, patch: { inLibrary: $inLibrary } }) {
      mangas {
        id
        inLibrary
      }
    }
  }
`)

export const SetMangasCategories = graphql(`
  mutation SetMangasCategories($ids: [Int!]!, $add: [Int!], $remove: [Int!]) {
    updateMangasCategories(input: { ids: $ids, patch: { addToCategories: $add, removeFromCategories: $remove } }) {
      mangas {
        id
        categories {
          nodes {
            id
          }
        }
      }
    }
  }
`)

/** 选中漫画里符合条件的章节 id（批量已读 / 下载用） */
export const ChapterIds = graphql(`
  query ChapterIds($filter: ChapterFilterInput!) {
    chapters(filter: $filter) {
      nodes {
        id
      }
    }
  }
`)
