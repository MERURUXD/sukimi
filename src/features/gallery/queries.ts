import { graphql } from '@/api/gql'
import type { GalleryReadChaptersQuery } from '@/api/gql/graphql'

/**
 * 每部的总话数。用 no-cache 只存进按 id 索引的内存缓存，避免合并进书库后触发全库重算。
 * 不进快照，所以不用改 LibraryMangas 的字段，也不用递增快照版本。
 */
export const GalleryCounts = graphql(`
  query GalleryCounts {
    mangas(condition: { inLibrary: true }) {
      nodes {
        id
        chapters {
          totalCount
        }
      }
    }
  }
`)

/**
 * 读过的章节（已读或有阅读时间），只给阅读档案汇总用。
 * 按 id 分页取完，用 no-cache 只在内存里算，不把几千话塞进 Apollo 缓存。
 * 沿用旧的顶层已读字段，继续兼容 v2.4.2366。
 */
export const GalleryReadChapters = graphql(`
  query GalleryReadChapters($first: Int!, $offset: Int!) {
    chapters(
      filter: { inLibrary: { equalTo: true }, or: [{ isRead: { equalTo: true } }, { lastReadAt: { greaterThan: "0" } }] }
      order: [{ by: ID, byType: ASC }]
      first: $first
      offset: $offset
    ) {
      nodes {
        id
        mangaId
        isRead
        pageCount
        lastReadAt
        meta {
          key
          value
        }
      }
      pageInfo {
        hasNextPage
      }
    }
  }
`)

export type ReadChapter = GalleryReadChaptersQuery['chapters']['nodes'][number]

/**
 * 画布详情层与放映要的简介和接着读的一话。漫画按 id 归一化，
 * 简介与详情页的查询落在同一个缓存条目里，之后进详情页不用再等。
 */
export const GalleryPeek = graphql(`
  query GalleryPeek($id: Int!) {
    manga(id: $id) {
      id
      description
      firstUnreadChapter {
        id
      }
    }
  }
`)
