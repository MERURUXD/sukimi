import { ms, sec } from '@/lib/format'
import type { LibraryManga } from './queries'
import type { FilterKey, SortKey, TriState } from './store'

export const FILTERS: { key: FilterKey; label: string; test: (m: LibraryManga) => boolean }[] = [
  { key: 'unread', label: '未读', test: (m) => m.unreadCount > 0 },
  { key: 'downloaded', label: '已下载', test: (m) => m.downloadCount > 0 },
  { key: 'started', label: '已开始阅读', test: (m) => m.lastReadChapter != null },
  { key: 'bookmarked', label: '有书签', test: (m) => m.bookmarkCount > 0 },
  { key: 'completed', label: '已完结', test: (m) => m.status === 'COMPLETED' || m.status === 'PUBLISHING_FINISHED' },
]

export const lastUpdated = (m: LibraryManga) =>
  Math.max(sec(m.latestFetchedChapter?.fetchedAt), ms(m.latestUploadedChapter?.uploadDate))

const collator = new Intl.Collator('zh-CN', { numeric: true, sensitivity: 'base' })

export const SORTS: { key: SortKey; label: string; value: (m: LibraryManga) => number | string }[] = [
  { key: 'updated', label: '最近更新', value: lastUpdated },
  { key: 'read', label: '最近阅读', value: (m) => sec(m.lastReadChapter?.lastReadAt) },
  { key: 'added', label: '加入时间', value: (m) => sec(m.inLibraryAt) },
  { key: 'title', label: '标题', value: (m) => m.title },
  { key: 'unread', label: '未读数', value: (m) => m.unreadCount },
  { key: 'downloaded', label: '已下载数', value: (m) => m.downloadCount },
]

export function inCategory(m: LibraryManga, category: 'all' | number) {
  if (category === 'all') return true
  const ids = m.categories.nodes
  // 没有分类的漫画归在默认分类（id 0）
  return category === 0 ? ids.length === 0 || ids.some((c) => c.id === 0) : ids.some((c) => c.id === category)
}

export function matchesSearch(m: LibraryManga, q: string) {
  if (!q) return true
  const hay = [m.title, m.author, m.artist, m.source?.displayName, ...m.genre].filter(Boolean).join('\n').toLowerCase()
  return q
    .toLowerCase()
    .split(/\s+/)
    .every((w) => hay.includes(w))
}

export function applyView(
  list: readonly LibraryManga[],
  opts: {
    category: 'all' | number
    filters: Record<FilterKey, TriState>
    sources: readonly string[]
    sort: SortKey
    desc: boolean
    query: string
  },
) {
  const active = FILTERS.filter((f) => opts.filters[f.key] !== 0)
  const sort = SORTS.find((s) => s.key === opts.sort) ?? SORTS[0]
  const dir = opts.desc ? -1 : 1

  const out = list.filter(
    (m) =>
      inCategory(m, opts.category) &&
      (opts.sources.length === 0 || (m.source != null && opts.sources.includes(m.source.id))) &&
      active.every((f) => f.test(m) === (opts.filters[f.key] === 1)) &&
      matchesSearch(m, opts.query),
  )
  const keyed = out.map((m) => [sort.value(m), m] as const)
  keyed.sort(([a, ma], [b, mb]) => {
    const c = typeof a === 'string' ? collator.compare(a, b as string) : a - (b as number)
    return c !== 0 ? c * dir : collator.compare(ma.title, mb.title)
  })
  return keyed.map(([, m]) => m)
}

/** 书库里出现过的来源，按漫画数从多到少 */
export function librarySources(list: readonly LibraryManga[]) {
  const map = new Map<string, { id: string; name: string; count: number }>()
  for (const m of list) {
    if (!m.source) continue
    const e = map.get(m.source.id)
    if (e) e.count++
    else map.set(m.source.id, { id: m.source.id, name: m.source.displayName, count: 1 })
  }
  return [...map.values()].sort((a, b) => b.count - a.count || collator.compare(a.name, b.name))
}
