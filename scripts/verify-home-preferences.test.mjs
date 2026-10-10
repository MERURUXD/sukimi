import assert from 'node:assert/strict'
import test from 'node:test'
import { HOME_SECTION_ORDER, moveHomeSection, normalizeHomeOrder, normalizeHomePreferences } from '../src/features/home/preferences.ts'

test('首页偏好：旧设置保留默认内容，橱窗默认开启', () => {
  for (const value of [undefined, null, {}, { homeMobileLayout: 'cover', theme: 'light' }]) {
    assert.deepEqual(normalizeHomePreferences(value), {
      homeSections: { updates: true, stale: true, fresh: true, recent: true },
      homeSectionOrder: [...HOME_SECTION_ORDER], homeGallery: true,
    })
  }
})

test('首页偏好：显式关闭保留，坏值与缺失项按默认开启', () => {
  const saved = { homeSections: { updates: false, stale: 'false', recent: false }, homeGallery: false }
  const result = normalizeHomePreferences(saved)
  assert.deepEqual(result.homeSections, { updates: false, stale: true, fresh: true, recent: false })
  assert.equal(result.homeGallery, false)
  assert.equal(normalizeHomePreferences({ homeGallery: 0 }).homeGallery, true)
  assert.equal(saved.homeSections.stale, 'false', '不修改读入的旧偏好')
})

test('首页偏好：顺序忽略未知项、去重并补全，已有合法顺序不变', () => {
  assert.deepEqual(normalizeHomeOrder(['recent', 'removed', 'recent', 'gallery', null]), ['recent', 'gallery', 'updates', 'stale', 'fresh'])
  assert.deepEqual(normalizeHomeOrder('gallery'), [...HOME_SECTION_ORDER])
  const order = [...HOME_SECTION_ORDER].reverse()
  assert.deepEqual(normalizeHomeOrder(order), order)
})

test('首页偏好：连续移动保留全部模块，边界不丢项、不修改输入', () => {
  const initial = [...HOME_SECTION_ORDER]
  let order = initial
  for (let i = 0; i < 6; i++) order = moveHomeSection(order, 'gallery', -1)
  assert.equal(order[0], 'gallery')
  for (let i = 0; i < 6; i++) order = moveHomeSection(order, 'gallery', 1)
  assert.deepEqual(order, initial)
  assert.deepEqual(initial, [...HOME_SECTION_ORDER])
  assert.deepEqual(new Set(order), new Set(HOME_SECTION_ORDER))
})
