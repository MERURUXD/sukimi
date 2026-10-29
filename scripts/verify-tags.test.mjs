import assert from 'node:assert/strict'
import test from 'node:test'
import { addTag, filterTags, hasTag, hideSource, knownTags, libraryTags, matchTags, mergeTags, NO_EDIT, parseTags, removeTag, serializeTags, sourceTags, tagsKey, tagsOf } from '../src/features/tags/tags.ts'

const genre = ['恋爱', '校园', '连载中', 'Romance']

test('自建标签：只认当前账号的键，坏键和坏值忽略，空编辑不算', () => {
  const metas = [
    { key: tagsKey(7, 1), value: JSON.stringify({ add: ['虚构标签甲', ' 虚构标签甲 ', ''], hide: ['连载中'] }) },
    { key: tagsKey(8, 1), value: JSON.stringify({ add: ['别的账号'] }) },
    { key: tagsKey(7, 2), value: '{坏的' },
    { key: `${tagsKey(7, 0)}`, value: JSON.stringify({ add: ['零号'] }) },
    { key: tagsKey(7, 3), value: JSON.stringify({ add: [], hide: [] }) },
    { key: tagsKey(7, 4), value: JSON.stringify({ add: '不是数组', hide: [3] }) },
  ]
  const map = parseTags(7, metas)
  assert.deepEqual([...map.keys()], [1])
  assert.deepEqual(map.get(1), { add: ['虚构标签甲'], hide: ['连载中'] })
})

test('自建标签：显示的是来源去掉隐藏的，再接上自己加的，不分大小写去重', () => {
  const edit = { add: ['虚构标签甲', 'romance'], hide: ['连载中'] }
  assert.deepEqual(tagsOf(genre, edit), ['恋爱', '校园', 'Romance', '虚构标签甲'])
  assert.deepEqual(sourceTags(genre, edit), { shown: ['恋爱', '校园', 'Romance'], hidden: ['连载中'] })
  assert.deepEqual(tagsOf(null), [])
  assert.equal(hasTag(genre, edit, ' 虚构标签甲 '), true)
  assert.equal(hasTag(genre, edit, '连载中'), false)
})

test('自建标签：加一个被隐藏的来源标签等于取消隐藏，重复加不变', () => {
  let e = hideSource(NO_EDIT, '连载中', true)
  assert.deepEqual(e, { add: [], hide: ['连载中'] })
  e = addTag(e, '连载中')
  assert.deepEqual(e, { add: [], hide: [] })
  e = addTag(addTag(e, '虚构标签乙'), '虚构标签乙')
  assert.deepEqual(e.add, ['虚构标签乙'])
  assert.equal(addTag(e, '   '), e)
  assert.deepEqual(removeTag(e, '虚构标签乙'), NO_EDIT)
  assert.equal(serializeTags(NO_EDIT), null)
  assert.deepEqual(JSON.parse(serializeTags(e)), { add: ['虚构标签乙'], hide: [] })
})

test('自建标签：补全按用过的部数排序', () => {
  const list = knownTags([{ add: ['乙', '甲'], hide: [] }, { add: ['甲'], hide: [] }, { add: [], hide: ['丙'] }])
  assert.deepEqual(list, ['甲', '乙'])
})

test('自建标签：换源迁移时并进新漫画已有的标签，不丢任何一边', () => {
  const from = { add: ['甲', '乙'], hide: ['连载中'] }
  assert.deepEqual(mergeTags(from), { add: ['甲', '乙'], hide: ['连载中'] })
  assert.deepEqual(mergeTags(from, { add: ['乙', '丙'], hide: [] }), { add: ['乙', '丙', '甲'], hide: ['连载中'] })
})

test('标签筛选：来源归一并去掉无意义的词，自己加的只合并同义写法', () => {
  const edit = { add: ['完结', 'romance', '虚构标签甲'], hide: ['校园'] }
  assert.deepEqual(filterTags(['Romance', '爱情', '校园', '连载中', '日常'], edit), ['恋爱', '日常', '完结', '虚构标签甲'])
  assert.deepEqual(filterTags(null), [])
})

test('标签筛选：书库标签按部数排序，包含任一、排除一个都不能有', () => {
  const list = [{ id: 1, genre: ['恋爱', '校园'] }, { id: 2, genre: ['Romance'] }, { id: 3, genre: [] }]
  const edits = new Map([[3, { add: ['虚构标签甲'], hide: [] }], [1, { add: [], hide: ['校园'] }]])
  assert.deepEqual(libraryTags(list, edits), [{ name: '恋爱', count: 2 }, { name: '虚构标签甲', count: 1 }])
  assert.equal(matchTags(['恋爱'], {}), true)
  assert.equal(matchTags(['恋爱'], { 恋爱: 1, 日常: 1 }), true)
  assert.equal(matchTags(['校园'], { 恋爱: 1 }), false)
  assert.equal(matchTags(['恋爱', '恐怖'], { 恋爱: 1, 恐怖: 2 }), false)
  assert.equal(matchTags(['日常'], { 恐怖: 2 }), true)
  assert.equal(matchTags(['ROMANCE'], { romance: 1 }), true)
})
