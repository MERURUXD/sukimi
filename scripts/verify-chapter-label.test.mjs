import assert from 'node:assert/strict'
import test from 'node:test'
import { chapterLabel } from '../src/lib/format.ts'
import { lastRead, nextToRead } from '../src/features/manga/progress.ts'

// 虚构章节；lastReadAt 为秒，0 表示没读过
const ch = (id, extra = {}) => ({ id, sourceOrder: id, isRead: false, lastReadAt: '0', ...extra })

test('章节显示名直接用章节名，没有名字时才按话数拼', () => {
  assert.equal(chapterLabel({ name: '第181话', chapterNumber: 181 }), '第181话')
  assert.equal(chapterLabel({ name: 'Vol.2 Ch.13 新的朋友', chapterNumber: 13 }), 'Vol.2 Ch.13 新的朋友')
  assert.equal(chapterLabel({ name: '  ', chapterNumber: 12.5 }), '第 12.5 话')
  assert.equal(chapterLabel({ name: '', chapterNumber: -1 }), '未命名章节')
})

test('服务端给出阅读时间为 0 的最近章节时，仍算没读过', () => {
  const list = [ch(1), ch(2), ch(3)]
  assert.equal(lastRead(list, 1), undefined)
  assert.deepEqual(nextToRead(list, 1), { chapter: list[0], verb: '开始阅读' })
  assert.equal(nextToRead([], 1), null)
})

test('读到一半继续这一话，读完接下一话未读', () => {
  const list = [ch(1, { isRead: true, lastReadAt: '100' }), ch(2, { lastReadAt: '200' }), ch(3)]
  assert.equal(lastRead(list, 2), list[1])
  assert.deepEqual(nextToRead(list, 2), { chapter: list[1], verb: '继续阅读' })
  list[1].isRead = true
  assert.deepEqual(nextToRead(list, 2), { chapter: list[2], verb: '继续阅读' })
  list[2].isRead = true
  assert.deepEqual(nextToRead(list, 2), { chapter: list[0], verb: '重新阅读' })
})

test('没有阅读记录但手动标过已读，从第一话未读接着读', () => {
  const list = [ch(1, { isRead: true }), ch(2), ch(3)]
  assert.deepEqual(nextToRead(list, undefined), { chapter: list[1], verb: '继续阅读' })
})
