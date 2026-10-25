import test from 'node:test'
import assert from 'node:assert/strict'
import { isRecent, isStale, notStarted, pick, pickBatch, STALE_DAYS } from '../src/features/home/picks.ts'
import { hiddenKey } from '../src/features/history/history.ts'

// 虚构书库条目，lastReadAt 为秒
const NOW = 2_000_000_000
const DAY = 86400
const manga = (id, unreadCount, readAt, meta = []) => ({
  id,
  unreadCount,
  lastReadChapter: readAt == null ? null : { lastReadAt: String(readAt), meta },
})
const ids = (list) => list.map((m) => m.id)

test('同一种子结果固定，换种子会换一批', () => {
  const list = Array.from({ length: 30 }, (_, i) => manga(i + 1, 3, 0))
  const a = pick(list, 4, 'hero:a#0', (m) => m.id)
  assert.equal(a.length, 4)
  assert.deepEqual(ids(pick(list, 4, 'hero:a#0', (m) => m.id)), ids(a))
  assert.notDeepEqual(ids(pick(list, 4, 'hero:a#1', (m) => m.id)), ids(a))
  assert.equal(new Set(ids(a)).size, 4)
})

test('换种子时每部被选中的机会大致均等，不会总是同几种组合', () => {
  // 5 选 4：每部落选的次数应接近 1/5
  const five = Array.from({ length: 5 }, (_, i) => manga(i + 1, 3, 0))
  const left = new Map()
  for (let s = 0; s < 1000; s++) {
    const picked = ids(pick(five, 4, `hero:${s.toString(36)}#0`, (m) => m.id))
    const out = five.find((m) => !picked.includes(m.id)).id
    left.set(out, (left.get(out) ?? 0) + 1)
  }
  for (const m of five) assert.ok(left.get(m.id) > 140 && left.get(m.id) < 260, `第 ${m.id} 部落选 ${left.get(m.id)} 次`)
  // 20 选 4：200 个种子应得到几乎都不同的组合
  const twenty = Array.from({ length: 20 }, (_, i) => manga(i + 1, 3, 0))
  const sets = new Set(Array.from({ length: 200 }, (_, s) => ids(pick(twenty, 4, `x${s}`, (m) => m.id)).sort().join()))
  assert.ok(sets.size > 180, `只有 ${sets.size} 种组合`)
})

test('列表多一项少一项时，已选中的大多保持不变', () => {
  const list = Array.from({ length: 20 }, (_, i) => manga(i + 1, 3, 0))
  const before = ids(pick(list, 4, 's', (m) => m.id))
  // 去掉一部没被选中的，结果完全不变
  const dropped = list.filter((m) => !before.includes(m.id)).slice(1)
  const kept = list.filter((m) => before.includes(m.id))
  assert.deepEqual(ids(pick([...kept, ...dropped], 4, 's', (m) => m.id)).sort(), [...before].sort())
  assert.equal(pick(list.slice(0, 2), 4, 's', (m) => m.id).length, 2)
})

test('还没开始读：有章节、阅读时间为 0 或没有记录', () => {
  assert.equal(notStarted(manga(1, 5, 0)), true)
  assert.equal(notStarted(manga(2, 5, null)), true)
  assert.equal(notStarted(manga(3, 0, 0)), false)
  assert.equal(notStarted(manga(4, 5, NOW - DAY)), false)
})

test('Tachiyomi 时期导入的已读章节没有阅读时间，也不算还没开始读', () => {
  assert.equal(notStarted({ ...manga(1, 5, 0), latestReadChapter: { id: 12 } }), false)
  assert.equal(notStarted({ ...manga(2, 5, null), latestReadChapter: { id: 21 } }), false)
  assert.equal(notStarted({ ...manga(3, 5, 0), latestReadChapter: null }), true)
})

test('好久没看：超过两周、还有未读，历史里删掉的不算', () => {
  const old = NOW - (STALE_DAYS + 1) * DAY
  assert.equal(isStale(manga(1, 3, old), NOW, 1), true)
  assert.equal(isStale(manga(2, 3, NOW - 3 * DAY), NOW, 1), false)
  assert.equal(isStale(manga(3, 0, old), NOW, 1), false)
  assert.equal(isStale(manga(4, 3, 0), NOW, 1), false)
  assert.equal(isStale(manga(5, 3, old, [{ key: hiddenKey(1), value: String(old) }]), NOW, 1), false)
  // 删除后又读过（阅读时间晚于删除时间）就重新出现
  assert.equal(isStale(manga(6, 3, old, [{ key: hiddenKey(1), value: String(old - 10) }]), NOW, 1), true)
})

test('两周内读过的才算最近', () => {
  assert.equal(isRecent(String(NOW - STALE_DAYS * DAY), NOW), true)
  assert.equal(isRecent(String(NOW - STALE_DAYS * DAY - 1), NOW), false)
})

test('换一批时第一个一定和上一批不同，同一批结果固定', () => {
  for (const size of [5, 20]) {
    const list = Array.from({ length: size }, (_, i) => manga(i + 1, 3, 0))
    let prev
    for (let b = 0; b < 200; b++) {
      const cur = ids(pickBatch(list, 4, 'hero:a', b, (m) => m.id))
      assert.equal(new Set(cur).size, 4)
      if (b > 0) assert.notEqual(cur[0], prev, `${size} 部里第 ${b} 批第一个重复`)
      prev = cur[0]
    }
    assert.deepEqual(ids(pickBatch(list, 4, 'hero:a', 7, (m) => m.id)), ids(pickBatch(list, 4, 'hero:a', 7, (m) => m.id)))
    assert.deepEqual(ids(pickBatch(list, 4, 'hero:a', 0, (m) => m.id)), ids(pick(list, 4, 'hero:a#0', (m) => m.id)))
    // 第一组只从 first 里挑，换一批才轮到其余候选
    const head = list.slice(0, 4)
    assert.deepEqual(new Set(ids(pickBatch(list, 4, 'hero:a', 0, (m) => m.id, head))), new Set(ids(head)))
    const later = new Set(Array.from({ length: 6 }, (_, b) => ids(pickBatch(list, 4, 'hero:a', b + 1, (m) => m.id, head))).flat())
    assert.ok([...later].some((id) => !ids(head).includes(id)))
  }
})
