import type { ApolloClient } from '@apollo/client'
import { forgetImage, acquireImage } from './imageLoad'
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

/** 每张图的宽高比（宽 / 高），双页拼版用；原始宽度给纵向占位用 */
const aspects = new Map<string, number>()
const widths = new Map<string, number>()
const warmed = new Set<string>()

export const aspectOf = (url: string) => aspects.get(url)
export const pixelWidthOf = (url: string) => widths.get(url)

export function rememberAspect(url: string, img: HTMLImageElement) {
  if (img.naturalWidth && img.naturalHeight) {
    aspects.set(url, img.naturalWidth / img.naturalHeight)
    widths.set(url, img.naturalWidth)
  }
}

/** 重新加载一页前忘掉预加载的结果，下次预加载重新请求 */
export function forgetWarm(url: string) {
  warmed.delete(url)
  forgetImage(url)
}

/** 预加载图片（同源 Cookie 鉴权）。同一地址和裁边、预解码共用一张图。宽高比只通知一次，避免阅读页的预取效果来回触发。 */
export function warm(url: string, onAspect?: () => void) {
  if (warmed.has(url)) return
  warmed.add(url)
  const img = acquireImage(url)
  const apply = () => {
    rememberAspect(url, img)
    onAspect?.()
  }
  if (img.complete) {
    if (img.naturalWidth) apply()
    return
  }
  img.addEventListener('load', apply, { once: true })
}
