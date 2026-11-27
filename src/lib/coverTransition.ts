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
const LEAD_MS = fade.fast.duration * 1000
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

/**
 * 打码的封面不飞：克隆是不带模糊的原图，又在打码区域外面，飞行期间会把原图露出来。
 * 图片还在载入（只有骨架屏）时没法读滤镜，按所在区域是否打码保守处理。
 */
const guarded = (cover: HTMLElement, img: HTMLImageElement | null) =>
  img ? getComputedStyle(img).filter !== 'none' : !!cover.closest('[data-nsfw]')

/** 克隆只做等比缩放，两端比例不同（如手机首页铺满的大图区）时会被裁切、落地时跳变，就只淡入 */
const sameShape = (a: DOMRect, b: DOMRect) => Math.abs((a.width / a.height) / (b.width / b.height) - 1) < 0.03

interface Shot { src: string; rect: DOMRect; radius: number; shadow: string }

/**
 * 量一端的位置、圆角和投影。起点还要带上已解码的图（克隆用它）；
 * 终点只量位置——详情页大封面刚挂载时图片可能还在载入，克隆用的是起点那张。
 */
function shoot(cover: HTMLElement | null | undefined, withImage = true): Shot | undefined {
  const img = cover?.querySelector('img')
  if (!cover || guarded(cover, img ?? null)) return
  if (withImage && (!img?.complete || !img.currentSrc)) return
  const rect = cover.getBoundingClientRect()
  if (!onScreen(rect)) return
  const style = getComputedStyle(cover)
  return { src: img?.currentSrc ?? '', rect, radius: parseFloat(style.borderTopLeftRadius) || 0, shadow: style.boxShadow }
}

interface Flight { el: HTMLDivElement; img: HTMLImageElement; shadow: HTMLDivElement }

const place = (el: HTMLElement, r: DOMRect) =>
  Object.assign(el.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` })

/**
 * 起飞：点下去的同一帧就把克隆图原样摆在起点、盖在底色上面，
 * 换页期间（返回时底色渐入、新页面挂载）封面一直留在原处，不会跟着页面一起消失再冒出来。
 */
function launch(from: Shot): Flight {
  const el = document.createElement('div')
  el.className = 'cover-flight'
  place(el, from.rect)
  const shadow = document.createElement('div')
  shadow.style.boxShadow = from.shadow
  const img = new Image()
  img.alt = ''
  img.decoding = 'sync'
  img.src = from.src
  img.style.borderRadius = shadow.style.borderRadius = `${from.radius}px`
  el.append(shadow, img)
  layer().append(el)
  return { el, img, shadow }
}

/**
 * 落地：一张固定定位的克隆图从起点移到终点，期间藏起终点的真封面。
 * 克隆改按两端里较大的尺寸绘制、只往小缩放，任何一端都不会被放大发虚（和动画同一帧换，看不出跳动）；
 * 位移和缩放单独一段动画，交给合成器，新页面挂载占住主线程时也不卡；
 * 圆角和投影透明度另起动画，两端不同时才有。
 */
function land({ el, img, shadow }: Flight, from: Shot, to: Shot, target: HTMLElement): Animation[] {
  const base = from.rect.width >= to.rect.width ? from.rect : to.rect
  const at = (r: DOMRect) => `translate(${r.left - base.left}px, ${r.top - base.top}px) scale(${r.width / base.width})`
  const radius = (s: Shot) => `${s.radius * (base.width / s.rect.width)}px`
  place(el, base)
  target.style.visibility = 'hidden'

  const timing = { duration: FLIGHT_MS, easing: EASE, fill: 'both' } as const
  const anims = [el.animate([{ transform: at(from.rect) }, { transform: at(to.rect) }], timing)]
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
    el.remove()
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

const SCROLL_KEYS = new Set([' ', 'PageUp', 'PageDown', 'Home', 'End', 'ArrowUp', 'ArrowDown'])

/**
 * 动画期间不让用户滚动：终点在动画开始时量好，中途滚动会让封面落到错位的格子上。
 * 原来的浏览器转场有一层覆盖全屏的转场层，顺带挡住了滚动；自绘动画要自己拦。
 * 只拦用户输入，程序里的滚动恢复照常（ScrollManager 会忽略这里拦下的滚轮和触摸滑动）；按钮、输入框上的按键不拦。
 */
function holdScroll() {
  const block = (e: Event) => e.preventDefault()
  const key = (e: KeyboardEvent) => {
    if (SCROLL_KEYS.has(e.key) && !(e.target as Element | null)?.closest?.('input, textarea, select, button, a, [contenteditable], [role="slider"]')) e.preventDefault()
  }
  const opts = { capture: true, passive: false }
  addEventListener('wheel', block, opts)
  addEventListener('touchmove', block, opts)
  addEventListener('keydown', key, true)
  return () => {
    removeEventListener('wheel', block, opts)
    removeEventListener('touchmove', block, opts)
    removeEventListener('keydown', key, true)
  }
}

/** 后台标签页里 rAF 和动画会降速甚至暂停，换页不能只等它们 */
const within = (p: Promise<unknown>, ms: number) =>
  Promise.race([p.then(() => {}, () => {}), new Promise<void>((resolve) => setTimeout(resolve, ms))])
const nextFrame = () => within(new Promise<void>((resolve) => requestAnimationFrame(() => resolve())), 100)

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
  active?.skip()
  const cover = motion ? veil() : undefined
  const flight = source ? launch(source) : undefined
  // 只有封面在飞时才拦：没有克隆（大封面已滚出屏、从导航去别的页）只是底色淡出，不必吞掉输入
  const release = flight ? holdScroll() : undefined
  // 返回时详情页带着取色背景，书库是纯底色：先让底色渐入盖住详情页再换页，不然背景是硬切的
  const lead = cover && back
    ? cover.animate([{ opacity: 0 }, { opacity: 1 }], { duration: LEAD_MS, easing: EASE, fill: 'both' })
    : undefined

  let anims: Animation[] = []
  let skipped = false
  let updating: Promise<void> | undefined
  // 被打断时也要换页，且只换一次
  const runUpdate = () => (updating ??= Promise.resolve().then(() => update?.()).then(() => undefined))
  const handle = {
    skip: () => {
      skipped = true
      lead?.finish()
      void runUpdate().catch(() => {})
      anims.forEach((a) => a.finish())
      cover?.remove()
      flight?.el.remove()
      release?.()
    },
  }
  active = handle

  const updateCallbackDone = (lead ? within(lead.finished, LEAD_MS + 50) : Promise.resolve()).then(runUpdate)
  const ready = updateCallbackDone.then(async () => {
    if (!cover) return
    // 等一帧：滚动恢复与虚拟列表首帧都已落定，量到的终点才准；这一帧还被底色盖着
    await nextFrame()
    if (skipped) return
    const target = back
      ? (() => { const covers = coversOf(`${basePath}${from}`); return covers[origin!.index] ?? covers[0] })()
      : DETAIL_PATH.test(to) ? document.querySelector<HTMLElement>(HERO_COVER) : null
    const dest = source && target ? shoot(target, false) : undefined
    const fadeOut = { duration: FADE_MS, easing: EASE, fill: 'both' } as const
    anims = [cover.animate([{ opacity: 1 }, { opacity: 0 }], fadeOut)]
    if (!flight || !source) return
    if (dest && target && sameShape(source.rect, dest.rect)) anims.push(...land(flight, source, dest, target))
    // 没有落点（格子不在屏内、打码或比例不同）：已经摆出来的克隆跟着底色一起淡掉
    else anims.push(flight.el.animate([{ opacity: 1 }, { opacity: 0 }], fadeOut))
  })
  const finished = ready
    .then(() => Promise.allSettled(anims.map((a) => a.finished)))
    .then(() => undefined)
    .finally(() => {
      cover?.remove()
      flight?.el.remove()
      release?.()
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
