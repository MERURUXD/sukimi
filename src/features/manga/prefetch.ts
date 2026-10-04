import { useApolloClient } from '@apollo/client/react'
import { useMemo, useRef } from 'react'
import { MangaChapters, MangaDetail } from './queries'

/**
 * 鼠标在封面上停留 120ms 就预取详情与章节，点进去时通常已经在缓存里，
 * 封面过渡动画落点完整、页面不闪「正在加载」。
 */
export function usePrefetchManga(id: number) {
  const client = useApolloClient()
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  return useMemo(
    () => ({
      onPointerEnter: (e: React.PointerEvent) => {
        if (e.pointerType !== 'mouse') return
        timer.current = setTimeout(() => {
          void client.query({ query: MangaDetail, variables: { id } }).catch(() => {})
          void client.query({ query: MangaChapters, variables: { mangaId: id } }).catch(() => {})
        }, 120)
      },
      onPointerLeave: () => clearTimeout(timer.current),
    }),
    [client, id],
  )
}
