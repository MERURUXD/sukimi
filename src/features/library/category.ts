import type { LibraryManga } from './queries'
import type { LibraryTab } from './store'

/** defaultId：默认分类的 id；每个用户的默认分类 id 不同（管理员 0，其他人从 1 起），要从分类列表的 default 标记里取 */
export function inCategory(m: LibraryManga, category: LibraryTab, defaultId = 0) {
  // 「稍后再看」的列表另外取，进来的已经都是
  if (category === 'all' || category === 'later') return true
  const ids = m.categories.nodes
  // 没有分类的漫画归在默认分类
  return category === defaultId ? ids.length === 0 || ids.some((c) => c.id === defaultId) : ids.some((c) => c.id === category)
}
