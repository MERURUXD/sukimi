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
  // 结果带着它对应的关键词：改了关键词的那次提交里，state 还是上一个词的结果，
  // 不对上号就不能写进新词名下，否则下面会以为新词已经搜完而一个请求都不发
  const [state, setState] = useState<{ q: string; data: SearchResults }>(() => ({ q, data: memory.get(q) ?? {} }))
  const results = state.q === q ? state.data : (memory.get(q) ?? {})

  useEffect(() => {
    if (q && state.q === q) memory.set(q, state.data)
  }, [q, state, memory])

  useEffect(() => {
    if (!q) return
    let alive = true
    const prev = memory.get(q) ?? {}
    const todo = sources.filter((s) => prev[s.id]?.status !== 'done')
    setState({ q, data: { ...prev, ...Object.fromEntries(todo.map((s) => [s.id, { status: 'loading' as const, items: [] }])) } })
    const put = (id: string, entry: SearchResults[string]) => setState((r) => (r.q === q ? { q, data: { ...r.data, [id]: entry } } : r))
    const queue = [...todo]
    const worker = async () => {
      for (let s = queue.shift(); s && alive; s = queue.shift()) {
        const id = s.id
        try {
          const { data } = await client.mutate({ mutation: FetchSourceManga, variables: { source: id, type: 'SEARCH', page: 1, query: q } })
          if (alive) put(id, { status: 'done', items: data?.fetchSourceManga?.mangas ?? [] })
        } catch {
          if (alive) put(id, { status: 'error', items: [] })
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
