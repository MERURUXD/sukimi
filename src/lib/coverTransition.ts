import { useAppearance } from '@/design/settings'

/** 封面「飞入 / 飞回」用的 view-transition-name；同一时刻页面上只能有一个 */
export const COVER_VT = 'manga-cover'

/** 页面根元素上标记当前路径（AppShell 的 main），过渡前后各读一次就知道是从哪页回到哪页 */
export const PAGE_PATH_ATTR = 'data-page-path'

/** 详情页路径 → 从哪个页面、第几个同名封面点进来的 */
const origins = new Map<string, { path: string; index: number }>()

let installed = false

const coversOf = (href: string) =>
  [...document.querySelectorAll<HTMLElement>(`a[href="${CSS.escape(href)}"]`)]
    .map((a) => (a.matches('.cv') ? a : a.querySelector<HTMLElement>('.cv')))
    .filter((el): el is HTMLElement => !!el)

function mark(cover: HTMLElement) {
  document.querySelectorAll<HTMLElement>('[data-cover-vt]').forEach(unmark)
  cover.style.viewTransitionName = COVER_VT
  cover.dataset.coverVt = ''
}

function unmark(el: HTMLElement) {
  el.style.viewTransitionName = ''
  delete el.dataset.coverVt
}

/**
 * 固定在屏幕边缘的玻璃栏（顶栏、底部标签栏）加上 data-vt-bar="名字"。
 * 过渡动画的伪元素都画在页面最上层，封面从栏下面的格子里飞出或飞回时会盖在栏上。
 * 给与封面重叠的栏临时挂上过渡名，它就成了独立图层，按绘制顺序排在封面之上。
 * 不能常驻：带过渡名的元素会成为 backdrop root，玻璃的模糊和折射失效（见 index.css），
 * 所以只在这一次过渡期间、且确实重叠时才挂，动画结束就摘掉。
 * 已知代价：挂名期间栏内玻璃的模糊 / 折射会暂时消失。
 */
const BAR_ATTR = 'data-vt-bar'
const liftedBars = new Set<HTMLElement>()

function liftBars(cover: HTMLElement | null | undefined) {
  if (!cover?.isConnected) return
  const c = cover.getBoundingClientRect()
  document.querySelectorAll<HTMLElement>(`[${BAR_ATTR}]`).forEach((bar) => {
    const b = bar.getBoundingClientRect()
    const overlap = c.left < b.right && c.right > b.left && c.top < b.bottom && c.bottom > b.top
    if (!overlap) return
    bar.style.viewTransitionName = `bar-${bar.getAttribute(BAR_ATTR)}`
    liftedBars.add(bar)
  })
}

function dropBars() {
  liftedBars.forEach((bar) => { bar.style.viewTransitionName = '' })
  liftedBars.clear()
}

const pagePath = () => document.querySelector(`[${PAGE_PATH_ATTR}]`)?.getAttribute(PAGE_PATH_ATTR) ?? null

/**
 * 封面过渡：
 *
 * - 进入：全局点击监听，点了指向详情页的链接时，只给「被点的那个」封面挂上过渡名。
 *   不能按漫画 id 判断——同一部漫画可能在页面上出现多次（首页大图区和书架），
 *   两个元素同名会让浏览器直接放弃整个过渡。链接本身是 .cv，或者里面有 .cv，都算封面。
 * - 返回：React Router 对用 viewTransition 进入的页面，后退时也会走过渡。
 *   包一层 document.startViewTransition，在新页面渲染完、浏览器截图之前，
 *   找到当初点的那个封面挂上过渡名，详情页的大封面就会飞回原来的格子。
 *   虚拟列表要在第一次渲染时就用恢复后的滚动位置，那个格子才会在 DOM 里（见 useRestoredOffset）。
 */
export function installCoverTransition(basePath = '') {
  if (installed) return
  installed = true

  document.addEventListener(
    'click',
    (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const link = (e.target as Element | null)?.closest?.(`a[href^="${basePath}/manga/"]`)
      const href = link?.getAttribute('href')
      if (!link || !href || /\/chapter\//.test(href)) return
      const cover = (link.matches('.cv') ? link : link.querySelector('.cv')) as HTMLElement | null
      if (!cover) return
      mark(cover)
      const from = pagePath()
      if (from) origins.set(href.slice(basePath.length), { path: from, index: Math.max(0, coversOf(href).indexOf(cover)) })
      // 过渡结束后旧页面通常已卸载；万一还在（导航被取消），清掉名字
      setTimeout(() => cover.isConnected && unmark(cover), 1200)
    },
    true,
  )

  const start = document.startViewTransition?.bind(document)
  if (!start) return
  document.startViewTransition = ((arg?: ViewTransitionUpdateCallback | StartViewTransitionOptions) => {
    const update = typeof arg === 'function' ? arg : arg?.update
    const from = pagePath()
    let marked: HTMLElement | undefined
    // 旧页面的快照在 start 调用时就拍了：点进详情时，被点的封面可能正压在栏下面
    liftBars(document.querySelector<HTMLElement>('[data-cover-vt]'))
    const t = start({
      ...(typeof arg === 'object' ? arg : {}),
      update: async () => {
        await update?.()
        const to = pagePath()
        // 仅跳过涉及详情页的转场，不影响其他页面及菜单动画。
        if (!useAppearance.getState().mangaDetailMotion && [from, to].some((path) => path && /^\/manga\/\d+$/.test(path))) {
          t.skipTransition()
          return
        }
        const origin = from ? origins.get(from) : undefined
        if (!from || !origin || origin.path !== to) return
        const covers = coversOf(`${basePath}${from}`)
        marked = covers[origin.index] ?? covers[0]
        if (marked) {
          mark(marked)
          liftBars(marked)
        }
      },
    })
    // 快速返回或打开面板可能取消封面过渡；仍清理标记，不产生未处理拒绝。
    void t.ready.catch(() => {})
    void t.finished.finally(() => {
      if (marked) unmark(marked)
      dropBars()
    }).catch(() => {})
    return t
  }) as typeof document.startViewTransition
}
