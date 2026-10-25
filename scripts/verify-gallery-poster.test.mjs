import assert from 'node:assert/strict'
import test from 'node:test'

process.env.TZ = 'Asia/Taipei'
const { fitLines, posterFileName, posterTop, wallRows, workHeading, workProgress, WALL_COLS, WALL_ROWS } = await import('../src/features/gallery/poster.ts')

// 虚构的等宽量法：中日文一个字 2，其余 1
const measure = (s) => [...s].reduce((w, ch) => w + (ch.charCodeAt(0) > 0x2e80 ? 2 : 1), 0)

test('文件名只用 ASCII，按本地日期', () => {
  assert.equal(posterFileName('library', Date.UTC(2026, 9, 20, 17)), 'sukimi-library-20261021.png')
})

test('封面墙铺满，相邻行错开，书少时循环', () => {
  const rows = wallRows(['a', 'b', 'c'])
  assert.equal(rows.length, WALL_ROWS)
  assert.ok(rows.every((r) => r.length === WALL_COLS))
  assert.deepEqual(rows[0].slice(0, 4), ['a', 'b', 'c', 'a'])
  // 同一列上下两格不是同一部
  for (let r = 1; r < rows.length; r++) rows[r].forEach((x, c) => assert.notEqual(x, rows[r - 1][c]))
  assert.deepEqual(wallRows([]), [])
})

test('书多时每格一部不重复，从最早到最新的收藏都取到', () => {
  const items = Array.from({ length: 248 }, (_, i) => i)
  const flat = wallRows(items).flat()
  assert.equal(new Set(flat).size, WALL_ROWS * WALL_COLS)
  assert.equal(flat[0], 0)
  assert.ok(flat.at(-1) >= 240)
})

test('中文逐字换行，超过行数时截断加省略号', () => {
  assert.deepEqual(fitLines('云海邮局', 20, 2, measure), ['云海邮局'])
  assert.deepEqual(fitLines('在世界尽头的图书馆等你回来', 10, 2, measure), ['在世界尽头', '的图书馆…'])
})

test('西文按词换行，过长的词逐字断开', () => {
  assert.deepEqual(fitLines('Moonlight Express', 10, 3, measure), ['Moonlight', 'Express'])
  assert.deepEqual(fitLines('Supercalifragilistic', 8, 3, measure), ['Supercal', 'ifragili', 'stic'])
})

test('标点不放在行首', () => {
  const lines = fitLines('潮汐图书馆，海风', 10, 3, measure)
  assert.ok(lines.every((l) => !/^[，。]/.test(l)), lines.join('|'))
})

test('读得最多：先去掉 NSFW 和已移出书库的，再取前三', () => {
  const byId = new Map([
    [1, { id: 1, nsfw: false }],
    [2, { id: 2, nsfw: true }],
    [3, { id: 3, nsfw: false }],
    [5, { id: 5, nsfw: false }],
    [6, { id: 6, nsfw: false }],
  ])
  const ranking = [{ id: 2, read: 90 }, { id: 4, read: 80 }, { id: 1, read: 70 }, { id: 3, read: 60 }, { id: 5, read: 50 }, { id: 6, read: 40 }]
  const top = posterTop(ranking, byId, (m) => m.nsfw)
  assert.deepEqual(top.map((t) => t.manga.id), [1, 3, 5])
  assert.deepEqual(posterTop([{ id: 1, read: 0 }], byId, () => false), [])
})

test('单部进度：总话数未知时不显示已读', () => {
  assert.deepEqual(workProgress(null, 3), { read: null, total: null })
  assert.deepEqual(workProgress(128, 42), { read: 86, total: 128 })
  assert.deepEqual(workProgress(10, 12), { read: 0, total: 10 })
  const unread = workHeading(0, 128)
  assert.equal(workHeading(null, null), unread)
  assert.equal(new Set([unread, workHeading(86, 128), workHeading(128, 128)]).size, 3, '未开始、阅读中和已读完可区分')
})
