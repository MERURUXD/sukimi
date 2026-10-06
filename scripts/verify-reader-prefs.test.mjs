import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { buildSchema, executeSync } from 'graphql'
import * as docs from '../src/api/gql/graphql.ts'
import { createDemoData } from '../src/features/demo/data.ts'
import { READER_META_PREFIX, createWriteOrder, hasReaderMeta, mergeMeta, parseReaderMeta, planMigration, readerMetaKey, splitPatch, toReaderMeta } from '../src/features/reader/remote.ts'

const schema = buildSchema(readFileSync(new URL('../src/api/schema.graphql', import.meta.url), 'utf8'))
function ok(rootValue, document, variableValues) {
  const result = executeSync({ schema, rootValue, document, variableValues })
  assert.equal(result.errors, undefined, result.errors?.map((e) => e.message).join('\n'))
  return result.data
}

test('只认识合法的模式 / 方向 / 缩放，其他键和坏值忽略', () => {
  const meta = [
    { key: readerMetaKey('mode'), value: 'webtoon' },
    { key: readerMetaKey('dir'), value: 'upside-down' },
    { key: readerMetaKey('fit'), value: 'width' },
    { key: 'other.client.mode', value: 'single' },
  ]
  assert.deepEqual(parseReaderMeta(meta), { mode: 'webtoon', fit: 'width' })
  assert.deepEqual(parseReaderMeta([]), {})
  assert.equal(hasReaderMeta(meta), true)
  assert.equal(hasReaderMeta([{ key: 'other' }]), false)
})

test('一次修改拆成按漫画存的部分和全局偏好', () => {
  const { local, global } = splitPatch({ mode: 'double', bg: 'white', dir: 'ltr', preload: 5 })
  assert.deepEqual(local, { mode: 'double', dir: 'ltr' })
  assert.deepEqual(global, { bg: 'white', preload: 5 })
  assert.deepEqual(toReaderMeta(local), [
    { key: `${READER_META_PREFIX}mode`, value: 'double' },
    { key: `${READER_META_PREFIX}dir`, value: 'ltr' },
  ])
})

test('写入时同键覆盖，其余元数据保留', () => {
  const merged = mergeMeta([{ key: 'a', value: '1' }, { key: readerMetaKey('mode'), value: 'single' }], [{ key: readerMetaKey('mode'), value: 'vertical' }])
  assert.deepEqual(merged, [{ key: 'a', value: '1' }, { key: readerMetaKey('mode'), value: 'vertical' }])
})

test('旧的浏览器内设置补传时不覆盖服务端已有的键，查不到的漫画丢弃', () => {
  const legacy = { 1: { mode: 'webtoon', dir: 'ltr' }, 2: { fit: 'height' }, 3: { mode: 'double' } }
  const remote = [
    { id: 1, meta: [{ key: readerMetaKey('mode'), value: 'single' }] },
    { id: 2, meta: [] },
    { id: 4, meta: [] },
  ]
  assert.deepEqual(planMigration(legacy, remote), [
    { mangaIds: [1], metas: [{ key: readerMetaKey('dir'), value: 'ltr' }] },
    { mangaIds: [2], metas: [{ key: readerMetaKey('fit'), value: 'height' }] },
  ])
})

test('补传跳过本次会话里用户刚改过的键', () => {
  const legacy = { 1: { mode: 'webtoon', fit: 'width' } }
  const skip = (mangaId, key) => mangaId === 1 && key === readerMetaKey('mode')
  assert.deepEqual(planMigration(legacy, [{ id: 1, meta: [] }], skip), [
    { mangaIds: [1], metas: [{ key: readerMetaKey('fit'), value: 'width' }] },
  ])
})

// 手动控制何时完成的请求，模拟网络快慢
function deferred() {
  let resolve, reject
  const promise = new Promise((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}
const tick = () => new Promise((r) => setTimeout(r, 0))

test('写入排队依次发送：前一个没完成，后一个不会发出', async () => {
  const writes = createWriteOrder()
  const sent = []
  const first = deferred()
  const a = writes.run(() => { sent.push('补传'); return first.promise })
  const b = writes.run(async () => { sent.push('双页') })
  await tick()
  assert.deepEqual(sent, ['补传'])
  first.reject(new Error('网络错误'))
  await assert.rejects(a)
  await b
  assert.deepEqual(sent, ['补传', '双页'], '前一个失败不影响后面')
  await writes.settle()
})

test('连续修改同一设置时，较早的响应不算最新，补传也跳过这个键', () => {
  const writes = createWriteOrder()
  const mode = readerMetaKey('mode')
  assert.equal(writes.touched(1, mode), false)
  const double = writes.mark(1, [mode])
  const vertical = writes.mark(1, [mode])
  assert.equal(writes.isLatest(1, mode, double), false)
  assert.equal(writes.isLatest(1, mode, vertical), true)
  assert.equal(writes.isLatest(2, mode, vertical), false, '别的漫画不受影响')
  assert.equal(writes.touched(1, mode), true)
  assert.equal(writes.touched(1, readerMetaKey('fit')), false)
})

test('演示数据按正式查询读写、统计和清除漫画元数据', () => {
  const root = createDemoData()
  const read = (id) => ok(root, docs.ReaderMangaMetaDocument, { id }).manga.meta
  assert.deepEqual(read(1), [])

  const saved = ok(root, docs.SetReaderMetaDocument, { items: [{ mangaIds: [1], metas: toReaderMeta({ mode: 'webtoon', fit: 'width' }) }] })
  assert.equal(saved.setMangaMetas.metas.length, 2)
  ok(root, docs.SetReaderMetaDocument, { items: [{ mangaIds: [1], metas: toReaderMeta({ mode: 'vertical' }) }, { mangaIds: [2], metas: toReaderMeta({ dir: 'ltr' }) }] })
  assert.deepEqual(parseReaderMeta(read(1)), { mode: 'vertical', fit: 'width' })
  assert.deepEqual(parseReaderMeta(read(2)), { dir: 'ltr' })

  const of = ok(root, docs.ReaderMetaOfDocument, { ids: [2, 3] }).mangas.nodes
  assert.deepEqual(of.map((m) => [m.id, m.meta.length]), [[2, 1], [3, 0]])

  const index = ok(root, docs.ReaderMetaIndexDocument).mangas.nodes.filter((m) => hasReaderMeta(m.meta)).map((m) => m.id)
  assert.deepEqual(index, [1, 2])

  const cleared = ok(root, docs.ClearReaderMetaDocument, { ids: index, prefixes: [READER_META_PREFIX] })
  assert.equal(cleared.deleteMangaMetas.metas.length, 3)
  assert.deepEqual(read(1), [])
  assert.deepEqual(read(2), [])
})
