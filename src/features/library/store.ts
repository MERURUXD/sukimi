import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { rehydrateOnUserChange, scopedMerge, userStorage } from '@/api/userStorage'
import { USER_KEYS } from '@/features/auth/userScope'

export type FilterKey = 'unread' | 'downloaded' | 'started' | 'bookmarked' | 'completed' | 'nsfw'
/** 0 不限 · 1 包含 · 2 排除 */
export type TriState = 0 | 1 | 2
export type SortKey = 'updated' | 'read' | 'added' | 'title' | 'unread' | 'downloaded' | 'score'
export type Density = 'comfy' | 'compact' | 'list'
/** 封面角标 */
export type BadgeKey = 'unread' | 'downloaded' | 'score' | 'bookmarks' | 'completed' | 'lang' | 'favorite'
/** 封面下标题之后的附加信息 */
export type SublineKey = 'source' | 'time' | 'author' | 'genre'
/** 标题显示的行数，0 = 不显示 */
export type TitleLines = 0 | 1 | 2
/** 每行封面数：手机和桌面分开记，0 = 按宽度自动 */
export interface GridCols {
  mobile: number
  desktop: number
}
/** 'all'、分类 id，或固定的「特别关心」「稍后再看」标签 */
export type LibraryTab = 'all' | 'favorite' | 'later' | number

interface LibraryView {
  category: LibraryTab
  filters: Record<FilterKey, TriState>
  sort: SortKey
  desc: boolean
  density: Density
  /** 只看这些来源（source id）；空 = 全部来源 */
  sources: string[]
  /** 「稍后再看」里的漫画加入后读完已有章节时自动移出 */
  laterAutoRemove: boolean
  /** 不论按什么排序，特别关心都排在最前 */
  favoriteFirst: boolean
  cols: GridCols
  badges: Record<BadgeKey, boolean>
  titleLines: TitleLines
  subline: Record<SublineKey, boolean>
  setCategory: (c: LibraryTab) => void
  cycleFilter: (k: FilterKey) => void
  clearFilter: (k: FilterKey) => void
  pickSort: (k: SortKey) => void
  setDensity: (d: Density) => void
  toggleSource: (id: string) => void
  clearSources: () => void
  setLaterAutoRemove: (on: boolean) => void
  setFavoriteFirst: (on: boolean) => void
  setCols: (device: keyof GridCols, n: number) => void
  toggleBadge: (k: BadgeKey) => void
  setTitleLines: (n: TitleLines) => void
  toggleSubline: (k: SublineKey) => void
}

const NO_FILTERS: Record<FilterKey, TriState> = { unread: 0, downloaded: 0, started: 0, bookmarked: 0, completed: 0, nsfw: 0 }

// 默认值与加入这些设置之前的显示一致：未读、下载角标，一行标题，来源和更新时间；特别关心的星标后加，默认显示
export const DEFAULT_BADGES: Record<BadgeKey, boolean> = { unread: true, downloaded: true, score: false, bookmarks: false, completed: false, lang: false, favorite: true }
export const DEFAULT_SUBLINE: Record<SublineKey, boolean> = { source: true, time: true, author: false, genre: false }

type Persisted = 'category' | 'filters' | 'sort' | 'desc' | 'density' | 'sources' | 'laterAutoRemove' | 'favoriteFirst' | 'cols' | 'badges' | 'titleLines' | 'subline'

const INITIAL: Pick<LibraryView, Persisted> = {
  category: 'all',
  filters: NO_FILTERS,
  sort: 'updated',
  desc: true,
  density: 'comfy',
  sources: [],
  // 旧偏好里没有这个字段，合并默认值后开启
  laterAutoRemove: true,
  favoriteFirst: true,
  cols: { mobile: 0, desktop: 0 },
  badges: DEFAULT_BADGES,
  titleLines: 1,
  subline: DEFAULT_SUBLINE,
}

export const useLibraryView = create<LibraryView>()(
  persist(
    (set) => ({
      ...INITIAL,
      setCategory: (category) => set({ category }),
      cycleFilter: (k) => set((s) => ({ filters: { ...s.filters, [k]: ((s.filters[k] + 1) % 3) as TriState } })),
      clearFilter: (k) => set((s) => ({ filters: { ...s.filters, [k]: 0 } })),
      // 再点一次当前排序 = 切换方向；标题默认正序，其他默认倒序
      pickSort: (k) => set((s) => (s.sort === k ? { desc: !s.desc } : { sort: k, desc: k !== 'title' })),
      setDensity: (density) => set({ density }),
      toggleSource: (id) =>
        set((s) => ({ sources: s.sources.includes(id) ? s.sources.filter((x) => x !== id) : [...s.sources, id] })),
      clearSources: () => set({ sources: [] }),
      setLaterAutoRemove: (laterAutoRemove) => set({ laterAutoRemove }),
      setFavoriteFirst: (favoriteFirst) => set({ favoriteFirst }),
      setCols: (device, n) => set((s) => ({ cols: { ...s.cols, [device]: n } })),
      toggleBadge: (k) => set((s) => ({ badges: { ...s.badges, [k]: !s.badges[k] } })),
      setTitleLines: (titleLines) => set({ titleLines }),
      toggleSubline: (k) => set((s) => ({ subline: { ...s.subline, [k]: !s.subline[k] } })),
    }),
    {
      name: USER_KEYS.library,
      storage: userStorage<typeof INITIAL>(),
      // 对象字段是整个替换：旧偏好里没有后加的项，要补上默认值，否则 undefined 会被当成已启用或关闭
      merge: (persisted, current) => {
        const merged = scopedMerge<LibraryView>(INITIAL)!(persisted, current)
        return {
          ...merged,
          filters: { ...NO_FILTERS, ...merged.filters },
          cols: { ...INITIAL.cols, ...merged.cols },
          badges: { ...DEFAULT_BADGES, ...merged.badges },
          subline: { ...DEFAULT_SUBLINE, ...merged.subline },
        }
      },
      version: 2,
      migrate: (old) => ({ sources: [], ...(old as Omit<LibraryView, 'sources'>) }),
      partialize: ({ category, filters, sort, desc, density, sources, laterAutoRemove, favoriteFirst, cols, badges, titleLines, subline }) =>
        ({ category, filters, sort, desc, density, sources, laterAutoRemove, favoriteFirst, cols, badges, titleLines, subline }),
    },
  ),
)
rehydrateOnUserChange(useLibraryView)
