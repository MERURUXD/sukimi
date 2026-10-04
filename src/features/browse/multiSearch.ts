import { useApolloClient } from '@apollo/client/react'
import { useEffect, useState } from 'react'
import { FetchSourceManga, type Source, type SourceManga } from './queries'

export type SearchResults = Record<string, { status: 'loading' | 'done' | 'error'; items: SourceManga[] }>

/** 同时最多向 3 个来源发请求，免得一次性把所有来源打满 */
const PARALLEL = 3

/**
 * 在多个来源里搜同一个关键词（发现页的全局搜索、迁移找候选）。
 * memory 按关键词保存结果：从详情页返回时直接恢复，已经有结果的来源不再请求，出错的重试。
 */
export function useMultiSourceSearch(q: string, sources: readonly Source[], memory: Map<string, SearchResults>) {
  const client = useApolloClient()
  const [results, setResults] = useState<SearchResults>(() => memory.get(q) ?? {})

  useEffect(() => {
    if (q) memory.set(q, results)
  }, [q, results, memory])

  useEffect(() => {
    if (!q) return
    let alive = true
    const prev = memory.get(q) ?? {}
    const todo = sources.filter((s) => prev[s.id]?.status !== 'done')
    setResults({ ...prev, ...Object.fromEntries(todo.map((s) => [s.id, { status: 'loading' as const, items: [] }])) })
    const queue = [...todo]
    const worker = async () => {
      for (let s = queue.shift(); s && alive; s = queue.shift()) {
        const id = s.id
        try {
          const { data } = await client.mutate({ mutation: FetchSourceManga, variables: { source: id, type: 'SEARCH', page: 1, query: q } })
          if (alive) setResults((r) => ({ ...r, [id]: { status: 'done', items: data?.fetchSourceManga?.mangas ?? [] } }))
        } catch {
          if (alive) setResults((r) => ({ ...r, [id]: { status: 'error', items: [] } }))
        }
      }
    }
    void Promise.all(Array.from({ length: PARALLEL }, worker))
    return () => {
      alive = false
    }
  }, [q, sources, client, memory])

  return results
}
