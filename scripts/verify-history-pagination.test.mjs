import assert from 'node:assert/strict'
import test from 'node:test'
import { ApolloClient, ApolloLink, Observable, gql } from '@apollo/client'
import { firstValueFrom, filter } from 'rxjs'
import { createCache } from '../src/api/cache.ts'
import { HistoryDocument } from '../src/api/gql/graphql.ts'
import { HISTORY_PAGE, historyVariables } from '../src/features/history/pagination.ts'

// 虚构响应走正式查询、Apollo 缓存和 fetchMore；离开后重新订阅，模拟路由卸载与返回。
function fixture(total = 260) {
  const all = Array.from({ length: total }, (_, i) => ({
    __typename: 'ChapterType', id: i + 1, name: `测试章节 ${i + 1}`, chapterNumber: i + 1,
    lastPageRead: 3, pageCount: 20, isRead: false, lastReadAt: String(100000 - i), meta: [],
    manga: { __typename: 'MangaType', id: i % 6 + 1, title: `虚构漫画 ${i % 6 + 1}`, thumbnailUrl: '/favicon.svg', source: null },
  }))
  const requests = []
  const client = new ApolloClient({
    cache: createCache(),
    link: new ApolloLink(op => new Observable(observer => {
      requests.push({ ...op.variables })
      const timer = setTimeout(() => {
        const { first, offset } = op.variables
        observer.next({ data: { chapters: {
          __typename: 'ChapterNodeList', totalCount: all.length,
          pageInfo: { __typename: 'PageInfo', hasNextPage: offset + first < all.length },
          nodes: all.slice(offset, offset + first),
        } } })
        observer.complete()
      }, 5)
      return () => clearTimeout(timer)
    })),
  })
  const watch = () => client.watchQuery({
    query: HistoryDocument, variables: historyVariables(client.cache),
    fetchPolicy: 'cache-and-network', notifyOnNetworkStatusChange: true,
  })
  return { client, all, requests, watch }
}

const ready = query => firstValueFrom(query.pipe(filter(result => !result.loading)))
async function more(query, offset) {
  const result = await query.fetchMore({
    variables: { first: HISTORY_PAGE, offset },
    updateQuery: (prev, { fetchMoreResult }) => ({
      chapters: { ...fetchMoreResult.chapters, nodes: [...prev.chapters.nodes, ...fetchMoreResult.chapters.nodes] },
    }),
  })
  await firstValueFrom(query.pipe(filter(value => !value.loading && value.data?.chapters.nodes.length === offset + result.data.chapters.nodes.length)))
}

test('历史分页返回：首帧和刷新响应都保留已加载范围，继续分页仍每次一百条', async () => {
  const { client, all, requests, watch } = fixture()
  const initial = watch()
  const subscription = initial.subscribe(() => {})
  try {
    await ready(initial)
    await more(initial, 100)
    assert.equal(initial.getCurrentResult().data.chapters.nodes.length, 200)
    subscription.unsubscribe()

    // 离开时又读了较早的一话：返回仍应刷新顺序，而不是只依赖旧缓存。
    const latest = all.pop()
    latest.lastReadAt = '200000'
    all.unshift(latest)
    const returned = watch()
    const lengths = []
    const back = returned.subscribe(result => lengths.push(result.data?.chapters.nodes.length ?? 0))
    try {
      assert.equal(returned.getCurrentResult().data.chapters.nodes.length, 200, '首帧必须有完整缓存')
      const refreshed = await ready(returned)
      assert.equal(refreshed.data.chapters.nodes[0].id, latest.id, '仍刷新最新阅读记录')
      assert.ok(lengths.every(length => length === 200), `返回期间列表被截短：${lengths}`)
      assert.deepEqual(requests.at(-1), { first: 200, offset: 0 })
      await more(returned, 200)
      assert.deepEqual(requests.at(-1), { first: 100, offset: 200 })
      const result = returned.getCurrentResult().data.chapters
      assert.equal(result.nodes.length, 260)
      assert.equal(new Set(result.nodes.map(c => c.id)).size, 260)
      assert.equal(result.pageInfo.hasNextPage, false)
    } finally { back.unsubscribe() }
  } finally { subscription.unsubscribe(); client.stop() }
})

test('历史缓存独立于其他章节查询，清空后不沿用上一会话的分页范围', async () => {
  const { client, watch } = fixture(160)
  const query = watch()
  const subscription = query.subscribe(() => {})
  try {
    await ready(query)
    await more(query, 100)
    const other = gql`query OtherChapters { chapters(first: 1, offset: 0) { nodes { id } } }`
    client.cache.writeQuery({ query: other, data: { chapters: { __typename: 'ChapterNodeList', nodes: [{ __typename: 'ChapterType', id: 999 }] } } })
    assert.deepEqual(historyVariables(client.cache), { first: 160, offset: 0 })
    assert.equal(client.cache.readQuery({ query: other }).chapters.nodes[0].id, 999)
    subscription.unsubscribe()
    await client.clearStore()
    assert.deepEqual(historyVariables(client.cache), { first: 100, offset: 0 })
  } finally { subscription.unsubscribe(); client.stop() }
})
