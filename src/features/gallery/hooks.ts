import { useQuery } from '@apollo/client/react'
import { useMemo, useSyncExternalStore } from 'react'
import { withSnapshot } from '@/api/persist'
import { FILTERS } from '@/features/library/filtering'
import type { GalleryCountsQuery } from '@/api/gql/graphql'
import { Categories, LibraryMangas, type LibraryManga } from '@/features/library/queries'
import { GalleryCounts } from './queries'
import { useLanded } from './readMorph'

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

export const isCompleted = FILTERS.find((f) => f.key === 'completed')!.test

/** 每部的总话数（按 id）；还没取到时为 null */
export const chapterTotals = (data: GalleryCountsQuery | undefined) => (data ? new Map(data.mangas.nodes.map((m) => [m.id, m.chapters.totalCount])) : null)

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
  // 换页动画期间有缓存就只用缓存，落地后再去网络刷新（见 useLanded）；没有缓存时照常去取，免得数字一直是「—」
  const landed = useLanded()
  const counts = useQuery(GalleryCounts, { fetchPolicy: landed ? 'cache-and-network' : 'cache-first' })
  const all = useMemo<LibraryManga[]>(() => data?.mangas.nodes ?? [], [data])
  const totals = useMemo(() => chapterTotals(counts.data), [counts.data])
  const stats = useMemo(() => {
    const done = all.filter(isCompleted).length
    return {
      works: all.length,
      chapters: totals ? all.reduce((n, m) => n + (totals.get(m.id) ?? 0), 0) : null,
      read: readChapters(all, totals),
      ongoing: all.filter((m) => m.status === 'ONGOING').length,
      done,
    }
  }, [all, totals])
  return {
    all,
    totals,
    stats,
    categories: catData?.categories.nodes ?? [],
    loading: lib.loading && !data,
    error: data ? undefined : lib.error,
    refetch: lib.refetch,
    // 总话数取失败且没有缓存时，档案页要能显示错误并重试，不能一直停在「正在汇总」
    countsError: counts.data ? undefined : counts.error,
    refetchCounts: counts.refetch,
  }
}

/** 画布和首页墙上的排列：按收藏先后，No.01 是最早收藏的 */
export const galleryOrder = (all: readonly LibraryManga[]) =>
  [...all].sort((a, b) => Number(a.inLibraryAt) - Number(b.inLibraryAt) || a.id - b.id)
