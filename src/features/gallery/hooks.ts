import { useQuery } from '@apollo/client/react'
import { useMemo, useSyncExternalStore } from 'react'
import { withSnapshot } from '@/api/persist'
import { isCompleted } from '@/features/library/filtering'
import { Categories, LibraryMangas, type LibraryManga } from '@/features/library/queries'
import { useNsfw } from '@/features/nsfw/useNsfw'
import { useLanded } from './readMorph'
import { useChapterTotals } from './useChapterTotals'

export function useMedia(query: string) {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(query)
      m.addEventListener('change', cb)
      return () => m.removeEventListener('change', cb)
    },
    () => window.matchMedia(query).matches,
  )
}

export const useMobile = () => useMedia('(max-width: 767px)')
export const useReducedMotionPref = () => useMedia('(prefers-reduced-motion: reduce)')

export { isCompleted }

/** 书库有作品、但全被 NSFW 隐藏时的提示，不能沿用空书库的文案 */
export const NSFW_ALL_HIDDEN = '书库里的作品都标成了 NSFW，已隐藏。可以在「设置 → 外观 → 隐私」里调整，或按 Shift + H 临时显示。'

/**
 * 已读话数：总话数减未读，不用把读过的章节全取下来；和阅读档案的「已读」口径相同（isRead 的章节数）。
 * 画廊首页、首页橱窗的数字点进去会飞成档案页的大数字，各处必须一致，落地时才不跳
 */
export const readChapters = (all: readonly LibraryManga[], totals: ReadonlyMap<number, number> | null) =>
  totals ? all.reduce((n, m) => n + Math.max(0, (totals.get(m.id) ?? 0) - m.unreadCount), 0) : null

/**
 * 画廊用的书库数据：和书库页、首页共用 LibraryMangas 的缓存与快照，所以能秒开；
 * 总话数单独取，到达前为 null（界面显示「—」）。
 */
export function useGalleryLibrary() {
  const lib = useQuery(LibraryMangas)
  const cats = useQuery(Categories)
  const data = withSnapshot('library', lib.data)
  const catData = withSnapshot('categories', cats.data)
  const landed = useLanded()
  const counts = useChapterTotals(data?.mangas.nodes, landed)
  const full = useMemo<LibraryManga[]>(() => data?.mangas.nodes ?? [], [data])
  // 墙、网格、画布和放映都不出现 NSFW 作品；数字仍按完整书库算（只计数不露面）
  const { hidden } = useNsfw()
  const all = useMemo(() => full.filter((m) => !hidden(m)), [full, hidden])
  const totals = counts.totals
  const stats = useMemo(() => {
    const done = full.filter(isCompleted).length
    return {
      works: full.length,
      chapters: totals ? full.reduce((n, m) => n + (totals.get(m.id) ?? 0), 0) : null,
      read: readChapters(full, totals),
      ongoing: full.filter((m) => m.status === 'ONGOING').length,
      done,
      shown: all.length,
    }
  }, [full, all, totals])
  return {
    /** 能露面的作品（去掉 NSFW） */
    all,
    /** 完整书库，汇总数字用 */
    full,
    totals,
    stats,
    categories: catData?.categories.nodes ?? [],
    loading: lib.loading && !data,
    error: data ? undefined : lib.error,
    refetch: lib.refetch,
    // 总话数取失败且没有缓存时，档案页要能显示错误并重试，不能一直停在「正在汇总」
    countsError: counts.error,
    refetchCounts: counts.refetch,
  }
}

/** 画布和首页墙上的排列：按收藏先后，No.01 是最早收藏的 */
export const galleryOrder = (all: readonly LibraryManga[]) =>
  [...all].sort((a, b) => Number(a.inLibraryAt) - Number(b.inLibraryAt) || a.id - b.id)
