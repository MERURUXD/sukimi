/*
 * 液态折射：backdrop-filter: url(#svg) + feDisplacementMap（仅 Chromium 生效）。
 *
 * 位移图按组件尺寸用 canvas 生成，模拟「凸透镜边缘」：
 * - 中间区域不位移，保持通透；
 * - 只有沿边缘一圈「透镜带」会把内容向外拉伸（越靠外缘越强，曲线由 falloff 控制）；
 * - 始终从内侧取样，不会取到元素外面的透明像素而出现黑边。
 * 色散先把输入拆为单色光，再分别沿透镜位移，最后用加法还原 RGB。
 */
import { Fragment, useLayoutEffect, useRef, type RefObject } from 'react'

export interface LensOptions {
  bezel: number
  strength: number
  falloff: number
  dispersion: number
}

let supportCache: boolean | undefined

/** backdrop-filter: url(#svg) 目前只有 Chromium 真正生效 */
export function supportsRefract() {
  if (supportCache !== undefined) return supportCache
  const ua = navigator.userAgent
  const webkit = /Safari/.test(ua) && !/Chrome|Chromium|Edg/.test(ua)
  const firefox = /Firefox/.test(ua)
  supportCache = !webkit && !firefox && CSS.supports('backdrop-filter', 'url(#x)')
  return supportCache
}

export const autoBezel = (w: number, h: number) => Math.max(6, Math.min(22, Math.min(w, h) * 0.3))

const cache = new Map<string, string>()
let canvas: HTMLCanvasElement | null = null

/**
 * 生成位移图。R / G 通道 = 128 ± 位移方向，最大位移对应 ±127。
 * 返回 data URL；同尺寸同参数复用。
 */
function lensMap(w: number, h: number, radius: number, bezel: number, falloff: number) {
  const W = Math.max(1, Math.round(w))
  const H = Math.max(1, Math.round(h))
  const key = `${W}x${H}r${radius.toFixed(1)}b${bezel.toFixed(1)}f${falloff}`
  const hit = cache.get(key)
  if (hit) {
    cache.delete(key)
    cache.set(key, hit)
    return hit
  }

  canvas ??= document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  const img = ctx.createImageData(W, H)
  const d = img.data
  const hw = W / 2
  const hh = H / 2
  const r = Math.min(radius, hw, hh)

  for (let y = 0; y < H; y++) {
    const py = y + 0.5 - hh
    const ay = Math.abs(py)
    const sy = py < 0 ? -1 : 1
    for (let x = 0; x < W; x++) {
      const px = x + 0.5 - hw
      const ax = Math.abs(px)
      const sx = px < 0 ? -1 : 1
      const qx = ax - (hw - r)
      const qy = ay - (hh - r)
      let dist: number
      let nx = 0
      let ny = 0
      if (qx > 0 && qy > 0) {
        // 圆角区域：法线沿圆心指向外
        const len = Math.hypot(qx, qy)
        dist = r - len
        nx = qx / len
        ny = qy / len
      } else if (hw - ax < hh - ay) {
        dist = hw - ax
        nx = 1
      } else {
        dist = hh - ay
        ny = 1
      }
      const i = (y * W + x) * 4
      let ox = 0
      let oy = 0
      if (dist < bezel) {
        // 圆角外侧只露出半个像素的边缘也按最外缘位移：不弯的话它们取到原样的背景，
        // 紧挨着弯折最强的一圈，沿圆角的像素台阶会露出锯齿
        const m = (1 - Math.max(0, dist) / bezel) ** falloff
        // 从内侧取样：位移方向与外法线相反
        ox = -sx * nx * m
        oy = -sy * ny * m
      }
      d[i] = 128 + ox * 127
      d[i + 1] = 128 + oy * 127
      d[i + 2] = 128
      d[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  const url = canvas.toDataURL()
  if (cache.size >= 48) cache.delete(cache.keys().next().value!)
  cache.set(key, url)
  return url
}

/** 跟随宿主元素尺寸重绘位移图，并把位移量写进滤镜 */
export function useLensMap(host: RefObject<HTMLElement | null>, enabled: boolean, o: LensOptions) {
  const feImage = useRef<SVGFEImageElement>(null)
  // 色散开关会换掉滤镜节点，也要重新写 scale
  const key = `${o.bezel}|${o.strength}|${o.falloff}|${o.dispersion}`

  useLayoutEffect(() => {
    const el = host.current
    if (!enabled || !el) return
    let lastSize = ''
    const draw = () => {
      // 用布局尺寸而不是 getBoundingClientRect：缩放动画中的 transform 不应影响位移图
      const w = el.offsetWidth
      const h = el.offsetHeight
      if (!w || !h) return
      // 动画中会改内联圆角的玻璃（Popover 展开）用 data-lens-radius 固定落定后的圆角
      const radius = Number(el.dataset.lensRadius) || parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0
      const bezel = o.bezel > 0 ? Math.min(o.bezel, w / 2, h / 2) : autoBezel(w, h)
      const size = `${w}:${h}:${radius}:${bezel}`
      if (lastSize === size) return
      lastSize = size
      feImage.current?.setAttribute('href', lensMap(w, h, radius, bezel, o.falloff))
      // 位移图 ±127 对应 ±scale/2，所以 scale = 2 × 最大位移
      const shift = bezel * o.strength
      const filter = feImage.current?.parentElement
      filter?.querySelectorAll('feDisplacementMap').forEach((fe) => {
        const extra = Number(fe.dataset.extra ?? 0)
        fe.setAttribute('scale', String(2 * shift + extra))
      })
    }
    draw()
    // 在本次布局绘制前同步换图；延迟或再等一帧会先拉伸旧透镜带，随后边缘二次跳变。
    const ro = new ResizeObserver(draw)
    ro.observe(el)
    return () => {
      ro.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, key])

  return feImage
}

export function LensFilter({
  id,
  feImage,
  dispersion,
}: {
  id: string
  feImage: RefObject<SVGFEImageElement | null>
  dispersion: number
}) {
  return (
    <svg aria-hidden className="pointer-events-none absolute inset-0 -z-10 size-full opacity-0">
      <defs>
        <filter id={id} colorInterpolationFilters="sRGB" x="0%" y="0%" width="100%" height="100%">
          <feImage ref={feImage} x="0" y="0" width="100%" height="100%" preserveAspectRatio="none" result="map" />
          {dispersion > 0 ? (
            <>
              {(['R', 'G', 'B'] as const).map((channel, index) => (
                <Fragment key={channel}>
                  <feComponentTransfer in="SourceGraphic" result={`input-${channel}`}>
                    <feFuncR type="linear" slope={channel === 'R' ? 1 : 0} />
                    <feFuncG type="linear" slope={channel === 'G' ? 1 : 0} />
                    <feFuncB type="linear" slope={channel === 'B' ? 1 : 0} />
                  </feComponentTransfer>
                  <feDisplacementMap
                    in={`input-${channel}`}
                    in2="map"
                    xChannelSelector="R"
                    yChannelSelector="G"
                    data-extra={(index - 1) * dispersion}
                    result={`lens-${channel}`}
                  />
                </Fragment>
              ))}
              {/* 单色通道互不重叠，加法合成不会把封面的颜色混成新的色调。 */}
              <feComposite in="lens-R" in2="lens-G" operator="arithmetic" k2={1} k3={1} result="red-green" />
              <feComposite in="red-green" in2="lens-B" operator="arithmetic" k2={1} k3={1} />
            </>
          ) : (
            <feDisplacementMap data-extra={0} in="SourceGraphic" in2="map" xChannelSelector="R" yChannelSelector="G" />
          )}
        </filter>
      </defs>
    </svg>
  )
}
