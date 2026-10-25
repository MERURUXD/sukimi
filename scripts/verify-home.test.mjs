import test from 'node:test'
import assert from 'node:assert/strict'
import { isRecent, isStale, notStarted, pick, pickBatch, STALE_DAYS } from '../src/features/home/picks.ts'
import { hiddenKey } from '../src/features/history/history.ts'
import { readingTarget } from '../src/features/home/reading.ts'
import { HOME_SECTION_ORDER, moveHomeSection, normalizeHomeOrder, normalizeHomePreferences } from '../src/features/home/preferences.ts'

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

const chapter = (patch = {}) => ({ id: 101, name: '山间的信', chapterNumber: 1, pageCount: 20, lastPageRead: 7, lastReadAt: '100', ...patch })
const record = (patch = {}) => ({ ...chapter(), isRead: false, manga: { firstUnreadChapter: null }, ...patch })

test('未读完时，阅读目标和进度来自当前章节', () => {
  const r = readingTarget(record())
  assert.equal(r.chapter.id, 101)
  assert.equal(r.page, '第 8 / 20 页')
  assert.equal(r.pct, 40)
  assert.equal(r.isNext, false)
})

test('读完后，新章节尚未开始时不显示进度条，也不沿用上一话的满进度', () => {
  const r = readingTarget(record({ isRead: true, manga: { firstUnreadChapter: chapter({ id: 102, lastPageRead: 0, lastReadAt: '0' }) } }))
  assert.equal(r.chapter.id, 102)
  assert.equal(r.page, '尚未开始')
  assert.equal(r.pct, null)
  assert.equal(r.isNext, true)
})

test('第一话未读曾经读过一部分时，保留那一话的实际页码与进度', () => {
  const r = readingTarget(record({ isRead: true, manga: { firstUnreadChapter: chapter({ id: 102, lastPageRead: 4, pageCount: 10 }) } }))
  assert.equal(r.chapter.id, 102)
  assert.equal(r.page, '第 5 / 10 页')
  assert.equal(r.pct, 50)
})

test('总页数未知时不编造百分比，全部读完时没有继续阅读目标', () => {
  const r = readingTarget(record({ pageCount: -1 }))
  assert.equal(r.page, '第 8 页')
  assert.equal(r.pct, null)
  assert.equal(readingTarget(record({ isRead: true })), null)
})

const E_DEFAULTS = { week: true, favorite: false, updates: false, stale: true, fresh: true, recent: false, later: true }

test('首页偏好：没有「这一周」的偏好换成默认组合，橱窗默认开启', () => {
  for (const value of [undefined, null, {}, { homeMobileLayout: 'cover', theme: 'light' }]) {
    assert.deepEqual(normalizeHomePreferences(value), {
      homeSections: E_DEFAULTS, homeSectionOrder: [...HOME_SECTION_ORDER], homeGallery: true,
    })
  }
  // 旧版存下的开关：这一周与稍后再看打开，三个被它包含的模块关闭，好久没看 / 还没开始读照旧
  const old = { homeSections: { favorite: true, updates: true, stale: false, fresh: true, recent: true, later: false } }
  assert.deepEqual(normalizeHomePreferences(old).homeSections, { ...E_DEFAULTS, stale: false })
})

test('首页偏好：已有「这一周」时照存下的开关，坏值与缺失项按默认', () => {
  const saved = { homeSections: { week: false, updates: true, stale: 'false', recent: true, later: false }, homeGallery: false }
  const result = normalizeHomePreferences(saved)
  assert.deepEqual(result.homeSections, { week: false, favorite: false, updates: true, stale: true, fresh: true, recent: true, later: false })
  assert.equal(normalizeHomePreferences({ homeSections: { week: true, favorite: true } }).homeSections.favorite, true)
  assert.equal(normalizeHomePreferences({ homeSections: { week: true, later: 'false' } }).homeSections.later, true)
  assert.equal(normalizeHomePreferences({ homeSections: { week: 'true' } }).homeSections.favorite, false, '坏值等于没有这个字段')
  assert.equal(result.homeGallery, false)
  assert.equal(normalizeHomePreferences({ homeGallery: 0 }).homeGallery, true)
  assert.equal(saved.homeSections.stale, 'false', '不修改读入的旧偏好')
})

test('首页偏好：顺序忽略未知项、去重并补全，已有合法顺序不变', () => {
  // 没有「这一周」「特别关心」的旧顺序：它们放到最前，其余缺的补在后面
  assert.deepEqual(normalizeHomeOrder(['recent', 'removed', 'recent', 'gallery', null]), ['week', 'favorite', 'recent', 'gallery', 'later', 'stale', 'fresh', 'updates'])
  assert.deepEqual(normalizeHomeOrder(['recent', 'favorite', 'week']), ['recent', 'favorite', 'week', 'later', 'stale', 'fresh', 'gallery', 'updates'])
  assert.deepEqual(normalizeHomeOrder('gallery'), [...HOME_SECTION_ORDER])
  const order = [...HOME_SECTION_ORDER].reverse()
  assert.deepEqual(normalizeHomeOrder(order), order)
})

test('首页偏好：连续移动保留全部模块，边界不丢项、不修改输入', () => {
  const initial = [...HOME_SECTION_ORDER]
  let order = initial
  for (let i = 0; i < 8; i++) order = moveHomeSection(order, 'recent', -1)
  assert.equal(order[0], 'recent')
  for (let i = 0; i < 8; i++) order = moveHomeSection(order, 'recent', 1)
  assert.deepEqual(order, initial)
  assert.deepEqual(initial, [...HOME_SECTION_ORDER])
  assert.deepEqual(new Set(order), new Set(HOME_SECTION_ORDER))
})
