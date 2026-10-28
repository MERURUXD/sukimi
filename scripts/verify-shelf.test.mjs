import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { buildSchema, executeSync } from 'graphql'
import * as docs from '../src/api/gql/graphql.ts'
import { createDemoData } from '../src/features/demo/data.ts'
import { inCategory } from '../src/features/library/category.ts'
import { isShelved, SHELF_META, shelfIds, withoutShelf } from '../src/features/shelf/shelf.ts'

const cat = (id, meta = []) => ({ id, name: `虚构分类 ${id}`, meta })
const tag = [{ key: SHELF_META, value: '1' }]
const manga = (...ids) => ({ categories: { nodes: ids.map((id) => ({ id })) } })

test('搁置：只认带元数据的分类，不看名称；两台设备各建了一个时都算', () => {
  const cats = [cat(1), { ...cat(2), name: '搁置' }, cat(3, tag), cat(4, [{ key: 'other', value: '1' }]), cat(7, tag)]
  assert.deepEqual([...shelfIds(cats)].sort(), [3, 7])
  assert.equal(shelfIds().size, 0)
  assert.deepEqual(withoutShelf(cats, shelfIds(cats)).map((c) => c.id), [1, 2, 4])
})

test('搁置：漫画在任一搁置分类里就算搁置', () => {
  const shelf = new Set([3, 7])
  assert.equal(isShelved(manga(1, 7), shelf), true)
  assert.equal(isShelved(manga(1, 2), shelf), false)
  assert.equal(isShelved(manga(), shelf), false)
})

test('搁置：只在搁置分类里的漫画仍归默认分类，在其他分类里的照旧', () => {
  const shelf = new Set([3])
  assert.equal(inCategory(manga(3), 0, 0, shelf), true)
  assert.equal(inCategory(manga(3), 3, 0, shelf), false)
  assert.equal(inCategory(manga(1, 3), 0, 0, shelf), false)
  assert.equal(inCategory(manga(1, 3), 1, 0, shelf), true)
  // 非管理员的默认分类 id 不是 0
  assert.equal(inCategory(manga(3), 5, 5, shelf), true)
  assert.equal(inCategory(manga(3), 0, 0, new Set()), false)
})

const schema = buildSchema(readFileSync(new URL('../src/api/schema.graphql', import.meta.url), 'utf8'))
function ok(root, document, variables) {
  const result = executeSync({ schema, rootValue: root, document, variableValues: variables })
  assert.equal(result.errors, undefined, result.errors?.map((e) => e.message).join('\n'))
  return result.data
}

test('演示：建搁置分类、打标记、放入和移出漫画都在内存里生效', () => {
  const root = createDemoData(1_700_000_000_000)
  const before = ok(root, docs.CategoriesDocument).categories.nodes
  assert.equal(shelfIds(before).size, 0)
  const { id } = ok(root, docs.CreateShelfDocument, { name: '搁置' }).createCategory.category
  ok(root, docs.TagShelfDocument, { id, key: SHELF_META })
  const shelf = shelfIds(ok(root, docs.CategoriesDocument).categories.nodes)
  assert.deepEqual([...shelf], [id])
  const added = ok(root, docs.SetMangasCategoriesDocument, { ids: [1], add: [id] }).updateMangasCategories.mangas[0]
  assert.equal(isShelved(added, shelf), true)
  assert.ok(added.categories.nodes.length > 1, '原来的分类保留')
  const removed = ok(root, docs.SetMangasCategoriesDocument, { ids: [1], remove: [...shelf] }).updateMangasCategories.mangas[0]
  assert.equal(isShelved(removed, shelf), false)
})
