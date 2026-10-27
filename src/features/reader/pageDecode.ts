import { acquireImage } from './imageLoad'

/** 留住已解码的位图，首屏与相邻屏共用，避免换上图片后的第一帧为空。 */
const decoded = new Map<string, { img: HTMLImageElement; ready: Promise<void> }>()

/** 重新加载一页前忘掉它：失败的解码结果不能留着，否则换了新地址也读到旧的 */
export const forgetDecoded = (src: string) => void decoded.delete(src)

export function decodePage(src: string | undefined) {
  if (!src) return Promise.resolve()
  let d = decoded.get(src)
  if (!d) {
    const img = acquireImage(src)
    d = { img, ready: img.decode().catch(() => {}) }
    decoded.set(src, d)
    if (decoded.size > 24) decoded.delete(decoded.keys().next().value!)
  }
  return d.ready
}
