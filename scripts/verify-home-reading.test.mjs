import test from 'node:test'
import assert from 'node:assert/strict'
import { readingTarget } from '../src/features/home/reading.ts'

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
