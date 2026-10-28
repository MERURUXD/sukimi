import { t } from '../../i18n/core.ts'
interface ReadingChapter {
  id: number
  name: string
  chapterNumber: number
  pageCount: number
  lastPageRead: number
  lastReadAt: string
}

/** 标题、页码和进度都取实际将要打开的章节。 */
export function readingTarget(c: ReadingChapter & { isRead: boolean; manga: { firstUnreadChapter?: ReadingChapter | null } }) {
  const chapter = c.isRead ? c.manga.firstUnreadChapter : c
  if (!chapter) return null
  const isNext = chapter.id !== c.id
  // 还没读过就不给进度：一条空进度条看不出意思，文字「尚未开始」已经说明
  if (Number(chapter.lastReadAt) <= 0) return { chapter, isNext, page: t('home.reading.notStarted'), pct: null }
  const page = Math.max(0, chapter.lastPageRead) + 1
  if (chapter.pageCount <= 0) return { chapter, isNext, page: t('home.reading.pageN', { page }), pct: null }
  const current = Math.min(page, chapter.pageCount)
  return { chapter, isNext, page: t('home.reading.pageOf', { current, total: chapter.pageCount }), pct: (current / chapter.pageCount) * 100 }
}
