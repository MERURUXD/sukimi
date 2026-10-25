import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { ApolloClient, ApolloLink, Observable } from '@apollo/client'
import { buildSchema, executeSync } from 'graphql'
import { firstValueFrom, filter } from 'rxjs'
import { createCache } from '../src/api/cache.ts'
import { LibraryMangasDocument } from '../src/api/gql/graphql.ts'
import { createDemoData } from '../src/features/demo/data.ts'
import { chapterTotalsFor, invalidateChapterTotals } from '../src/features/gallery/chapterTotals.ts'

const schema = buildSchema(readFileSync(new URL('../src/api/schema.graphql', import.meta.url), 'utf8'))
const ready = (query) => firstValueFrom(query.pipe(filter((r) => !r.loading && !!r.data)))

// 正式文档与缓存规则，全部响应由本地虚构书库生成。
function fixture() {
  const rootValue = createDemoData(Date.UTC(2026, 9, 20))
  const requests = []
  let fail = false
  const client = new ApolloClient({
    cache: createCache(),
    link: new ApolloLink((op) => new Observable((observer) => {
      requests.push(op.operationName)
      const timer = setTimeout(() => {
        if (fail && op.operationName === 'GalleryCounts') observer.error(new Error('虚构请求失败'))
        else {
          observer.next(executeSync({ schema, rootValue, document: op.query, variableValues: op.variables }))
          observer.complete()
        }
      }, 0)
      return () => clearTimeout(timer)
    })),
  })
  return { client, requests, rootValue, store: chapterTotalsFor(client), fail: (v) => { fail = v } }
}

test('取总话数不覆盖书库缓存，不广播书库变更或额外拉取全库', async () => {
  const { client, requests, store } = fixture()
  const watch = client.watchQuery({ query: LibraryMangasDocument })
  const sub = watch.subscribe(() => {})
  try {
    const { data } = await ready(watch)
    const before = client.cache.extract()
    const cached = client.cache.readQuery({ query: LibraryMangasDocument })
    let broadcasts = 0
    const off = client.cache.watch({ query: LibraryMangasDocument, optimistic: false, callback: () => broadcasts++ })
    await store.load(data.mangas.nodes)
    // 等 Apollo 的缓存广播与可能触发的补请求完成。
    await new Promise((resolve) => setTimeout(resolve, 20))
    off()
    assert.deepEqual(requests, ['LibraryMangas', 'GalleryCounts'])
    assert.deepEqual(client.cache.extract(), before)
    assert.equal(client.cache.readQuery({ query: LibraryMangasDocument }), cached)
    assert.equal(broadcasts, 0)
    assert.equal(store.snapshot().totals.get(1), 8)
  } finally { sub.unsubscribe(); client.stop() }
})

test('橱窗、画廊、画布和档案共用总话数；同一书库的并发请求与返回不重取', async () => {
  const { client, requests, store } = fixture()
  try {
    const watch = client.watchQuery({ query: LibraryMangasDocument })
    const { data } = await ready(watch)
    const library = data.mangas.nodes
    await Promise.all([store.load(library), store.load(library)])
    const totals = store.snapshot().totals
    for (let i = 0; i < 3; i++) {
      const page = client.watchQuery({ query: LibraryMangasDocument })
      const next = await ready(page)
      await store.load(next.data.mangas.nodes)
      // 大书库超出 Apollo 结果缓存容量时，同样的列表也会被重新构建。
      await store.load(structuredClone(next.data.mangas.nodes))
    }
    assert.equal(requests.filter((n) => n === 'GalleryCounts').length, 1)
    assert.equal(store.snapshot().totals, totals)
  } finally { client.stop() }
})

test('阅读、新章节和移出书库刷新统计，未变的列表仍可手动刷新', async () => {
  const { client, requests, rootValue, store } = fixture()
  const library = async () => (await client.query({ query: LibraryMangasDocument, fetchPolicy: 'network-only' })).data.mangas.nodes
  try {
    let all = await library()
    await store.load(all)
    const before = store.snapshot().totals
    const unread = all.find((m) => m.id === 1).unreadCount
    rootValue.updateChapter({ input: { id: 103, patch: { isRead: true } } })
    all = await library()
    await store.load(all)
    assert.equal(store.snapshot().totals, before, '仅阅读变化不重新生成总话数映射')
    assert.equal(all.find((m) => m.id === 1).unreadCount, unread - 1)
    assert.equal(requests.filter((n) => n === 'GalleryCounts').length, 2)
    // 输入完全不变时，只有 force 能触发这次请求。
    await store.load(all, true)
    assert.equal(requests.filter((n) => n === 'GalleryCounts').length, 3)
    assert.equal(store.snapshot().totals, before)
    const manga = rootValue.manga({ id: 1 })
    manga.chapters.nodes.push({ ...manga.chapters.nodes.at(-1), id: 109 })
    await store.load(await library())
    assert.equal(store.snapshot().totals.get(1), 9, '新章节到达后不保留旧总数')
    manga.inLibrary = false
    await store.load(await library())
    assert.equal(store.snapshot().totals.has(1), false, '移出书库后去掉旧条目')
    assert.equal(requests.filter((n) => n === 'GalleryCounts').length, 5)
  } finally { client.stop() }
})

test('整轮更新完成时，即使书库列表字段未变也刷新总话数', async () => {
  const { client, requests, rootValue, store } = fixture()
  try {
    const { data } = await client.query({ query: LibraryMangasDocument })
    const library = data.mangas.nodes
    await store.load(library)
    const manga = rootValue.manga({ id: 1 })
    manga.chapters.nodes.splice(0, 1)
    invalidateChapterTotals(client)
    assert.equal(store.snapshot().totals.get(1), 8, '刷新期间沿用已有数字')
    await chapterTotalsFor(client).load(library)
    assert.equal(store.snapshot().totals.get(1), 7)
    assert.equal(requests.filter((n) => n === 'GalleryCounts').length, 2)
  } finally { client.stop() }
})

test('失败能重试；不同客户端与身份重置后的总话数不串用', async () => {
  const a = fixture(), b = fixture()
  try {
    const { data } = await a.client.query({ query: LibraryMangasDocument })
    const library = data.mangas.nodes
    a.fail(true)
    await a.store.load(library)
    assert.equal(a.store.snapshot().totals, null)
    assert.ok(a.store.snapshot().error)
    a.fail(false)
    await a.store.load(library, true)
    assert.equal(a.store.snapshot().totals.get(1), 8)
    assert.equal(a.store.snapshot().error, undefined)
    assert.equal(b.store.snapshot().totals, null)
    a.store.reset()
    assert.equal(a.store.snapshot().totals, null)
    await a.store.load(library)
    assert.equal(a.requests.filter((n) => n === 'GalleryCounts').length, 3)
  } finally { a.client.stop(); b.client.stop() }
})

test('身份重置后，之前未完成的总话数请求不能回填缓存', async () => {
  const { client, store } = fixture()
  try {
    const pending = store.load([])
    store.reset()
    await pending
    assert.equal(store.snapshot().totals, null)
    assert.equal(store.snapshot().error, undefined)
  } finally { client.stop() }
})
