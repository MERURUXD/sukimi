import type { ReadChapter } from './queries'

/** 后台刷新内容未变时沿用旧数组，避免档案和海报再次全量汇总。 */
export function reuseReadChapters(previous: ReadChapter[] | null, next: ReadChapter[]): ReadChapter[] {
  if (!previous || previous.length !== next.length) return next
  const same = previous.every((c, i) => {
    const n = next[i]
    return c === n || (c.id === n.id && c.mangaId === n.mangaId && c.isRead === n.isRead
      && c.pageCount === n.pageCount && c.lastReadAt === n.lastReadAt
      && c.meta.length === n.meta.length && c.meta.every((m, j) => m.key === n.meta[j].key && m.value === n.meta[j].value))
  })
  return same ? previous : next
}
