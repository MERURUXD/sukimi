import { readerVt } from '@/design/motion'
import { useAppearance } from '@/design/settings'

/** 进出阅读器的转场期间挂在 html 上（'in' / 'out'）：CSS 据此关掉默认淡化，并压掉页面上其他过渡名 */
export const READER_VT_ATTR = 'data-reader-vt'
/** 阅读器根元素，值为「漫画 id:章节 id」；转场开始时据此判断是进还是出、退出时落回哪一话 */
export const READER_ROOT_ATTR = 'data-reader-root'
/** 整行可点的入口（链接只包着标题、靠伪元素铺满整行）挂在行上：展开起点和落点取这一行的位置与圆角 */
export const READER_ORIGIN_ATTR = 'data-reader-origin'
/** 转场期间挂在入口（进入时点的、退出时落回的）元素上，CSS 给它单独的过渡名 reader-src */
const SRC_ATTR = 'data-reader-src'

const READER_PATH = /\/manga\/\d+\/chapter\/\d+$/

/** 视口里的矩形和圆角（px） */
interface Rect { x: number; y: number; w: number; h: number; r: number }
const full = (): Rect => ({ x: 0, y: 0, w: innerWidth, h: innerHeight, r: 0 })
/** 找不到入口时从屏幕中间展开 / 缩回 */
const center = (): Rect => ({ x: innerWidth * 0.3, y: innerHeight * 0.3, w: innerWidth * 0.4, h: innerHeight * 0.4, r: 24 })

let clicked: { el: HTMLElement; at: number } | undefined
/** 进入时点的是整行（章节行）还是按钮：退出时同一话两种入口都在，落回同类的那个 */
let enteredRow = false
/** 浏览器自己播了后退动画（手机侧滑返回），不再叠一层 */
let uaPop = 0
let token = 0
let installed = false

const originOf = (el: Element) => (el.closest(`[${READER_ORIGIN_ATTR}]`) ?? el) as HTMLElement

/** 元素在视口里的矩形；圆角跟元素自己一致，胶囊按钮取半高。不在视口里或看不见时不能当起点 / 落点 */
function rectOf(el: HTMLElement): Rect | undefined {
  // 详情页占位时操作区是 invisible，按钮在但看不见
  if (el.checkVisibility?.({ visibilityProperty: true, opacityProperty: true }) === false) return undefined
  const b = el.getBoundingClientRect()
  if (!b.width || !b.height || b.right <= 0 || b.bottom <= 0 || b.left >= innerWidth || b.top >= innerHeight) return undefined
  const r = Math.min(parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0, b.width / 2, b.height / 2)
  return { x: b.left, y: b.top, w: b.width, h: b.height, r }
}

/**
 * 回到的页面上找这部漫画的阅读入口：先找刚读的这一话，再找其他话（如详情页的「继续阅读」）。
 * 历史页、首页最近阅读读完这一话后，行里不再有阅读链接，退到指向详情的那一行。
 */
function landing(basePath: string, root: string) {
  const [mangaId, chapterId] = root.split(':')
  const exact = `${basePath}/manga/${mangaId}/chapter/${chapterId}`
  const links = [...document.querySelectorAll<HTMLAnchorElement>(`a[href^="${CSS.escape(`${basePath}/manga/${mangaId}/chapter/`)}"]`)]
  const isRow = (a: Element) => a.closest(`[${READER_ORIGIN_ATTR}]`) !== null
  const same = links.filter((a) => a.getAttribute('href')?.split('?')[0] === exact)
  const detail = [...document.querySelectorAll<HTMLAnchorElement>(`a[href="${CSS.escape(`${basePath}/manga/${mangaId}`)}"]`)]
  for (const a of [...same.filter((a) => isRow(a) === enteredRow), ...same, ...links, ...detail]) {
    const el = originOf(a)
    const rect = rectOf(el)
    if (rect) return { el, rect }
  }
  return undefined
}

/**
 * 等阅读器首屏的图片加载、解码好：新快照是实时画面，拍的时候还在「正在加载」的话，
 * 展开途中会突然换成页面，看起来闪一下。等待期间画面停在旧页面上；最多等 max 毫秒。
 * 拍快照前浏览器暂停渲染，requestAnimationFrame 不会触发，只能用定时器轮询。
 */
async function firstScreen(max: number) {
  const until = performance.now() + max
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
  while (performance.now() < until) {
    const root = document.querySelector(`[${READER_ROOT_ATTR}]`)
    const imgs = [...(root?.querySelectorAll('img') ?? [])].filter((img) => {
      // 首屏仍在等拼版、裁边或解码时，隐藏的原图不能算准备好了。
      if (getComputedStyle(img).visibility === 'hidden') return false
      const b = img.getBoundingClientRect()
      return b.width > 0 && b.height > 0 && b.bottom > 0 && b.top < innerHeight && b.right > 0 && b.left < innerWidth
    })
    if (imgs.length && imgs.every((img) => img.complete)) {
      await Promise.race([Promise.all(imgs.map((img) => img.decode().catch(() => {}))), sleep(until - performance.now())])
      return
    }
    await sleep(16)
  }
}

/**
 * 弹簧曲线，同 SwiftUI .spring(response:dampingFraction:)：初速为 0，从 0 走到 1。
 * 包络衰减到 0.5% 算落定，时长再封顶，最后一帧直接落到 1。
 */
function spring({ response, damping, max }: { response: number; damping: number; max: number }) {
  const w0 = (2 * Math.PI) / response
  const decay = damping * w0
  const wd = w0 * Math.sqrt(Math.max(0, 1 - damping * damping))
  const at = (t: number) =>
    wd > 0 ? 1 - Math.exp(-decay * t) * (Math.cos(wd * t) + (decay / wd) * Math.sin(wd * t)) : 1 - Math.exp(-w0 * t) * (1 + w0 * t)
  return { at, duration: Math.min(max, Math.log(200) / decay) }
}

const lerp = (a: number, b: number, s: number) => a + (b - a) * s
const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const ramp = (v: number, from: number, to: number) => clamp01((v - from) / (to - from))

/**
 * 整页快照缩成矩形 b 的样子：等比缩放到刚好盖住 b、中心对齐，多出来的部分裁掉（坐标在缩放前的快照里）。
 * 快照的变换原点在 CSS 里设为左上角。b 为全屏时就是原样。
 */
function panel(b: Rect) {
  const W = innerWidth
  const H = innerHeight
  const k = Math.max(b.w / W, b.h / H)
  const tx = b.x + b.w / 2 - (W * k) / 2
  const ty = b.y + b.h / 2 - (H * k) / 2
  const left = (b.x - tx) / k
  const top = (b.y - ty) / k
  return {
    transform: `translate(${tx}px, ${ty}px) scale(${k})`,
    clipPath: `inset(${top}px ${W - left - b.w / k}px ${H - top - b.h / k}px ${left}px round ${b.r / k}px)`,
  }
}

/** 入口元素自己的快照跟着面板走：按宽度等比放大、中心对齐 */
function follow(src: Rect, b: Rect) {
  const q = b.w / src.w
  return `translate(${b.x + b.w / 2 - (src.w * q) / 2}px, ${b.y + b.h / 2 - (src.h * q) / 2}px) scale(${q})`
}

/** 背后的页面往入口方向微微推近 / 退回，有一点纵深 */
const zoom = (at: Rect, q: number) => {
  const ox = at.x + at.w / 2
  const oy = at.y + at.h / 2
  return `translate(${ox * (1 - q)}px, ${oy * (1 - q)}px) scale(${q})`
}

/**
 * 逐帧算好三层的关键帧（帧间线性）：
 * - 面板（阅读器整页快照）在入口矩形和全屏之间按弹簧变化，圆角先长到 readerVt.radius，落定前收成直角；
 * - 入口元素的快照叠在面板上，跟着放大并很快淡出（退出时反过来，最后淡入）；
 * - 背后的页面微微推近。
 */
function frames(dir: 'in' | 'out', src: Rect | undefined) {
  const { at, duration } = spring(dir === 'in' ? readerVt.enter : readerVt.exit)
  const a = src ?? center()
  const f = full()
  const n = Math.ceil(duration * 60)
  const page: Keyframe[] = []
  const back: Keyframe[] = []
  const el: Keyframe[] = []
  for (let i = 0; i <= n; i++) {
    const p = i / n
    const t = i === n ? 1 : at(p * duration)
    // 进入：入口 → 全屏；退出：全屏 → 入口。s 表示离入口多远（0 在入口，1 全屏）
    const s = dir === 'in' ? t : 1 - t
    const c = clamp01(s)
    const r = lerp(a.r, readerVt.radius, ramp(c, 0, 0.3)) * (1 - ramp(c, 0.8, 1))
    const b: Rect = { x: lerp(a.x, f.x, s), y: lerp(a.y, f.y, s), w: lerp(a.w, f.w, s), h: lerp(a.h, f.h, s), r: Math.min(r, lerp(a.w, f.w, s) / 2, lerp(a.h, f.h, s) / 2) }
    page.push({ ...panel(b), opacity: dir === 'in' ? ramp(p, 0, 0.2) : 1 - ramp(p, 0.55, 0.95) })
    back.push({ transform: zoom(a, 1 + readerVt.depth * c) })
    if (src) el.push({ transform: follow(src, b), opacity: dir === 'in' ? 1 - ramp(p, 0, 0.22) : ramp(p, 0.45, 0.9) })
  }
  return { page, back, el, duration: duration * 1000 }
}

/**
 * 进出阅读器的「同源展开」：阅读器像是从点的那个元素长出来的，展开完就是平常的阅读界面；返回时缩回入口。
 * 仿 iOS 打开应用：
 * - 进入：阅读器整页快照先等比缩成入口大小、裁成入口的形状，再按弹簧放大到全屏，圆角跟着过渡；
 *   入口元素自己的快照（过渡名 reader-src）叠在上面一起放大并淡出；背后的页面微微推近。
 * - 退出：反过来，阅读器缩回刚读那一话的入口，入口在最后淡入。
 * - 只动整页快照的变换、裁切和透明度，不给阅读器起同名过渡（那样会把按钮快照拉伸到全屏）。
 * - 入口 Link 带 viewTransition，React Router 才会走转场；后退时它按「转场离开过的路径」自动再走一次。
 *   阅读器里切话、去掉书签参数的 replace 不带，不会触发。
 * - 判断进出看阅读器根元素是否已挂载、地址是否是阅读器：startViewTransition 被调用时地址已经换好了。
 *
 * 必须在 installCoverTransition 之后安装，包在它外面：先挂上标记，封面转场据此让路。
 */
export function installReaderTransition(basePath = '') {
  if (installed) return
  installed = true

  // 只记元素：第一次打开要等阅读器的代码块加载，位置到转场开始时再量
  document.addEventListener(
    'click',
    (e) => {
      const link = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null
      if (link && READER_PATH.test(new URL(link.href).pathname)) clicked = { el: originOf(link), at: Date.now() }
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
    const root = document.querySelector(`[${READER_ROOT_ATTR}]`)?.getAttribute(READER_ROOT_ATTR)
    const toReader = READER_PATH.test(location.pathname)
    const dir = !root && toReader ? 'in' : root && !toReader ? 'out' : undefined
    if (!dir || html.hasAttribute('data-theme-vt')) return start(arg)

    const ua = Date.now() - uaPop < 1000
    uaPop = 0
    const source = clicked && Date.now() - clicked.at < 10_000 && clicked.el.isConnected ? clicked.el : undefined
    clicked = undefined
    if (ua || !useAppearance.getState().readerMotion || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const t = start(arg)
      t.skipTransition()
      return t
    }

    // 旧快照在调用后马上拍，标记、入口和起始状态要先同步挂上
    const id = ++token
    let src: { el: HTMLElement; rect: Rect } | undefined
    if (dir === 'in') {
      const rect = source && rectOf(source)
      if (source && rect) src = { el: source, rect }
      enteredRow = !!source?.hasAttribute(READER_ORIGIN_ATTR)
      src?.el.setAttribute(SRC_ATTR, '')
      const first = panel(src?.rect ?? center())
      html.style.setProperty('--reader-vt-transform', first.transform)
      html.style.setProperty('--reader-vt-clip', first.clipPath)
    }
    html.setAttribute(READER_VT_ATTR, dir)
    const update = typeof arg === 'function' ? arg : arg?.update
    const t = start({
      ...(typeof arg === 'object' ? arg : {}),
      update: async () => {
        await update?.()
        if (dir === 'in') await firstScreen(readerVt.ready * 1000)
        // 新页面渲染好、拍快照之前找落点，给它挂上过渡名
        if (dir === 'out' && root) {
          src = landing(basePath, root)
          src?.el.setAttribute(SRC_ATTR, '')
        }
      },
    })
    void t.ready
      .then(() => {
        const { page, back, el, duration } = frames(dir, src?.rect)
        const opts = { duration, fill: 'forwards' } as const
        html.animate(page, { ...opts, pseudoElement: dir === 'in' ? '::view-transition-new(root)' : '::view-transition-old(root)' })
        html.animate(back, { ...opts, pseudoElement: dir === 'in' ? '::view-transition-old(root)' : '::view-transition-new(root)' })
        if (src) html.animate(el, { ...opts, pseudoElement: '::view-transition-group(reader-src)' })
      })
      .catch(() => {})
    void t.finished
      .finally(() => {
        src?.el.removeAttribute(SRC_ATTR)
        if (id !== token) return
        html.removeAttribute(READER_VT_ATTR)
        html.style.removeProperty('--reader-vt-transform')
        html.style.removeProperty('--reader-vt-clip')
      })
      .catch(() => {})
    return t
  }) as typeof document.startViewTransition
}
