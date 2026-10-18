import { useCallback, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router'

/** 从详情页进入阅读器时带上的 history state */
export const FROM_DETAIL = { fromDetail: true } as const

let readerExit: { mangaId: number; at: number } | null = null

/** 刚从阅读器回到这部漫画的详情页：详情页据此跳过进场动画，页面看起来是原样回来的 */
export function justLeftReader(mangaId: number) {
  return readerExit?.mangaId === mangaId && Date.now() - readerExit.at < 5000
}

/**
 * 阅读器的「返回」：从详情页进来就后退一步（不新增历史记录，详情页的返回才能回到书库）；
 * 直接打开的阅读器则替换成详情页。
 */
export function useBackToDetail(mangaId: number) {
  const navigate = useNavigate()
  const location = useLocation()
  const fromDetail = (location.state as { fromDetail?: boolean } | null)?.fromDetail
  // 详情页渲染时阅读器还没卸载（Infinity），之后 5 秒内也算刚离开，
  // 这样按钮、浏览器后退手势等任何离开方式都不用逐个标记
  useEffect(() => {
    readerExit = { mangaId, at: Infinity }
    return () => { readerExit = { mangaId, at: Date.now() } }
  }, [mangaId])
  return useCallback(() => {
    if (fromDetail) navigate(-1)
    else navigate(`/manga/${mangaId}`, { replace: true, viewTransition: true })
  }, [fromDetail, navigate, mangaId])
}
