import { ApolloClient, ApolloLink, Observable } from '@apollo/client'
import { ApolloProvider } from '@apollo/client/react'
import { useEffect, useState } from 'react'
import { useAuth } from '@/api/auth'
import { createCache } from '@/api/cache'
import { ConfirmHost } from '@/components/ui/Confirm'
import { Toaster } from '@/components/ui/toast'
import { useApplyAppearance } from '@/design/settings'
import type { AuthUser } from '@/features/auth/permissions'
import { favoriteKey } from '@/features/favorite/favorite'
import { laterKey } from '@/features/later/later'
import { tagsKey } from '@/features/tags/tags'
import { MigrateView } from '@/features/manga/MigratePage'

const ID = -500
const source = (id: string, name: string, lang: string) => ({
  __typename: 'SourceType', id, name, displayName: name, lang, iconUrl: '', supportsLatest: true, contentWarning: 'SAFE', homeUrl: null,
})
const SOURCES = [
  source('900', '测试来源 甲', 'zh'),
  source('901', '测试来源 乙', 'zh'),
  source('902', '测试来源 丙', 'all'),
  source('903', '测试来源 丁', 'zh'),
  source('904', 'Test Source', 'en'),
]
const chapter = (id: number, n: number, o: Record<string, unknown> = {}) => ({
  __typename: 'ChapterType', id, name: `第 ${n} 话`, chapterNumber: n, sourceOrder: n, scanlator: null, uploadDate: '0',
  isRead: false, isBookmarked: false, isDownloaded: false, lastPageRead: 0, pageCount: -1, lastReadAt: '0', meta: [], ...o,
})
// 当前漫画：12 话，读到第 8 话（第 5 话跳过），第 3、10 话有书签，前 4 话已下载；
// 另有一话读过、被识别成第 2024 话的特别篇，验收它不会把后面没读的标成已读
const OLD = [
  ...Array.from({ length: 12 }, (_, i) =>
    chapter(-600 - i, i + 1, { isRead: i < 8 && i !== 4, isBookmarked: i === 2 || i === 9, isDownloaded: i < 4 }),
  ),
  chapter(-650, 2024, { name: '2024 新年特别篇', sourceOrder: 13, isRead: true }),
]

/**
 * 虚构账号 id 0（旧版单用户）；当前漫画在稍后再看和特别关心里，也有自建标签。
 * 第一个候选（-700）已经有一个标签，用来验收迁移时两边合并、旧的不丢
 */
const USER: AuthUser = { id: 0, username: '', roles: ['ADMIN'], permissions: [], legacy: true }
const metas = new Map([
  [laterKey(USER.id, ID), '1700000000'],
  [favoriteKey(USER.id, ID), '1700000500'],
  [tagsKey(USER.id, ID), JSON.stringify({ add: ['虚构标签甲'], hide: [] })],
  [tagsKey(USER.id, -700), JSON.stringify({ add: ['虚构标签乙'], hide: [] })],
])

const tracker = (id: number, name: string, loggedIn: boolean) => ({
  __typename: 'TrackerType', id, name, icon: '', isLoggedIn: loggedIn, isTokenExpired: false, authUrl: null, supportsPrivateTracking: false,
  supportsReadingDates: false, supportsTrackDeletion: false, scores: [], statuses: [],
})
const record = (id: number, trackerId: number, mangaId: number, title: string) => ({
  __typename: 'TrackRecordType', id, trackerId, mangaId, remoteId: `r${trackerId}`, remoteUrl: '', title, status: 1, lastChapterRead: 3,
  totalChapters: 0, score: 0, displayScore: '', startDate: '0', finishDate: '0', private: false,
})
/** 本次打开期间新绑定的记录 */
const bound: ReturnType<typeof record>[] = []

/** 只在开发路由挂载；所有请求在本机生成，不连接服务端 */
export function MigrateLab() {
  useApplyAppearance()
  const [log, setLog] = useState<string[]>([])
  // 迁移要按账号 id 拼稍后再看、特别关心的键；离开时还原原来的身份
  useEffect(() => {
    const prev = useAuth.getState().user
    useAuth.setState({ user: USER })
    return () => useAuth.setState({ user: prev })
  }, [])
  const [done, setDone] = useState<number | null>(null)
  const [client] = useState(
    () =>
      new ApolloClient({
        cache: createCache(),
        link: new ApolloLink((op) => new Observable((observer) => {
          const v = op.variables as Record<string, never>
          if (!['MangaDetail', 'MangaChapters', 'Sources'].includes(op.operationName ?? '')) setLog((l) => [...l, `${op.operationName} ${JSON.stringify(v)}`])
          const slow = op.operationName === 'FetchSourceManga' || op.operationName === 'MigrationTarget'
          const timer = setTimeout(() => {
            switch (op.operationName) {
              case 'MangaDetail':
                observer.next({ data: { manga: {
                  __typename: 'MangaType', id: ID, title: '虚构测试漫画', thumbnailUrl: '/favicon.svg', author: '测试作者', artist: null,
                  description: null, genre: [], status: 'ONGOING', realUrl: null, inLibrary: true, initialized: true, unreadCount: 5,
                  downloadCount: 4, bookmarkCount: 2, source: { __typename: 'SourceType', id: '899', displayName: '测试来源 原', lang: 'zh' },
                  categories: { __typename: 'CategoryNodeList', nodes: [{ __typename: 'CategoryType', id: 3 }, { __typename: 'CategoryType', id: 5 }] },
                  lastReadChapter: null,
                } } })
                break
              case 'MangaChapters':
                observer.next({ data: { chapters: { __typename: 'ChapterNodeList', nodes: OLD } } })
                break
              case 'Sources':
                observer.next({ data: { sources: { __typename: 'SourceNodeList', nodes: [source('899', '测试来源 原', 'zh'), ...SOURCES] } } })
                break
              case 'FetchSourceManga': {
                const s = Number(v.source)
                if (s === 903) {
                  observer.error(new Error('虚构的来源错误'))
                  return
                }
                const n = s === 901 ? 0 : s === 900 ? 9 : 3
                observer.next({ data: { fetchSourceManga: { __typename: 'FetchSourceMangaPayload', hasNextPage: false, mangas: Array.from({ length: n }, (_, i) => ({
                  __typename: 'MangaType', id: -700 - s * 10 - i, title: i === 0 ? '虚构测试漫画' : `虚构测试漫画 第${i + 1}季 名字比较长的候选`,
                  thumbnailUrl: '/favicon.svg', author: '测试作者', inLibrary: i === 1,
                })) } } })
                break
              }
              case 'MigrationTarget':
                observer.next({ data: { fetchMangaAndChapters: {
                  __typename: 'FetchMangaAndChaptersPayload',
                  manga: { __typename: 'MangaType', id: v.id, title: '虚构测试漫画', thumbnailUrl: '/favicon.svg', author: '测试作者', inLibrary: false, source: null },
                  // 新来源 14 话，多了 10.5 话和识别不出话数的番外
                  chapters: [...Array.from({ length: 14 }, (_, i) => chapter(-800 - i, i + 1)), chapter(-850, 10.5), chapter(-851, -1)],
                } } })
                break
              case 'SetMangaInLibrary':
                observer.next({ data: { updateManga: { __typename: 'UpdateMangaPayload', manga: { __typename: 'MangaType', id: v.id, inLibrary: v.inLibrary } } } })
                break
              case 'SetMangaCategories':
                observer.next({ data: { updateMangaCategories: { __typename: 'UpdateMangaCategoriesPayload', manga: { __typename: 'MangaType', id: v.id, categories: { __typename: 'CategoryNodeList', nodes: [] } } } } })
                break
              case 'UpdateChapters':
                observer.next({ data: { updateChapters: { __typename: 'UpdateChaptersPayload', chapters: [] } } })
                break
              case 'DeleteDownloads':
                observer.next({ data: { deleteDownloadedChapters: { __typename: 'DeleteDownloadedChaptersPayload', chapters: [] } } })
                break
              case 'MigrationMarks':
                observer.next({ data: { metas: { __typename: 'GlobalMetaNodeList', nodes: (v.keys as string[]).flatMap((key) => {
                  const value = metas.get(key)
                  return value === undefined ? [] : [{ __typename: 'GlobalMetaType', key, value }]
                }) } } })
                break
              case 'CopyMigrationMarks':
                for (const m of v.metas as { key: string; value: string }[]) metas.set(m.key, m.value)
                observer.next({ data: { setGlobalMetas: { __typename: 'SetGlobalMetasPayload', metas: [] } } })
                break
              case 'RemoveMigrationMarks':
                for (const key of v.keys as string[]) metas.delete(key)
                observer.next({ data: { deleteGlobalMetas: { __typename: 'DeleteGlobalMetasPayload', metas: [] } } })
                break
              case 'Trackers':
                observer.next({ data: { trackers: { __typename: 'TrackerNodeList', nodes: [
                  tracker(1, '虚构追踪甲', true),
                  tracker(2, '虚构追踪乙', true),
                  tracker(3, '虚构追踪丙', false),
                ] } } })
                break
              case 'MangaTracks':
                observer.next({ data: { manga: { __typename: 'MangaType', id: v.id, trackRecords: { __typename: 'TrackRecordNodeList', nodes:
                  v.id === ID ? [record(-910, 1, ID, '虚构条目 甲'), record(-911, 2, ID, '虚构条目 乙'), record(-912, 3, ID, '虚构条目 丙')] : bound.filter((r) => r.mangaId === v.id),
                } } } })
                break
              case 'SearchTracker':
                // 乙网站搜不到，用来验收「个别网站绑不上」的提示
                observer.next({ data: { searchTracker: { __typename: 'SearchTrackerPayload', trackSearches: v.trackerId === 2 ? [] : [{
                  __typename: 'TrackSearchType', id: -1, remoteId: `r${v.trackerId}`, title: v.query, coverUrl: '', summary: '', publishingStatus: '', publishingType: '', startDate: '', totalChapters: 0, trackingUrl: '',
                }] } } })
                break
              case 'BindTrack': {
                const rec = record(-920 - bound.length, v.trackerId, v.mangaId, '虚构条目')
                bound.push(rec)
                observer.next({ data: { bindTrack: { __typename: 'BindTrackPayload', trackRecord: rec } } })
                break
              }
              default:
                observer.error(new Error('迁移验收页不连接服务端'))
                return
            }
            observer.complete()
          }, slow ? 700 : 100)
          return () => clearTimeout(timer)
        })),
      }),
  )

  return (
    <div className="pt-6" data-sfw="">
      <p className="wrap m-0 text-sm text-muted">换源迁移 · 界面验收（虚构数据，仅开发环境）</p>
      <ApolloProvider client={client}>
        <MigrateView mangaId={ID} onDone={setDone} />
      </ApolloProvider>
      <div className="wrap pb-10">
        {done != null && <p className="font-bold" role="status">迁移完成，跳转到 {done}</p>}
        <details>
          <summary className="cursor-pointer text-sm font-bold">虚构请求（{log.length} 次）</summary>
          <pre className="overflow-x-auto text-xs text-muted">{log.join('\n')}</pre>
        </details>
      </div>
      <Toaster />
      <ConfirmHost />
    </div>
  )
}
