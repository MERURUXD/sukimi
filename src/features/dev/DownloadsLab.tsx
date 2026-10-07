import { ApolloClient, ApolloLink, Observable } from '@apollo/client'
import { ApolloProvider } from '@apollo/client/react'
import { useEffect, useState } from 'react'
import { useAuth } from '@/api/auth'
import { createCache } from '@/api/cache'
import { useLive, type DownloadItem } from '@/api/live'
import { ConfirmHost } from '@/components/ui/Confirm'
import { Toaster } from '@/components/ui/toast'
import { useApplyAppearance } from '@/design/settings'
import { PREVIEW_MEMBER } from '@/features/auth/previewUsers'
import { DownloadsPage } from '@/features/downloads/DownloadsPage'

const MANGAS = ['虚构漫画 甲', '虚构漫画 乙：名字比较长用来检查截断', '虚构漫画 丙', '虚构漫画 丁']
const item = (i: number, m: number, n: number): DownloadItem => ({
  __typename: 'DownloadType',
  progress: 0,
  state: 'QUEUED',
  position: i,
  tries: 0,
  chapter: { __typename: 'ChapterType', id: -4000 - i, name: `第 ${n} 话`, chapterNumber: n, mangaId: -5000 - m, pageCount: i % 4 === 0 ? -1 : 24 },
  manga: { __typename: 'MangaType', id: -5000 - m, title: MANGAS[m], thumbnailUrl: '/favicon.svg' },
}) as DownloadItem

/** 只在开发路由挂载：直接改全局的下载状态（这里没有挂订阅），变更请求在本机模拟 */
export function DownloadsLab() {
  useApplyAppearance()
  const [log, setLog] = useState<string[]>([])
  // 切换虚构身份看共用提示：多账号服务端显示，旧版单账号（?legacy）不显示；离开时还原原来的身份。
  // 换身份会清空实时状态，所以用整页刷新切换，不在页面里直接改
  const [shared] = useState(() => !new URLSearchParams(location.search).has('legacy'))
  useEffect(() => {
    const prev = useAuth.getState().user
    useAuth.setState({ user: shared ? PREVIEW_MEMBER : { id: 0, username: '', roles: ['ADMIN'], permissions: [], legacy: true } })
    return () => useAuth.setState({ user: prev })
  }, [shared])
  const [client] = useState(() => {
    const status = () => {
      const s = useLive.getState()
      return { __typename: 'DownloadStatus', state: s.downloader, queue: s.queue.map((d, i) => ({ ...d, position: i })) }
    }
    const setQueue = (q: DownloadItem[]) => useLive.setState({ queue: q.map((d, i) => ({ ...d, position: i })) })
    return new ApolloClient({
      cache: createCache(),
      link: new ApolloLink((op) => new Observable((observer) => {
        const v = op.variables as { ids: number[]; id: number; to: number; reorders: { chapterId: number; to: number }[] }
        setLog((l) => [...l, `${op.operationName} ${JSON.stringify(v)}`])
        const timer = setTimeout(() => {
          const q = [...useLive.getState().queue]
          const move = (id: number, to: number) => {
            const from = q.findIndex((d) => d.chapter.id === id)
            const [d] = q.splice(from, 1)
            q.splice(to, 0, d)
          }
          switch (op.operationName) {
            case 'StartDownloader':
            case 'StopDownloader':
              useLive.setState({ downloader: op.operationName === 'StartDownloader' ? 'STARTED' : 'STOPPED' })
              observer.next({ data: { [op.operationName === 'StartDownloader' ? 'startDownloader' : 'stopDownloader']: { __typename: 'P', downloadStatus: { __typename: 'DownloadStatus', state: useLive.getState().downloader } } } })
              break
            case 'DequeueDownloads':
              setQueue(q.filter((d) => !v.ids.includes(d.chapter.id)))
              observer.next({ data: { dequeueChapterDownloads: { __typename: 'P', downloadStatus: status() } } })
              break
            case 'RequeueDownloads':
              observer.next({ data: { enqueueChapterDownloads: { __typename: 'P', downloadStatus: status() } } })
              break
            case 'ReorderDownload':
              move(v.id, v.to)
              setQueue(q)
              observer.next({ data: { reorderChapterDownload: { __typename: 'P', downloadStatus: status() } } })
              break
            case 'ReorderDownloads':
              for (const r of v.reorders) move(r.chapterId, r.to)
              setQueue(q)
              observer.next({ data: { reorderChapterDownloads: { __typename: 'P', downloadStatus: status() } } })
              break
            case 'ClearDownloads':
              setQueue([])
              observer.next({ data: { clearDownloader: { __typename: 'P', downloadStatus: status() } } })
              break
            default:
              observer.error(new Error('下载验收页不连接服务端'))
              return
          }
          observer.complete()
        }, 300)
        return () => clearTimeout(timer)
      })),
    })
  })

  useEffect(() => {
    const m = [0, 0, 0, 1, 2, 1, 1, 3, 0, 2, 3, 3]
    const queue = m.map((mm, i) => item(i, mm, 10 + i))
    queue[0] = { ...queue[0], state: 'DOWNLOADING', progress: 0.3 }
    queue[6] = { ...queue[6], state: 'ERROR', tries: 3 }
    useLive.setState({ queue, downloader: 'STARTED', connected: true })
    // 模拟进度推送：只改进度不改顺序，拖动中不应被打断
    const t = setInterval(() => {
      const s = useLive.getState()
      if (s.downloader !== 'STARTED') return
      useLive.setState({ queue: s.queue.map((d) => (d.state === 'DOWNLOADING' ? { ...d, progress: (d.progress + 0.05) % 1 } : d)) })
    }, 700)
    return () => {
      clearInterval(t)
      useLive.setState({ queue: [], downloader: 'STOPPED' })
    }
  }, [])

  return (
    <div className="pt-6" data-sfw="">
      <p className="wrap m-0 text-sm text-muted">
        下载队列 · 界面验收（虚构数据，仅开发环境）
        <label className="ml-3 inline-flex items-center gap-1.5">
          <input type="checkbox" checked={shared} onChange={(e) => location.assign(e.target.checked ? location.pathname : '?legacy')} />
          多账号服务端
        </label>
      </p>
      <ApolloProvider client={client}>
        <DownloadsPage />
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
