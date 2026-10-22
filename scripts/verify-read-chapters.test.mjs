import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { buildSchema, executeSync } from 'graphql'
import { GalleryReadChaptersDocument } from '../src/api/gql/graphql.ts'
import { createDemoData } from '../src/features/demo/data.ts'
import { reuseReadChapters } from '../src/features/gallery/readChapters.ts'
import { summarize } from '../src/features/gallery/stats.ts'
import { hiddenKey, isVisible } from '../src/features/history/history.ts'

const now = Date.UTC(2026, 9, 22, 4)
const schema = buildSchema(readFileSync(new URL('../src/api/schema.graphql', import.meta.url), 'utf8'))
const rootValue = createDemoData(now)
const response = () => {
  const result = executeSync({ schema, rootValue, document: GalleryReadChaptersDocument, variableValues: { first: 2000, offset: 0 } })
  assert.equal(result.errors, undefined)
  return result.data.chapters.nodes
}

test('阅读记录：真实查询返回同样内容的新对象时，复用旧数组且不修改响应', () => {
  const previous = response(), next = response()
  assert.notEqual(previous, next)
  assert.notEqual(previous[0], next[0])
  for (const c of [...previous, ...next]) { c.meta.forEach(Object.freeze); Object.freeze(c.meta); Object.freeze(c) }
  Object.freeze(previous); Object.freeze(next)
  assert.equal(reuseReadChapters(previous, next), previous)
  assert.equal(reuseReadChapters(previous, previous), previous)
})

test('阅读记录：编号、归属、已读、页数或时间变化时必须交付新数组', () => {
  const previous = response()
  for (const patch of [{ id: previous[0].id + 1 }, { mangaId: previous[0].mangaId + 1 }, { isRead: !previous[0].isRead }, { pageCount: previous[0].pageCount + 1 }, { lastReadAt: String(Number(previous[0].lastReadAt) + 1) }]) {
    const next = structuredClone(previous)
    Object.assign(next[0], patch)
    assert.equal(reuseReadChapters(previous, next), next, JSON.stringify(patch))
  }
})

test('阅读记录：新增、删除、换序和空结果不会误用旧列表', () => {
  const previous = response()
  for (const next of [previous.slice(1), [...previous, { ...previous[0], id: 999999 }], [...previous].reverse(), []]) {
    assert.equal(reuseReadChapters(previous, next), next)
  }
  const empty = [], nextEmpty = []
  assert.equal(reuseReadChapters(null, previous), previous)
  assert.equal(reuseReadChapters(empty, nextEmpty), empty)
})

test('阅读记录：元数据增删、键名和值变化都能刷新，历史隐藏不被旧数组吞掉', () => {
  const previous = response()
  const i = previous.findIndex(c => Number(c.lastReadAt) > 0 && isVisible(c, 1))
  const next = structuredClone(previous)
  next[i].meta = [...next[i].meta, { key: hiddenKey(1), value: next[i].lastReadAt }]
  assert.equal(reuseReadChapters(previous, next), next)
  const mangas = [{ id: previous[i].mangaId, total: 100 }]
  const before = summarize(previous, mangas, now, 1), after = summarize(next, mangas, now, 1)
  assert.equal(after.read, before.read)
  assert.equal(after.hours.reduce((a,b)=>a+b,0), before.hours.reduce((a,b)=>a+b,0)-1)
  const removed = structuredClone(next)
  removed[i].meta.pop()
  assert.equal(reuseReadChapters(next, removed), removed)
  const changed = structuredClone(next)
  changed[i].meta.at(-1).value = String(Number(changed[i].meta.at(-1).value) - 1)
  assert.equal(reuseReadChapters(next, changed), changed)
  const renamed = structuredClone(next)
  renamed[i].meta.at(-1).key = hiddenKey(2)
  assert.equal(reuseReadChapters(next, renamed), renamed)
})
