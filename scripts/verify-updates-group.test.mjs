import test from 'node:test'
import assert from 'node:assert/strict'
import { groupByManga, groupRank, sortGroups } from '../src/features/updates/group.ts'

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
