import assert from 'node:assert/strict'
import test from 'node:test'
import { caughtUp, LATER_PREFIX, laterKey, parseLater } from '../src/features/later/later.ts'

test('稍后再看：键按漫画 id 拼前缀，解析时忽略别的键和坏值', () => {
  assert.equal(laterKey(42), `${LATER_PREFIX}42`)
  const map = parseLater([
    { key: laterKey(1), value: '1700000000' },
    { key: laterKey(2), value: 'abc' },
    { key: `${LATER_PREFIX}x`, value: '1700000000' },
    { key: `${LATER_PREFIX}-3`, value: '1700000000' },
    { key: 'sukimi.reader.mode', value: 'single' },
    { key: laterKey(5), value: '0' },
  ])
  assert.deepEqual([...map], [[1, 1700000000], [5, 0]])
  assert.equal(parseLater().size, 0)
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
