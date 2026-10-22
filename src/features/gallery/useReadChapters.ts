import type { ApolloClient } from '@apollo/client'
import { useApolloClient } from '@apollo/client/react'
import { useCallback, useEffect, useState } from 'react'
import { captureUser, resetOnUserContext, StaleSessionError } from '@/api/userContext'
import { afterViewTransition } from './readMorph'
import { reuseReadChapters } from './readChapters'
import { GalleryReadChapters, type ReadChapter } from './queries'

/** 每页取多少话；阅读档案的加载进度也按它估算 */
export const PAGE = 2000

/**
 * 上一次取到的结果，只放在内存里、按客户端（正式 / 演示）区分，换账号时清空。
 * 从作品详情返回阅读档案时先直接用它（不用再等、不重播进场），同时在后台重新取一遍。
 */
let last: { client: ApolloClient; chapters: ReadChapter[] } | null = null
resetOnUserContext(() => {
  last = null
})

/**
 * 分页取完书库里读过的章节（已读或有阅读时间）。几千到上万话，
 * 用 no-cache 只放在内存里，不进 Apollo 缓存和快照。
 * 分享面板已有档案页数据时关闭取数，进度、错误与重试也沿用原页。
 */
export function useReadChapters(enabled = true) {
  const client = useApolloClient()
  const [state, setState] = useState<{ chapters: ReadChapter[] | null; fetched: number; error: unknown }>(() => {
    const cached = last?.client === client ? last.chapters : null
    return { chapters: cached, fetched: cached?.length ?? 0, error: null }
  })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!enabled) return
    let alive = true
    const still = captureUser()
    // 有上一次的结果时先留着显示，取完再换；没有时显示进度
    setState((s) => (s.chapters ? s : { chapters: null, fetched: 0, error: null }))
    void (async () => {
      const all: ReadChapter[] = []
      try {
        // 已读话数正在飞的时候先不取：几千话的结果要解析（演示数据还要在本页现算），会让飞行一顿一顿的
        await afterViewTransition()
        if (!alive) return
        for (let offset = 0; ; offset += PAGE) {
          const { data } = await client.query({ query: GalleryReadChapters, variables: { first: PAGE, offset }, fetchPolicy: 'no-cache' })
          // 取的过程中换了账号：这些是上一个账号的阅读记录，丢掉
          still()
          if (!alive || !data) return
          all.push(...data.chapters.nodes)
          setState((s) => (s.chapters ? s : { chapters: null, fetched: all.length, error: null }))
          if (!data.chapters.pageInfo.hasNextPage || !data.chapters.nodes.length) break
        }
        if (!alive) return
        const chapters = reuseReadChapters(last?.client === client ? last.chapters : null, all)
        last = { client, chapters }
        setState((s) => s.chapters === chapters && s.fetched === chapters.length && s.error == null
          ? s : { chapters, fetched: chapters.length, error: null })
      } catch (error) {
        if (alive && !(error instanceof StaleSessionError)) setState((s) => (s.chapters ? s : { chapters: null, fetched: all.length, error }))
      }
    })()
    return () => {
      alive = false
    }
  }, [client, attempt, enabled])

  const retry = useCallback(() => setAttempt((n) => n + 1), [])
  return { ...state, retry }
}
