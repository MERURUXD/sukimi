import assert from 'node:assert/strict'
import test from 'node:test'
import { addDays, dayText, occurrences, predict, shortText, startOfDay } from '../src/features/updates/predict.ts'

// 虚构时间线：「今天」固定为 2026/10/17 周六中午
const NOW = new Date(2026, 9, 17, 12).getTime()
const at = (m, d, h = 0, min = 0) => new Date(2026, m - 1, d, h, min).getTime()
const ch = (uploadDate, fetchedAt = uploadDate) => ({ uploadDate, fetchedAt })
const ongoing = { status: 'ONGOING', now: NOW }

test('周更：一次延期、一次补发不带偏，间隔仍是 7 天，下一话在一周后', () => {
  const dates = [[7, 22], [7, 29], [8, 5], [8, 27], [8, 27], [9, 2], [9, 9], [9, 16], [9, 30], [10, 7], [10, 14]]
  const p = predict(dates.map(([m, d]) => ch(at(m, d))), ongoing)
  assert.equal(p.kind, 'next')
  assert.equal(p.interval, 7)
  assert.equal(p.regular, 'high')
  assert.equal(p.next, at(10, 21))
  assert.equal(p.late, 0)
  assert.equal(p.minute, undefined, '来源只给日期时不推算几点')
  assert.equal(shortText(p, NOW), '预计周三 10/21 更新')
})

test('同一天的多话算一次发布；最近只看 10 个发布日', () => {
  const chapters = Array.from({ length: 30 }, (_, i) => ch(at(1, 1) + Math.floor(i / 2) * 3 * 86_400_000))
  const p = predict(chapters, ongoing)
  assert.equal(p.interval, 3)
  assert.equal(p.days.length, 10)
})

test('过了预计日还没出：记晚了几天', () => {
  const p = predict([ch(at(9, 19)), ch(at(9, 26)), ch(at(10, 3))], ongoing)
  assert.equal(p.next, at(10, 10))
  assert.equal(p.late, 7)
  assert.equal(shortText(p, NOW), '晚了 7 天')
})

test('完结、休刊、只抓一次、发布日太少都不推算', () => {
  const three = [ch(at(10, 1)), ch(at(10, 8)), ch(at(10, 15))]
  assert.deepEqual(predict(three, { status: 'COMPLETED', now: NOW }), { kind: 'none', reason: 'ended' })
  assert.deepEqual(predict(three, { status: 'ON_HIATUS', now: NOW }), { kind: 'none', reason: 'ended' })
  assert.deepEqual(predict(three, { ...ongoing, updateStrategy: 'ONLY_FETCH_ONCE' }), { kind: 'none', reason: 'once' })
  assert.deepEqual(predict(three.slice(0, 2), ongoing), { kind: 'none', reason: 'few' })
  assert.deepEqual(predict([], ongoing), { kind: 'none', reason: 'few' })
})

test('来源没给发布日期时改用抓取时间，只算「偶尔会晚」并标成仅供参考', () => {
  const fetched = [at(9, 3, 21), at(9, 17, 21), at(10, 1, 21), at(10, 15, 21)]
  const p = predict(fetched.map((f) => ch(0, f)), ongoing)
  assert.equal(p.approx, true)
  assert.equal(p.interval, 14)
  assert.equal(p.regular, 'mid')
  assert.equal(p.minute, undefined, '抓取时刻是服务端检查的时间，不当作发布时刻')
})

test('发布日期在未来或早于 2000 年的当作没给', () => {
  const p = predict([ch(1, at(9, 1)), ch(at(12, 1), at(9, 8)), ch(0, at(9, 15))], ongoing)
  assert.equal(p.approx, true)
  assert.equal(p.interval, 7)
})

test('带时刻的来源推算几点，今天、明天的预计会写出时间', () => {
  const p = predict([ch(at(9, 27, 20, 0)), ch(at(10, 4, 20, 10)), ch(at(10, 11, 19, 50))], ongoing)
  assert.equal(p.minute, 20 * 60)
  assert.equal(p.next, at(10, 18))
  assert.equal(shortText(p, NOW), '预计明天 20:00 更新')
})

test('间隔忽长忽短：不太规律，长间隔只说到上中下旬', () => {
  const p = predict([ch(at(5, 1)), ch(at(5, 20)), ch(at(7, 10)), ch(at(7, 25)), ch(at(9, 30))], ongoing)
  assert.equal(p.regular, 'low')
  assert.ok(p.interval >= 20)
  assert.match(dayText(p, NOW), /^约 \d+ 月[上中下]旬$/)
  assert.match(shortText(p, NOW), /更新$/)
})

test('往后翻几周时按间隔重复，范围外的不算', () => {
  const p = predict([ch(at(10, 3)), ch(at(10, 10)), ch(at(10, 17))], ongoing)
  const from = startOfDay(NOW)
  assert.deepEqual(occurrences(p, from, addDays(from, 22)), [at(10, 24), at(10, 31), at(11, 7)])
  assert.deepEqual(occurrences(p, addDays(from, 8), addDays(from, 15)), [at(10, 31)])
})

test('一周的日历：过去放实际抓到的、今天以后放预计；同一天抓到了就不再显示预计', async () => {
  const { buildWeek, leftovers, seriesOf, weekStart } = await import('../src/features/updates/calendar.ts')
  const m = (id, status = 'ONGOING') => ({ id, status, updateStrategy: 'ALWAYS_UPDATE' })
  const row = (mangaId, t, manga = m(mangaId)) => ({ mangaId, uploadDate: t, fetchedAt: t + 3_600_000, manga })
  const chapters = [
    // 1：周更，今天（周六）刚出 → 今天是实际更新，不再显示预计
    ...[[9, 26], [10, 3], [10, 10], [10, 17]].map(([mo, d]) => row(1, at(mo, d, 8))),
    // 2：周更，预计明天
    ...[[9, 27], [10, 4], [10, 11]].map(([mo, d]) => row(2, at(mo, d))),
    // 3：晚了 7 天
    ...[[9, 19], [9, 26], [10, 3]].map(([mo, d]) => row(3, at(mo, d))),
    // 4：已完结，只在本周三抓到过
    row(4, at(10, 14), m(4, 'COMPLETED')),
    // 5：周更但最后一话在四个月前 → 停更
    ...[[5, 30], [6, 6], [6, 13]].map(([mo, d]) => row(5, at(mo, d))),
  ]
  const series = seriesOf(chapters, NOW)
  const start = weekStart(NOW)
  assert.equal(start, at(10, 12), '周一开头')
  const week = buildWeek(chapters, series, start, NOW)
  const at17 = week[5].entries.map((e) => `${e.kind}${e.mangaId}`)
  assert.deepEqual(at17, ['done1'])
  assert.deepEqual(week[6].entries.map((e) => `${e.kind}${e.mangaId}`), ['pred2'])
  assert.deepEqual(week[2].entries.map((e) => `${e.kind}${e.mangaId}`), ['done4'])
  assert.ok(week.every((d) => d.entries.every((e) => e.mangaId !== 3)), '晚了的不排进日历')

  const rest = leftovers(series)
  assert.deepEqual(rest.late.map((s) => s.mangaId), [3])
  assert.deepEqual(rest.stalled.map((s) => s.mangaId), [5])
  assert.deepEqual(rest.ended.map((s) => s.mangaId), [4])

  // 下一周：1 和 2 各出现一次
  const next = buildWeek(chapters, series, at(10, 19), NOW)
  assert.deepEqual(next.flatMap((d) => d.entries.map((e) => `${e.kind}${e.mangaId}`)).sort(), ['pred1', 'pred2'])
})
