import { useEffect, useState } from 'react'

const cache = new Map<string, Promise<string | null>>()

/** 只对小位图做一次模糊，推镜时只合成 transform；失败时交给背景的静态渐变。 */
function softCover(src: string, w: number, h: number) {
  const key = `${w}x${h}:${src}`
  const hit = cache.get(key)
  if (hit) return hit
  const result = (async () => {
    try {
      const image = new Image()
      image.crossOrigin = 'anonymous'
      image.src = src
      await image.decode()
      const canvas = document.createElement('canvas')
      canvas.width = 192
      canvas.height = Math.max(1, Math.round(192 * h / w))
      const ctx = canvas.getContext('2d')
      if (!ctx) return null
      const scale = Math.max(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight)
      const iw = image.naturalWidth * scale
      const ih = image.naturalHeight * scale
      ctx.filter = `blur(${18 * 192 / (w * 1.16)}px) saturate(1.25)`
      ctx.drawImage(image, (canvas.width - iw) / 2, (canvas.height - ih) / 2, iw, ih)
      const url = canvas.toDataURL('image/png')
      const decoded = new Image()
      decoded.src = url
      await decoded.decode()
      return url
    } catch { return null }
  })()
  cache.set(key, result)
  if (cache.size > 24) cache.delete(cache.keys().next().value!)
  return result
}

export function useSoftCover(src: string | null) {
  const [size, setSize] = useState(() => [window.innerWidth, window.innerHeight])
  const [ready, setReady] = useState<{ src: string; w: number; h: number; url: string | null } | null>(null)
  useEffect(() => {
    const resize = () => setSize([window.innerWidth, window.innerHeight])
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])
  const [w, h] = size
  useEffect(() => {
    if (!src) return
    let alive = true
    void softCover(src, w, h).then((url) => { if (alive) setReady({ src, w, h, url }) })
    return () => { alive = false }
  }, [src, w, h])
  const current = ready?.src === src && ready.w === w && ready.h === h
  return { url: current ? ready.url : null, ready: !src || current }
}
