/*
 * 静态玻璃交给 @sessile/dom 的 GlassSurfaceController 绘制，和弹出层的形变走同一条管线
 * （同一张 Snell 位移图、同一套模糊 / 提亮 / 可读性滤镜、同一个边缘高光渲染器）。
 *
 * - backdropTarget: 'container'：采样滤镜和底色直接写在宿主自身。宿主经常自己做透明度动画，
 *   子层的 backdrop-filter 会把这样的宿主当成 backdrop 根而采不到页面。
 * - 边缘叠加层画细线与高光，只比宿主盒外扩外描边的宽度（外描边在形状外侧，宿主带 data-sessile 时
 *   CSS 不再画它），基本不撑大滚动溢出；外投影仍由 CSS 画。
 * - 叠加层共用一个页面级 WebGL2 上下文（context: 'shared'），一页几十块玻璃不会超出浏览器的
 *   上下文上限，形变层也走这一个，静态与形变的边缘出自同一个着色器。
 * - 宿主不能是滚动容器：叠加层是宿主的子节点，会被裁到内边距盒并跟着内容滚走。需要滚动时在
 *   玻璃里面另放一层滚动容器。
 * - 材质从宿主静息时的 CSS（底色、描边、内发光、--g-veil）读出，className 上的覆盖照样生效；
 *   形变层也用同一个读取函数，收尾交接时不会跳变。
 */
import { useEffect, useLayoutEffect, useRef, useSyncExternalStore, type RefObject } from 'react'
import {
  createGlassOverlayRenderer,
  parseCssFilterOptics,
  tryParseCssRgba,
  type BackdropVeilOptics,
  type GlassFieldState,
  type OpticalMaterial,
  type ThemeMode,
} from '@sessile/core'
import {
  GlassSurfaceController,
  buildMaterialFromCssSurface,
  readElementGlassSurface,
  resolveElementTheme,
  type GlassLegibilityOptions,
  type RefractFilterConfig,
} from '@sessile/dom'

export const SURFACE_ATTR = 'data-sessile'

/**
 * 在宿主显示静息 CSS 外观的状态下执行 read：摘掉 Sessile 与形变标记、内联底色和采样滤镜，
 * 同时关掉过渡，读到的是目标值而不是过渡中间值。
 */
export function readRestingStyles<T>(el: HTMLElement, read: () => T): T {
  const style = el.style
  const saved = {
    background: style.background,
    backdropFilter: style.backdropFilter,
    webkit: style.getPropertyValue('-webkit-backdrop-filter'),
    transition: style.transition,
  }
  const attrs = [SURFACE_ATTR, 'data-morphing'].filter((a) => el.hasAttribute(a)).map((a) => [a, el.getAttribute(a)!] as const)
  style.transition = 'none'
  for (const [a] of attrs) el.removeAttribute(a)
  style.background = ''
  style.backdropFilter = ''
  style.removeProperty('-webkit-backdrop-filter')
  try {
    return read()
  } finally {
    for (const [a, v] of attrs) el.setAttribute(a, v)
    style.background = saved.background
    style.backdropFilter = saved.backdropFilter
    if (saved.webkit) style.setProperty('-webkit-backdrop-filter', saved.webkit)
    style.transition = saved.transition
  }
}

export interface RestingGlass {
  material: OpticalMaterial
  theme: ThemeMode
  /** 折射档的提亮 / 压暗（--g-veil），作用在模糊和饱和之后 */
  veilOptics?: BackdropVeilOptics
  /** 宿主文字颜色，0–1 的 sRGB */
  foreground: [number, number, number]
}

/** 文字颜色认不出时（Sessile 只换算 sRGB 与 OKLab 系），按主题取常规前景，至少极性不会反 */
function resolveForeground(value: string, theme: ThemeMode): [number, number, number] {
  const rgba = tryParseCssRgba(value)
  if (rgba) return [rgba[0], rgba[1], rgba[2]]
  return theme === 'dark' ? [1, 1, 1] : [0, 0, 0]
}

/** 读宿主静息时的玻璃材质；blur / saturate 取自玻璃调参（CSS 里只有毛玻璃档的默认值） */
export function readRestingGlass(el: HTMLElement, o: { blur: number | null; saturate: number | null; tone: boolean }): RestingGlass {
  return readRestingStyles(el, () => {
    const measured = readElementGlassSurface(el, { temporarilyClearAttribute: null })
    const cs = getComputedStyle(el)
    const veil = o.tone ? cs.getPropertyValue('--g-veil').trim() : ''
    const theme = resolveElementTheme(el)
    const material = buildMaterialFromCssSurface(measured, { theme })
    if (o.blur !== null) material.blur = o.blur
    if (o.saturate !== null) material.saturation = o.saturate
    // 外投影由 CSS 画在宿主盒外，叠加层只负责形状内部
    material.shadowAlpha = 0
    return {
      material,
      theme,
      veilOptics: veil ? parseCssFilterOptics(veil) : undefined,
      foreground: resolveForeground(cs.color, theme),
    }
  })
}

/*
 * 主题可以由任意祖先的 data-theme 局部改写（阅读器按自己的背景另设主题），
 * 统一观察一次，变化时让所有玻璃重读材质。
 */
let styleEpoch = 0
const epochListeners = new Set<() => void>()
let epochObserver: MutationObserver | null = null

function subscribeStyleEpoch(listener: () => void): () => void {
  epochListeners.add(listener)
  if (!epochObserver && typeof MutationObserver !== 'undefined') {
    epochObserver = new MutationObserver(() => {
      styleEpoch += 1
      for (const fn of epochListeners) fn()
    })
    epochObserver.observe(document.documentElement, {
      attributes: true,
      subtree: true,
      attributeFilter: ['data-theme', 'data-glass-preset', 'data-glass'],
    })
  }
  return () => {
    epochListeners.delete(listener)
    if (epochListeners.size === 0) {
      epochObserver?.disconnect()
      epochObserver = null
    }
  }
}

const getStyleEpoch = () => styleEpoch

export interface GlassSurfaceOptions {
  enabled: boolean
  /** 透镜折射（Chromium）；false 时退回同一材质的毛玻璃 */
  refract: boolean
  /** 折射档的底色与提亮；关掉透镜时也保留 */
  tone: boolean
  blur: number | null
  saturate: number | null
  refraction: Partial<RefractFilterConfig>
  /** 可读性目标（不含前景色，前景取宿主的文字颜色）；null 关闭 */
  legibility: Omit<GlassLegibilityOptions, 'foreground'> | null
  /** 其他会改变 CSS 外观的输入（预设、dense、className、底色浓度） */
  styleKey: string
}

const surfaces = new WeakMap<Element, GlassSurfaceController>()

/**
 * 不取整的边框盒尺寸。offsetWidth / clientLeft 会取整，而静态玻璃和形变层的几何都按小数画，
 * 两边一个取整一个不取整，形变收尾交接时边缘差半个像素。全局 box-sizing: border-box，
 * 计算出的 width / height 就是边框盒。
 */
export function borderBoxSize(el: HTMLElement, cs: CSSStyleDeclaration = getComputedStyle(el)): { width: number; height: number } {
  return { width: parseFloat(cs.width) || el.offsetWidth, height: parseFloat(cs.height) || el.offsetHeight }
}

function isScrollContainer(cs: CSSStyleDeclaration): boolean {
  const scrolls = (v: string) => v === 'auto' || v === 'scroll'
  return scrolls(cs.overflowX) || scrolls(cs.overflowY)
}

function outset(box: { x: number; y: number; width: number; height: number }, px: number) {
  return { x: box.x - px, y: box.y - px, width: box.width + 2 * px, height: box.height + 2 * px }
}

/** 宿主上的控制器；形变层借它的可读性参数，让过渡和静息一致 */
export function getGlassSurface(el: Element | null | undefined): GlassSurfaceController | null {
  return (el && surfaces.get(el)) || null
}

export function useGlassSurface(host: RefObject<HTMLElement | null>, o: GlassSurfaceOptions): void {
  const epoch = useSyncExternalStore(subscribeStyleEpoch, getStyleEpoch, getStyleEpoch)
  const controllerRef = useRef<GlassSurfaceController | null>(null)
  const drawRef = useRef<() => void>(() => {})
  const optionsRef = useRef(o)
  useLayoutEffect(() => {
    optionsRef.current = o
  })

  const { enabled } = o
  useLayoutEffect(() => {
    const el = host.current
    if (!enabled || !el) return
    let resting: RestingGlass | null = null
    let ready = false

    const controller = new GlassSurfaceController({
      container: el,
      backdropTarget: 'container',
      overlayRenderer: createGlassOverlayRenderer({ context: 'shared' }),
      mode: optionsRef.current.refract ? 'refract' : 'frosted',
      observeResize: true,
      // 构造时会同步回调一次，此时控制器尚未赋值
      onResize: () => ready && draw(),
    })
    const overlay = controller.getElements().overlayCanvas
    overlay?.setAttribute('data-sessile-layer', 'overlay')

    function draw() {
      if (!el || !resting) return
      const cs = getComputedStyle(el)
      const { width: w, height: h } = borderBoxSize(el, cs)
      if (!w || !h) return controller.clear()
      // 子层以内边距盒为原点，宿主边框盒左上角在 (-border)
      const box = { x: -(parseFloat(cs.borderLeftWidth) || 0), y: -(parseFloat(cs.borderTopWidth) || 0), width: w, height: h }
      const radius = Math.min(parseFloat(cs.borderTopLeftRadius) || 0, Math.min(w, h) / 2)
      const field: GlassFieldState = {
        primitives: [{ id: 'glass', center: { x: box.x + w / 2, y: box.y + h / 2 }, size: { width: w, height: h }, radius }],
        blendK: 0,
        // 静息材质是毛玻璃档，内发光取自 CSS 的 inset 阴影：画成均匀的柔和内边光，和形变层的 open 状态一致
        styleMix: 1,
      }
      const opts = optionsRef.current
      controller.render({
        field,
        // 外描边画在形状外侧，叠加层外扩它的宽度再加 1px 抗锯齿，否则会被裁掉，形变收尾时这条线会消失
        bounds: outset(box, Math.ceil(resting.material.hairlineWidth + 1)),
        refractBounds: box,
        material: resting.material,
        theme: resting.theme,
        veilOptics: resting.veilOptics,
        refraction: opts.refraction,
      })
    }

    const refresh = () => {
      const opts = optionsRef.current
      resting = readRestingGlass(el, opts)
      if (import.meta.env.DEV && isScrollContainer(getComputedStyle(el))) {
        console.warn('[glass] 玻璃宿主不能是滚动容器，边缘会跟着内容滚走；把滚动放进 <GlassScroll>。', el)
      }
      controller.setMode(opts.refract ? 'refract' : 'frosted')
      controller.setTheme(resting.theme)
      controller.setLegibility(opts.legibility ? { ...opts.legibility, foreground: resting.foreground } : null)
      draw()
    }

    el.setAttribute(SURFACE_ATTR, '')
    surfaces.set(el, controller)
    controllerRef.current = controller
    drawRef.current = refresh
    ready = true
    refresh()

    return () => {
      surfaces.delete(el)
      controller.dispose()
      el.removeAttribute(SURFACE_ATTR)
      controllerRef.current = null
      drawRef.current = () => {}
    }
  }, [enabled, host])

  const legibilityKey = JSON.stringify(o.legibility)
  const refractionKey = JSON.stringify(o.refraction)
  useEffect(() => {
    drawRef.current()
  }, [o.refract, o.tone, o.blur, o.saturate, refractionKey, legibilityKey, o.styleKey, epoch])
}
