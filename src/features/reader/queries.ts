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

/** 单部漫画的元数据，阅读器从中读出按漫画记住的模式 / 方向 / 缩放 */
export const ReaderMangaMeta = graphql(`
  query ReaderMangaMeta($id: Int!) {
    manga(id: $id) {
      id
      meta {
        key
        value
      }
    }
  }
`)

/** 指定几部漫画的元数据；补传旧的浏览器内设置前先看服务端已有哪些 */
export const ReaderMetaOf = graphql(`
  query ReaderMetaOf($ids: [Int!]!) {
    mangas(filter: { id: { in: $ids } }) {
      nodes {
        id
        meta {
          key
          value
        }
      }
    }
  }
`)

/** 服务端没法按元数据筛选漫画，只能取全部漫画的元数据键来统计和清除 */
export const ReaderMetaIndex = graphql(`
  query ReaderMetaIndex {
    mangas {
      nodes {
        id
        meta {
          key
          value
        }
      }
    }
  }
`)

export const SetReaderMeta = graphql(`
  mutation SetReaderMeta($items: [SetMangaMetasItemInput!]!) {
    setMangaMetas(input: { items: $items }) {
      metas {
        mangaId
        key
        value
      }
    }
  }
`)

export const ClearReaderMeta = graphql(`
  mutation ClearReaderMeta($ids: [Int!]!, $prefixes: [String!]!) {
    deleteMangaMetas(input: { items: [{ mangaIds: $ids, prefixes: $prefixes }] }) {
      metas {
        mangaId
        key
      }
    }
  }
`)
