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
export function installCoverTransition() {
  if (installed) return
  installed = true

  document.addEventListener(
    'click',
    (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const link = (e.target as Element | null)?.closest?.('a[href^="/manga/"]')
      const href = link?.getAttribute('href')
      if (!link || !href || /\/chapter\//.test(href)) return
      const cover = (link.matches('.cv') ? link : link.querySelector('.cv')) as HTMLElement | null
      if (!cover) return
      mark(cover)
      const from = pagePath()
      if (from) origins.set(href, { path: from, index: Math.max(0, coversOf(href).indexOf(cover)) })
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
    const t = start({
      ...(typeof arg === 'object' ? arg : {}),
      update: async () => {
        await update?.()
        const to = pagePath()
        const origin = from ? origins.get(from) : undefined
        if (!from || !origin || origin.path !== to) return
        const covers = coversOf(from)
        marked = covers[origin.index] ?? covers[0]
        if (marked) mark(marked)
      },
    })
    t.finished.finally(() => marked && unmark(marked))
    return t
  }) as typeof document.startViewTransition
}
