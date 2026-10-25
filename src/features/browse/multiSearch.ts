import { useApolloClient } from '@apollo/client/react'
import { useCallback, useEffect, useState } from 'react'
import { FetchSourceMangaDocument } from '../../api/gql/graphql.ts'
import type { Source, SourceManga } from './queries'

export type SearchResults = Record<string, { status: 'loading' | 'done' | 'error'; items: SourceManga[] }>

/** 全局搜索只搜在线漫画源（排除 id 为 '0' 的本地源） */
export function onlineSources<T extends { id: string }>(sources: readonly T[]): T[] {
  return sources.filter((s) => s.id !== '0')
}

/** 统计多源搜索进度：区分已完成（成功或失败）、成功与失败数量 */
export function summarizeMultiSearch(sources: readonly { id: string }[], results: SearchResults) {
  let done = 0
  let succeeded = 0
  let failed = 0
  for (const s of sources) {
    const st = results[s.id]?.status
    if (st === 'done') {
      done++
      succeeded++
    } else if (st === 'error') {
      done++
      failed++
    }
  }
  return { total: sources.length, done, succeeded, failed, loading: sources.length - done }
}

/**
 * 挑出本次需要请求的来源：
 * - 常规搜索或「重试失败来源」：跳过已经成功（status === 'done'）的来源；
 * - 单源重试（传入 targetIds）：重跑指定的来源，以及因上一轮中断仍处于 loading 的来源。
 */
export function sourcesToFetch<T extends { id: string }>(sources: readonly T[], prev: SearchResults, targetIds?: readonly string[]): T[] {
  if (targetIds && targetIds.length > 0) {
    const set = new Set(targetIds)
    return sources.filter((s) => set.has(s.id) || prev[s.id]?.status === 'loading')
  }
  return sources.filter((s) => prev[s.id]?.status !== 'done')
}

/** 同时最多向 3 个来源发请求，免得一次性把所有来源打满 */
const PARALLEL = 3

/**
 * 在多个来源里搜同一个关键词（发现页的全局搜索、迁移找候选）。
 * memory 按关键词保存结果：从详情页返回时直接恢复，已经有结果的来源不再请求，出错的可单独或批量重试。
 */
export function useMultiSourceSearch(q: string, sources: readonly Source[], memory: Map<string, SearchResults>) {
  const client = useApolloClient()
  // 结果带着它对应的关键词：改了关键词的那次提交里，state 还是上一个词的结果，
  // 不对上号就不能写进新词名下，否则下面会以为新词已经搜完而一个请求都不发
  const [state, setState] = useState<{ q: string; data: SearchResults }>(() => ({ q, data: memory.get(q) ?? {} }))
  const [retryReq, setRetryReq] = useState<{ q: string; tick: number; ids?: readonly string[] }>({ q: '', tick: 0 })
  const results = state.q === q ? state.data : (memory.get(q) ?? {})

  useEffect(() => {
    if (q && state.q === q) memory.set(q, state.data)
  }, [q, state, memory])

  useEffect(() => {
    if (!q) return
    let alive = true
    const prev = memory.get(q) ?? {}
    const targetIds = retryReq.q === q ? retryReq.ids : undefined
    const todo = sourcesToFetch(sources, prev, targetIds)
    if (todo.length === 0) {
      setState({ q, data: prev })
      return
    }
    const nextData: SearchResults = { ...prev, ...Object.fromEntries(todo.map((s) => [s.id, { status: 'loading' as const, items: [] }])) }
    memory.set(q, nextData)
    setState({ q, data: nextData })
    const put = (id: string, entry: SearchResults[string]) =>
      setState((r) => {
        if (r.q !== q) return r
        const data = { ...r.data, [id]: entry }
        memory.set(q, data)
        return { q, data }
      })
    const queue = [...todo]
    const worker = async () => {
      for (let s = queue.shift(); s && alive; s = queue.shift()) {
        const id = s.id
        try {
          const { data } = await client.mutate({ mutation: FetchSourceMangaDocument, variables: { source: id, type: 'SEARCH', page: 1, query: q } })
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
  }, [q, sources, client, memory, retryReq])

  const retry = useCallback((ids?: readonly string[]) => {
    setRetryReq((prev) => ({ q, tick: prev.tick + 1, ids }))
  }, [q])

  return { results, retry }
}
