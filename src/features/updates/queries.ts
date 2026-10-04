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
