import { ApolloClient, ApolloLink, Observable } from '@apollo/client'
import { ApolloProvider } from '@apollo/client/react'
import { useState } from 'react'
import { createCache } from '@/api/cache'
import { ConfirmHost } from '@/components/ui/Confirm'
import { Toaster } from '@/components/ui/toast'
import { useApplyAppearance } from '@/design/settings'
import { HistoryPage } from '@/features/history/HistoryPage'

const NOW = Math.floor(Date.now() / 1000)
/** 虚构的 260 条阅读记录：6 部漫画轮流读，时间每条往前推 50 分钟，跨过十来天，测分页 */
function chapters() {
  return Array.from({ length: 260 }, (_, i) => {
    const m = [0, 0, 1, 2, 0, 3, 4, 5][i % 8]
    return {
      __typename: 'ChapterType',
      id: -2000 - i,
      name: `第 ${100 - (i % 40)} 话`,
      chapterNumber: 100 - (i % 40),
      lastPageRead: i % 3 === 0 ? 11 : 4,
      pageCount: i % 5 === 0 ? -1 : 20,
      isRead: i % 3 !== 0,
      lastReadAt: String(NOW - 120 - i * 3000),
      meta: [],
      manga: {
        __typename: 'MangaType',
        id: -3000 - m,
        title: ['虚构漫画 甲', '虚构漫画 乙：标题稍微长一点用来检查截断的效果', '虚构漫画 丙', '虚构漫画 丁', '虚构漫画 戊', '虚构漫画 己'][m],
        thumbnailUrl: '/favicon.svg',
        source: { __typename: 'SourceType', id: '900', displayName: '测试来源', contentWarning: 'SAFE' },
        categories: { __typename: 'CategoryNodeList', nodes: [] },
      },
    }
  })
}

/** 只在开发路由挂载；所有请求在本机生成，不连接服务端 */
export function HistoryLab() {
  useApplyAppearance()
  const [log, setLog] = useState<string[]>([])
  const [client] = useState(() => {
    const all = chapters()
    return new ApolloClient({
      cache: createCache(),
      link: new ApolloLink((op) => new Observable((observer) => {
        const v = op.variables as { first: number; offset: number; ids: number[]; value: string }
        setLog((l) => [...l, `${op.operationName} ${JSON.stringify(v)}`])
        const timer = setTimeout(() => {
          if (op.operationName === 'History') {
            const nodes = all.slice(v.offset, v.offset + v.first)
            observer.next({ data: { chapters: { __typename: 'ChapterNodeList', totalCount: all.length, pageInfo: { __typename: 'PageInfo', hasNextPage: v.offset + v.first < all.length }, nodes } } })
          } else if (op.operationName === 'HideHistory') {
            observer.next({ data: { setChapterMetas: { __typename: 'SetChapterMetasPayload', metas: v.ids.map((id) => ({ __typename: 'ChapterMetaType', chapterId: id, key: 'x', value: v.value })) } } })
          } else {
            observer.error(new Error('历史验收页不连接服务端'))
            return
          }
          observer.complete()
        }, 400)
        return () => clearTimeout(timer)
      })),
    })
  })

  return (
    <div className="pt-6" data-sfw="">
      <p className="wrap m-0 text-sm text-muted">阅读历史 · 界面验收（虚构数据，仅开发环境）</p>
      <ApolloProvider client={client}>
        <HistoryPage />
      </ApolloProvider>
      <details className="wrap pb-10">
        <summary className="cursor-pointer text-sm font-bold">虚构请求（{log.length} 次）</summary>
        <pre className="overflow-x-auto text-xs text-muted">{log.join('\n')}</pre>
      </details>
      <Toaster />
      <ConfirmHost />
    </div>
  )
}
