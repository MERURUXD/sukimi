import assert from 'node:assert/strict'
import test from 'node:test'
import { byDay, dayIndex, updatesPartial, weekDays } from '../src/features/home/week.ts'

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
