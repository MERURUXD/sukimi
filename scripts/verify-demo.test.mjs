import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { buildSchema, executeSync } from 'graphql'
import * as docs from '../src/api/gql/graphql.ts'
import { createDemoData } from '../src/features/demo/data.ts'

const schema = buildSchema(readFileSync(new URL('../src/api/schema.graphql', import.meta.url), 'utf8'))
const run = (rootValue, document, variableValues) => executeSync({ schema, rootValue, document, variableValues })
function ok(root, document, variables) {
  const result = run(root, document, variables)
  assert.equal(result.errors, undefined, result.errors?.map((e) => e.message).join('\n'))
  return result.data
}

test('演示数据符合正式首页、书库、详情、历史和发现查询', () => {
  const root = createDemoData()
  for (const [name, variables] of [
    ['RecentReads', {}], ['RecentUpdates', { first: 60, offset: 0, filter: { inLibrary: { equalTo: true } } }],
    ['LibraryMangas', {}], ['Categories', {}], ['MangaDetail', { id: 1 }], ['MangaChapters', { mangaId: 1 }],
    ['History', { first: 100, offset: 0 }], ['LastUpdate', {}], ['Sources', {}], ['SourceFilters', { id: '9000' }],
    ['ExtensionUpdateCount', {}], ['MangaTracks', { id: 1 }],
    ['GalleryCounts', {}], ['GalleryReadChapters', { first: 2000, offset: 0 }],
  ]) {
    assert.ok(docs[`${name}Document`], `${name} 查询存在`)
    ok(root, docs[`${name}Document`], variables)
  }
  const lib = ok(root, docs.LibraryMangasDocument)
  assert.equal(lib.mangas.totalCount, 10)
  assert.equal(lib.mangas.nodes[0].title, '云海邮局')
  assert.ok(lib.mangas.nodes.every((m) => m.thumbnailUrl.startsWith('data:image/svg+xml')))
  // 第 10 部像 Tachiyomi 导入：有已读标记、没有阅读时间
  const imported = lib.mangas.nodes.find((m) => m.id === 10)
  assert.equal(imported.lastReadChapter.lastReadAt, '0')
  assert.equal(imported.latestReadChapter.id, 1002)
  assert.equal(lib.mangas.nodes.find((m) => m.id === 9).latestReadChapter, null)
  const page = ok(root, docs.RecentUpdatesDocument, { first: 2, offset: 0, filter: { isRead: { equalTo: false }, inLibrary: { equalTo: true } } })
  assert.equal(page.chapters.nodes.length, 2)
  assert.ok(page.chapters.pageInfo.hasNextPage)
  assert.ok(page.chapters.nodes.every((c) => !c.isRead))
})

test('画廊：总话数与读过的章节按组合条件筛出', () => {
  const root = createDemoData()
  const counts = ok(root, docs.GalleryCountsDocument).mangas.nodes
  assert.equal(counts.length, 10)
  assert.ok(counts.every((m) => m.chapters.totalCount === 8))
  const read = ok(root, docs.GalleryReadChaptersDocument, { first: 2000, offset: 0 }).chapters
  // 已读或有阅读时间：第 9 部没读过、第 10 部只有已读标记、第 12 部不在书库
  assert.ok(read.nodes.every((c) => c.isRead || Number(c.lastReadAt) > 0))
  assert.ok(read.nodes.every((c) => c.mangaId !== 9 && c.mangaId !== 12))
  assert.deepEqual(read.nodes.filter((c) => c.mangaId === 10).map((c) => [c.id, c.lastReadAt]), [[1001, '0'], [1002, '0']])
  assert.deepEqual(read.nodes.map((c) => c.id), [...read.nodes.map((c) => c.id)].sort((a, b) => a - b))
  const page = ok(root, docs.GalleryReadChaptersDocument, { first: 5, offset: 5 }).chapters
  assert.equal(page.nodes.length, 5)
  assert.deepEqual(page.nodes.map((c) => c.id), read.nodes.slice(5, 10).map((c) => c.id))
})

test('开发用大书库：规模可控、编号不冲突、结果稳定', () => {
  const now = Date.UTC(2026, 9, 9, 12)
  const root = createDemoData(now, [], { scale: 50 })
  const lib = ok(root, docs.LibraryMangasDocument).mangas.nodes
  assert.equal(lib.length, 60)
  assert.equal(new Set(lib.map((m) => m.thumbnailUrl)).size, 60)
  assert.ok(lib.every((m) => !m.thumbnailUrl.includes('undefined')))
  const ids = []
  for (let offset = 0, more = true; more; offset += 2000) {
    const page = ok(root, docs.GalleryReadChaptersDocument, { first: 2000, offset }).chapters
    ids.push(...page.nodes.map((c) => c.id))
    more = page.pageInfo.hasNextPage
  }
  assert.equal(new Set(ids).size, ids.length)
  assert.ok(ids.length > 500)
  const again = createDemoData(now, [], { scale: 50 })
  assert.equal(ok(again, docs.GalleryReadChaptersDocument, { first: 1, offset: 300 }).chapters.nodes[0].lastReadAt,
    ok(root, docs.GalleryReadChaptersDocument, { first: 1, offset: 300 }).chapters.nodes[0].lastReadAt)
})

test('阅读页生成本地图片，进度修改只影响当前演示实例', () => {
  const root = createDemoData()
  const other = createDemoData()
  const pages = ok(root, docs.FetchChapterPagesDocument, { chapterId: 103 }).fetchChapterPages.pages
  assert.equal(pages.length, 6)
  assert.ok(pages.every((url) => url.startsWith('data:image/svg+xml')))
  const saved = ok(root, docs.SaveProgressDocument, { id: 103, lastPageRead: 5, isRead: true })
  assert.equal(saved.updateChapter.chapter.manga.unreadCount, 5)
  assert.equal(ok(other, docs.MangaDetailDocument, { id: 1 }).manga.unreadCount, 6)
  assert.equal(ok(root, docs.MangaChaptersDocument, { mangaId: 1 }).chapters.nodes[2].lastPageRead, 5)
})

test('书库、分类、章节状态和历史隐藏在演示内生效', () => {
  const root = createDemoData()
  ok(root, docs.SetMangaInLibraryDocument, { id: 11, inLibrary: true })
  assert.equal(ok(root, docs.LibraryMangasDocument).mangas.totalCount, 11)
  ok(root, docs.SetMangaCategoriesDocument, { id: 1, add: [2], remove: [1] })
  assert.deepEqual(ok(root, docs.MangaDetailDocument, { id: 1 }).manga.categories.nodes.map((c) => c.id), [2])
  const result = ok(root, docs.UpdateChaptersDocument, { ids: [104, 105], patch: { isRead: true, isBookmarked: true } })
  assert.equal(result.updateChapters.chapters[0].manga.bookmarkCount, 3)
  ok(root, docs.HideHistoryDocument, { ids: [103], key: 'suwayomi-web.historyHiddenAt', value: '9999999999' })
  assert.equal(ok(root, docs.HistoryDocument, { first: 100, offset: 0 }).chapters.nodes.find((c) => c.id === 103).meta[0].value, '9999999999')
})

test('发现搜索与分页只使用虚构作品', () => {
  const root = createDemoData()
  const result = ok(root, docs.FetchSourceMangaDocument, { source: '9000', type: 'SEARCH', page: 1, query: '云海' }).fetchSourceManga
  assert.deepEqual(result.mangas.map((m) => m.title), ['云海邮局'])
  assert.equal(result.hasNextPage, false)
  assert.equal(ok(root, docs.FetchSourceMangaDocument, { source: '9000', type: 'POPULAR', page: 2 }).fetchSourceManga.mangas.length, 0)
})

test('不支持的操作和不存在的漫画明确拒绝，不回退到真实服务端', () => {
  const root = createDemoData()
  const result = run(root, docs.EnqueueDownloadsDocument, { ids: [103] })
  assert.match(result.errors[0].message, /演示模式只在本地运行/)
  assert.match(run(root, docs.MangaDetailDocument, { id: 999 }).errors[0].message, /不在演示书库/)
})
