/*
 * 把几个「打开就要看」的查询结果存进 IndexedDB，刷新页面后先显示上次的数据，同时照常请求新的。
 *
 * - 不持久化整个 Apollo 缓存：章节列表、页面地址这些量大又容易过期，只挑书库和首页。
 * - 快照不写回 Apollo 缓存，页面在网络数据到之前直接用原始快照渲染：
 *   书库有三千多部，写进规范化缓存再读出来要一秒多，比直接用快照慢得多。
 * - 退出登录时清空，避免下一个账号看到上一个账号的书库。
 */
import type { ApolloClient, DocumentNode, OperationVariables, TypedDocumentNode } from '@apollo/client'
import { IN_LIBRARY, RecentReads, RecentUpdates } from '@/features/home/queries'
import { Categories, LibraryMangas } from '@/features/library/queries'
import { LastUpdate, UPDATES_FILTERS, UPDATES_PAGE } from '@/features/updates/queries'
import { useAuth } from './auth'

interface Entry {
  key: string
  query: DocumentNode
  variables?: OperationVariables
}

const entry = <R, V extends OperationVariables>(key: string, query: TypedDocumentNode<R, V>, variables?: V): Entry => ({
  key,
  query,
  variables,
})

/** 改了这些查询的字段就把版本号加一，旧快照直接作废 */
const VERSION = 2
const ENTRIES = [
  entry('library', LibraryMangas),
  entry('categories', Categories),
  entry('recentReads', RecentReads),
  entry('recentUpdates', RecentUpdates, { first: 200, offset: 0, filter: IN_LIBRARY }),
  // 更新页「全部」筛选的第一页（往下加载的后续页也合并在这条查询里，一起保存）
  entry('updates', RecentUpdates, { first: UPDATES_PAGE, offset: 0, filter: UPDATES_FILTERS.all }),
  entry('lastUpdate', LastUpdate),
]

const DB = 'suwayomi-web'
const STORE = 'snapshots'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

let dbPromise: Promise<IDBDatabase> | null = null
const db = () => (dbPromise ??= openDb())

function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return db().then(
    (d) =>
      new Promise<T>((resolve, reject) => {
        const req = run(d.transaction(STORE, mode).objectStore(STORE))
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      }),
  )
}

interface Snapshot {
  v: number
  savedAt: number
  data: unknown
}

/** 启动时读出来的快照，只在网络数据到之前用 */
const snapshots = new Map<string, unknown>()

/**
 * 启动时调用：读出快照，然后开始监听这些查询的变化并延迟保存。
 * 读库失败（隐私模式等）就当没有缓存，不影响使用。
 */
export async function loadSnapshots(client: ApolloClient) {
  await Promise.all(
    ENTRIES.map(async (e) => {
      try {
        const snap = await tx<Snapshot | undefined>('readonly', (s) => s.get(e.key))
        if (snap?.v === VERSION) snapshots.set(e.key, snap.data)
      } catch {
        /* 没有缓存 */
      }
    }),
  )
  for (const e of ENTRIES) watch(client, e)
}

const timers = new Map<string, ReturnType<typeof setTimeout>>()

function watch(client: ApolloClient, e: Entry) {
  client.cache.watch({
    query: e.query,
    variables: e.variables,
    optimistic: false,
    callback: (diff) => {
      if (!diff.complete || useAuth.getState().status !== 'signedIn') return
      const data = diff.result
      clearTimeout(timers.get(e.key))
      // 下载进度等会频繁改动书库数据，攒一会儿再写
      timers.set(
        e.key,
        setTimeout(() => {
          void tx('readwrite', (s) => s.put({ v: VERSION, savedAt: Date.now(), data } satisfies Snapshot, e.key)).catch(() => {})
        }, 3000),
      )
    },
  })
}

export async function clearSnapshots() {
  for (const t of timers.values()) clearTimeout(t)
  timers.clear()
  snapshots.clear()
  await tx('readwrite', (s) => s.clear()).catch(() => {})
}

/** 网络 / 缓存里还没有数据时，退回上次保存的快照 */
export function withSnapshot<R>(key: string, data: R | undefined): R | undefined {
  return data ?? (snapshots.get(key) as R | undefined)
}

export const hasSnapshot = (key: string) => snapshots.has(key)
