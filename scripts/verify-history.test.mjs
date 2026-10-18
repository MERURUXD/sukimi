import assert from 'node:assert/strict'
import test from 'node:test'
import { groupHistory, HIDDEN_KEY, hiddenKey, hiddenValue, isVisible } from '../src/features/history/history.ts'

// 虚构阅读记录，lastReadAt 为秒；按天分组用固定的日期名
const DAY = 86_400
const USER = 2
const c = (id, manga, at, hiddenAt, user = USER) => ({ id, lastReadAt: String(at), manga: { id: manga }, meta: hiddenAt == null ? [] : [{ key: hiddenKey(user), value: String(hiddenAt) }] })
const dayOf = (t) => `d${Math.floor(t / 1000 / DAY)}`

test('删除时的阅读时间之后再读会重新出现', () => {
  assert.equal(isVisible(c(1, 1, 100), USER), true)
  assert.equal(isVisible(c(1, 1, 100, 100), USER), false)
  assert.equal(isVisible(c(1, 1, 101, 100), USER), true)
  assert.equal(isVisible({ lastReadAt: '5', meta: [{ key: 'other', value: '9' }] }, USER), true)
  assert.equal(isVisible(c(1, 1, 100, 100), undefined), true)
})

test('一个账号删除记录不会藏掉别的账号的同一条历史', () => {
  // A（id 1）在 10/12 读后删除；B（id 2）10/10 读过同一话
  const chapter = { id: 1, lastReadAt: '100', manga: { id: 1 }, meta: [{ key: hiddenKey(1), value: '300' }] }
  assert.equal(isVisible(chapter, 1), false)
  assert.equal(isVisible(chapter, 2), true)
})

test('旧版不分账号的键只对单用户（id 0）生效', () => {
  const chapter = { id: 1, lastReadAt: '100', manga: { id: 1 }, meta: [{ key: HIDDEN_KEY, value: '100' }] }
  assert.equal(isVisible(chapter, 0), false)
  assert.equal(isVisible(chapter, 1), true)
})

test('同一天同一部漫画合成一条，最新的在前，隐藏的跳过', () => {
  const list = [
    c(1, 10, 3 * DAY + 500),
    c(2, 20, 3 * DAY + 400),
    c(3, 10, 3 * DAY + 300),
    c(4, 10, 2 * DAY + 900, 2 * DAY + 900),
    c(5, 10, 2 * DAY + 100),
  ]
  const days = groupHistory(list, dayOf, USER)
  assert.deepEqual(days.map((d) => [d.label, d.entries.map((e) => [e.latest.id, e.chapters.map((x) => x.id)])]), [
    ['d3', [[1, [1, 3]], [2, [2]]]],
    ['d2', [[5, [5]]]],
  ])
})

test('隐藏值取这条里最晚的阅读时间', () => {
  const [day] = groupHistory([c(1, 10, 900), c(2, 10, 700)], dayOf, USER)
  assert.equal(hiddenValue(day.entries[0]), '900')
})
