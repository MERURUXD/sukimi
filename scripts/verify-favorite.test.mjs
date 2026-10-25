import assert from 'node:assert/strict'
import test from 'node:test'
import { AWAY_MIN_SEC, awayUpdates, FAVORITE_PREFIX, favoriteKey, favoritePrefix, favoritesFirst, favoritesWithNew, parseFavorites } from '../src/features/favorite/favorite.ts'

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
