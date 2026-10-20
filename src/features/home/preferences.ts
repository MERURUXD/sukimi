export const HOME_SECTION_ORDER = ['favorite', 'updates', 'stale', 'fresh', 'recent', 'gallery', 'later'] as const
export type HomeSection = typeof HOME_SECTION_ORDER[number]
export type HomeContentSection = Exclude<HomeSection, 'gallery'>

export const HOME_SECTION_LABELS: Record<HomeSection, string> = {
  favorite: '特别关心', updates: '最近更新', stale: '好久没看', fresh: '还没开始读', recent: '最近阅读', gallery: '画廊橱窗', later: '稍后再看',
}

const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}

/** 旧偏好默认全开（「稍后再看」后加，默认关闭；「特别关心」后加，默认开启）；缺失、重复或不认识的模块不能让首页丢内容。 */
export function normalizeHomePreferences(value: unknown) {
  const saved = object(value)
  const sections = object(saved.homeSections)
  const on = (v: unknown, fallback = true) => typeof v === 'boolean' ? v : fallback
  return {
    homeSections: {
      favorite: on(sections.favorite), updates: on(sections.updates), stale: on(sections.stale), fresh: on(sections.fresh), recent: on(sections.recent),
      later: on(sections.later, false),
    },
    homeSectionOrder: normalizeHomeOrder(saved.homeSectionOrder),
    homeGallery: on(saved.homeGallery),
  }
}

export function normalizeHomeOrder(value: unknown): HomeSection[] {
  const order = Array.isArray(value) ? value.filter((id): id is HomeSection => HOME_SECTION_ORDER.includes(id)) : []
  // 「特别关心」后加，又是要优先看的：旧顺序里没有它时放到最前，而不是补在最后
  if (order.length && !order.includes('favorite')) order.unshift('favorite')
  return [...new Set([...order, ...HOME_SECTION_ORDER])]
}

export function moveHomeSection(order: readonly HomeSection[], id: HomeSection, direction: -1 | 1) {
  const next = normalizeHomeOrder(order)
  const from = next.indexOf(id)
  const to = from + direction
  if (to >= 0 && to < next.length) [next[from], next[to]] = [next[to], next[from]]
  return next
}
