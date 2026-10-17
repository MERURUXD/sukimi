import { graphql } from '@/api/gql'
import { IN_LIBRARY } from '@/features/home/queries'

export const LastUpdate = graphql(`
  query LastUpdate {
    lastUpdateTimestamp {
      timestamp
    }
  }
`)

export type UpdatesFilter = 'all' | 'unread' | 'downloaded'
export const UPDATES_FILTERS: Record<UpdatesFilter, object> = {
  all: IN_LIBRARY,
  unread: { ...IN_LIBRARY, isRead: { equalTo: false } },
  downloaded: { ...IN_LIBRARY, isDownloaded: { equalTo: true } },
}
export const UPDATES_PAGE = 60

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
