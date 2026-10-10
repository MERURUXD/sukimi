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
 * 导航的实际玻璃表面用 data-vt-glass 标记，过渡名不加在透明外壳上。
 * 过渡动画的伪元素都画在页面最上层，封面从栏下面的格子里飞出或飞回时会盖在栏上。
 * 封面转场前后都单独捕获玻璃，滤镜由浏览器带到它自己的过渡分组，保持背景采样。
 * 不按起点相交决定：飞行中途也可能经过导航，且前后快照需要配对同一批表面。
 */
let liftedSurfaces: Map<HTMLElement, string> | undefined

function liftSurfaces(surfaces: Map<HTMLElement, string>) {
  document.querySelectorAll<HTMLElement>('.glass[data-vt-glass]').forEach((surface) => {
    const r = surface.getBoundingClientRect()
    if (!r.width || !r.height || r.right <= 0 || r.bottom <= 0 || r.left >= innerWidth || r.top >= innerHeight) return
    if (!surfaces.has(surface)) surfaces.set(surface, surface.style.viewTransitionName)
    surface.style.viewTransitionName = `nav-${surface.dataset.vtGlass}`
  })
}

function dropSurfaces() {
  liftedSurfaces?.forEach((name, surface) => { surface.style.viewTransitionName = name })
  liftedSurfaces = undefined
}

const pagePath = () => document.querySelector(`[${PAGE_PATH_ATTR}]`)?.getAttribute(PAGE_PATH_ATTR) ?? null

/**
 * 封面过渡：
 *
 * - 进入：全局点击监听，点了指向详情页的链接时，只给「被点的那个」封面挂上过渡名。
 *   不能按漫画 id 判断——同一部漫画可能在页面上出现多次（首页大图区和书架），
 *   两个元素同名会让浏览器直接放弃整个过渡。链接本身是 .cv，或者里面有 .cv，都算封面；
 *   都不是时借用同一区块里同一详情的封面。
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
      // 本身不带封面的链接（如首页「漫画详情」按钮）借用同一区块里指向同一详情、正显示着的封面
      const cover = ((link.matches('.cv') ? link : link.querySelector('.cv')) as HTMLElement | null)
        ?? coversOf(href).find((el) => link.closest('section')?.contains(el) && el.getClientRects().length > 0)
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
    // 新转场先接管标记；旧转场迟到的收尾不能清掉正在使用的名字。
    dropSurfaces()
    const surfaces = new Map<HTMLElement, string>()
    liftedSurfaces = surfaces
    const coverTransition = !document.documentElement.hasAttribute('data-theme-vt')
      && (!!document.querySelector('[data-cover-vt]') || !!(from && origins.has(from)))
    if (coverTransition) liftSurfaces(surfaces)
    const t = start({
      ...(typeof arg === 'object' ? arg : {}),
      update: async () => {
        await update?.()
        const to = pagePath()
        // 仅跳过涉及详情页的换页转场，不影响其他页面、菜单动画，以及停在同一页的转场（如切换主题）。
        if (!useAppearance.getState().mangaDetailMotion && from !== to && [from, to].some((path) => path && /^\/manga\/\d+$/.test(path))) {
          t.skipTransition()
          return
        }
        const origin = from ? origins.get(from) : undefined
        if (from && origin?.path === to) {
          const covers = coversOf(`${basePath}${from}`)
          marked = covers[origin.index] ?? covers[0]
          if (marked) mark(marked)
        }
        if (coverTransition) liftSurfaces(surfaces)
      },
    })
    // 快速返回或打开面板可能取消封面过渡；仍清理标记，不产生未处理拒绝。
    void t.ready.catch(() => {})
    void t.finished.finally(() => {
      if (marked) unmark(marked)
      if (liftedSurfaces === surfaces) dropSurfaces()
    }).catch(() => {})
    return t
  }) as typeof document.startViewTransition
}
