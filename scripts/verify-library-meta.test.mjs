import assert from 'node:assert/strict'
import test from 'node:test'
import { AWAY_MIN_SEC, awayUpdates, FAVORITE_PREFIX, favoriteKey, favoritePrefix, favoritesFirst, favoritesWithNew, parseFavorites } from '../src/features/favorite/favorite.ts'
import { caughtUp, LATER_PREFIX, laterKey, laterPrefix, parseLater } from '../src/features/later/later.ts'
import { categoryNsfwKey, isNsfw, mangaNsfwKey, NO_MARKS, NSFW_PREFIX, nsfwReason, nsfwWrite, parseNsfw } from '../src/features/nsfw/nsfw.ts'

test('特别关心：键按账号与漫画 id 拼前缀，只认当前账号、忽略坏值', () => {
  assert.equal(favoriteKey(7, 42), `${FAVORITE_PREFIX}7.42`)
  assert.equal(favoritePrefix(0), `${FAVORITE_PREFIX}0.`)
  const metas = [
    { key: favoriteKey(7, 1), value: '1700000000' },
    { key: favoriteKey(7, 2), value: 'abc' },
    { key: `${favoritePrefix(7)}x`, value: '1' },
    { key: favoriteKey(70, 3), value: '1' },
    { key: 'sukimi.later.7.4', value: '1' },
  ]
  assert.deepEqual([...parseFavorites(7, metas)], [[1, 1700000000]])
  assert.equal(parseFavorites(7).size, 0)
})

const m = (id, unreadCount, fetchedAt) => ({ id, unreadCount, latestFetchedChapter: fetchedAt === null ? null : { fetchedAt: String(fetchedAt) } })
const library = [m(1, 0, 900), m(2, 3, 500), m(3, 1, 800), m(4, 5, 950), m(5, 2, null)]
const favorites = new Map([[1, 0], [2, 0], [3, 0], [5, 0], [99, 0]])

test('特别关心：首页只要有未读的，最近抓到新章节的在前；不在书库的不出现', () => {
  assert.deepEqual(favoritesWithNew(library, favorites).map((x) => x.id), [3, 2, 5])
})

test('特别关心：离开期间的更新只算离开之后抓到的，离开太短或没有记录不提示', () => {
  const now = 10_000
  assert.deepEqual(awayUpdates(library, favorites, 600, now).map((x) => x.id), [3])
  assert.deepEqual(awayUpdates(library, favorites, 400, now).map((x) => x.id), [3, 2])
  assert.deepEqual(awayUpdates(library, favorites, null, now), [])
  assert.deepEqual(awayUpdates(library, favorites, now - AWAY_MIN_SEC + 1, now), [])
})

test('特别关心：置顶保持两组内部顺序，没有标记时顺序不变', () => {
  const list = [m(4, 0, 0), m(3, 0, 0), m(9, 0, 0), m(1, 0, 0)]
  assert.deepEqual(favoritesFirst(list, favorites).map((x) => x.id), [3, 1, 4, 9])
  assert.deepEqual(favoritesFirst(list, new Set()), list)
})

test('稍后再看：键按账号与漫画 id 拼前缀，解析时忽略别的键和坏值', () => {
  assert.equal(laterKey(7, 42), `${LATER_PREFIX}7.42`)
  assert.equal(laterPrefix(0), `${LATER_PREFIX}0.`)
  const map = parseLater(7, [
    { key: laterKey(7, 1), value: '1700000000' },
    { key: laterKey(7, 2), value: 'abc' },
    { key: `${laterPrefix(7)}x`, value: '1700000000' },
    { key: `${laterPrefix(7)}-3`, value: '1700000000' },
    { key: 'sukimi.reader.mode', value: 'single' },
    { key: laterKey(7, 5), value: '0' },
  ])
  assert.deepEqual([...map], [[1, 1700000000], [5, 0]])
  assert.equal(parseLater(7).size, 0)
})

test('稍后再看：只认当前账号的键，id 前缀相同的别的账号也不混入', () => {
  const metas = [
    { key: laterKey(1, 10), value: '100' },
    { key: laterKey(12, 20), value: '200' },
    { key: `${LATER_PREFIX}10`, value: '300' },
  ]
  assert.deepEqual([...parseLater(1, metas)], [[10, 100]])
  assert.deepEqual([...parseLater(12, metas)], [[20, 200]])
  assert.equal(parseLater(2, metas).size, 0)
})

test('稍后再看：加入后读完已有章节才算读完', () => {
  const at = 1000
  assert.equal(caughtUp({ hasChapters: true, unread: 0, lastReadAt: 1001 }, at), true)
  // 加入前就已追平（等更新的），加入后没再读过，不移出
  assert.equal(caughtUp({ hasChapters: true, unread: 0, lastReadAt: 999 }, at), false)
  assert.equal(caughtUp({ hasChapters: true, unread: 0, lastReadAt: 0 }, at), false)
  // 还没抓过章节的漫画未读数也是 0，不能算读完
  assert.equal(caughtUp({ hasChapters: false, unread: 0, lastReadAt: 2000 }, at), false)
  assert.equal(caughtUp({ hasChapters: true, unread: 1, lastReadAt: 2000 }, at), false)
})

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
