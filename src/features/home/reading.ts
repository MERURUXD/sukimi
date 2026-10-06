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
  if (Number(chapter.lastReadAt) <= 0) return { chapter, isNext, page: '尚未开始', pct: 0 }
  const page = Math.max(0, chapter.lastPageRead) + 1
  if (chapter.pageCount <= 0) return { chapter, isNext, page: `第 ${page} 页`, pct: null }
  const current = Math.min(page, chapter.pageCount)
  return { chapter, isNext, page: `第 ${current} / ${chapter.pageCount} 页`, pct: (current / chapter.pageCount) * 100 }
}
