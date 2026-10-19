import type { ApolloClient } from '@apollo/client'
import { StaleSessionError } from '@/api/userContext'
import { planTrackCopy } from '@/features/manga/migrate'
import { MangaTracks, Trackers, type Tracker } from './queries'
import { bindRemote } from './bindRemote'

const usableIds = (trackers: readonly Tracker[]) => new Set(trackers.filter((t) => t.isLoggedIn && !t.isTokenExpired).map((t) => t.id))

/** 换源时可以带走的追踪记录（不含新漫画已有绑定的网站）；target 为 null 时只看旧漫画 */
export async function trackCopyPlan(client: ApolloClient, fromId: number, targetId: number | null) {
  const [from, trackers] = await Promise.all([
    client.query({ query: MangaTracks, variables: { id: fromId }, fetchPolicy: 'cache-first' }),
    client.query({ query: Trackers, fetchPolicy: 'cache-first' }),
  ])
  const existing = targetId == null ? [] : (await client.query({ query: MangaTracks, variables: { id: targetId }, fetchPolicy: 'network-only' })).data?.manga.trackRecords.nodes ?? []
  const nodes = trackers.data?.trackers.nodes ?? []
  const records = planTrackCopy(from.data?.manga.trackRecords.nodes ?? [], existing, usableIds(nodes))
  return { records, trackers: nodes }
}

/**
 * 把旧漫画绑定的追踪条目绑到新漫画上，返回成功绑定的网站数和失败的网站名。
 * 只绑定、不复制进度：新漫画的已读进度由迁移本身决定，之后的同步会把它推上去。
 * 一个网站失败不拖累其他网站；旧漫画上的记录原样保留，也方便失败后手动重绑
 */
export async function copyTracks(client: ApolloClient, fromId: number, targetId: number, still: () => void) {
  still()
  const { records, trackers } = await trackCopyPlan(client, fromId, targetId)
  still()
  const failed: string[] = []
  let bound = 0
  for (const r of records) {
    const t = trackers.find((x) => x.id === r.trackerId)
    try {
      await bindRemote(client, { mangaId: targetId, trackerId: r.trackerId, remoteId: r.remoteId, keywords: [r.title], isPrivate: t?.supportsPrivateTracking ? r.private : null }, still)
      bound++
    } catch (e) {
      // 中途换了账号要整体中止，不能当成单个网站失败
      if (e instanceof StaleSessionError) throw e
      failed.push(t?.name ?? String(r.trackerId))
    }
  }
  // 绑定列表挂在漫画上，新记录不在已缓存的列表里；之后的进度同步直接读这份缓存
  if (bound) await client.query({ query: MangaTracks, variables: { id: targetId }, fetchPolicy: 'network-only' })
  return { bound, failed }
}
