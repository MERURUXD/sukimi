import assert from 'node:assert/strict'
import test from 'node:test'
import { atChapterEnd, progressAt, progressOnLeave, progressVariables } from '../src/features/reader/progress.ts'

test('读到结尾：最后一页在当前屏里才算，拆成两半的宽页要读到后一半', () => {
  assert.equal(atChapterEnd([8], 9, false, 0), false)
  assert.equal(atChapterEnd([9], 9, false, 0), true)
  // 双页模式最后一屏是两页
  assert.equal(atChapterEnd([8, 9], 9, false, 0), true)
  assert.equal(atChapterEnd([9], 9, true, 0), false)
  assert.equal(atChapterEnd([9], 9, true, 1), true)
})

test('翻页进度：停在服务端已记下的那一页且没读完时不写', () => {
  const chapter = { lastPageRead: 3, isRead: false }
  assert.equal(progressAt(chapter, 3, false), null)
  assert.deepEqual(progressAt(chapter, 4, false), { page: 4, read: false })
  // 往回翻也要记下，下次从这里续读
  assert.deepEqual(progressAt(chapter, 1, false), { page: 1, read: false })
})

test('翻页进度：读到结尾时标为已读，已读的话只更新页码', () => {
  assert.deepEqual(progressAt({ lastPageRead: 3, isRead: false }, 9, true), { page: 9, read: true })
  // 上次就停在最后一页，再次读到结尾仍要标记
  assert.deepEqual(progressAt({ lastPageRead: 9, isRead: false }, 9, true), { page: 9, read: true })
  assert.deepEqual(progressAt({ lastPageRead: 0, isRead: true }, 9, true), { page: 9, read: false })
  // 重读已读的话：从第 1 页开始翻不会把它改回未读
  assert.deepEqual(progressAt({ lastPageRead: 0, isRead: true }, 2, false), { page: 2, read: false })
})

test('换话：往后翻算这一话读完，往前翻沿用已记下的进度', () => {
  const from = { sourceOrder: 5, isRead: false }
  assert.deepEqual(progressOnLeave(from, { sourceOrder: 6 }, 19), { page: 19, read: true })
  assert.equal(progressOnLeave(from, { sourceOrder: 4 }, 19), null)
  assert.deepEqual(progressOnLeave({ sourceOrder: 5, isRead: true }, { sourceOrder: 6 }, 19), { page: 19, read: false })
})

test('写入参数：没读完时不传 isRead', () => {
  assert.deepEqual(progressVariables(42, { page: 3, read: false }), { id: 42, lastPageRead: 3, isRead: undefined })
  assert.deepEqual(progressVariables(42, { page: 9, read: true }), { id: 42, lastPageRead: 9, isRead: true })
})
