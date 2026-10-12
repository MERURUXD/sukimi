import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { rehydrateOnUserChange, scopedMerge, userStorage } from '@/api/userStorage'
import { USER_KEYS } from '@/features/auth/userScope'

export type FilterKey = 'unread' | 'downloaded' | 'started' | 'bookmarked' | 'completed'
/** 0 不限 · 1 包含 · 2 排除 */
export type TriState = 0 | 1 | 2
export type SortKey = 'updated' | 'read' | 'added' | 'title' | 'unread' | 'downloaded' | 'score'
export type Density = 'comfy' | 'compact' | 'list'
/** 'all'、分类 id，或固定的「稍后再看」标签 */
export type LibraryTab = 'all' | 'later' | number

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
  setCategory: (c: LibraryTab) => void
  cycleFilter: (k: FilterKey) => void
  clearFilter: (k: FilterKey) => void
  pickSort: (k: SortKey) => void
  setDensity: (d: Density) => void
  toggleSource: (id: string) => void
  clearSources: () => void
  setLaterAutoRemove: (on: boolean) => void
}

const NO_FILTERS: Record<FilterKey, TriState> = { unread: 0, downloaded: 0, started: 0, bookmarked: 0, completed: 0 }

const INITIAL: Pick<LibraryView, 'category' | 'filters' | 'sort' | 'desc' | 'density' | 'sources' | 'laterAutoRemove'> = {
  category: 'all',
  filters: NO_FILTERS,
  sort: 'updated',
  desc: true,
  density: 'comfy',
  sources: [],
  // 旧偏好里没有这个字段，合并默认值后开启
  laterAutoRemove: true,
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
    }),
    {
      name: USER_KEYS.library,
      storage: userStorage<typeof INITIAL>(),
      merge: scopedMerge<LibraryView>(INITIAL),
      version: 2,
      migrate: (old) => ({ sources: [], ...(old as Omit<LibraryView, 'sources'>) }),
      partialize: ({ category, filters, sort, desc, density, sources, laterAutoRemove }) => ({ category, filters, sort, desc, density, sources, laterAutoRemove }),
    },
  ),
)
rehydrateOnUserChange(useLibraryView)
