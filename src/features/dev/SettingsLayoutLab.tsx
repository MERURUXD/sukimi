import { ApolloClient, ApolloLink, Observable } from '@apollo/client'
import { ApolloProvider } from '@apollo/client/react'
import { Kind } from 'graphql'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { useAuth } from '@/api/auth'
import { createCache } from '@/api/cache'
import { PageHeader } from '@/components/ui/PageHeader'
import { useApplyAppearance } from '@/design/settings'
import { PREVIEW_ADMIN, PREVIEW_MEMBER } from '@/features/auth/previewUsers'
import { SETTINGS_TABS, SettingsNavigation } from '@/features/settings/SettingsPage'
import { ServerSettingsQuery } from '@/features/settings/server'
import { DownloadsTab } from '@/features/settings/tabs/DownloadsTab'
import { SettingsPanel } from '@/features/reader/SettingsPanel'
import { DEFAULTS } from '@/features/reader/settings'

/** 使用正式控件和虚构设置检查布局；独立客户端拒绝所有保存请求。 */
export function SettingsLayoutLab() {
  useApplyAppearance()
  const { tab = 'downloads' } = useParams()
  const [reader, setReader] = useState(false)
  const [settings, setSettings] = useState(DEFAULTS)
  const [remember, setRemember] = useState(true)
  const [initialUser] = useState(() => {
    const prev = useAuth.getState().user
    if (!prev) useAuth.setState({ user: PREVIEW_ADMIN })
    return prev
  })
  const user = useAuth((s) => s.user)

  useEffect(() => {
    return () => {
      const cur = useAuth.getState().user
      if (cur === PREVIEW_ADMIN || cur === PREVIEW_MEMBER) useAuth.setState({ user: initialUser })
    }
  }, [initialUser])

  const [client] = useState(() => {
    const fragment = ServerSettingsQuery.definitions.find((d) => d.kind === Kind.FRAGMENT_DEFINITION)
    const fields = fragment?.kind === Kind.FRAGMENT_DEFINITION
      ? fragment.selectionSet.selections.filter((s) => s.kind === Kind.FIELD).map((s) => [s.name.value, null])
      : []
    const fixture = {
      ...Object.fromEntries(fields),
      __typename: 'SettingsType',
      globalUpdateInterval: 12,
      excludeUnreadChapters: true,
      excludeNotStarted: false,
      excludeCompleted: true,
      updateMangas: false,
      downloadsPath: '',
      downloadAsCbz: false,
      autoDownloadNewChapters: false,
      autoDownloadNewChaptersLimit: 0,
      excludeEntryWithUnreadChapters: false,
      autoDownloadIgnoreReUploads: true,
      downloadConversions: [],
      serveConversions: [],
      maxSourcesInParallel: 6,
      localSourcePath: '',
      kcefEnabled: true,
      flareSolverrEnabled: false,
      flareSolverrUrl: 'http://localhost:8191',
      flareSolverrTimeout: 60,
      flareSolverrSessionName: 'suwayomi',
      flareSolverrSessionTtl: 15,
      flareSolverrAsResponseFallback: false,
      backupPath: '',
      backupTime: '04:00',
      backupInterval: 1,
      backupTTL: 14,
      autoBackupIncludeManga: true,
      autoBackupIncludeCategories: true,
      autoBackupIncludeChapters: true,
      autoBackupIncludeTracking: true,
      autoBackupIncludeHistory: true,
      autoBackupIncludeClientData: true,
      autoBackupIncludeServerSettings: true,
      syncYomiEnabled: false,
      syncYomiHost: '',
      syncInterval: 'PT0S',
      syncDataManga: true,
      syncDataChapters: true,
      syncDataTracking: true,
      syncDataHistory: true,
      syncDataCategories: true,
      koreaderSyncChecksumMethod: 'BINARY',
      koreaderSyncPercentageTolerance: 0.01,
      koreaderSyncStrategyForward: 'PROMPT',
      koreaderSyncStrategyBackward: 'DISABLED',
      ip: '0.0.0.0',
      port: 4567,
      authMode: 'UI_LOGIN',
      authUsername: 'admin',
      jwtTokenExpiry: 'PT5M',
      jwtRefreshExpiry: 'P30D',
      socksProxyEnabled: false,
      socksProxyVersion: 5,
      socksProxyHost: '',
      socksProxyPort: '',
      socksProxyUsername: '',
      webUIFlavor: 'CUSTOM',
      webUIChannel: 'STABLE',
      webUIUpdateCheckInterval: 0,
      initialOpenInBrowserEnabled: false,
      systemTrayEnabled: true,
      debugLogsEnabled: false,
      maxLogFiles: 7,
      maxLogFileSize: '10mb',
      maxLogFolderSize: '100mb',
      databaseType: 'H2',
      databaseUrl: '',
      databaseUsername: '',
      useHikariConnectionPool: true,
      opdsUseBinaryFileSizes: false,
      opdsItemsPerPage: 50,
      opdsEnablePageReadProgress: true,
      opdsMarkAsReadOnDownload: false,
      opdsShowOnlyUnreadChapters: false,
      opdsShowOnlyDownloadedChapters: false,
      opdsChapterSortOrder: 'DESC',
      opdsCbzMimetype: 'MODERN',
      opdsSkipChapterMetadataFeed: false,
    }
    return new ApolloClient({
      cache: createCache(),
      link: new ApolloLink((operation) => new Observable((observer) => {
        const reply = (data: Record<string, unknown>) => {
          observer.next({ data })
          observer.complete()
        }
        switch (operation.operationName) {
          case 'MultiUserSettings':
            return reply({ settings: { __typename: 'SettingsType', autoBackupIncludeUserSettings: true } })
          case 'UserSettings':
            return reply({ userSettings: { ...fixture, __typename: 'UserSettingsType' } })
          case 'ServerSettings':
            return reply({ settings: fixture })
          case 'ReaderMetaIndex':
            return reply({
              mangas: {
                __typename: 'MangaNodeList',
                nodes: [{ __typename: 'MangaType', id: 1, meta: [{ __typename: 'MangaMetaType', key: 'suwayomi-web.reader.mode', value: 'double' }] }],
              },
            })
          case 'Categories':
            return reply({
              categories: {
                __typename: 'CategoryNodeList',
                nodes: [
                  { __typename: 'CategoryType', id: 0, name: '默认', order: 0, default: true, meta: [] },
                  { __typename: 'CategoryType', id: 1, name: '连载中', order: 1, default: false, meta: [] },
                  { __typename: 'CategoryType', id: 2, name: '短篇集', order: 2, default: false, meta: [] },
                ],
              },
            })
          case 'CategoriesFull':
            return reply({
              categories: {
                __typename: 'CategoryNodeList',
                nodes: [
                  { __typename: 'CategoryType', id: 0, name: '默认', order: 0, default: true, meta: [], includeInUpdate: 'INCLUDE', mangas: { __typename: 'MangaNodeList', totalCount: 4 } },
                  { __typename: 'CategoryType', id: 1, name: '连载中', order: 1, default: false, meta: [], includeInUpdate: 'INCLUDE', mangas: { __typename: 'MangaNodeList', totalCount: 6 } },
                  { __typename: 'CategoryType', id: 2, name: '短篇集', order: 2, default: false, meta: [], includeInUpdate: 'EXCLUDE', mangas: { __typename: 'MangaNodeList', totalCount: 2 } },
                ],
              },
            })
          case 'ExtensionStores':
            return reply({
              extensionStores: {
                __typename: 'ExtensionStoreNodeList',
                nodes: [{ __typename: 'ExtensionStoreType', indexUrl: 'https://example.invalid/repo/index.min.json', name: '虚构扩展仓库', badgeLabel: '虚构', isLegacy: false }],
              },
            })
          case 'LastSync':
            return reply({
              lastSyncStatus: { __typename: 'SyncStatus', state: 'SUCCESS', startDate: '1760000000000', endDate: '1760000005000', errorMessage: null },
            })
          case 'KoSyncStatus':
            return reply({
              koSyncStatus: { __typename: 'KoSyncStatusPayload', isLoggedIn: false, serverAddress: null, username: null },
            })
          case 'Trackers': {
            const trackerExtra = {
              supportsPrivateTracking: false,
              supportsReadingDates: true,
              supportsTrackDeletion: true,
              scores: ['10', '9', '8'],
              statuses: [{ __typename: 'TrackStatusType', name: '在读', value: 1 }],
            }
            return reply({
              trackers: {
                __typename: 'TrackerNodeList',
                nodes: [
                  { __typename: 'TrackerType', id: 1, name: 'Bangumi', icon: '', isLoggedIn: true, isTokenExpired: false, authUrl: 'https://example.invalid/oauth', ...trackerExtra },
                  { __typename: 'TrackerType', id: 2, name: 'AniList', icon: '', isLoggedIn: false, isTokenExpired: false, authUrl: 'https://example.invalid/oauth', ...trackerExtra },
                ],
              },
            })
          }
          case 'Users':
            return reply({
              users: {
                __typename: 'UserNodeList',
                nodes: [
                  { __typename: 'UserType', id: 1, username: 'admin', roles: ['ADMIN'], permissions: [] },
                  { __typename: 'UserType', id: 2, username: 'demo-reader', roles: ['USER'], permissions: ['DOWNLOAD_CHAPTERS'] },
                ],
              },
            })
          case 'UserCodes':
            return reply({ userCodes: [] })
          case 'SettingsAbout':
            return reply({
              aboutServer: {
                __typename: 'AboutServerPayload',
                name: 'Suwayomi-Server',
                version: 'v2.4.2379',
                buildType: 'Preview',
                buildTime: '1760000000',
                github: 'https://github.com/Suwayomi/Suwayomi-Server',
                discord: 'https://discord.gg/ddZ25aB',
                platformInfo: {
                  __typename: 'PlatformInfoType',
                  arch: 'amd64',
                  os: { __typename: 'OsInfoType', name: 'Linux', version: '6.8' },
                  jvm: { __typename: 'JvmInfoType', javaVersion: '21.0.4' },
                },
              },
            })
          default:
            observer.error(new Error('布局验收页不保存设置，也不连接服务端'))
        }
      })),
    })
  })

  const Shown = SETTINGS_TABS.find((t) => t.id === tab)?.Component ?? DownloadsTab

  return (
    <ApolloProvider client={client}>
      <div data-sfw="">
        <div className={reader ? 'hidden' : undefined}>
          <header className="sticky top-0 z-20 flex h-[var(--nav-h)] items-center justify-between gap-3 bg-bg px-6">
            <Link to="/dev/source-filters" className="text-sm text-muted">来源筛选验收</Link>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="fopt"
                onClick={() => useAuth.setState({ user: user?.id === PREVIEW_MEMBER.id ? PREVIEW_ADMIN : PREVIEW_MEMBER })}
              >
                身份：{user?.id === PREVIEW_MEMBER.id ? '普通用户' : '管理员'}
              </button>
              <button type="button" className="fopt" onClick={() => setReader(true)}>检查阅读设置</button>
            </div>
          </header>
          {/* 宽度、标题和两栏尺寸跟正式设置页（SettingsShell）一致 */}
          <div className="wrap pb-24">
            <PageHeader title="设置" className="pb-3" />
            <p className="mt-0 mb-6 max-w-[62ch] text-sm text-muted">布局验收：全部 12 个分栏均使用虚构数据在本地渲染；不保存任何服务端设置，也不连接真实后端。</p>
            <div className="md:grid md:grid-cols-[220px_minmax(0,760px)] md:items-start md:gap-10 lg:grid-cols-[240px_minmax(0,760px)]">
              <SettingsNavigation selected={tab} basePath="/dev/settings-layout" />
              <div className="min-w-0 max-md:mt-8"><Shown /></div>
            </div>
            <div className="h-[50dvh]" aria-hidden />
          </div>
        </div>
        {reader && (
          <div className="fixed inset-0 z-50 bg-bg">
            <button type="button" className="gbtn absolute top-5 left-5" onClick={() => setReader(false)}>关闭阅读验收</button>
            <SettingsPanel open settings={settings} set={(patch) => setSettings((prev) => ({ ...prev, ...patch }))} rememberPerManga={remember} onRememberChange={setRemember} syncLabel="虚构阅读设置，仅在此页生效" />
          </div>
        )}
      </div>
    </ApolloProvider>
  )
}
