/*
 * 全站共用的玻璃背景探针：封面、阅读页和动态背景登记各自的亮度统计，玻璃按自己盖住的区域取样，
 * 再由 Sessile 的可读性求解器决定底色、提亮 / 压暗和逐像素压缩的力度。
 *
 * 探针不读页面渲染结果，只用页面自己能读的图片像素（同源封面；跨域图片画布被污染时
 * measureImageTelemetry 返回 null，就当没有登记）。没有登记的部分按页面底色算。
 * 只有进入视口附近的区域才放进探针：书库一屏外可能有上百张封面，每次取样都要逐个量位置。
 * 没有玻璃开着可读性时（设置默认关闭）只记下登记，不观察、不取样。
 */
import {
  linearToSrgb,
  relativeLuminance,
  srgbLuma,
  type BackdropTelemetry,
  type BackdropTelemetryAccumulator,
  type BackdropTelemetryGrid,
  type Rect,
} from '@sessile/core'
import { createRegionProbe, measureImageTelemetry, type BackdropProbe, type RegionProbe } from '@sessile/dom'
import { useEffect, type RefObject } from 'react'
import type { Rgb, Swatch } from '@/lib/palette'

type Telemetry = BackdropTelemetry | BackdropTelemetryGrid

/** 纯色的统计：亮度两端相同、没有细节 */
export function colorTelemetry([r, g, b]: Rgb): BackdropTelemetry {
  return {
    lumaHigh: linearToSrgb(relativeLuminance(r, g, b)),
    lumaLow: srgbLuma(r, g, b),
    channelHigh: Math.max(r, g, b),
    channelLow: Math.min(r, g, b),
    chroma: Math.max(r, g, b) - Math.min(r, g, b),
    detail: 0,
  }
}

/**
 * 动态背景只画色板里的颜色（色块之间互相混合），所以两端取各色的极值即可覆盖画面；
 * 色块高度模糊，细节记 0。
 */
export function swatchTelemetry(swatches: readonly Swatch[]): BackdropTelemetry | null {
  const used = swatches.filter((s) => s.weight > 0.02)
  if (!used.length) return null
  const each = used.map((s) => colorTelemetry(s.rgb))
  const total = used.reduce((sum, s) => sum + s.weight, 0)
  return {
    lumaHigh: Math.max(...each.map((t) => t.lumaHigh)),
    lumaLow: Math.min(...each.map((t) => t.lumaLow)),
    channelHigh: Math.max(...each.map((t) => t.channelHigh!)),
    channelLow: Math.min(...each.map((t) => t.channelLow!)),
    chroma: each.reduce((sum, t, i) => sum + t.chroma * used[i]!.weight, 0) / total,
    detail: 0,
  }
}

function pageTelemetry(): BackdropTelemetry {
  const m = getComputedStyle(document.body).backgroundColor.match(/[\d.]+/g)
  const rgb: Rgb = m && m.length >= 3 ? [Number(m[0]) / 255, Number(m[1]) / 255, Number(m[2]) / 255] : [0.08, 0.08, 0.09]
  return colorTelemetry(rgb)
}

/** 登记的区域：统计延迟到首次进入视口附近才算，书库里看不到的封面不解码取样 */
interface Region {
  measure: () => Telemetry | null
  telemetry?: Telemetry
  visible: boolean
}

const regions = new Map<Element, Region>()
const listeners = new Set<() => void>()
let inner: RegionProbe | null = null
let io: IntersectionObserver | null = null
let themeObserver: MutationObserver | null = null

const notify = () => {
  for (const fn of listeners) fn()
}

function rebuildInner() {
  // 页面底色随主题变化；RegionProbe 的背景在创建时固定，所以整体重建并重放可见区域
  inner = createRegionProbe({ background: pageTelemetry(), eventTarget: null })
  for (const [el, region] of regions) {
    if (region.visible && region.telemetry) inner.set(el, region.telemetry)
  }
}

function show(el: Element, region: Region) {
  region.visible = true
  // 读不到时下次可见再试：换图后元素可能还在加载
  region.telemetry ??= region.measure() ?? undefined
  if (region.telemetry && inner) {
    inner.set(el, region.telemetry)
    notify()
  }
}

function startObserving() {
  if (typeof IntersectionObserver === 'undefined') return
  io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const region = regions.get(entry.target)
        if (!region) continue
        if (entry.isIntersecting) show(entry.target, region)
        else if (region.visible) {
          region.visible = false
          if (inner) inner.delete(entry.target)
          notify()
        }
      }
    },
    { rootMargin: '25%' },
  )
  themeObserver = new MutationObserver(() => {
    rebuildInner()
    notify()
  })
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  for (const el of regions.keys()) io.observe(el)
  document.addEventListener('scroll', onScroll, { capture: true, passive: true })
  window.addEventListener('resize', onScroll)
}

function stopObserving() {
  io?.disconnect()
  themeObserver?.disconnect()
  io = themeObserver = null
  inner = null
  for (const region of regions.values()) region.visible = false
  document.removeEventListener('scroll', onScroll, { capture: true })
  window.removeEventListener('resize', onScroll)
}

const onScroll = () => notify()

export const glassBackdropProbe: BackdropProbe = {
  sample(rects: readonly Rect[], acc: BackdropTelemetryAccumulator) {
    inner ??= (rebuildInner(), inner)
    inner!.sample(rects, acc)
  },
  observe(invalidate) {
    if (listeners.size === 0) startObserving()
    listeners.add(invalidate)
    return () => {
      listeners.delete(invalidate)
      if (listeners.size === 0) stopObserving()
    }
  },
}

/** 登记一块背景；measure 在可见时才调用，返回 null 表示读不到（跨域、未载入） */
export function registerBackdrop(el: Element, measure: () => Telemetry | null): () => void {
  const region: Region = { measure, visible: false }
  regions.set(el, region)
  io?.observe(el)
  return () => {
    if (regions.get(el) !== region) return
    regions.delete(el)
    io?.unobserve(el)
    if (region.visible && inner) {
      inner.delete(el)
      notify()
    }
  }
}

/** 格子映射到元素的边框盒（object-fit: cover 的裁切忽略不计） */
function measureBackdropImage(img: HTMLImageElement): BackdropTelemetryGrid | null {
  if (!img.complete || !img.naturalWidth) return null
  return measureImageTelemetry(img, { cols: 4, rows: 6, sampleWidth: 48, aspect: img.naturalHeight / img.naturalWidth })
}

/**
 * 图片载入后登记为背景，loadedSrc 为 null 表示尚未载入。
 * 统计跟着元素走，换图时重新登记；阅读页每页一个 Blob 地址，按地址缓存会一直增长。
 */
export function useBackdropImage(img: RefObject<HTMLImageElement | null>, loadedSrc: string | null): void {
  useEffect(() => {
    const el = img.current
    if (!el || !loadedSrc) return
    return registerBackdrop(el, () => measureBackdropImage(el))
  }, [img, loadedSrc])
}
