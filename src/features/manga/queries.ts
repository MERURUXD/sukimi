import { graphql } from '@/api/gql'
import type { MangaChaptersQuery, MangaDetailQuery } from '@/api/gql/graphql'

export const MangaDetail = graphql(`
  query MangaDetail($id: Int!) {
    manga(id: $id) {
      id
      title
      thumbnailUrl
      author
      artist
      description
      genre
      status
      realUrl
      inLibrary
      initialized
      unreadCount
      downloadCount
      bookmarkCount
      source {
        id
        displayName
        lang
      }
      categories {
        nodes {
          id
          default
        }
      }
      lastReadChapter {
        id
        lastReadAt
      }
    }
  }
`)

export type Manga = MangaDetailQuery['manga']

/** 列表里已经有的那点信息（封面 + 标题），详情还没加载完时先用它画出页面骨架 */
export const MangaPeek = graphql(`
  fragment MangaPeek on MangaType {
    id
    title
    thumbnailUrl
  }
`)

export function placeholderManga(peek: { id: number; title: string; thumbnailUrl: string | null }): Manga {
  return {
    ...peek,
    author: null,
    artist: null,
    description: null,
    genre: [],
    status: 'UNKNOWN',
    realUrl: null,
    inLibrary: false,
    initialized: true,
    unreadCount: 0,
    downloadCount: 0,
    bookmarkCount: 0,
    source: null,
    categories: { nodes: [] },
    lastReadChapter: null,
  }
}

export const MangaChapters = graphql(`
  query MangaChapters($mangaId: Int!) {
    chapters(condition: { mangaId: $mangaId }, order: [{ by: SOURCE_ORDER, byType: ASC }]) {
      nodes {
        id
        name
        chapterNumber
        sourceOrder
        scanlator
        uploadDate
        isRead
        isBookmarked
        isDownloaded
        lastPageRead
        pageCount
        lastReadAt
      }
    }
  }
`)

export type Chapter = MangaChaptersQuery['chapters']['nodes'][number]

export const FetchMangaAndChapters = graphql(`
  mutation FetchMangaAndChapters($id: Int!) {
    fetchMangaAndChapters(input: { id: $id, fetchManga: true, fetchChapters: true }) {
      manga {
        id
        title
        thumbnailUrl
        author
        artist
        description
        genre
        status
        initialized
        unreadCount
        downloadCount
      }
    }
  }
`)

export const SetMangaInLibrary = graphql(`
  mutation SetMangaInLibrary($id: Int!, $inLibrary: Boolean!) {
    updateManga(input: { id: $id, patch: { inLibrary: $inLibrary } }) {
      manga {
        id
        inLibrary
      }
    }
  }
`)

export const SetMangaCategories = graphql(`
  mutation SetMangaCategories($id: Int!, $add: [Int!], $remove: [Int!]) {
    updateMangaCategories(input: { id: $id, patch: { addToCategories: $add, removeFromCategories: $remove } }) {
      manga {
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

/** 迁移目标：从来源拉取信息和章节，一次拿到规划要用的字段 */
export const MigrationTarget = graphql(`
  mutation MigrationTarget($id: Int!) {
    fetchMangaAndChapters(input: { id: $id, fetchManga: true, fetchChapters: true }) {
      manga {
        id
        title
        thumbnailUrl
        author
        inLibrary
        source {
          id
          displayName
        }
      }
      chapters {
        id
        chapterNumber
        isRead
        isBookmarked
      }
    }
  }
`)
