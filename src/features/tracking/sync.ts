import type { ApolloClient } from '@apollo/client'
import { UpdateChapters } from '@/api/chapters'
import { captureUser, resetOnUserContext, StaleSessionError } from '@/api/userContext'
import { toastError } from '@/components/ui/toast'
import { MangaChapters } from '@/features/manga/queries'
import { FetchTrack, MangaTracks, TrackedMangaIds, Trackers } from './queries'
import { readProgress } from './tracking'
import { updateTrackQueued } from './useSaveTrack'

async function push(client: ApolloClient, mangaId: number, still: () => void) {
  still()
  const tracks = await client.query({ query: MangaTracks, variables: { id: mangaId }, fetchPolicy: 'cache-first' })
  still()
  // 退出登录或登录过期的网站保留绑定但暂停同步，写了也只会失败、反复提示
  const trackers = (await client.query({ query: Trackers, fetchPolicy: 'cache-first' })).data?.trackers.nodes ?? []
  still()
  const usable = new Set(trackers.filter((t) => t.isLoggedIn && !t.isTokenExpired).map((t) => t.id))
  const records = (tracks.data?.manga.trackRecords.nodes ?? []).filter((r) => usable.has(r.trackerId))
  if (!records.length) return 0
  const chapters = await client.query({ query: MangaChapters, variables: { mangaId }, fetchPolicy: 'cache-first' })
  still()
  const read = readProgress(chapters.data?.chapters.nodes ?? [])
  const behind = records.filter((r) => read > r.lastChapterRead)
  // 这里的进度是开始同步时读到的，排队期间用户可能手动改得更高；
  // forwardOnly 让队列轮到这次写入时再比一次，避免把手动改的 5 话退回 4 话
  // 各网站分别写，一个失败不拖累其他网站；全部结束后再报第一个错误
  const results = await Promise.allSettled(behind.map((r) => updateTrackQueued(client, { recordId: r.id, lastChapterRead: read }, { forwardOnly: true })))
  const failed = results.find((x) => x.status === 'rejected')
  if (failed) throw failed.reason
  return results.filter((x) => x.status === 'fulfilled' && x.value).length
}

// 同一部漫画的同步排队执行：连读两话时，第二次要等第一次写完、看到新进度再比较，
// 否则两个请求同时发出，较旧的 3 话可能后到，把网站上的 4 话改回 3 话
const queue = new Map<number, Promise<number>>()
resetOnUserContext(() => queue.clear())

/**
 * 把本地已读进度推到已绑定的追踪网站，返回更新了几个网站。
 * 不用服务端的 trackProgress：它直接取已读的最大话数，贺图编成「2026 话」时会把进度推到 2026。
 * 这里按 readProgress 跳过异常编号，只往前推；状态（在读 / 读完）由服务端随进度自动调整
 */
export function pushTrackProgress(client: ApolloClient, mangaId: number, still = captureUser()) {
  // still 记下发起时的账号（批量同步传入最初那次的），排队期间换了账号，后面每一步都会中止
  const next = (queue.get(mangaId) ?? Promise.resolve(0)).catch(() => 0).then(() => push(client, mangaId, still))
  queue.set(mangaId, next)
  const done = () => { if (queue.get(mangaId) === next) queue.delete(mangaId) }
  next.then(done, done)
  return next
}

/**
 * 把追踪网站上的进度拉到本地：先刷新各网站的记录，取最高的「读到第几话」，
 * 再把本地话数不超过它的章节全部标为已读，返回新标了几话。
 * 只往已读方向改，不取消已有的已读；编号不是正数的章节（番外、未知话数）不动。
 * 服务端自己不会做这一步：绑定和刷新都只更新追踪记录，不碰章节
 */
export async function pullTrackProgress(client: ApolloClient, mangaId: number, still = captureUser()) {
  still()
  const tracks = await client.query({ query: MangaTracks, variables: { id: mangaId }, fetchPolicy: 'network-only' })
  still()
  const trackers = (await client.query({ query: Trackers, fetchPolicy: 'cache-first' })).data?.trackers.nodes ?? []
  still()
  const usable = new Set(trackers.filter((t) => t.isLoggedIn && !t.isTokenExpired).map((t) => t.id))
  const records = (tracks.data?.manga.trackRecords.nodes ?? []).filter((r) => usable.has(r.trackerId))
  if (!records.length) return 0
  // 先从网站刷新，拿到的才是网站上最新的进度；一个网站失败不拖累其他网站
  const results = await Promise.allSettled(records.map((r) => client.mutate({ mutation: FetchTrack, variables: { recordId: r.id } })))
  still()
  const fresh = results.flatMap((x) => (x.status === 'fulfilled' && x.value.data ? [x.value.data.fetchTrack.trackRecord.lastChapterRead] : []))
  if (!fresh.length) throw (results.find((x) => x.status === 'rejected') as PromiseRejectedResult | undefined)?.reason ?? new Error('刷新追踪记录失败')
  const remote = Math.max(...fresh)
  if (remote <= 0) return 0
  const chapters = await client.query({ query: MangaChapters, variables: { mangaId }, fetchPolicy: 'network-only' })
  still()
  const ids = (chapters.data?.chapters.nodes ?? []).filter((c) => !c.isRead && c.chapterNumber > 0 && c.chapterNumber <= remote).map((c) => c.id)
  if (!ids.length) return 0
  await client.mutate({ mutation: UpdateChapters, variables: { ids, patch: { isRead: true } } })
  return ids.length
}

/**
 * 读完一话、标为已读后自动调用；失败只提示，不打断阅读；换了账号就安静放弃。
 * still：在「标为已读」开始前用 captureUser() 记下，等标记请求回来再同步时仍按发起操作的账号核对
 */
export async function syncTrackProgress(client: ApolloClient, mangaId: number, still = captureUser()) {
  try {
    await pushTrackProgress(client, mangaId, still)
  } catch (e) {
    if (!(e instanceof StaleSessionError)) toastError('追踪进度同步失败', e)
  }
}

/** 更新页、书库批量标为已读后调用：先一次查出哪些漫画绑定了追踪，只同步这些 */
export async function syncTrackProgressMany(client: ApolloClient, mangaIds: readonly number[], still = captureUser()) {
  const ids = [...new Set(mangaIds)]
  if (!ids.length) return
  try {
    still()
    const { data } = await client.query({ query: TrackedMangaIds, variables: { ids }, fetchPolicy: 'network-only' })
    still()
    const tracked = [...new Set(data?.trackRecords.nodes.map((r) => r.mangaId))]
    // 沿用批量开始时的账号检查：漫画是按那个账号挑出来的，中途换了账号就停
    for (const id of tracked) {
      still()
      await pushTrackProgress(client, id, still)
    }
  } catch (e) {
    if (!(e instanceof StaleSessionError)) toastError('追踪进度同步失败', e)
  }
}
