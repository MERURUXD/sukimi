import { graphql } from '@/api/gql'
import type { TrackerFieldsFragment, TrackRecordFieldsFragment, TrackSearchFieldsFragment } from '@/api/gql/graphql'

graphql(`
  fragment TrackerFields on TrackerType {
    id
    name
    icon
    isLoggedIn
    isTokenExpired
    authUrl
    supportsPrivateTracking
    supportsReadingDates
    supportsTrackDeletion
    scores
    statuses {
      name
      value
    }
  }
`)

graphql(`
  fragment TrackRecordFields on TrackRecordType {
    id
    trackerId
    mangaId
    remoteId
    remoteUrl
    title
    status
    lastChapterRead
    totalChapters
    score
    displayScore
    startDate
    finishDate
    private
  }
`)

graphql(`
  fragment TrackSearchFields on TrackSearchType {
    id
    remoteId
    title
    coverUrl
    summary
    publishingStatus
    publishingType
    startDate
    totalChapters
    trackingUrl
  }
`)

export type Tracker = TrackerFieldsFragment
export type TrackRecord = TrackRecordFieldsFragment
export type TrackSearch = TrackSearchFieldsFragment

export const Trackers = graphql(`
  query Trackers {
    trackers {
      nodes {
        ...TrackerFields
      }
    }
  }
`)

export const MangaTracks = graphql(`
  query MangaTracks($id: Int!) {
    manga(id: $id) {
      id
      trackRecords {
        nodes {
          ...TrackRecordFields
        }
      }
    }
  }
`)

export const SearchTracker = graphql(`
  query SearchTracker($trackerId: Int!, $query: String!) {
    searchTracker(input: { trackerId: $trackerId, query: $query }) {
      trackSearches {
        ...TrackSearchFields
      }
    }
  }
`)

export const BindTrack = graphql(`
  mutation BindTrack($mangaId: Int!, $trackerId: Int!, $remoteId: LongString!, $private: Boolean) {
    bindTrack(input: { mangaId: $mangaId, trackerId: $trackerId, remoteId: $remoteId, private: $private }) {
      trackRecord {
        ...TrackRecordFields
      }
    }
  }
`)

export const UpdateTrack = graphql(`
  mutation UpdateTrack($input: UpdateTrackInput!) {
    updateTrack(input: $input) {
      trackRecord {
        ...TrackRecordFields
      }
    }
  }
`)

export const FetchTrack = graphql(`
  mutation FetchTrack($recordId: Int!) {
    fetchTrack(input: { recordId: $recordId }) {
      trackRecord {
        ...TrackRecordFields
      }
    }
  }
`)

export const UnbindTrack = graphql(`
  mutation UnbindTrack($recordId: Int!, $deleteRemoteTrack: Boolean) {
    unbindTrack(input: { recordId: $recordId, deleteRemoteTrack: $deleteRemoteTrack }) {
      trackRecord {
        id
      }
    }
  }
`)

export const LoginTrackerOAuth = graphql(`
  mutation LoginTrackerOAuth($trackerId: Int!, $callbackUrl: String!) {
    loginTrackerOAuth(input: { trackerId: $trackerId, callbackUrl: $callbackUrl }) {
      isLoggedIn
      tracker {
        ...TrackerFields
      }
    }
  }
`)

export const LoginTrackerCredentials = graphql(`
  mutation LoginTrackerCredentials($trackerId: Int!, $username: String!, $password: String!) {
    loginTrackerCredentials(input: { trackerId: $trackerId, username: $username, password: $password }) {
      isLoggedIn
      tracker {
        ...TrackerFields
      }
    }
  }
`)

export const LogoutTracker = graphql(`
  mutation LogoutTracker($trackerId: Int!) {
    logoutTracker(input: { trackerId: $trackerId }) {
      isLoggedIn
      tracker {
        ...TrackerFields
      }
    }
  }
`)
