import { useEffect, useState } from 'react'

const cache = new Map<string, Promise<string | null>>()

/** 排行只显示小封面；空闲时解码原图并缩到显示尺寸，切屏时不再栅格大图。 */
function prepare(src: string, width: number) {
  const key = `${width}:${src}`
  let pending = cache.get(key)
  if (!pending) {
    pending = (async () => {
      try {
        const img = new Image()
        img.src = src
        await img.decode()
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = Math.round(width * 1.5)
        const ctx = canvas.getContext('2d')
        if (!ctx) return null
        const k = Math.max(width / img.naturalWidth, canvas.height / img.naturalHeight)
        ctx.drawImage(img, (width - img.naturalWidth * k) / 2, (canvas.height - img.naturalHeight * k) / 2, img.naturalWidth * k, img.naturalHeight * k)
        const url = canvas.toDataURL('image/jpeg', 0.88)
        const small = new Image()
        small.src = url
        await small.decode()
        return url
      } catch { return null }
    })()
    cache.set(key, pending)
    if (cache.size > 40) cache.delete(cache.keys().next().value!)
  }
  return pending
}

export function useRankCover(src: string | null | undefined, width: number) {
  const pixels = Math.min(640, Math.max(32, Math.ceil(width * Math.min(2, window.devicePixelRatio || 1))))
  const [ready, setReady] = useState<{ src: string; pixels: number; url: string } | null>(null)
  useEffect(() => {
    if (!src) return
    let alive = true
    const run = () => { void prepare(src, pixels).then((url) => { if (alive && url) setReady({ src, pixels, url }) }) }
    const idle = 'requestIdleCallback' in window
    const id = idle ? window.requestIdleCallback(run, { timeout: 800 }) : window.setTimeout(run, 100)
    return () => {
      alive = false
      if (idle) window.cancelIdleCallback(id)
      else window.clearTimeout(id)
    }
  }, [src, pixels])
  return ready && ready.src === src && ready.pixels === pixels ? ready.url : src
}
