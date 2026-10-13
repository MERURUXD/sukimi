import { ApolloClient, ApolloLink, Observable } from '@apollo/client'
import { ApolloProvider } from '@apollo/client/react'
import { useState } from 'react'
import { createCache } from '@/api/cache'
import { ConfirmHost } from '@/components/ui/Confirm'
import { Toaster } from '@/components/ui/toast'
import { useApplyAppearance } from '@/design/settings'
import { DevToolsPage } from '@/features/devtools/DevToolsPage'

const source = (id: string, name: string, supportsLatest = true) => ({
  __typename: 'SourceType', id, name, displayName: name, lang: 'zh', iconUrl: '', supportsLatest, contentWarning: 'SAFE', homeUrl: null,
})
const SOURCES = [source('0', '本地'), source('910', '测试来源 甲'), source('911', '测试来源 乙（第 2 页出错）', false), source('912', '测试来源 丙（入库失败）')]
// 书库：两部已在库，其中一部和来源里的作品同名
const LIBRARY = [
  { __typename: 'MangaType', id: -2001, title: '虚构 · 已在书库' },
  { __typename: 'MangaType', id: -2900, title: '虚构 · 同名作品' },
]

/** 每页 12 条：第 1 页含一部已在书库、一部同名，第 2 页开头重复上一页的两部 */
function page(sourceId: string, n: number) {
  const base = -3000 - Number(sourceId) * 100 - n * 20
  const items = Array.from({ length: 12 }, (_, i) => ({ __typename: 'MangaType', id: base - i, title: `虚构作品 ${sourceId}-${n}-${i + 1}`, thumbnailUrl: '/favicon.svg', author: '测试作者', inLibrary: false }))
  if (n === 1) {
    items[0] = { ...items[0], id: -2001, title: '虚构 · 已在书库', inLibrary: true }
    items[1] = { ...items[1], title: '虚构 · 同名作品' }
  } else {
    items[0] = { ...page(sourceId, n - 1).mangas[3] }
    items[1] = { ...page(sourceId, n - 1).mangas[4] }
  }
  return { __typename: 'FetchSourceMangaPayload', hasNextPage: n < 5, mangas: items }
}

/** 只在开发路由挂载；所有请求在本机生成，不连接服务端。左下角列出页面发出的写入类请求 */
export function DevToolsLab() {
  useApplyAppearance()
  const [log, setLog] = useState<string[]>([])
  const [client] = useState(() => {
    let submitted = 0
    return new ApolloClient({
      cache: createCache(),
      link: new ApolloLink((op) => new Observable((observer) => {
        const v = op.variables as Record<string, never>
        if (['FetchSourceManga', 'SetInLibrary', 'LibraryMangas'].includes(op.operationName ?? '')) {
          const line = `${op.operationName} ${JSON.stringify(v)}`
          setLog((l) => [...l.slice(-30), line])
          // 页面卸载后日志面板也没了；挂到 window 上，验收「离开页面后不再写入」时可查
          ;((window as unknown as { __devtoolsLog?: string[] }).__devtoolsLog ??= []).push(line)
        }
        const timer = setTimeout(() => {
          switch (op.operationName) {
            case 'DevToolsPing':
              observer.next({ data: { aboutServer: { __typename: 'AboutServerPayload', name: 'Suwayomi（虚构）', version: 'v0.0.0-lab', buildType: 'Preview' } } })
              break
            case 'Sources':
              observer.next({ data: { sources: { __typename: 'SourceNodeList', nodes: SOURCES } } })
              break
            case 'DevToolsLibraryTitles':
              observer.next({ data: { mangas: { __typename: 'MangaNodeList', nodes: LIBRARY } } })
              break
            case 'FetchSourceManga':
              if (v.source === '911' && v.page === 2) {
                observer.error(new Error('虚构来源请求失败'))
                return
              }
              observer.next({ data: { fetchSourceManga: page(v.source, v.page) } })
              break
            case 'SetInLibrary': {
              // 丙来源：第 2 批起全部失败，演示连续失败中止
              const ids = v.ids as number[]
              if (ids[0] <= -94200 && ++submitted > 1) {
                observer.error(new Error('虚构入库失败'))
                return
              }
              observer.next({ data: { updateMangas: { __typename: 'UpdateMangasPayload', mangas: ids.map((id) => ({ __typename: 'MangaType', id, inLibrary: true })) } } })
              break
            }
            default:
              observer.next({ data: {} })
          }
          observer.complete()
        }, op.operationName === 'FetchSourceManga' ? 600 : 250)
        return () => clearTimeout(timer)
      })),
    })
  })

  return (
    <ApolloProvider client={client}>
      <DevToolsPage />
      {log.length > 0 && (
        <pre className="fixed bottom-3 left-3 z-50 m-0 max-h-48 max-w-[min(560px,calc(100vw-24px))] overflow-auto rounded-xl bg-bg/90 p-3 text-[11px] text-muted">
          {log.join('\n')}
        </pre>
      )}
      <ConfirmHost />
      <Toaster />
    </ApolloProvider>
  )
}
