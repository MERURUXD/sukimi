import assert from 'node:assert/strict'
import test from 'node:test'
import { caughtUp, LATER_PREFIX, laterKey, laterPrefix, parseLater } from '../src/features/later/later.ts'

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
