import { ApolloClient, ApolloLink, Observable } from '@apollo/client'
import { ApolloProvider } from '@apollo/client/react'
import { Kind } from 'graphql'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { createCache } from '@/api/cache'
import { useApplyAppearance } from '@/design/settings'
import { SettingsNavigation } from '@/features/settings/SettingsPage'
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
  const [client] = useState(() => {
    const fragment = ServerSettingsQuery.definitions.find((d) => d.kind === Kind.FRAGMENT_DEFINITION)
    const fields = fragment?.kind === Kind.FRAGMENT_DEFINITION
      ? fragment.selectionSet.selections.filter((s) => s.kind === Kind.FIELD).map((s) => [s.name.value, null])
      : []
    const fixture = {
      ...Object.fromEntries(fields),
      __typename: 'SettingsType',
      downloadsPath: '', downloadAsCbz: false, autoDownloadNewChapters: false,
      autoDownloadNewChaptersLimit: 0, excludeEntryWithUnreadChapters: false,
      autoDownloadIgnoreReUploads: true, downloadConversions: [], serveConversions: [],
    }
    return new ApolloClient({
      cache: createCache(),
      link: new ApolloLink((operation) => new Observable((observer) => {
        if (operation.operationName !== 'ServerSettings') {
          observer.error(new Error('布局验收页不保存设置，也不连接服务端'))
          return
        }
        observer.next({ data: { settings: fixture } })
        observer.complete()
      })),
    })
  })

  return (
    <ApolloProvider client={client}>
      <div data-sfw="">
        <div className={reader ? 'hidden' : undefined}>
          <header className="sticky top-0 z-20 flex h-[var(--nav-h)] items-center justify-between gap-3 bg-bg px-6">
            <Link to="/dev/source-filters" className="text-sm text-muted">来源筛选验收</Link>
            <button type="button" className="fopt" onClick={() => setReader(true)}>检查阅读设置</button>
          </header>
          <div className="wrap max-w-[1120px]! pb-24">
            <h1 className="pt-7 pb-6 text-[40px] font-black">设置</h1>
            <p className="mb-6 text-sm text-muted">布局验收：仅虚构下载设置；切换左栏检查滚动后的动画，不保存任何服务端设置。</p>
            <div className="md:grid md:grid-cols-[220px_minmax(0,1fr)] md:items-start md:gap-10 lg:grid-cols-[240px_minmax(0,1fr)]">
              <SettingsNavigation selected={tab} basePath="/dev/settings-layout" />
              <div className="min-w-0 max-md:mt-8"><DownloadsTab /></div>
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
