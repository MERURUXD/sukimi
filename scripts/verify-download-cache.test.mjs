import assert from 'node:assert/strict'
import test from 'node:test'
import { gql } from '@apollo/client'
import { createCache } from '../src/api/cache.ts'
import { markCompletedDownloads } from '../src/api/downloadCache.ts'

// 同一查询同时展示章节和漫画，能观察到逐项广播产生的中间状态。
const query = gql`query DownloadBadges {
  mangas { nodes { id downloadCount } }
  chapters { nodes { id isDownloaded } }
}`
const initial = () => ({
  mangas: { __typename: 'MangaNodeList', nodes: [
    { __typename: 'MangaType', id: 1, downloadCount: 4 },
    { __typename: 'MangaType', id: 2, downloadCount: 0 },
  ] },
  chapters: { __typename: 'ChapterNodeList', nodes: [11, 12, 21].map(id => ({ __typename: 'ChapterType', id, isDownloaded: false })) },
})
const finished = [
  { chapter: { id: 11 }, manga: { id: 1 } },
  { chapter: { id: 12 }, manga: { id: 1 } },
  { chapter: { id: 21 }, manga: { id: 2 } },
]

test('一批下载完成只通知一次，章节和漫画角标同时更新', () => {
  const cache = createCache()
  cache.writeQuery({ query, data: initial() })
  const results = []
  const off = cache.watch({ query, optimistic: false, callback: diff => results.push(diff.result) })
  cache.broadcastWatches()
  results.length = 0
  markCompletedDownloads(cache, finished)
  assert.equal(results.length, 1, '订阅者不应收到每个章节和漫画逐项修改的中间结果')
  assert.deepEqual(results[0].mangas.nodes.map(m => m.downloadCount), [6, 1])
  assert.ok(results[0].chapters.nodes.every(c => c.isDownloaded))
  off()
})

test('没有完成项时不通知，单项完成仍更新两类状态', () => {
  const cache = createCache()
  cache.writeQuery({ query, data: initial() })
  let notifications = 0
  const off = cache.watch({ query, optimistic: false, callback: () => notifications++ })
  cache.broadcastWatches()
  notifications = 0
  markCompletedDownloads(cache, [])
  assert.equal(notifications, 0)
  markCompletedDownloads(cache, finished.slice(0, 1))
  const result = cache.readQuery({ query })
  assert.deepEqual(result.mangas.nodes.map(m => m.downloadCount), [5, 0])
  assert.deepEqual(result.chapters.nodes.map(c => c.isDownloaded), [true, false, false])
  assert.equal(notifications, 1)
  off()
})

test('章节未进入缓存时仍更新已缓存的漫画，不创建残缺章节', () => {
  const cache = createCache()
  cache.writeQuery({ query, data: initial() })
  markCompletedDownloads(cache, [{ chapter: { id: 99 }, manga: { id: 1 } }])
  assert.equal(cache.readQuery({ query }).mangas.nodes[0].downloadCount, 5)
  assert.equal(cache.extract()['ChapterType:99'], undefined)
})
