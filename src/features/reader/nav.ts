import { useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router'

/** 从详情页进入阅读器时带上的 history state */
export const FROM_DETAIL = { fromDetail: true } as const

/**
 * 阅读器的「返回」：从详情页进来就后退一步（不新增历史记录，详情页的返回才能回到书库）；
 * 直接打开的阅读器则替换成详情页。
 */
export function useBackToDetail(mangaId: number) {
  const navigate = useNavigate()
  const location = useLocation()
  const fromDetail = (location.state as { fromDetail?: boolean } | null)?.fromDetail
  return useCallback(() => {
    if (fromDetail) navigate(-1)
    else navigate(`/manga/${mangaId}`, { replace: true })
  }, [fromDetail, navigate, mangaId])
}
