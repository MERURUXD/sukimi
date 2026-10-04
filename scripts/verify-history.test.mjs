import assert from 'node:assert/strict'
import test from 'node:test'
import { groupHistory, HIDDEN_KEY, hiddenValue, isVisible } from '../src/features/history/history.ts'

// 虚构阅读记录，lastReadAt 为秒；按天分组用固定的日期名
const DAY = 86_400
const c = (id, manga, at, hiddenAt) => ({ id, lastReadAt: String(at), manga: { id: manga }, meta: hiddenAt == null ? [] : [{ key: HIDDEN_KEY, value: String(hiddenAt) }] })
const dayOf = (t) => `d${Math.floor(t / 1000 / DAY)}`

test('删除时的阅读时间之后再读会重新出现', () => {
  assert.equal(isVisible(c(1, 1, 100)), true)
  assert.equal(isVisible(c(1, 1, 100, 100)), false)
  assert.equal(isVisible(c(1, 1, 101, 100)), true)
  assert.equal(isVisible({ lastReadAt: '5', meta: [{ key: 'other', value: '9' }] }), true)
})

test('同一天同一部漫画合成一条，最新的在前，隐藏的跳过', () => {
  const list = [
    c(1, 10, 3 * DAY + 500),
    c(2, 20, 3 * DAY + 400),
    c(3, 10, 3 * DAY + 300),
    c(4, 10, 2 * DAY + 900, 2 * DAY + 900),
    c(5, 10, 2 * DAY + 100),
  ]
  const days = groupHistory(list, dayOf)
  assert.deepEqual(days.map((d) => [d.label, d.entries.map((e) => [e.latest.id, e.chapters.map((x) => x.id)])]), [
    ['d3', [[1, [1, 3]], [2, [2]]]],
    ['d2', [[5, [5]]]],
  ])
})

test('隐藏值取这条里最晚的阅读时间', () => {
  const [day] = groupHistory([c(1, 10, 900), c(2, 10, 700)], dayOf)
  assert.equal(hiddenValue(day.entries[0]), '900')
})
