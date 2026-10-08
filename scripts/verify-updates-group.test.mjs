import test from 'node:test'
import assert from 'node:assert/strict'
import { groupByManga } from '../src/features/updates/group.ts'

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
