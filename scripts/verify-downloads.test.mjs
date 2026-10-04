import assert from 'node:assert/strict'
import test from 'node:test'
import { dropTarget, failed, groupByManga, moveGroup } from '../src/features/downloads/downloads.ts'

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
