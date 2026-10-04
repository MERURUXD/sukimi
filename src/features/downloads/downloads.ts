/** 下载队列的整理逻辑，只依赖这几个字段，方便用虚构数据测试 */
export interface QueueItem {
  state: string
  chapter: { id: number }
  manga: { id: number }
}

/** 按漫画分组，组的顺序按该漫画在队列里第一次出现的位置 */
export function groupByManga<T extends QueueItem>(queue: readonly T[]) {
  const groups = new Map<number, T[]>()
  for (const d of queue) {
    const g = groups.get(d.manga.id)
    if (g) g.push(d)
    else groups.set(d.manga.id, [d])
  }
  return [...groups.values()]
}

/**
 * 把一组章节整体移到队首或队尾，返回服务端批量排序要的 { chapterId, to } 列表。
 * 服务端按顺序逐条执行，所以移到队首时从前往后依次放到 0、1、2……；
 * 移到队尾时依次放到最后一位，先放的会被后放的往前挤，顺序保持不变。
 */
export function moveGroup(queue: readonly QueueItem[], ids: readonly number[], where: 'top' | 'bottom') {
  const last = queue.length - 1
  return ids.map((chapterId, i) => ({ chapterId, to: where === 'top' ? i : last }))
}

/** 拖动结束后，被拖的那一项在新顺序里的位置；没变就返回 null */
export function dropTarget(before: readonly number[], after: readonly number[], moved: number) {
  const from = before.indexOf(moved)
  const to = after.indexOf(moved)
  return from === to || to < 0 ? null : to
}

export const failed = <T extends QueueItem>(queue: readonly T[]) => queue.filter((d) => d.state === 'ERROR')
