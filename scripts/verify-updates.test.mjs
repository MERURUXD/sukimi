import test from 'node:test'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { groupByManga, groupRank, sortGroups } from '../src/features/updates/group.ts'
import { ApolloClient, ApolloLink, Observable } from '@apollo/client'
import { firstValueFrom, filter } from 'rxjs'
import { createCache } from '../src/api/cache.ts'
import { UpdatesFeedAllDocument, UpdatesFeedUnreadDocument } from '../src/api/gql/graphql.ts'
import { UPDATES_PAGE, updatesVariables } from '../src/features/updates/pagination.ts'
import { isFreshUpdate } from '../src/features/updates/visible.ts'

// 虚构章节，只带分组用到的字段
const ch = (id, mangaId) => ({ id, mangaId })
const ids = (groups) => groups.map((g) => g.rows.map((r) => r.id))

test('同一部漫画的多话合成一组，组内保持原顺序', () => {
  const groups = groupByManga([ch(3, 1), ch(2, 1), ch(1, 1)], '今天')
  assert.equal(groups.length, 1)
  assert.deepEqual(ids(groups), [[3, 2, 1]])
})

test('不同漫画交错出现时也合到第一次出现的位置', () => {
  const groups = groupByManga([ch(1, 1), ch(2, 2), ch(3, 1), ch(4, 3), ch(5, 2)], '今天')
  assert.deepEqual(groups.map((g) => g.mangaId), [1, 2, 3])
  assert.deepEqual(ids(groups), [[1, 3], [2, 5], [4]])
})

test('单话保持一组一行，空列表没有分组', () => {
  assert.deepEqual(ids(groupByManga([ch(1, 1), ch(2, 2)], '昨天')), [[1], [2]])
  assert.deepEqual(groupByManga([], '昨天'), [])
})

test('组的 key 带日期，不同日期的同一部漫画互不相干', () => {
  const [a] = groupByManga([ch(1, 7)], '今天')
  const [b] = groupByManga([ch(2, 7)], '昨天')
  assert.notEqual(a.key, b.key)
})

test('一天里：没读完的特别关心在前，其次没读完的，读完的放最后，同档保持原顺序', () => {
  const row = (id, mangaId, isRead) => ({ id, mangaId, isRead })
  const groups = groupByManga([row(1, 1, true), row(2, 2, false), row(3, 3, false), row(4, 4, true), row(5, 5, false), row(6, 3, true)], '今天')
  const fav = new Set([5, 4])
  const sorted = sortGroups(groups, (g) => groupRank(g, fav.has(g.mangaId)))
  assert.deepEqual(sorted.map((g) => g.mangaId), [5, 2, 3, 1, 4], '读完的特别关心不提前')
  assert.deepEqual(groups.map((g) => g.mangaId), [1, 2, 3, 4, 5], '不修改输入')
})

test('多话的组里有一话没读就算没读完', () => {
  const [g] = groupByManga([{ id: 1, mangaId: 1, isRead: true }, { id: 2, mangaId: 1, isRead: false }], '今天')
  assert.equal(groupRank(g, false), 1)
  assert.equal(groupRank(g, true), 0)
  const [done] = groupByManga([{ id: 3, mangaId: 2, isRead: true }], '今天')
  assert.equal(groupRank(done, true), 2)
})

const ALL = { inLibrary: { equalTo: true } }
const UNREAD = { inLibrary: { equalTo: true }, isRead: { equalTo: false } }

// 虚构响应走正式查询、Apollo 缓存和 fetchMore；离开后重新订阅，模拟路由卸载与返回。
function fixture(total = 200) {
  const all = Array.from({ length: total }, (_, i) => ({
    __typename: 'ChapterType', id: i + 1, name: `测试章节 ${i + 1}`, chapterNumber: i + 1, sourceOrder: i + 1,
    fetchedAt: String(1_000_000 - i * 60), uploadDate: '0', isRead: false, isDownloaded: false, isBookmarked: false,
    lastPageRead: 0, pageCount: 10, mangaId: i % 6 + 1,
    manga: { __typename: 'MangaType', id: i % 6 + 1, title: `虚构漫画 ${i % 6 + 1}`, thumbnailUrl: '/favicon.svg', inLibraryAt: '1', source: null, categories: { __typename: 'CategoryNodeList', nodes: [] } },
  }))
  const requests = []
  const client = new ApolloClient({
    cache: createCache(),
    link: new ApolloLink(op => new Observable(observer => {
      requests.push({ first: op.variables.first, offset: op.variables.offset })
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
  const watch = (query = UpdatesFeedAllDocument, f = ALL) => client.watchQuery({
    query, variables: updatesVariables(client.cache, query, f),
    fetchPolicy: 'cache-and-network', notifyOnNetworkStatusChange: true,
  })
  return { client, all, requests, watch }
}

const ready = query => firstValueFrom(query.pipe(filter(result => !result.loading)))
async function more(query, offset) {
  const result = await query.fetchMore({
    variables: { first: UPDATES_PAGE, offset },
    updateQuery: (prev, { fetchMoreResult }) => ({
      chapters: { ...fetchMoreResult.chapters, nodes: [...prev.chapters.nodes, ...fetchMoreResult.chapters.nodes] },
    }),
  })
  await firstValueFrom(query.pipe(filter(value => !value.loading && value.data?.chapters.nodes.length === offset + result.data.chapters.nodes.length)))
}

test('更新页分页返回：首帧和刷新响应都保留已加载范围，继续分页仍每次一页', async () => {
  const { client, requests, watch } = fixture()
  const initial = watch()
  const subscription = initial.subscribe(() => {})
  try {
    await ready(initial)
    await more(initial, UPDATES_PAGE)
    await more(initial, UPDATES_PAGE * 2)
    assert.equal(initial.getCurrentResult().data.chapters.nodes.length, 180)
    subscription.unsubscribe()

    const returned = watch()
    const lengths = []
    const back = returned.subscribe(result => lengths.push(result.data?.chapters.nodes.length ?? 0))
    try {
      assert.equal(returned.getCurrentResult().data.chapters.nodes.length, 180, '首帧必须有完整缓存')
      await ready(returned)
      assert.ok(lengths.every(length => length === 180), `返回期间列表被截短：${lengths}`)
      assert.deepEqual(requests.at(-1), { first: 180, offset: 0 })
      await more(returned, 180)
      assert.deepEqual(requests.at(-1), { first: UPDATES_PAGE, offset: 180 })
      const result = returned.getCurrentResult().data.chapters
      assert.equal(result.nodes.length, 200)
      assert.equal(new Set(result.nodes.map(c => c.id)).size, 200)
      assert.equal(result.pageInfo.hasNextPage, false)
    } finally { back.unsubscribe() }
  } finally { subscription.unsubscribe(); client.stop() }
})

test('各筛选的缓存互不相干，清空后不沿用上一会话的范围', async () => {
  const { client, watch } = fixture()
  const query = watch()
  const subscription = query.subscribe(() => {})
  try {
    await ready(query)
    await more(query, UPDATES_PAGE)
    assert.equal(updatesVariables(client.cache, UpdatesFeedAllDocument, ALL).first, 120)
    assert.equal(updatesVariables(client.cache, UpdatesFeedUnreadDocument, UNREAD).first, UPDATES_PAGE, '未读筛选没加载过，不继承全部的范围')
    subscription.unsubscribe()
    await client.clearStore()
    assert.equal(updatesVariables(client.cache, UpdatesFeedAllDocument, ALL).first, UPDATES_PAGE)
  } finally { subscription.unsubscribe(); client.stop() }
})

test('迁移时一并抓到的章节不算更新：只列加入书库之后才抓到的', () => {
  const ch = (fetchedAt, inLibraryAt) => ({ fetchedAt, manga: { inLibraryAt } })
  assert.equal(isFreshUpdate(ch('2000', '1000')), true)
  assert.equal(isFreshUpdate(ch('999', '1000')), false, '迁移前一刻抓的整本章节')
  assert.equal(isFreshUpdate(ch('1000', '1000')), false, '同一秒算一起抓的')
})

test('更新页：移除批量已读，下载仍按天提供', () => {
  const updates = readFileSync(new URL('../src/features/updates/UpdatesPage.tsx', import.meta.url), 'utf8')
  assert.ok(!updates.includes('全部标为已读'), '不再渲染跨天/整页的「全部标为已读」')
  assert.ok(!updates.includes('下载全部未读'), '不再渲染跨天/整页的「下载全部未读」')
  assert.ok(!updates.includes('markDayRead') && !updates.includes('当日已读'), '移除按天批量已读入口及处理逻辑')
  assert.ok(updates.includes('downloadDay') && updates.includes('下载未读'), '按天提供「下载未读」')
})
