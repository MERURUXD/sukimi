/** 留住已解码的位图，首屏与相邻屏共用，避免换上图片后的第一帧为空。 */
const decoded = new Map<string, { img: HTMLImageElement; ready: Promise<void> }>()

export function decodePage(src: string | undefined) {
  if (!src) return Promise.resolve()
  let d = decoded.get(src)
  if (!d) {
    const img = new Image()
    img.src = src
    d = { img, ready: img.decode().catch(() => {}) }
    decoded.set(src, d)
    if (decoded.size > 24) decoded.delete(decoded.keys().next().value!)
  }
  return d.ready
}
