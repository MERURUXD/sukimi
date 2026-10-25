import { graphql } from '@/api/gql'
import { IN_LIBRARY } from '@/features/home/queries'

export const LastUpdate = graphql(`
  query LastUpdate {
    lastUpdateTimestamp {
      timestamp
    }
  }
`)

export type UpdatesFilter = 'all' | 'unread' | 'downloaded' | 'favorite'
/** 「特别关心」在这之上由页面再按标记的漫画 id 筛（mangaId in），交给服务端分页，不在本地过滤 */
export const UPDATES_FILTERS: Record<UpdatesFilter, object> = {
  all: IN_LIBRARY,
  favorite: IN_LIBRARY,
  unread: { ...IN_LIBRARY, isRead: { equalTo: false } },
  downloaded: { ...IN_LIBRARY, isDownloaded: { equalTo: true } },
}

/**
 * 更新页的章节列表：字段同首页的 RecentUpdates，另取 inLibraryAt 用来排除迁移 / 刚加入书库时一并抓到的章节。
 * 每个筛选一份文档，各用自己的 @connection 键：刷新范围随已加载条数变化（见 pagination.ts），
 * 不同范围共用一份缓存，也不会和首页那条 first: 200 的查询互相覆盖。
 * 键不能写成 filter 参数——codegen 会把指令里的 filter 当成章节筛选去校验而报错，所以按筛选拆开。
 */
export const UpdatesFeedChapter = graphql(`
  fragment UpdatesFeedChapter on ChapterType {
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
      inLibraryAt
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
`)

export const UpdatesFeedAll = graphql(`
  query UpdatesFeedAll($first: Int!, $offset: Int!, $filter: ChapterFilterInput!) {
    chapters(filter: $filter, order: [{ by: FETCHED_AT, byType: DESC }, { by: SOURCE_ORDER, byType: DESC }], first: $first, offset: $offset)
      @connection(key: "UpdatesFeedAll") {
      totalCount
      pageInfo {
        hasNextPage
      }
      nodes {
        ...UpdatesFeedChapter
      }
    }
  }
`)

export const UpdatesFeedUnread = graphql(`
  query UpdatesFeedUnread($first: Int!, $offset: Int!, $filter: ChapterFilterInput!) {
    chapters(filter: $filter, order: [{ by: FETCHED_AT, byType: DESC }, { by: SOURCE_ORDER, byType: DESC }], first: $first, offset: $offset)
      @connection(key: "UpdatesFeedUnread") {
      totalCount
      pageInfo {
        hasNextPage
      }
      nodes {
        ...UpdatesFeedChapter
      }
    }
  }
`)

export const UpdatesFeedDownloaded = graphql(`
  query UpdatesFeedDownloaded($first: Int!, $offset: Int!, $filter: ChapterFilterInput!) {
    chapters(filter: $filter, order: [{ by: FETCHED_AT, byType: DESC }, { by: SOURCE_ORDER, byType: DESC }], first: $first, offset: $offset)
      @connection(key: "UpdatesFeedDownloaded") {
      totalCount
      pageInfo {
        hasNextPage
      }
      nodes {
        ...UpdatesFeedChapter
      }
    }
  }
`)

export const UpdatesFeedFavorite = graphql(`
  query UpdatesFeedFavorite($first: Int!, $offset: Int!, $filter: ChapterFilterInput!) {
    chapters(filter: $filter, order: [{ by: FETCHED_AT, byType: DESC }, { by: SOURCE_ORDER, byType: DESC }], first: $first, offset: $offset)
      @connection(key: "UpdatesFeedFavorite") {
      totalCount
      pageInfo {
        hasNextPage
      }
      nodes {
        ...UpdatesFeedChapter
      }
    }
  }
`)

export const UPDATES_FEEDS = { all: UpdatesFeedAll, unread: UpdatesFeedUnread, downloaded: UpdatesFeedDownloaded, favorite: UpdatesFeedFavorite } as const

/**
 * 更新日历：书库里近半年发布或抓到的章节，只取推算要用的字段。
 * 一次拿完再按漫画分组，不对每部漫画单独请求；书库大时也只是一次稍大的请求。
 */
export const CalendarChapters = graphql(`
  query CalendarChapters($filter: ChapterFilterInput!, $first: Int!) {
    chapters(filter: $filter, order: [{ by: FETCHED_AT, byType: DESC }], first: $first) {
      nodes {
        id
        mangaId
        name
        chapterNumber
        uploadDate
        fetchedAt
        manga {
          id
          title
          thumbnailUrl
          status
          updateStrategy
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

/** 近半年；月更的作品也能凑够几个发布日 */
export const CALENDAR_WINDOW_DAYS = 183
/** 一次最多取的章节数，防止异常大的书库把请求拖得太久 */
export const CALENDAR_LIMIT = 8000

export function calendarFilter(now = Date.now()) {
  const since = now - CALENDAR_WINDOW_DAYS * 86_400_000
  return {
    ...IN_LIBRARY,
    // 来源没给发布日期的章节靠抓取时间进窗口
    or: [{ uploadDate: { greaterThan: String(since) } }, { fetchedAt: { greaterThan: String(Math.floor(since / 1000)) } }],
  }
}

/** 服务端自动检查的间隔（小时，0 为关闭），算「下次检查」用 */
export const UpdateInterval = graphql(`
  query UpdateInterval {
    settings {
      globalUpdateInterval
    }
  }
`)
