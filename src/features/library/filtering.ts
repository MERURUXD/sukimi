import { ms, sec } from '@/lib/format'
import { inCategory } from './category'
import type { LibraryManga } from './queries'
import { compareSortValues, libraryScore } from './sortValues'
import type { NsfwSubject } from '@/features/nsfw/nsfw'
import { favoritesFirst } from '@/features/favorite/favorite'
import { isShelved } from '@/features/shelf/shelf'
import type { FilterKey, LibraryTab, SortKey, TriState } from './store'
import { t } from '@/i18n'

/** 筛选要用到的书库外数据：NSFW 标记存在服务端，由调用方按当前账号的标记和开关给出判定 */
export interface FilterContext {
  nsfw: (m: NsfwSubject) => boolean
  shelf: ReadonlySet<number>
}

export const isCompleted = (m: LibraryManga) => m.status === 'COMPLETED' || m.status === 'PUBLISHING_FINISHED'

export const FILTERS: { key: FilterKey; label: string; test: (m: LibraryManga, ctx: FilterContext) => boolean }[] = [
  { key: 'unread', label: t('library.filter.unread'), test: (m) => m.unreadCount > 0 },
  { key: 'downloaded', label: t('library.filter.downloaded'), test: (m) => m.downloadCount > 0 },
  // 没读过的漫画服务端也会给出 lastReadChapter，阅读时间为 0；
  // 从 Tachiyomi 导入的已读章节没有阅读时间、只有已读标记（latestReadChapter），也算读过，和首页「还没开始读」一致
  { key: 'started', label: t('library.filter.started'), test: (m) => sec(m.lastReadChapter?.lastReadAt) > 0 || !!m.latestReadChapter },
  { key: 'bookmarked', label: t('library.filter.bookmarked'), test: (m) => m.bookmarkCount > 0 },
  { key: 'completed', label: t('library.filter.completed'), test: isCompleted },
  // 不看「首页和画廊隐藏」「模糊封面」这些显示开关：只按标记、分类和来源判定，临时显示（Shift + H）时也能筛出来
  { key: 'nsfw', label: 'NSFW', test: (m, ctx) => ctx.nsfw(m) },
  { key: 'shelved', label: t('library.filter.shelved'), test: (m, ctx) => isShelved(m, ctx.shelf) },
]

export { inCategory }

export const lastUpdated = (m: LibraryManga) =>
  Math.max(sec(m.latestFetchedChapter?.fetchedAt), ms(m.latestUploadedChapter?.uploadDate))

const collator = new Intl.Collator('zh-CN', { numeric: true, sensitivity: 'base' })

/** 排序需要的书库外数据：各追踪网站的评分档位（trackerId → 档位列表） */
export interface SortContext {
  scales: ReadonlyMap<number, readonly string[]>
}

/** value 返回 null 表示没有这项数据（如未评分），默认不论正序倒序都排在最后；nullsLow 的排序把 null 当最小值，正序时排在最前 */
export const SORTS: {
  key: SortKey
  label: string
  value: (m: LibraryManga, ctx: SortContext) => number | string | null
  nullsLow?: boolean
}[] = [
  { key: 'updated', label: t('library.sort.updated'), value: lastUpdated },
  { key: 'read', label: t('library.sort.read'), value: (m) => sec(m.lastReadChapter?.lastReadAt) },
  { key: 'added', label: t('library.sort.added'), value: (m) => sec(m.inLibraryAt) },
  { key: 'title', label: t('library.sort.title'), value: (m) => m.title },
  { key: 'unread', label: t('library.sort.unread'), value: (m) => m.unreadCount },
  { key: 'downloaded', label: t('library.sort.downloaded'), value: (m) => m.downloadCount },
  { key: 'score', label: t('library.sort.score'), value: (m, ctx) => libraryScore(m.trackRecords.nodes, ctx.scales), nullsLow: true },
]
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
    category: LibraryTab
    defaultCategoryId?: number
    filters: Record<FilterKey, TriState>
    sources: readonly string[]
    sort: SortKey
    desc: boolean
    query: string
    scales?: SortContext['scales']
    nsfw: FilterContext['nsfw']
    /** 搁置分类的 id：分类标签里不算，「搁置」筛选用 */
    shelf: ReadonlySet<number>
    /** 给了就把这些排到最前（「特别关心置顶」） */
    pinned?: ReadonlyMap<number, number>
  },
) {
  const active = FILTERS.filter((f) => opts.filters[f.key] !== 0)
  const ctx: FilterContext = { nsfw: opts.nsfw, shelf: opts.shelf }
  const sort = SORTS.find((s) => s.key === opts.sort) ?? SORTS[0]

  const out = list.filter(
    (m) =>
      inCategory(m, opts.category, opts.defaultCategoryId ?? 0, opts.shelf) &&
      (opts.sources.length === 0 || (m.source != null && opts.sources.includes(m.source.id))) &&
      active.every((f) => f.test(m, ctx) === (opts.filters[f.key] === 1)) &&
      matchesSearch(m, opts.query),
  )
  const sortCtx: SortContext = { scales: opts.scales ?? new Map() }
  const keyed = out.map((m) => [sort.value(m, sortCtx), m] as const)
  keyed.sort(([a, ma], [b, mb]) => compareSortValues(a, b, opts.desc, collator.compare, sort.nullsLow) || collator.compare(ma.title, mb.title))
  const sorted = keyed.map(([, m]) => m)
  return opts.pinned ? favoritesFirst(sorted, opts.pinned) : sorted
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
