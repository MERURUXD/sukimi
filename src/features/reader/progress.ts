/**
 * 阅读进度回写的判断规则：什么时候写、写到哪一页、要不要标为已读。
 * 只做判断，写入和计时在 progressSync.ts 的 useProgressSync。
 */

/** 一次要写入的进度 */
export type Progress = { page: number; read: boolean }

type ChapterState = { lastPageRead: number; isRead: boolean }

/** 是否读到了这一话的结尾：最后一页是拆成两半的宽页时，读到后一半才算读完 */
export function atChapterEnd(shown: readonly number[], last: number, lastSplits: boolean, half: 0 | 1) {
  return Math.max(...shown) >= last && (!lastSplits || half === 1)
}

/** 翻到某一页后要写的进度；停在服务端已记下的那一页、又没读完时不用写 */
export function progressAt(chapter: ChapterState, page: number, end: boolean): Progress | null {
  if (page === chapter.lastPageRead && !end) return null
  // 已读的话不再重复标记，只更新页码
  return { page, read: end && !chapter.isRead }
}

/**
 * 换话时补写的进度：往后翻 = 这一话读完了（纵向模式自动进下一话时，页码状态可能还没来得及更新）。
 * 往前翻返回 null，沿用翻页时记下的进度。
 */
export function progressOnLeave(
  from: { sourceOrder: number; isRead: boolean },
  to: { sourceOrder: number },
  last: number,
): Progress | null {
  return to.sourceOrder > from.sourceOrder ? { page: last, read: !from.isRead } : null
}

/** 写入请求的参数：没读完时不传 isRead，免得把已读的话改回未读 */
export function progressVariables(chapterId: number, p: Progress) {
  return { id: chapterId, lastPageRead: p.page, isRead: p.read ? true : undefined }
}
