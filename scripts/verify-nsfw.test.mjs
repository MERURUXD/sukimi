import assert from 'node:assert/strict'
import test from 'node:test'
import { categoryNsfwKey, isNsfw, mangaNsfwKey, NO_MARKS, NSFW_PREFIX, nsfwReason, nsfwWrite, parseNsfw } from '../src/features/nsfw/nsfw.ts'

const safe = { id: 1, source: { contentWarning: 'SAFE' }, categories: { nodes: [{ id: 10 }] } }
const adult = { id: 2, source: { contentWarning: 'NSFW' }, categories: { nodes: [] } }
const mixed = { id: 3, source: { contentWarning: 'MIXED' }, categories: null }

test('NSFW：键按账号拼前缀，解析时忽略别的账号、坏键和坏值', () => {
  assert.equal(mangaNsfwKey(7, 42), `${NSFW_PREFIX}7.m.42`)
  assert.equal(categoryNsfwKey(0, 3), `${NSFW_PREFIX}0.c.3`)
  const marks = parseNsfw(7, [
    { key: mangaNsfwKey(7, 1), value: '1' },
    { key: mangaNsfwKey(7, 2), value: '0' },
    { key: mangaNsfwKey(7, 4), value: 'yes' },
    { key: `${NSFW_PREFIX}7.m.05`, value: '1' },
    { key: `${NSFW_PREFIX}7.m.-6`, value: '1' },
    { key: `${NSFW_PREFIX}7.m.8.9`, value: '1' },
    { key: categoryNsfwKey(7, 12), value: '1' },
    { key: categoryNsfwKey(7, 11), value: '1' },
    { key: categoryNsfwKey(7, 13), value: '0' },
    { key: mangaNsfwKey(17, 9), value: '1' },
    { key: 'sukimi.later.7.1', value: '1700000000' },
  ])
  assert.deepEqual(marks, { manga: { 1: true, 2: false }, categories: [11, 12] })
  assert.deepEqual(parseNsfw(7), NO_MARKS)
})

test('NSFW：手动标记优先，其次分类，再次来源；MIXED 来源不自动算', () => {
  assert.equal(nsfwReason(safe, NO_MARKS, true), null)
  assert.equal(nsfwReason(adult, NO_MARKS, true), 'source')
  assert.equal(nsfwReason(adult, NO_MARKS, false), null)
  assert.equal(nsfwReason(mixed, NO_MARKS, true), null)
  assert.equal(nsfwReason(safe, { manga: {}, categories: [10] }, false), 'category')
  assert.equal(nsfwReason(safe, { manga: { 1: true }, categories: [] }, true), 'manual')
  // 手动放行压过分类和来源
  assert.equal(isNsfw(adult, { manga: { 2: false }, categories: [] }, true), false)
  assert.equal(isNsfw(safe, { manga: { 1: false }, categories: [10] }, true), false)
})

test('NSFW：和分类、来源一致时不留手动键，不一致时写手动值', () => {
  assert.equal(nsfwWrite(safe, NO_MARKS, true, true), '1')
  assert.equal(nsfwWrite(safe, NO_MARKS, true, false), null)
  assert.equal(nsfwWrite(adult, NO_MARKS, true, false), '0')
  assert.equal(nsfwWrite(adult, NO_MARKS, true, true), null)
  // 关掉按来源判定后，来源 NSFW 的作品要手动标才算
  assert.equal(nsfwWrite(adult, NO_MARKS, false, true), '1')
  // 已有手动键时同样按判定结果决定：取消后回到跟随分类
  assert.equal(nsfwWrite(safe, { manga: { 1: true }, categories: [10] }, true, true), null)
})
