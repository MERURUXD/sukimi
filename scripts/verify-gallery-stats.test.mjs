import assert from 'node:assert/strict'
import test from 'node:test'

// 时区要在用到 Date 之前定下；统计按浏览器本地时区分天、分钟点
process.env.TZ = 'Asia/Taipei'
const { HIDDEN_KEY } = await import('../src/features/history/history.ts')
const { addDays, dayStart, heatLevel, longestStreak, mondayOf, summarize, HEAT_WEEKS } = await import('../src/features/gallery/stats.ts')

// 虚构阅读记录：台北时间 2026-10-09（周五）中午为「现在」
const NOW = Date.UTC(2026, 9, 9, 4) // 台北 12:00
const at = (y, m, d, h, min = 0) => String(Math.floor(new Date(y, m - 1, d, h, min).getTime() / 1000))
const ch = (mangaId, { read = true, pages = 20, time = '0', hidden } = {}) => ({
  mangaId, isRead: read, pageCount: pages, lastReadAt: time,
  meta: hidden == null ? [] : [{ key: HIDDEN_KEY, value: String(hidden) }],
})

test('小时分布按本地时区，高峰并列取较早的钟点', () => {
  const s = summarize([
    ch(1, { time: at(2026, 10, 8, 23, 30) }),
    ch(1, { time: at(2026, 10, 8, 23, 50) }),
    ch(2, { time: at(2026, 10, 9, 7) }),
    ch(2, { time: at(2026, 10, 9, 7, 30) }),
    ch(3, { time: at(2026, 10, 9, 0, 10) }),
  ], [{ id: 1, total: 2 }, { id: 2, total: 5 }, { id: 3, total: 1 }], NOW)
  assert.equal(s.hours[23], 2)
  assert.equal(s.hours[7], 2)
  assert.equal(s.hours[0], 1)
  assert.equal(s.hours.reduce((a, b) => a + b, 0), 5)
  assert.equal(s.peak, 7)
  // 同一刻在 UTC 下是 15 点：确认用的是本地时区
  assert.equal(new Date(Number(at(2026, 10, 8, 23, 30)) * 1000).getUTCHours(), 15)
})

test('热力图 26 周、按周一对齐，今天之后的格子标为未来', () => {
  const s = summarize([ch(1, { time: at(2026, 10, 9, 9) }), ch(1, { time: at(2026, 10, 9, 21) }), ch(1, { time: at(2026, 10, 5, 9) })], [{ id: 1, total: 10 }], NOW)
  assert.equal(s.days.length, HEAT_WEEKS * 7)
  assert.equal(new Date(s.days[0].date).getDay(), 1)
  assert.equal(s.days[0].date, addDays(mondayOf(NOW), -25 * 7))
  const today = s.days.findIndex((d) => d.date === dayStart(NOW))
  assert.equal(today, s.days.length - 3) // 周五：后面还有周六、周日
  assert.equal(s.days[today].count, 2)
  assert.ok(s.days.slice(today + 1).every((d) => d.future && d.count === 0))
  assert.equal(s.days[today - 4].count, 1) // 本周一
  assert.equal(s.activeDays, 2)
})

test('最长连续天数跨月、跨年也连续', () => {
  const days = [new Date(2025, 11, 30), new Date(2025, 11, 31), new Date(2026, 0, 1), new Date(2026, 0, 3)].map((d) => d.getTime())
  assert.equal(longestStreak(days), 3)
  assert.equal(longestStreak([]), 0)
  const s = summarize([
    ch(1, { time: at(2026, 9, 30, 22) }), ch(1, { time: at(2026, 10, 1, 1) }), ch(1, { time: at(2026, 10, 1, 23) }), ch(1, { time: at(2026, 10, 2, 8) }),
    ch(1, { time: at(2026, 10, 5, 8) }),
  ], [{ id: 1, total: 9 }], NOW)
  assert.equal(s.streak, 3)
})

test('从历史里删掉的记录不进时间图表，但仍计入已读', () => {
  const t = at(2026, 10, 9, 10)
  const s = summarize([ch(1, { time: t, hidden: Number(t) }), ch(1, { time: at(2026, 10, 9, 11), hidden: Number(t) })], [{ id: 1, total: 4 }], NOW)
  assert.equal(s.read, 2)
  assert.equal(s.hours[10], 0)
  assert.equal(s.hours[11], 1) // 删除之后又读过，重新出现
  assert.equal(s.days.at(-3).count, 1)
})

test('页数只累加页数大于 0 的已读章节', () => {
  const s = summarize([ch(1, { pages: 20 }), ch(1, { pages: 0 }), ch(1, { pages: -1 }), ch(1, { read: false, pages: 30, time: at(2026, 10, 9, 9) })], [{ id: 1, total: 4 }], NOW)
  assert.equal(s.pages, 20)
  assert.equal(s.read, 3)
})

test('已读但没有时间的章节只计入总数', () => {
  const s = summarize([ch(1), ch(1), ch(2, { time: at(2026, 10, 9, 9) })], [{ id: 1, total: 2 }, { id: 2, total: 3 }], NOW)
  assert.equal(s.read, 3)
  assert.equal(s.untimed, 2)
  assert.equal(s.hours.reduce((a, b) => a + b, 0), 1)
  assert.equal(s.activeDays, 1)
  assert.equal(s.caughtUp, 1)
  assert.equal(s.total, 5)
})

test('排行：已读多的在前，并列时最近读过的在前，再按 id', () => {
  const s = summarize([
    ch(3), ch(3),
    ch(1, { time: at(2026, 10, 1, 9) }), ch(1),
    ch(2, { time: at(2026, 10, 8, 9) }), ch(2),
    ch(4, { time: at(2026, 10, 9, 9) }),
  ], [1, 2, 3, 4, 5].map((id) => ({ id, total: 10 })), NOW)
  assert.deepEqual(s.ranking.map((r) => [r.id, r.read]), [[2, 2], [1, 2], [3, 2], [4, 1], [5, 0]])
})

test('总话数还没取到时总数为空，追平不计', () => {
  const s = summarize([ch(1)], [{ id: 1, total: null }, { id: 2, total: 0 }], NOW)
  assert.equal(s.total, null)
  assert.equal(s.caughtUp, 0)
  assert.equal(s.peak, -1)
})

test('热力图分档', () => {
  assert.deepEqual([0, 1, 3, 4, 6, 7, 10, 11, 99].map(heatLevel), [0, 1, 1, 2, 2, 3, 3, 4, 4])
})

test('换一个时区，同一批记录分到不同的天和钟点', async () => {
  const t = String(Math.floor(Date.UTC(2026, 9, 8, 23, 30) / 1000)) // 台北 10/9 07:30，伦敦 10/9 00:30
  const taipei = summarize([ch(1, { time: t })], [{ id: 1, total: 1 }], NOW)
  process.env.TZ = 'America/Los_Angeles' // 10/8 16:30
  try {
    const la = summarize([ch(1, { time: t })], [{ id: 1, total: 1 }], NOW)
    assert.equal(taipei.peak, 7)
    assert.equal(la.peak, 16)
    assert.equal(new Date(la.days.find((d) => d.count).date).getDate(), 8)
  } finally {
    process.env.TZ = 'Asia/Taipei'
  }
})
