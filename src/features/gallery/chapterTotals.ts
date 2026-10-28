import type { ApolloClient } from '@apollo/client'
import { GalleryCountsDocument } from '../../api/gql/graphql.ts'
import type { LibraryManga } from '../library/queries'
import { t } from '../../i18n/core.ts'

type Library = readonly LibraryManga[]
interface Snapshot {
  totals: ReadonlyMap<number, number> | null
  error: unknown
  generation: number
}

/** 大书库的 Apollo 结果可能被淘汰后重建，不能只用数组引用判断是否需要刷新。 */
function sameLibrary(a: Library, b: Library) {
  if (a === b) return true
  if (a.length !== b.length) return false
  return a.every((m, i) => {
    const n = b[i]
    return m === n || (m.id === n.id && m.inLibraryAt === n.inLibraryAt && m.unreadCount === n.unreadCount
      && m.latestFetchedChapter?.id === n.latestFetchedChapter?.id && m.latestFetchedChapter?.fetchedAt === n.latestFetchedChapter?.fetchedAt
      && m.latestUploadedChapter?.id === n.latestUploadedChapter?.id && m.latestUploadedChapter?.uploadDate === n.latestUploadedChapter?.uploadDate
      && m.latestReadChapter?.id === n.latestReadChapter?.id
      && m.lastReadChapter?.id === n.lastReadChapter?.id && m.lastReadChapter?.lastReadAt === n.lastReadChapter?.lastReadAt)
  })
}

/** 总话数单独留在内存里，供首页橱窗与画廊各页共用。 */
export function createChapterTotalsStore(client: ApolloClient) {
  let state: Snapshot = { totals: null, error: undefined, generation: 0 }
  let loadedFor: Library | undefined
  let pending: { library: Library; promise: Promise<void> } | undefined
  const listeners = new Set<() => void>()
  const emit = () => listeners.forEach((fn) => fn())
  const invalidate = (clear: boolean) => {
    loadedFor = undefined
    pending = undefined
    state = { totals: clear ? null : state.totals, error: undefined, generation: state.generation + 1 }
    emit()
  }

  return {
    snapshot: () => state,
    subscribe: (fn: () => void) => {
      listeners.add(fn)
      return () => { listeners.delete(fn) }
    },
    reset: () => invalidate(true),
    invalidate: () => invalidate(false),
    load: (library: Library, force = false): Promise<void> => {
      if (pending && sameLibrary(pending.library, library)) return pending.promise
      if (!force && loadedFor && state.totals && sameLibrary(loadedFor, library)) {
        loadedFor = library
        return Promise.resolve()
      }
      const request = { library, promise: Promise.resolve() }
      pending = request
      request.promise = (async () => {
        try {
          const { data } = await client.query({
            query: GalleryCountsDocument,
            // 不写规范化缓存：否则会覆盖书库列表，并让几千部作品的查询重新 diff。
            fetchPolicy: 'no-cache',
            // 书库或账号已换时，不能复用上一份尚未返回的请求。
            context: { queryDeduplication: false },
          })
          if (pending !== request) return
          if (!data) throw new Error(t('gallery.totalsFailed'))
          const next = new Map(data.mangas.nodes.map((m) => [m.id, m.chapters.totalCount]))
          const prev = state.totals
          const totals = prev && prev.size === next.size && [...next].every(([id, n]) => prev.get(id) === n) ? prev : next
          loadedFor = library
          if (totals !== prev || state.error) {
            state = { ...state, totals, error: undefined }
            emit()
          }
        } catch (error) {
          if (pending === request) {
            state = { ...state, error }
            emit()
          }
        } finally {
          if (pending === request) pending = undefined
        }
      })()
      return request.promise
    },
  }
}

const stores = new WeakMap<ApolloClient, ReturnType<typeof createChapterTotalsStore>>()
export function chapterTotalsFor(client: ApolloClient) {
  let store = stores.get(client)
  if (!store) {
    store = createChapterTotalsStore(client)
    stores.set(client, store)
  }
  return store
}

/** 整轮更新可能只删掉旧章节，书库列表字段没变时也要重新计数。 */
export function invalidateChapterTotals(client: ApolloClient) {
  stores.get(client)?.invalidate()
}
