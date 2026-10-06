/** 详情页「继续阅读」用到的阅读状态；纯逻辑，Node 测试直接导入 */
export interface ReadState {
  id: number
  sourceOrder: number
  isRead: boolean
  /** 秒，LongString */
  lastReadAt: string
}

/** 真正读过的那一话。服务端对没读过的漫画也会给出 lastReadChapter，只是阅读时间为 0 */
export const lastRead = <C extends ReadState>(chapters: readonly C[], lastReadId: number | undefined) =>
  chapters.find((c) => c.id === lastReadId && Number(c.lastReadAt) > 0)

/** 「继续阅读」指向哪一话：读到一半的那话 → 上次读完的下一话 → 第一话未读；从没读过就是「开始阅读」 */
export function nextToRead<C extends ReadState>(chapters: readonly C[], lastReadId: number | undefined) {
  if (!chapters.length) return null
  const last = lastRead(chapters, lastReadId)
  if (last && !last.isRead) return { chapter: last, verb: '继续阅读' }
  const next = last && chapters.find((c) => c.sourceOrder > last.sourceOrder && !c.isRead)
  if (next) return { chapter: next, verb: '继续阅读' }
  // 没读过任何一话才是「开始阅读」；手动标过已读的也从第一话未读接着读
  if (!last && !chapters.some((c) => c.isRead)) return { chapter: chapters[0], verb: '开始阅读' }
  const firstUnread = chapters.find((c) => !c.isRead)
  return firstUnread ? { chapter: firstUnread, verb: '继续阅读' } : { chapter: chapters[0], verb: '重新阅读' }
}
