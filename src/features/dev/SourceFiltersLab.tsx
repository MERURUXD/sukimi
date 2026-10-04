import { ApolloClient, ApolloLink, Observable } from '@apollo/client'
import { ApolloProvider } from '@apollo/client/react'
import { useState } from 'react'
import { SourceBrowser } from '@/features/browse/BrowsePage'
import type { SourceFilter } from '@/features/browse/filters'
import type { Source } from '@/features/browse/queries'
import { useApplyAppearance } from '@/design/settings'
import { createCache } from '@/api/cache'

const source: Source = {
  id: 'dev-source-filters',
  name: '界面测试来源',
  displayName: '界面测试来源',
  lang: 'zh',
  iconUrl: '',
  supportsLatest: true,
  contentWarning: 'SAFE',
  homeUrl: null,
}

const filters: SourceFilter[] = [
  { __typename: 'HeaderFilter', name: '选择条件后应用；这里的数据全部为虚构。' },
  { __typename: 'SelectFilter', name: '搜索类型', values: ['全部', '名称', '作者', '汉化组'], selectDefault: 0 },
  { __typename: 'SelectFilter', name: '排行榜', values: ['不查看', '日榜（上升最快）', '周榜（最近7天）', '月榜（最近30天）', '总榜单（即热门排序）'], selectDefault: 0 },
  { __typename: 'TextFilter', name: '作者', textDefault: '' },
  { __typename: 'SelectFilter', name: '状态', values: ['全部', '连载中', '已完结'], selectDefault: 0 },
  { __typename: 'CheckBoxFilter', name: '仅原创', checkBoxDefault: false },
  { __typename: 'SortFilter', name: '排序', values: ['热度', '更新时间', '标题'], sortDefault: { index: 0, ascending: false } },
  { __typename: 'GroupFilter', name: '类型 · 可多选', filters: [
    { __typename: 'CheckBoxFilter', name: '冒险', checkBoxDefault: false },
    { __typename: 'CheckBoxFilter', name: '科幻', checkBoxDefault: false },
    { __typename: 'TriStateFilter', name: '短篇', triStateDefault: 'IGNORE' },
    { __typename: 'GroupFilter', name: '其他条件', filters: [
      { __typename: 'SeparatorFilter', name: '' },
      { __typename: 'TextFilter', name: '标签', textDefault: '' },
      { __typename: 'TriStateFilter', name: '彩色', triStateDefault: 'IGNORE' },
    ] },
  ] },
]

/** 只在开发路由挂载独立客户端；所有响应均在本机生成，不连接真实服务端。 */
export function SourceFiltersLab() {
  useApplyAppearance()
  const [mode, setMode] = useState<'POPULAR' | 'LATEST' | 'SEARCH'>('POPULAR')
  const [requests, setRequests] = useState<{ mode: string; page: number; query?: string; filters?: unknown }[]>([])
  const [failFilters, setFailFilters] = useState(false)
  const [emptyFilters, setEmptyFilters] = useState(false)
  const [options] = useState(() => ({ fail: false, empty: false }))
  const [client] = useState(() => new ApolloClient({
    cache: createCache(),
    link: new ApolloLink((operation) => new Observable((observer) => {
      const timer = setTimeout(() => {
        if (operation.operationName === 'SourceFilters') {
          if (options.fail) {
            observer.error(new Error('虚构的筛选加载失败'))
            return
          }
          observer.next({ data: { source: { __typename: 'SourceType', id: source.id, filters: options.empty ? [] : filters } } })
        } else if (operation.operationName === 'FetchSourceManga') {
          const { type, page, query, filters: changes } = operation.variables
          setRequests((prev) => [...prev, { mode: type, page, query, filters: changes }])
          observer.next({ data: { fetchSourceManga: {
            __typename: 'FetchSourceMangaPayload',
            hasNextPage: page < 2,
            mangas: Array.from({ length: 6 }, (_, i) => ({
              __typename: 'MangaType',
              id: -1000 - (page * 10 + i),
              title: `虚构测试条目 ${page * 10 + i}`,
              thumbnailUrl: '/favicon.svg',
              author: '测试作者',
              inLibrary: false,
            })),
          } } })
        } else {
          observer.error(new Error('测试页不加载漫画详情'))
          return
        }
        observer.complete()
      }, 150)
      return () => clearTimeout(timer)
    })),
  }))

  const toggle = async (kind: 'fail' | 'empty') => {
    options[kind] = !options[kind]
    if (kind === 'fail') setFailFilters(options.fail)
    else setEmptyFilters(options.empty)
    client.cache.evict({ id: `SourceType:${source.id}`, fieldName: 'filters' })
    client.cache.gc()
    await client.refetchQueries({ include: ['SourceFilters'] }).catch(() => {})
  }

  return (
    <div className="wrap py-8" data-sfw="">
      <h1 className="m-0 text-2xl font-bold">来源筛选 · 界面验收</h1>
      <p className="mb-5 text-sm text-muted">虚构数据，不连接真实来源。此页面仅在开发环境存在。</p>
      <div className="mb-7 flex flex-wrap gap-2">
        <button type="button" className="fopt" aria-pressed={failFilters} onClick={() => void toggle('fail')}>模拟筛选加载失败</button>
        <button type="button" className="fopt" aria-pressed={emptyFilters} onClick={() => void toggle('empty')}>模拟没有筛选项</button>
      </div>
      <ApolloProvider client={client}>
        <SourceBrowser source={source} mode={mode} q="" onMode={setMode} />
      </ApolloProvider>
      <details className="mt-8">
        <summary className="cursor-pointer text-sm font-bold">检查发出的虚构请求（{requests.length} 次）</summary>
        <pre className="overflow-x-auto text-xs text-muted">{JSON.stringify(requests, null, 2)}</pre>
      </details>
    </div>
  )
}
