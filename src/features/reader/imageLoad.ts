/**
 * 同一地址只保留一张加载中的图片。预加载、裁边用的原图和预解码都从这里取，
 * 避免同一页同时解码好几遍。
 */
const images = new Map<string, HTMLImageElement>()

const LIMIT = 80

function trim() {
  if (images.size <= LIMIT) return
  for (const [url, img] of images) {
    // 还在加载的不能删，否则下一处会再开一张
    if (!img.complete) continue
    images.delete(url)
    if (images.size <= LIMIT) break
  }
}

export function acquireImage(url: string) {
  let img = images.get(url)
  if (!img) {
    img = new Image()
    img.decoding = 'async'
    img.src = url
    images.set(url, img)
    trim()
  }
  return img
}

/** 重新加载前丢掉这一张，下次才会向原地址再请求 */
export function forgetImage(url: string) {
  images.delete(url)
}
