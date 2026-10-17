import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { CACHE_MS, isFresh, parseSubject, pickMatch, shortCount } from '../src/features/bangumi/rating.ts'

/** 和公开接口同形的虚构条目 */
const raw = (id, o = {}) => ({
  id, name: `虚构条目 ${id}`, name_cn: '', platform: '漫画', series: true,
  rating: { rank: 12, total: 30, score: 7.4, count: { 1: 1, 7: 20, 8: 9 } },
  collection: { wish: 5, doing: 4, collect: 3, on_hold: 2, dropped: 1 },
  tags: [{ name: '奇幻', count: 9, total_count: 99 }],
  ...o,
})

test('条目换成界面用的形状，分布按 1–10 分排好，缺的分数记 0', () => {
  const s = parseSubject(raw(7))
  assert.equal(s.id, 7)
  assert.equal(s.score, 7.4)
  assert.deepEqual(s.counts, [1, 0, 0, 0, 0, 0, 20, 9, 0, 0])
  assert.deepEqual(s.collection, { wish: 5, doing: 4, collect: 3, onHold: 2, dropped: 1 })
  assert.deepEqual(s.tags, [{ name: '奇幻', count: 9 }])
})

test('缺评分、缺收藏的条目不报错，全部按 0 处理；排名 0 表示暂无排名', () => {
  const s = parseSubject({ id: 3, name: '虚构' })
  assert.equal(s.score, 0)
  assert.equal(s.rank, 0)
  assert.equal(s.counts.length, 10)
  assert.ok(s.counts.every((n) => n === 0))
  assert.equal(s.collection.dropped, 0)
  assert.deepEqual(s.tags, [])
})

test('按标题挑条目：漫画系列优先，跳过同名小说和单行本', () => {
  const list = [
    raw(1, { platform: '小说', series: true }),
    raw(2, { platform: '漫画', series: false }),
    raw(3, { platform: '漫画', series: true }),
  ].map(parseSubject)
  assert.equal(pickMatch(list)?.id, 3)
  // 没有漫画系列时退而求其次
  assert.equal(pickMatch(list.slice(0, 2))?.id, 2)
  assert.equal(pickMatch([parseSubject(raw(4, { platform: '画集', series: false }))]), null)
  assert.equal(pickMatch([]), null)
})

test('缓存一天内有效，时间倒退或没有时间都算过期', () => {
  const now = 1_800_000_000_000
  assert.ok(isFresh(now - CACHE_MS + 1, now))
  assert.ok(!isFresh(now - CACHE_MS, now))
  assert.ok(!isFresh(0, now))
  assert.ok(!isFresh(now + 1000, now))
})

test('人数缩写：一万以上写「万」，以下加千分位', () => {
  assert.equal(shortCount(950), '950')
  assert.equal(shortCount(2415), '2,415')
  assert.equal(shortCount(12000), '1.2万')
  assert.equal(shortCount(30000), '3万')
})

test('演示与 /dev/* 验收页走虚构数据，不请求 api.bgm.tv、不写本地存储', () => {
  const src = readFileSync(new URL('../src/features/bangumi/api.ts', import.meta.url), 'utf8')
  assert.match(src, /const fake = isDemo \|\| isDevLab/)
  // 两处外部请求都先判断 fake
  assert.match(src, /if \(fake\) return fakeSubject\(id\)/)
  assert.match(src, /fake\s*\?\s*await fakeSearch\(keyword\)/)
  assert.match(src, /if \(persist && !fake\)/)
  assert.match(src, /if \(!fake\) \{\s*try \{\s*const raw = localStorage/)
})
