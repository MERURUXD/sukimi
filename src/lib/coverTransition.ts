import { fade } from '@/design/motion'
import { useAppearance } from '@/design/settings'
import { READER_VT_ATTR } from './readerTransition'

/** 详情页大封面在阅读器转场里单独成组用的 view-transition-name */
export const COVER_VT = 'manga-cover'

/** 页面根元素上标记当前路径（AppShell 的 main），换页前读一次，得到是从哪页离开的 */
export const PAGE_PATH_ATTR = 'data-page-path'

const DETAIL_PATH = /^\/manga\/\d+$/
const HERO_COVER = '.manga-hero-cover'
const FLIGHT_MS = 450
const FADE_MS = fade.default.duration * 1000
const EASE = `cubic-bezier(${fade.default.ease.join(', ')})`

/**
 * 遮罩和克隆挂在 .app-shell 里：外壳是独立层叠上下文（isolate），挂在 body 上的 z-index 会压过整个外壳，
 * 连导航一起盖住；放进外壳才和导航（z-40）比层级，且仍是导航的兄弟元素，不影响玻璃采样。
 */
const layer = () => document.querySelector('.app-shell') ?? document.body

/** 详情页路径 → 从哪个页面、第几个同名封面点进来的 */
const origins = new Map<string, { path: string; index: number }>()

/** 刚点下的封面；只给紧接着的那次换页用 */
let clicked: { el: HTMLElement; at: number } | undefined
let uaPop = 0
let active: { skip: () => void } | undefined
let installed = false

const coversOf = (href: string) =>
  [...document.querySelectorAll<HTMLElement>(`a[href="${CSS.escape(href)}"]`)]
    .map((a) => (a.matches('.cv') ? a : a.querySelector<HTMLElement>('.cv')))
    .filter((el): el is HTMLElement => !!el)

const pagePath = () => document.querySelector(`[${PAGE_PATH_ATTR}]`)?.getAttribute(PAGE_PATH_ATTR) ?? null

const onScreen = (r: DOMRect) => r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth

/** 打码的封面不飞：克隆按目标尺寸绘制再缩放，模糊半径会跟着缩小，比原图看得更清楚 */
const blurred = (img: HTMLImageElement) => getComputedStyle(img).filter !== 'none'

interface Shot { src: string; rect: DOMRect; radius: number; shadow: string }

/**
 * 量一端的位置、圆角和投影。起点还要带上已解码的图（克隆用它）；
 * 终点只量位置——详情页大封面刚挂载时图片可能还在载入，克隆用的是起点那张。
 */
function shoot(cover: HTMLElement | null | undefined, withImage = true): Shot | undefined {
  const img = cover?.querySelector('img')
  if (!cover || (img?.complete && blurred(img))) return
  if (withImage && (!img?.complete || !img.currentSrc)) return
  const rect = cover.getBoundingClientRect()
  if (!onScreen(rect)) return
  const style = getComputedStyle(cover)
  return { src: img?.currentSrc ?? '', rect, radius: parseFloat(style.borderTopLeftRadius) || 0, shadow: style.boxShadow }
}

/**
 * 封面飞行：一张固定定位的克隆图从起点移到终点，期间藏起终点的真封面。
 * 克隆按两端里较大的尺寸绘制、只往小缩放，任何一端都不会被放大发虚；
 * 位移和缩放单独一段动画，交给合成器，新页面挂载占住主线程时也不卡；
 * 圆角和投影透明度另起动画，两端不同时才有。
 */
function fly(from: Shot, to: Shot, target: HTMLElement): Animation[] {
  const base = from.rect.width >= to.rect.width ? from.rect : to.rect
  const at = (r: DOMRect) => `translate(${r.left - base.left}px, ${r.top - base.top}px) scale(${r.width / base.width})`
  const radius = (s: Shot) => `${s.radius * (base.width / s.rect.width)}px`

  const flight = document.createElement('div')
  flight.className = 'cover-flight'
  Object.assign(flight.style, { left: `${base.left}px`, top: `${base.top}px`, width: `${base.width}px`, height: `${base.height}px` })
  const shadow = document.createElement('div')
  const img = new Image()
  img.alt = ''
  img.decoding = 'sync'
  img.src = from.src
  flight.append(shadow, img)
  layer().append(flight)
  target.style.visibility = 'hidden'

  const timing = { duration: FLIGHT_MS, easing: EASE, fill: 'both' } as const
  const anims = [flight.animate([{ transform: at(from.rect) }, { transform: at(to.rect) }], timing)]
  // 投影只取有投影的一端（详情页大封面），另一端淡掉
  shadow.style.boxShadow = from.shadow !== 'none' ? from.shadow : to.shadow
  const shade = (s: Shot) => (s.shadow !== 'none' ? 1 : 0)
  if (shade(from) !== shade(to)) anims.push(shadow.animate([{ opacity: shade(from) }, { opacity: shade(to) }], timing))
  if (from.radius !== to.radius || from.rect.width !== to.rect.width) {
    const corners = [{ borderRadius: radius(from) }, { borderRadius: radius(to) }]
    anims.push(img.animate(corners, timing), shadow.animate(corners, timing))
  } else {
    img.style.borderRadius = shadow.style.borderRadius = radius(to)
  }
  void Promise.allSettled(anims.map((a) => a.finished)).then(() => {
    target.style.visibility = ''
    flight.remove()
  })
  return anims
}

/** 页面内容从底色淡入，代替原来整页快照的交叉淡化。盖在导航下面，不改页面祖先的透明度，玻璃照常采样 */
function veil() {
  const el = document.createElement('div')
  el.className = 'cover-veil'
  layer().append(el)
  return el
}

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

/**
 * 进出详情页不走 View Transition，自己做封面飞行和页面淡入：
 * 浏览器转场期间整页每帧都要合成新旧快照，真实显卡上空转场也掉帧，时长越长掉得越多；
 * 普通动画只动一张图和一层底色，其余页面照常渲染。
 *
 * 返回 React Router 需要的那几个 ViewTransition 字段，它照常在 finished 后收尾，
 * 下一次换页打断时调 skipTransition。
 */
function coverFlight(update: ViewTransitionUpdateCallback | null | undefined, from: string | null, to: string, basePath: string): ViewTransition {
  const pending = clicked && Date.now() - clicked.at < 1000 && clicked.el.isConnected ? clicked.el : undefined
  clicked = undefined
  const motion = useAppearance.getState().mangaDetailMotion
    && !matchMedia('(prefers-reduced-motion: reduce)').matches
    && Date.now() - uaPop > 1000
  const origin = from ? origins.get(from) : undefined
  const back = !!from && DETAIL_PATH.test(from) && origin?.path === to
  const source = !motion ? undefined : back ? shoot(document.querySelector<HTMLElement>(HERO_COVER)) : shoot(pending)
  const cover = motion ? veil() : undefined

  let anims: Animation[] = []
  let skipped = false
  const handle = { skip: () => { skipped = true; anims.forEach((a) => a.finish()); cover?.remove() } }
  active?.skip()
  active = handle

  const updateCallbackDone = Promise.resolve().then(() => update?.()).then(() => undefined)
  const ready = updateCallbackDone.then(async () => {
    if (!cover) return
    // 等一帧：滚动恢复与虚拟列表首帧都已落定，量到的终点才准；这一帧还被底色盖着
    await nextFrame()
    if (skipped) return
    const target = back
      ? (() => { const covers = coversOf(`${basePath}${from}`); return covers[origin!.index] ?? covers[0] })()
      : DETAIL_PATH.test(to) ? document.querySelector<HTMLElement>(HERO_COVER) : null
    const dest = source && target ? shoot(target, false) : undefined
    anims = [cover.animate([{ opacity: 1 }, { opacity: 0 }], { duration: FADE_MS, easing: EASE, fill: 'both' })]
    if (source && dest && target) anims.push(...fly(source, dest, target))
  })
  const finished = ready
    .then(() => Promise.allSettled(anims.map((a) => a.finished)))
    .then(() => undefined)
    .finally(() => {
      cover?.remove()
      if (active === handle) active = undefined
    })
  void finished.catch(() => {})
  return { updateCallbackDone, ready, finished, skipTransition: handle.skip, types: new Set() } as unknown as ViewTransition
}

/**
 * 封面过渡：
 *
 * - 进入：全局点击监听，点了指向详情页的链接时记下「被点的那个」封面和它在页面上的序号。
 *   同一部漫画可能在页面上出现多次（首页大图区和书架），返回时按序号找回原来那一个。
 *   链接本身是 .cv，或者里面有 .cv，都算封面；都不是时借用同一区块里同一详情的封面。
 * - 返回：React Router 对用 viewTransition 进入的页面，后退时也会调 startViewTransition。
 *   回到来时的页面就让详情页的大封面飞回原来的格子；
 *   虚拟列表要在第一次渲染时就用恢复后的滚动位置，那个格子才会在 DOM 里（见 useRestoredOffset）。
 * - 换页涉及详情页时由 coverFlight 接管，不调浏览器的转场；阅读器、画廊和主题切换仍走 View Transition。
 */
export function installCoverTransition(basePath = '') {
  if (installed) return
  installed = true
  const strip = (path: string) => (basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path)

  document.addEventListener(
    'click',
    (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const link = (e.target as Element | null)?.closest?.(`a[href^="${basePath}/manga/"]`)
      const href = link?.getAttribute('href')
      if (!link || !href || /\/chapter\//.test(href)) return
      // 本身不带封面的链接（如首页「漫画详情」按钮）借用同一区块里指向同一详情、正显示着的封面
      const cover = ((link.matches('.cv') ? link : link.querySelector('.cv')) as HTMLElement | null)
        ?? coversOf(href).find((el) => link.closest('section')?.contains(el) && el.getClientRects().length > 0)
      if (!cover) return
      clicked = { el: cover, at: Date.now() }
      const from = pagePath()
      if (from) origins.set(href.slice(basePath.length), { path: from, index: Math.max(0, coversOf(href).indexOf(cover)) })
    },
    true,
  )
  addEventListener('popstate', (e) => {
    uaPop = (e as PopStateEvent & { hasUAVisualTransition?: boolean }).hasUAVisualTransition ? Date.now() : 0
  })

  const start = document.startViewTransition?.bind(document)
  if (!start) return
  document.startViewTransition = ((arg?: ViewTransitionUpdateCallback | StartViewTransitionOptions) => {
    const html = document.documentElement
    // 被调用时地址已经换好了
    const to = strip(location.pathname)
    const from = pagePath()
    const own = !html.hasAttribute(READER_VT_ATTR) && !html.hasAttribute('data-theme-vt')
      && !html.getAttributeNames().some((name) => name.startsWith('data-gallery-'))
      && from !== to && [from, to].some((path) => path && DETAIL_PATH.test(path))
    if (!own) {
      active?.skip()
      return start(arg)
    }
    return coverFlight(typeof arg === 'function' ? arg : arg?.update, from, to, basePath)
  }) as typeof document.startViewTransition
}
