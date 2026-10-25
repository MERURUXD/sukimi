import assert from 'node:assert/strict'
import test from 'node:test'
import { dropTarget, failed, groupByManga, moveGroup } from '../src/features/downloads/downloads.ts'
import { gql } from '@apollo/client'
import { createCache } from '../src/api/cache.ts'
import { markCompletedDownloads } from '../src/api/downloadCache.ts'

// 虚构队列：漫画 1、2 交错
const d = (chapter, manga, state = 'QUEUED') => ({ state, chapter: { id: chapter }, manga: { id: manga } })
const queue = [d(11, 1, 'DOWNLOADING'), d(21, 2), d(12, 1), d(22, 2, 'ERROR'), d(31, 3)]

test('按漫画分组，组顺序按第一次出现', () => {
  assert.deepEqual(groupByManga(queue).map((g) => g.map((x) => x.chapter.id)), [[11, 12], [21, 22], [31]])
})

test('整组移到队首 / 队尾的批量排序参数', () => {
  assert.deepEqual(moveGroup(queue, [21, 22], 'top'), [{ chapterId: 21, to: 0 }, { chapterId: 22, to: 1 }])
  assert.deepEqual(moveGroup(queue, [11, 12], 'bottom'), [{ chapterId: 11, to: 4 }, { chapterId: 12, to: 4 }])
})

test('按服务端逐条执行的语义模拟，移动后组内顺序不变', () => {
  const apply = (ids, reorders) => {
    const list = [...ids]
    for (const { chapterId, to } of reorders) {
      list.splice(list.indexOf(chapterId), 1)
      list.splice(to, 0, chapterId)
    }
    return list
  }
  const ids = queue.map((x) => x.chapter.id)
  assert.deepEqual(apply(ids, moveGroup(queue, [21, 22], 'top')), [21, 22, 11, 12, 31])
  assert.deepEqual(apply(ids, moveGroup(queue, [11, 12], 'bottom')), [21, 22, 31, 11, 12])
})

test('拖动结束的目标位置；没动返回 null', () => {
  assert.equal(dropTarget([1, 2, 3], [2, 3, 1], 1), 2)
  assert.equal(dropTarget([1, 2, 3], [1, 2, 3], 2), null)
  assert.equal(dropTarget([1, 2, 3], [1, 2], 3), null)
})

test('出错的章节', () => {
  assert.deepEqual(failed(queue).map((x) => x.chapter.id), [22])
})

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
