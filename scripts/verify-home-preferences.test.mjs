import assert from 'node:assert/strict'
import test from 'node:test'
import { HOME_SECTION_ORDER, moveHomeSection, normalizeHomeOrder, normalizeHomePreferences } from '../src/features/home/preferences.ts'

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
