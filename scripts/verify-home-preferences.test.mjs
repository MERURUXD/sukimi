import assert from 'node:assert/strict'
import test from 'node:test'
import { HOME_SECTION_ORDER, moveHomeSection, normalizeHomeOrder, normalizeHomePreferences } from '../src/features/home/preferences.ts'

test('首页偏好：旧设置保留默认内容，橱窗和特别关心默认开启、稍后再看默认关闭', () => {
  for (const value of [undefined, null, {}, { homeMobileLayout: 'cover', theme: 'light' }]) {
    assert.deepEqual(normalizeHomePreferences(value), {
      homeSections: { favorite: true, updates: true, stale: true, fresh: true, recent: true, later: false },
      homeSectionOrder: [...HOME_SECTION_ORDER], homeGallery: true,
    })
  }
})

test('首页偏好：显式关闭保留，坏值与缺失项按默认开启', () => {
  const saved = { homeSections: { updates: false, stale: 'false', recent: false }, homeGallery: false }
  const result = normalizeHomePreferences(saved)
  assert.deepEqual(result.homeSections, { favorite: true, updates: false, stale: true, fresh: true, recent: false, later: false })
  assert.equal(normalizeHomePreferences({ homeSections: { favorite: false } }).homeSections.favorite, false)
  assert.equal(normalizeHomePreferences({ homeSections: { later: true } }).homeSections.later, true)
  assert.equal(normalizeHomePreferences({ homeSections: { later: 'true' } }).homeSections.later, false)
  assert.equal(result.homeGallery, false)
  assert.equal(normalizeHomePreferences({ homeGallery: 0 }).homeGallery, true)
  assert.equal(saved.homeSections.stale, 'false', '不修改读入的旧偏好')
})

test('首页偏好：顺序忽略未知项、去重并补全，已有合法顺序不变', () => {
  // 没有「特别关心」的旧顺序：它放到最前，其余缺的补在后面
  assert.deepEqual(normalizeHomeOrder(['recent', 'removed', 'recent', 'gallery', null]), ['favorite', 'recent', 'gallery', 'updates', 'stale', 'fresh', 'later'])
  assert.deepEqual(normalizeHomeOrder(['recent', 'favorite']), ['recent', 'favorite', 'updates', 'stale', 'fresh', 'gallery', 'later'])
  assert.deepEqual(normalizeHomeOrder('gallery'), [...HOME_SECTION_ORDER])
  const order = [...HOME_SECTION_ORDER].reverse()
  assert.deepEqual(normalizeHomeOrder(order), order)
})

test('首页偏好：连续移动保留全部模块，边界不丢项、不修改输入', () => {
  const initial = [...HOME_SECTION_ORDER]
  let order = initial
  for (let i = 0; i < 7; i++) order = moveHomeSection(order, 'later', -1)
  assert.equal(order[0], 'later')
  for (let i = 0; i < 7; i++) order = moveHomeSection(order, 'later', 1)
  assert.deepEqual(order, initial)
  assert.deepEqual(initial, [...HOME_SECTION_ORDER])
  assert.deepEqual(new Set(order), new Set(HOME_SECTION_ORDER))
})
