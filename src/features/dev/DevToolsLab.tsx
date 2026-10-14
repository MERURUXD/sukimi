import { ApolloClient, ApolloLink, Observable } from '@apollo/client'
import { ApolloProvider } from '@apollo/client/react'
import { useState } from 'react'
import { createCache } from '@/api/cache'
import { monitorLink } from '@/api/monitorLink'
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

// 批量已读 / 未读用的虚构书库：分类 0 是默认分类；最后一部的章节写入总是失败
const CATEGORIES = [
  { __typename: 'CategoryType', id: 0, name: '默认', order: 0, default: true },
  { __typename: 'CategoryType', id: 1, name: '测试书架', order: 1, default: false },
  { __typename: 'CategoryType', id: 2, name: '待读', order: 2, default: false },
]
const READ_MANGAS: { id: number; title: string; cats: number[]; chapters: number; read: number; partial?: boolean }[] = [
  // 第 1 话读到一半：标为未读时也要被找出来归零页数
  { id: -5001, title: '虚构 · 全部未读（第 1 话读到一半）', cats: [1], chapters: 24, read: 0, partial: true },
  { id: -5002, title: '虚构 · 读了一半', cats: [1, 2], chapters: 40, read: 20 },
  { id: -5003, title: '虚构 · 已全部读完', cats: [2], chapters: 12, read: 12 },
  { id: -5004, title: '虚构 · 1200 话长篇', cats: [], chapters: 1200, read: 300 },
  { id: -5005, title: '虚构 · 零话', cats: [2], chapters: 0, read: 0 },
  { id: -5006, title: '虚构 · 写入失败', cats: [1], chapters: 30, read: 0 },
]
const FAIL_MANGA = -5006
const chapterId = (mangaId: number, i: number) => mangaId * 10_000 - i

/** 只在开发路由挂载；所有请求在本机生成，不连接服务端。左下角列出页面发出的写入类请求 */
export function DevToolsLab() {
  useApplyAppearance()
  const [log, setLog] = useState<string[]>([])
  const [client] = useState(() => {
    let submitted = 0
    // 章节已读状态存在内存里，标完再预演能看到变化；刷新即恢复
    const read = new Map<number, { mangaId: number; isRead: boolean; page: number }>()
    for (const m of READ_MANGAS)
      for (let i = 0; i < m.chapters; i++) read.set(chapterId(m.id, i), { mangaId: m.id, isRead: i < m.read, page: m.partial && i === 0 ? 5 : 0 })
    return new ApolloClient({
      cache: createCache(),
      // 和正式客户端一样挂上请求监视，工具箱里的「请求监视」可以用虚构请求验收
      link: ApolloLink.from([monitorLink(), new ApolloLink((op) => new Observable((observer) => {
        const v = op.variables as Record<string, never>
        if (['FetchSourceManga', 'SetInLibrary', 'LibraryMangas', 'UpdateChapters'].includes(op.operationName ?? '')) {
          // 章节 id 动辄上百个，日志里只记条数和首尾
          const ids = v.ids as number[] | undefined
          const shown = op.operationName === 'UpdateChapters' && ids ? { ...(v as object), ids: `${ids.length} 个（${ids[0]} … ${ids.at(-1)}）` } : v
          const line = `${op.operationName} ${JSON.stringify(shown)}`
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
            case 'Categories':
              observer.next({ data: { categories: { __typename: 'CategoryNodeList', nodes: CATEGORIES } } })
              break
            case 'DevToolsReadTargets': {
              // 只认 readTargetFilter 的两种形状：找未读，或找已读 / 有页码的
              const f = v.filter as { isRead?: { equalTo: boolean } }
              const match = (c: { isRead: boolean; page: number }) => (f.isRead ? c.isRead === f.isRead.equalTo : c.isRead || c.page > 0)
              observer.next({
                data: {
                  mangas: {
                    __typename: 'MangaNodeList',
                    nodes: READ_MANGAS.map((m) => ({
                      __typename: 'MangaType', id: m.id, title: m.title,
                      categories: { __typename: 'CategoryNodeList', nodes: m.cats.map((id) => ({ __typename: 'CategoryType', id })) },
                    })),
                  },
                  chapters: {
                    __typename: 'ChapterNodeList',
                    nodes: [...read].filter(([, c]) => match(c)).map(([id, c]) => ({ __typename: 'ChapterType', id, mangaId: c.mangaId })),
                  },
                },
              })
              break
            }
            case 'UpdateChapters': {
              const ids = v.ids as number[]
              if (ids.some((id) => read.get(id)?.mangaId === FAIL_MANGA)) {
                observer.error(new Error('虚构章节写入失败'))
                return
              }
              const patch = v.patch as { isRead: boolean; lastPageRead?: number }
              for (const id of ids) Object.assign(read.get(id)!, { isRead: patch.isRead }, patch.lastPageRead != null && { page: patch.lastPageRead })
              observer.next({ data: { updateChapters: { __typename: 'UpdateChaptersPayload', chapters: [] } } })
              break
            }
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
      }))]),
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
