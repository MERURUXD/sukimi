import assert from 'node:assert/strict'
import test from 'node:test'
import { compareSortValues, libraryScore } from '../src/features/library/sortValues.ts'

// 虚构的三个追踪网站：十分制、百分制、表情三档
const scales = new Map([
  [1, Array.from({ length: 11 }, (_, i) => String(i))],
  [2, Array.from({ length: 101 }, (_, i) => String(i))],
  [3, ['', ':(', ':|', ':)']],
])
const rec = (trackerId, displayScore) => ({ trackerId, displayScore })

test('不同分制折算到 0–10', () => {
  assert.equal(libraryScore([rec(1, '8')], scales), 8)
  assert.ok(Math.abs(libraryScore([rec(2, '72')], scales) - 7.2) < 1e-9)
  assert.equal(libraryScore([rec(3, ':)')], scales), 10)
})

test('多个网站取已评分的平均，未评分不拉低', () => {
  assert.equal(libraryScore([rec(1, '8'), rec(2, '60')], scales), 7)
  assert.equal(libraryScore([rec(1, '9'), rec(2, '0')], scales), 9)
})

test('没评分、没绑定或不知道分制时为 null', () => {
  assert.equal(libraryScore([rec(1, '0')], scales), null)
  assert.equal(libraryScore([rec(3, '')], scales), null)
  assert.equal(libraryScore([], scales), null)
  assert.equal(libraryScore([rec(9, '8')], scales), null)
  assert.equal(libraryScore([rec(1, '8.5')], scales), null)
})

test('没有评分的不论正序倒序都排在最后', () => {
  const values = [7, null, 9, 8.5, null]
  const sorted = (desc) => [...values].sort((a, b) => compareSortValues(a, b, desc, (x, y) => x.localeCompare(y)))
  assert.deepEqual(sorted(true), [9, 8.5, 7, null, null])
  assert.deepEqual(sorted(false), [7, 8.5, 9, null, null])
  assert.equal(compareSortValues('甲', '甲', true, (x, y) => x.localeCompare(y)), 0)
})
