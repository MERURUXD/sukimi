import type { ApolloClient } from '@apollo/client'
import { toastError } from '@/components/ui/toast'
import { MangaChapters } from '@/features/manga/queries'
import { MangaTracks, UpdateTrack } from './queries'
import { readProgress } from './tracking'

/**
 * 把本地已读进度推到已绑定的追踪网站，返回更新了几个网站。
 * 不用服务端的 trackProgress：它直接取已读的最大话数，贺图编成「2026 话」时会把进度推到 2026。
 * 这里按 readProgress 跳过异常编号，只往前推；状态（在读 / 读完）由服务端随进度自动调整
 */
export async function pushTrackProgress(client: ApolloClient, mangaId: number) {
  const tracks = await client.query({ query: MangaTracks, variables: { id: mangaId }, fetchPolicy: 'cache-first' })
  const records = tracks.data?.manga.trackRecords.nodes ?? []
  if (!records.length) return 0
  const chapters = await client.query({ query: MangaChapters, variables: { mangaId }, fetchPolicy: 'cache-first' })
  const read = readProgress(chapters.data?.chapters.nodes ?? [])
  const behind = records.filter((r) => read > r.lastChapterRead)
  // 返回的记录带 id，直接改缓存，详情页的追踪信息跟着刷新
  await Promise.all(behind.map((r) => client.mutate({ mutation: UpdateTrack, variables: { input: { recordId: r.id, lastChapterRead: read } } })))
  return behind.length
}

/** 读完一话、标为已读后自动调用；失败只提示，不打断阅读 */
export async function syncTrackProgress(client: ApolloClient, mangaId: number) {
  try {
    await pushTrackProgress(client, mangaId)
  } catch (e) {
    toastError('追踪进度同步失败', e)
  }
}
