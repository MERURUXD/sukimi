import type { ApolloClient } from '@apollo/client'
import { FetchChapterPages } from './queries'

/** 各章节的页面地址，切话、预取下一话时复用 */
const pageLists = new Map<number, Promise<string[]>>()

export function loadPages(client: ApolloClient, chapterId: number) {
  let p = pageLists.get(chapterId)
  if (!p) {
    p = client
      .mutate({ mutation: FetchChapterPages, variables: { chapterId } })
      .then((r) => r.data?.fetchChapterPages?.pages ?? [])
    p.catch(() => pageLists.delete(chapterId))
    pageLists.set(chapterId, p)
  }
  return p
}

/** 每张图的宽高比（宽 / 高），双页拼版用 */
const aspects = new Map<string, number>()
const warmed = new Map<string, HTMLImageElement>()

export const aspectOf = (url: string) => aspects.get(url)

export function rememberAspect(url: string, img: HTMLImageElement) {
  if (img.naturalWidth && img.naturalHeight) aspects.set(url, img.naturalWidth / img.naturalHeight)
}

/** 重新加载一页前忘掉预加载的结果，下次预加载重新请求 */
export const forgetWarm = (url: string) => void warmed.delete(url)

/** 预加载图片（同源 Cookie 鉴权，直接 new Image 即可） */
export function warm(url: string, onAspect?: () => void) {
  if (warmed.has(url)) return
  const img = new Image()
  img.decoding = 'async'
  img.onload = () => {
    rememberAspect(url, img)
    onAspect?.()
  }
  img.src = url
  warmed.set(url, img)
  // 只留最近的一批，避免长时间阅读后内存涨太多
  if (warmed.size > 80) warmed.delete(warmed.keys().next().value!)
}
