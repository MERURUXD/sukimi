import assert from 'node:assert/strict'
import test from 'node:test'
import { byDay, dayIndex, updatesPartial, weekDays, weekStartSec, weekTabSub } from '../src/features/home/week.ts'
import { ApolloClient, ApolloLink, Observable } from '@apollo/client'
import { firstValueFrom, filter } from 'rxjs'
import { createCache } from '../src/api/cache.ts'
import { RecentUpdatesDocument } from '../src/api/gql/graphql.ts'
import { completeWeekUpdates, mergeWeekUpdates, WEEK_UPDATES_PAGE } from '../src/features/home/weekUpdates.ts'

// 2026-10-22（周四）本地 15:00
const now = new Date(2026, 9, 22, 15, 0).getTime()
const at = (day, hour) => new Date(2026, 9, 22 - day, hour, 0).getTime()

test('这一周：按本地日历日算第几天，超出一周、无时间的丢掉', () => {
  assert.equal(dayIndex(at(0, 0), now), 0)
  assert.equal(dayIndex(at(1, 23), now), 1, '昨晚 23 点是昨天，不是「24 小时内」')
  assert.equal(dayIndex(at(6, 0), now), 6)
  assert.equal(dayIndex(at(7, 23), now), -1)
  assert.equal(dayIndex(at(-1, 1), now), 0, '时钟稍快的未来时间算今天')
  assert.equal(dayIndex(0, now), -1)
  assert.equal(dayIndex(Number.NaN, now), -1)
})

test('这一周：日期标签今天在前', () => {
  const days = weekDays(now)
  assert.equal(days.length, 7)
  assert.deepEqual(days.slice(0, 3), [{ name: '今天', date: '10/22' }, { name: '昨天', date: '10/21' }, { name: '周二', date: '10/20' }])
  assert.deepEqual(days[6], { name: '周五', date: '10/16' })
})

test('这一周：每天一部一项，最新的在前，项内记录也按时间倒序', () => {
  const records = [
    { id: 1, manga: 10, t: at(0, 9) },
    { id: 2, manga: 11, t: at(0, 12) },
    { id: 3, manga: 10, t: at(0, 14) },
    { id: 4, manga: 10, t: at(2, 8) },
    { id: 5, manga: 12, t: at(9, 8) },
  ]
  const days = byDay(records, (r) => r.t, (r) => r.manga, now)
  assert.deepEqual(days[0].map((g) => [g.mangaId, g.items.map((r) => r.id)]), [[10, [3, 1]], [11, [2]]])
  assert.deepEqual(days[2].map((g) => g.mangaId), [10])
  assert.equal(days.flat().length, 3, '一周外的记录不出现')
  assert.equal(records[0].id, 1, '不修改输入')
})

test('这一周：更新列表没取完、最旧一话还在本周时标为不完整', () => {
  assert.equal(updatesPartial([at(0, 9), at(3, 9)], true, now), true)
  assert.equal(updatesPartial([at(0, 9), at(8, 9)], true, now), false)
  assert.equal(updatesPartial([at(0, 9), at(3, 9)], false, now), false)
  assert.equal(updatesPartial([], true, now), false)
})

test('这一周：更新按抓取时间筛选的起点是 6 天前本地零点', () => {
  assert.equal(weekStartSec(now), Math.floor(new Date(2026, 9, 16, 0, 0).getTime() / 1000))
  assert.equal(dayIndex(weekStartSec(now) * 1000, now), 6)
  assert.equal(dayIndex((weekStartSec(now) - 1) * 1000, now), -1)
})

test('这一周：窄屏日期标签副标题区分更新与阅读四种组合', () => {
  assert.equal(weekTabSub(3, 2), '3 部更新 · 读 2 部')
  assert.equal(weekTabSub(4, 0), '4 部更新')
  assert.equal(weekTabSub(0, 2), '读了 2 部')
  assert.equal(weekTabSub(0, 0), '—')
})

const start = weekStartSec(new Date(2026, 9, 23, 12).getTime())
const variables = { first: WEEK_UPDATES_PAGE, offset: 0, filter: { inLibrary: { equalTo: true }, fetchedAt: { greaterThan: String(start - 1) } } }

// 正式查询、缓存与 fetchMore，所有响应只来自虚构作品。
function fixture(total = 2600) {
  const nodes = Array.from({ length: total }, (_, i) => ({
    __typename: 'ChapterType', id: i + 1, name: `测试章节 ${i + 1}`, chapterNumber: i + 1, sourceOrder: i + 1,
    fetchedAt: String(start + 6 * 86400 - i), uploadDate: '0', isRead: false, isDownloaded: false, isBookmarked: false,
    lastPageRead: 0, pageCount: 10, mangaId: i + 1,
    manga: { __typename: 'MangaType', id: i + 1, title: `虚构作品 ${i + 1}`, thumbnailUrl: '/favicon.svg', source: null, categories: { __typename: 'CategoryNodeList', nodes: [] } },
  }))
  let failAt = -1
  const requests = []
  const client = new ApolloClient({
    cache: createCache(),
    link: new ApolloLink(op => new Observable(observer => {
      const { first, offset } = op.variables
      requests.push({ first, offset })
      const timer = setTimeout(() => {
        if (offset === failAt) { observer.error(new Error('虚构分页失败')); return }
        observer.next({ data: { chapters: {
          __typename: 'ChapterNodeList', totalCount: total,
          pageInfo: { __typename: 'PageInfo', hasNextPage: offset + first < total },
          nodes: nodes.slice(offset, offset + first),
        } } })
        observer.complete()
      }, 0)
      return () => clearTimeout(timer)
    })),
  })
  const query = client.watchQuery({ query: RecentUpdatesDocument, variables, fetchPolicy: 'cache-and-network', notifyOnNetworkStatusChange: true })
  return { client, query, requests, fail: offset => { failAt = offset } }
}

const ready = query => firstValueFrom(query.pipe(filter(r => !r.loading && !!r.data)))
async function more(query) {
  const offset = query.getCurrentResult().data.chapters.nodes.length
  const result = await query.fetchMore({
    variables: { offset },
    updateQuery: (previous, { fetchMoreResult }) => mergeWeekUpdates(previous, fetchMoreResult),
  })
  await firstValueFrom(query.pipe(filter(r => !r.loading && r.data?.chapters.nodes.length === offset + result.data.chapters.nodes.length)))
}

test('这一周无快照：超过 1000 话时，取齐之前不展示部分作品', async () => {
  const { client, query, requests } = fixture()
  const visible = []
  const sub = query.subscribe(result => visible.push(completeWeekUpdates(start, result.data)?.chapters.nodes.length))
  try {
    await ready(query)
    assert.equal(completeWeekUpdates(start, query.getCurrentResult().data), undefined)
    await more(query)
    assert.equal(completeWeekUpdates(start, query.getCurrentResult().data), undefined)
    await more(query)
    const full = completeWeekUpdates(start, query.getCurrentResult().data)
    assert.equal(full.chapters.nodes.length, 2600)
    assert.equal(new Set(full.chapters.nodes.map(c => c.id)).size, 2600)
    assert.ok(visible.every(n => n === undefined || n === 2600), `出现部分作品：${visible}`)
    assert.deepEqual(requests.map(r => r.offset), [0, 1000, 2000])
  } finally { sub.unsubscribe(); client.stop() }
})

test('这一周刷新：完整快照首帧可用，网络分页期间不被 200 或 1000 话替换', async () => {
  const initial = fixture()
  const sub = initial.query.subscribe(() => {})
  let saved
  try {
    await ready(initial.query)
    await more(initial.query)
    await more(initial.query)
    saved = JSON.parse(JSON.stringify({ start, data: initial.query.getCurrentResult().data }))
  } finally { sub.unsubscribe(); initial.client.stop() }

  const { client, query } = fixture(2700)
  const visible = [completeWeekUpdates(start, undefined, saved).chapters.nodes.length]
  const refresh = query.subscribe(result => visible.push(completeWeekUpdates(start, result.data, saved)?.chapters.nodes.length))
  try {
    await ready(query)
    await more(query)
    await more(query)
    assert.ok(visible.every(n => n === 2600 || n === 2700), `完整快照被部分结果替换：${visible}`)
    assert.equal(completeWeekUpdates(start, query.getCurrentResult().data, saved).chapters.nodes.length, 2700)
  } finally { refresh.unsubscribe(); client.stop() }
})

test('这一周分页失败保留完整快照，重试后可取齐；空结果也可覆盖旧快照', async () => {
  const { client, query, fail } = fixture(1001)
  const sub = query.subscribe(() => {})
  try {
    await ready(query)
    const saved = { start, data: { chapters: { ...query.getCurrentResult().data.chapters, pageInfo: { hasNextPage: false } } } }
    fail(1000)
    await assert.rejects(more(query), /虚构分页失败/)
    assert.equal(completeWeekUpdates(start, query.getCurrentResult().data), undefined)
    assert.equal(completeWeekUpdates(start, query.getCurrentResult().data, saved), saved.data)
    fail(-1)
    await more(query)
    assert.equal(completeWeekUpdates(start, query.getCurrentResult().data).chapters.nodes.length, 1001)
    const empty = { chapters: { nodes: [], totalCount: 0, pageInfo: { hasNextPage: false } } }
    assert.equal(completeWeekUpdates(start, empty, saved), empty)
    assert.equal(completeWeekUpdates(start + 86400, undefined, saved), undefined, '跨日不沿用旧范围')
    assert.equal(completeWeekUpdates(start, undefined, { start, data: { ...saved.data, chapters: { ...saved.data.chapters, pageInfo: { hasNextPage: true } } } }), undefined)
  } finally { sub.unsubscribe(); client.stop() }
})

test('空分页还声称有下一页时停止，避免循环并误存完整快照', () => {
  const empty = { chapters: { nodes: [], totalCount: 10, pageInfo: { hasNextPage: true } } }
  assert.throws(() => mergeWeekUpdates(empty, empty), /未取完整/)
})
