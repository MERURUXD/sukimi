import { ApolloClient, ApolloLink, Observable } from '@apollo/client'
import { ApolloProvider } from '@apollo/client/react'
import { useState } from 'react'
import { createCache } from '@/api/cache'
import { ConfirmHost } from '@/components/ui/Confirm'
import { Toaster } from '@/components/ui/toast'
import { useApplyAppearance } from '@/design/settings'
import { TrackingTab } from '@/features/settings/tabs/TrackingTab'
import { TrackButton } from '@/features/tracking/TrackPanel'

const MANGA = -6000
const statuses = (names: string[]) => names.map((name, i) => ({ __typename: 'TrackStatusType', name, value: i + 1 }))
const tracker = (id: number, name: string, o: Record<string, unknown>) => ({
  __typename: 'TrackerType', id, name, icon: '', isLoggedIn: false, isTokenExpired: false, authUrl: null,
  supportsPrivateTracking: false, supportsReadingDates: false, supportsTrackDeletion: false,
  scores: ['', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'],
  statuses: statuses(['Reading', 'Completed', 'On Hold', 'Dropped', 'Plan to Read', 'Rereading']), ...o,
})

/** 只在开发路由挂载；所有请求在本机生成，不连接服务端，也不会跳去追踪网站 */
export function TrackingLab() {
  useApplyAppearance()
  const [log, setLog] = useState<string[]>([])
  const [client] = useState(() => {
    const trackers = [
      tracker(1, '测试追踪 A（OAuth，已登录）', { isLoggedIn: true, authUrl: 'https://example.invalid/a?x=1', supportsPrivateTracking: true, supportsReadingDates: true, supportsTrackDeletion: true }),
      tracker(2, '测试追踪 B（OAuth）', { authUrl: 'https://example.invalid/b?x=1' }),
      tracker(3, '测试追踪 C（账号密码）', {}),
      tracker(4, '测试追踪 D（已过期）', { isLoggedIn: true, isTokenExpired: true }),
    ]
    let records = [
      { __typename: 'TrackRecordType', id: 70, trackerId: 1, mangaId: MANGA, remoteId: '501', remoteUrl: 'https://example.invalid/501', title: '虚构条目：测试漫画', status: 1, lastChapterRead: 12, totalChapters: 40, score: 8, displayScore: '8', startDate: String(new Date(2026, 0, 5).getTime()), finishDate: '0', private: false },
    ]
    const find = (id: number) => trackers.find((t) => t.id === id)!
    return new ApolloClient({
      cache: createCache(),
      link: new ApolloLink((op) => new Observable((observer) => {
        const v = op.variables as Record<string, never>
        setLog((l) => [...l, `${op.operationName} ${JSON.stringify(v)}`])
        const timer = setTimeout(() => {
          switch (op.operationName) {
            case 'Trackers':
              observer.next({ data: { trackers: { __typename: 'TrackerNodeList', nodes: trackers } } })
              break
            case 'MangaTracks':
              observer.next({ data: { manga: { __typename: 'MangaType', id: MANGA, trackRecords: { __typename: 'TrackRecordNodeList', nodes: records } } } })
              break
            case 'SearchTracker':
              observer.next({ data: { searchTracker: { __typename: 'SearchTrackerPayload', trackSearches: Array.from({ length: 4 }, (_, i) => ({
                __typename: 'TrackSearchType', id: i, remoteId: String(600 + i), title: `虚构条目 ${i + 1}：${v.query}`, coverUrl: '/favicon.svg',
                summary: '这是一段虚构的简介，用来检查两行截断的效果。'.repeat(3), publishingStatus: 'Publishing', publishingType: 'Manga', startDate: '2020', totalChapters: 30 + i, trackingUrl: '',
              })) } } })
              break
            case 'BindTrack': {
              const rec = { ...records[0], id: 71 + records.length, trackerId: v.trackerId, remoteId: v.remoteId, title: `虚构条目（${v.remoteId}）`, status: 1, lastChapterRead: 0, displayScore: '', startDate: '0', private: !!v.private }
              records = [...records, rec]
              observer.next({ data: { bindTrack: { __typename: 'BindTrackPayload', trackRecord: rec } } })
              break
            }
            case 'UpdateTrack': {
              const input = v.input as Record<string, unknown> & { recordId: number }
              const { recordId, scoreString, ...rest } = input
              records = records.map((r) => (r.id === recordId ? { ...r, ...rest, ...(scoreString != null ? { displayScore: String(scoreString) } : {}) } : r))
              observer.next({ data: { updateTrack: { __typename: 'UpdateTrackPayload', trackRecord: records.find((r) => r.id === recordId) } } })
              break
            }
            case 'FetchTrack':
              observer.next({ data: { fetchTrack: { __typename: 'FetchTrackPayload', trackRecord: records.find((r) => r.id === v.recordId) } } })
              break
            case 'UnbindTrack':
              records = records.filter((r) => r.id !== v.recordId)
              observer.next({ data: { unbindTrack: { __typename: 'UnbindTrackPayload', trackRecord: { __typename: 'TrackRecordType', id: v.recordId } } } })
              break
            case 'TrackProgress':
              observer.next({ data: { trackProgress: { __typename: 'TrackProgressPayload', trackRecords: records } } })
              break
            case 'LoginTrackerCredentials':
            case 'LogoutTracker': {
              const t = find(v.trackerId)
              t.isLoggedIn = op.operationName === 'LoginTrackerCredentials'
              const key = op.operationName === 'LogoutTracker' ? 'logoutTracker' : 'loginTrackerCredentials'
              observer.next({ data: { [key]: { __typename: 'P', isLoggedIn: t.isLoggedIn, tracker: t } } })
              break
            }
            default:
              observer.error(new Error('追踪验收页不连接服务端'))
              return
          }
          observer.complete()
        }, 250)
        return () => clearTimeout(timer)
      })),
    })
  })

  return (
    <div className="wrap py-6" data-sfw="">
      <p className="m-0 text-sm text-muted">追踪 · 界面验收（虚构数据，仅开发环境）</p>
      <ApolloProvider client={client}>
        <div className="my-6 flex items-center gap-3">
          <span className="font-semibold">详情页按钮：</span>
          <TrackButton mangaId={MANGA} title="测试漫画" />
        </div>
        <TrackingTab />
      </ApolloProvider>
      <details className="pb-10">
        <summary className="cursor-pointer text-sm font-bold">虚构请求（{log.length} 次）</summary>
        <pre className="overflow-x-auto text-xs text-muted">{log.join('\n')}</pre>
      </details>
      <Toaster />
      <ConfirmHost />
    </div>
  )
}
