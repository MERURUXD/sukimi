/*
 * 服务端实时状态：下载队列、书库更新进度。
 * 登录后全局订阅一次（<LiveStatus /> 挂在登录守卫里），各页面从这里读，不再各自轮询。
 */
import type { ApolloClient } from '@apollo/client'
import { useEffect } from 'react'
import { create } from 'zustand'
import { useApolloClient } from '@apollo/client/react'
import { useAuth } from './auth'
import { contextGeneration } from './userContext'
import { markCompletedDownloads } from './downloadCache'
import { graphql } from './gql'
import type { DownloadItemFragment } from './gql/graphql'
import { wsClient } from './client'

graphql(`
  fragment DownloadItem on DownloadType {
    progress
    state
    position
    tries
    chapter {
      id
      name
      chapterNumber
      mangaId
      pageCount
    }
    manga {
      id
      title
      thumbnailUrl
    }
  }
`)

const DownloadsChanged = graphql(`
  subscription DownloadsChanged {
    downloadStatusChanged(input: { maxUpdates: 50 }) {
      state
      omittedUpdates
      initial {
        ...DownloadItem
      }
      updates {
        type
        download {
          ...DownloadItem
        }
      }
    }
  }
`)

const DownloadsSnapshot = graphql(`
  query DownloadsSnapshot {
    downloadStatus {
      state
      queue {
        ...DownloadItem
      }
    }
  }
`)

const UpdaterChanged = graphql(`
  subscription UpdaterChanged {
    libraryUpdateStatusChanged(input: { maxUpdates: 1 }) {
      omittedUpdates
      jobsInfo {
        isRunning
        finishedJobs
        totalJobs
      }
    }
  }
`)

export type DownloadItem = DownloadItemFragment

interface LiveState {
  connected: boolean
  downloader: 'STARTED' | 'STOPPED'
  /** 按队列顺序 */
  queue: DownloadItem[]
  updater: { isRunning: boolean; finished: number; total: number }
}

export const useLive = create<LiveState>(() => ({
  connected: false,
  downloader: 'STOPPED',
  queue: [],
  updater: { isRunning: false, finished: 0, total: 0 },
}))

// 退出登录或换账号时清空，下载队列、更新进度不留给下一个用户
useAuth.subscribe((s, prev) => {
  if (s.user?.id !== prev.user?.id) useLive.setState(useLive.getInitialState())
})

const sortQueue = (q: DownloadItem[]) => [...q].sort((a, b) => a.position - b.position)

/** 下载相关变更返回的最新状态，直接写回（订阅推送可能晚一点到） */
export function setDownloadStatus(s: { state: 'STARTED' | 'STOPPED'; queue: DownloadItem[] } | undefined) {
  if (s) useLive.setState({ downloader: s.state, queue: sortQueue(s.queue) })
}

function applyDownloads(client: ApolloClient, msg: { type: string; download: DownloadItem }[]) {
  const map = new Map(useLive.getState().queue.map((d) => [d.chapter.id, d]))
  const finished: DownloadItem[] = []
  for (const { type, download: d } of msg) {
    if (type === 'DEQUEUED') map.delete(d.chapter.id)
    else if (type === 'FINISHED') {
      map.delete(d.chapter.id)
      finished.push(d)
    } else map.set(d.chapter.id, d)
  }
  markCompletedDownloads(client.cache, finished)
  useLive.setState({ queue: sortQueue([...map.values()]) })
}

async function resyncDownloads(client: ApolloClient) {
  // 这份快照只给 useLive 用，不进 Apollo 缓存；请求期间换了账号，返回的队列属于上一个账号，丢弃
  const gen = contextGeneration()
  const { data } = await client.query({ query: DownloadsSnapshot, fetchPolicy: 'no-cache' })
  if (data && contextGeneration() === gen) useLive.setState({ queue: sortQueue(data.downloadStatus.queue), downloader: data.downloadStatus.state })
}

/** 挂在登录后的页面外壳里，负责订阅；断线自动重连（graphql-ws 内置） */
export function LiveStatus() {
  const client = useApolloClient()

  useEffect(() => {
    const offOpen = wsClient.on('connected', () => useLive.setState({ connected: true }))
    const offClose = wsClient.on('closed', () => useLive.setState({ connected: false }))
    let retry: ReturnType<typeof setTimeout>

    const subscribe = () => {
      const subs = [
        client.subscribe({ query: DownloadsChanged }).subscribe({
          next: ({ data }) => {
            const s = data?.downloadStatusChanged
            if (!s) return
            useLive.setState({ downloader: s.state })
            if (s.initial) useLive.setState({ queue: sortQueue(s.initial) })
            else applyDownloads(client, s.updates)
            if (s.omittedUpdates) void resyncDownloads(client)
          },
          error: onError,
        }),
        client.subscribe({ query: UpdaterChanged }).subscribe({
          next: ({ data }) => {
            const j = data?.libraryUpdateStatusChanged.jobsInfo
            if (!j) return
            const was = useLive.getState().updater.isRunning
            useLive.setState({ updater: { isRunning: j.isRunning, finished: j.finishedJobs, total: j.totalJobs } })
            // 一轮更新结束：刷新书库、更新列表等正在显示的查询
            if (was && !j.isRunning) void client.refetchQueries({ include: 'active' })
          },
          error: onError,
        }),
      ]
      return () => subs.forEach((s) => s.unsubscribe())
    }

    // 连接建立时令牌失效等原因被拒：断开重连（重连时会带上新令牌）
    let unsubscribe = subscribe()
    function onError() {
      clearTimeout(retry)
      retry = setTimeout(() => {
        unsubscribe()
        wsClient.terminate()
        unsubscribe = subscribe()
      }, 3000)
    }

    return () => {
      clearTimeout(retry)
      unsubscribe()
      offOpen()
      offClose()
    }
  }, [client])

  return null
}

/* 下载器开关 */
export const StartDownloader = graphql(`
  mutation StartDownloader {
    startDownloader(input: {}) {
      downloadStatus {
        state
      }
    }
  }
`)

export const StopDownloader = graphql(`
  mutation StopDownloader {
    stopDownloader(input: {}) {
      downloadStatus {
        state
      }
    }
  }
`)
