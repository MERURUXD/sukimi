import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ChapterFilter = 'all' | 'unread' | 'downloaded' | 'bookmarked'

export const useChapterView = create<{
  filter: ChapterFilter
  /** true = 最新的在上 */
  desc: boolean
  setFilter: (f: ChapterFilter) => void
  toggleOrder: () => void
}>()(
  persist(
    (set) => ({
      filter: 'all',
      desc: true,
      setFilter: (filter) => set({ filter }),
      toggleOrder: () => set((s) => ({ desc: !s.desc })),
    }),
    { name: 'suwayomi-web.chapters', partialize: ({ filter, desc }) => ({ filter, desc }) },
  ),
)
