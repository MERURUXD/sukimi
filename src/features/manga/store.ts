import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { rehydrateOnUserChange, scopedMerge, userStorage } from '@/api/userStorage'
import { USER_KEYS } from '@/features/auth/userScope'

export type ChapterFilter = 'all' | 'unread' | 'downloaded' | 'bookmarked'

interface ChapterView {
  filter: ChapterFilter
  /** true = 最新的在上 */
  desc: boolean
  setFilter: (f: ChapterFilter) => void
  toggleOrder: () => void
}

const INITIAL: Pick<ChapterView, 'filter' | 'desc'> = { filter: 'all', desc: true }

export const useChapterView = create<ChapterView>()(
  persist(
    (set) => ({
      ...INITIAL,
      setFilter: (filter) => set({ filter }),
      toggleOrder: () => set((s) => ({ desc: !s.desc })),
    }),
    {
      name: USER_KEYS.chapters,
      storage: userStorage<typeof INITIAL>(),
      merge: scopedMerge<ChapterView>(INITIAL),
      partialize: ({ filter, desc }) => ({ filter, desc }),
    },
  ),
)
rehydrateOnUserChange(useChapterView)
