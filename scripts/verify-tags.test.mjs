import assert from 'node:assert/strict'
import test from 'node:test'
import { addTag, changedTags, filterTags, hasTag, hideSource, knownTags, libraryTags, matchTags, mergeTags, NO_EDIT, parseTags, removeTag, renameTag, serializeTags, sourceTags, tagsKey, tagsOf, tagUsage } from '../src/features/tags/tags.ts'

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

test('标签管理：统计自己加的标签用在几部上，大小写不同算一个', () => {
  const usage = tagUsage([{ add: ['乙', '甲'], hide: [] }, { add: ['甲', 'Ab'], hide: [] }, { add: ['ab'], hide: ['丙'] }])
  assert.deepEqual(usage, [{ name: '甲', count: 2 }, { name: 'Ab', count: 2 }, { name: '乙', count: 1 }])
})

test('标签管理：改名保持位置，改成已有的就合并，只改大小写也生效，不去取消隐藏', () => {
  const edit = { add: ['甲', '乙', 'romance'], hide: ['丙'] }
  assert.deepEqual(renameTag(edit, '甲', '丁'), { add: ['丁', '乙', 'romance'], hide: ['丙'] })
  assert.deepEqual(renameTag(edit, '甲', ' 乙 '), { add: ['乙', 'romance'], hide: ['丙'] })
  assert.deepEqual(renameTag(edit, 'romance', 'Romance'), { add: ['甲', '乙', 'Romance'], hide: ['丙'] })
  assert.deepEqual(renameTag(edit, '甲', '丙'), { add: ['丙', '乙', 'romance'], hide: ['丙'] })
  assert.equal(renameTag(edit, '没有', '丁'), edit)
  assert.equal(renameTag(edit, '甲', '  '), edit)
})

test('标签管理：批量改动只返回变了的漫画，删空的给 null', () => {
  const edits = new Map([
    [1, { add: ['甲'], hide: [] }],
    [2, { add: ['甲', '乙'], hide: [] }],
    [3, { add: ['乙'], hide: [] }],
    [4, { add: ['甲'], hide: ['丙'] }],
  ])
  const out = changedTags(edits, (e) => removeTag(e, '甲'))
  assert.deepEqual([...out], [[1, null], [2, serializeTags({ add: ['乙'], hide: [] })], [4, serializeTags({ add: [], hide: ['丙'] })]])
  assert.equal(changedTags(edits, (e) => renameTag(e, '没有', '丁')).size, 0)
})

test('口味统计：自建标签和来源标签一起排，隐藏的来源标签不计入，自己加的「完结」也算', async () => {
  const { readTaste } = await import('../src/features/gallery/taste.ts')
  const byId = new Map([
    [1, { genre: ['恋爱', '奇幻'], author: '虚构作者甲' }],
    [2, { genre: ['Romance'], author: '虚构作者乙' }],
    [3, { genre: ['科幻'], author: '虚构作者丙', nsfw: true }],
  ])
  const edits = new Map([[1, { add: ['二刷', '完结'], hide: ['奇幻'] }]])
  const read = [{ id: 1, read: 60, pages: 0 }, { id: 2, read: 30, pages: 0 }, { id: 3, read: 90, pages: 0 }]
  const taste = readTaste(read, byId, (m) => !!m.nsfw, (id, m) => filterTags(m.genre, edits.get(id)))
  assert.deepEqual(taste.genres.map((g) => [g.name, g.read, g.works]), [['恋爱', 50, 2], ['二刷', 20, 1], ['完结', 20, 1]])
  // 不给取标签函数时照旧只按来源标签
  assert.deepEqual(readTaste(read, byId, (m) => !!m.nsfw).genres.map((g) => g.name), ['恋爱', '奇幻'])
})
