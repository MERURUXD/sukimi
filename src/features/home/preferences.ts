import { t } from '../../i18n/core.ts'
export const HOME_SECTION_ORDER = ['week', 'later', 'stale', 'fresh', 'gallery', 'favorite', 'updates', 'recent'] as const
export type HomeSection = typeof HOME_SECTION_ORDER[number]
export type HomeContentSection = Exclude<HomeSection, 'gallery'>

export const HOME_SECTION_LABELS: Record<HomeSection, string> = {
  week: t('home.section.week'), favorite: t('home.section.favorite'), updates: t('home.section.updates'), stale: t('home.section.stale'),
  fresh: t('home.section.fresh'), recent: t('home.section.recent'), gallery: t('home.section.gallery'), later: t('home.section.later'),
}

const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}

/**
 * 缺失、重复或不认识的模块不能让首页丢内容，坏值按默认处理。
 * 「这一周」已经包含特别关心、最近更新、最近阅读三类内容：还没有这个字段的旧偏好（包括全新安装）
 * 换成这一版的默认组合——这一周和稍后再看打开，三个单独模块关闭；之后各开关照存下的值。
 */
export function normalizeHomePreferences(value: unknown) {
  const saved = object(value)
  const sections = object(saved.homeSections)
  const on = (v: unknown, fallback = true) => typeof v === 'boolean' ? v : fallback
  const before = typeof sections.week !== 'boolean'
  return {
    homeSections: before
      ? { week: true, favorite: false, updates: false, stale: on(sections.stale), fresh: on(sections.fresh), recent: false, later: true }
      : {
        week: on(sections.week), favorite: on(sections.favorite, false), updates: on(sections.updates, false), stale: on(sections.stale), fresh: on(sections.fresh),
        recent: on(sections.recent, false), later: on(sections.later),
      },
    homeSectionOrder: normalizeHomeOrder(saved.homeSectionOrder),
    homeGallery: on(saved.homeGallery),
  }
}

export function normalizeHomeOrder(value: unknown): HomeSection[] {
  const order = Array.isArray(value) ? value.filter((id): id is HomeSection => HOME_SECTION_ORDER.includes(id)) : []
  // 后加的「特别关心」「这一周」都是要优先看的：旧顺序里没有它们时放到最前，而不是补在最后
  if (order.length && !order.includes('favorite')) order.unshift('favorite')
  if (order.length && !order.includes('week')) order.unshift('week')
  return [...new Set([...order, ...HOME_SECTION_ORDER])]
}

export function moveHomeSection(order: readonly HomeSection[], id: HomeSection, direction: -1 | 1) {
  const next = normalizeHomeOrder(order)
  const from = next.indexOf(id)
  const to = from + direction
  if (to >= 0 && to < next.length) [next[from], next[to]] = [next[to], next[from]]
  return next
}
