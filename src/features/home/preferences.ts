export const HOME_SECTION_ORDER = ['updates', 'stale', 'fresh', 'recent', 'gallery'] as const
export type HomeSection = typeof HOME_SECTION_ORDER[number]
export type HomeContentSection = Exclude<HomeSection, 'gallery'>

export const HOME_SECTION_LABELS: Record<HomeSection, string> = {
  updates: '最近更新', stale: '好久没看', fresh: '还没开始读', recent: '最近阅读', gallery: '画廊橱窗',
}

const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}

/** 旧偏好默认全开；缺失、重复或不认识的模块不能让首页丢内容。 */
export function normalizeHomePreferences(value: unknown) {
  const saved = object(value)
  const sections = object(saved.homeSections)
  const on = (v: unknown) => typeof v === 'boolean' ? v : true
  return {
    homeSections: {
      updates: on(sections.updates), stale: on(sections.stale), fresh: on(sections.fresh), recent: on(sections.recent),
    },
    homeSectionOrder: normalizeHomeOrder(saved.homeSectionOrder),
    homeGallery: on(saved.homeGallery),
  }
}

export function normalizeHomeOrder(value: unknown): HomeSection[] {
  const order = Array.isArray(value) ? value.filter((id): id is HomeSection => HOME_SECTION_ORDER.includes(id)) : []
  return [...new Set([...order, ...HOME_SECTION_ORDER])]
}

export function moveHomeSection(order: readonly HomeSection[], id: HomeSection, direction: -1 | 1) {
  const next = normalizeHomeOrder(order)
  const from = next.indexOf(id)
  const to = from + direction
  if (to >= 0 && to < next.length) [next[from], next[to]] = [next[to], next[from]]
  return next
}
