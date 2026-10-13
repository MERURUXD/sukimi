import { WINDOW_DUR, WINDOW_EASE, type WindowBox } from './windowMotion'

/** 桌面橱窗沿用实际封面层，文字与首页背景只在交接期间保留，避免等待整页快照。 */
export function createWindowCopy(kind: 'open' | 'back') {
  const shell = document.querySelector<HTMLElement>('.app-shell')
  const source = document.querySelector<HTMLElement>(kind === 'open' ? '.gwin-copy' : '[data-hero-ui]')
  const title = source?.querySelector<HTMLElement>(kind === 'open' ? '.gwin-title' : '.gallery-title')
  if (!shell || !source || !title) return null
  const from = title.getBoundingClientRect()
  const fontSize = parseFloat(getComputedStyle(title).fontSize)
  const layers: HTMLElement[] = []
  const animations: Animation[] = []
  const freeze = (el: HTMLElement, reference: HTMLElement) => {
    const style = getComputedStyle(reference)
    for (const key of style) if (key.startsWith('--')) el.style.setProperty(key, style.getPropertyValue(key))
    el.style.color = style.color
    el.setAttribute('aria-hidden', 'true')
    el.inert = true
    el.removeAttribute('id')
    el.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'))
    layers.push(el)
    shell.append(el)
    return el
  }
  const position = (el: HTMLElement, rect: WindowBox) => {
    Object.assign(el.style, { position: 'fixed', left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px`, margin: '0', pointerEvents: 'none' })
  }
  const copy = (el: HTMLElement) => {
    const clone = el.cloneNode(true) as HTMLElement
    position(clone, el.getBoundingClientRect())
    clone.classList.add('gw-copy-flight')
    return freeze(clone, el)
  }
  if (kind === 'open') {
    const main = source.closest('main')
    if (!main) return null
    const backdrop = document.createElement('div')
    backdrop.className = 'gw-page-flight'
    position(backdrop, { left: 0, top: 0, width: innerWidth, height: innerHeight })
    const page = document.createElement('div')
    page.className = main.className
    main.childNodes.forEach(node => page.append(node.cloneNode(true)))
    position(page, main.getBoundingClientRect())
    backdrop.append(page)
    backdrop.querySelectorAll('.gw-scene').forEach(node => node.remove())
    // 导航继续使用页面上的真实玻璃，背景固定在点击时的主题和滚动位置。
    const background = getComputedStyle(document.documentElement).getPropertyValue('--bg')
    backdrop.style.background = background
    freeze(backdrop, main)
  }
  const oldCopy = copy(source)
  return {
    play() {
      const target = document.querySelector<HTMLElement>(kind === 'open' ? 'main [data-hero-ui]' : 'main .gwin-copy')
      if (!target) return
      const next = copy(target)
      const nextTitle = next.querySelector<HTMLElement>(kind === 'open' ? '.gallery-title' : '.gwin-title')!
      oldCopy.querySelector<HTMLElement>(kind === 'open' ? '.gwin-title' : '.gallery-title')!.style.visibility = 'hidden'
      // 固定文字布局，只缩放字号对应的比例，双行标题不会因容器宽度变化重新折行。
      const to = target.querySelector<HTMLElement>(kind === 'open' ? '.gallery-title' : '.gwin-title')!.getBoundingClientRect()
      const scale = fontSize / parseFloat(getComputedStyle(nextTitle).fontSize)
      nextTitle.style.transformOrigin = 'top left'
      animations.push(nextTitle.animate({ transform: [`translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${scale})`, 'none'] }, { duration: WINDOW_DUR, easing: WINDOW_EASE, fill: 'both' }))
      animations.push(oldCopy.animate({ opacity: [1, 0] }, { duration: 120, easing: 'ease-out', fill: 'both' }))
      next.querySelectorAll<HTMLElement>(kind === 'open' ? '[data-gallery-copy]' : '.gwin-kicker, .gwin-stats, .gwin-cta').forEach(el => {
        animations.push(el.animate({ opacity: [0, 1] }, { duration: 450, delay: 200, easing: 'ease-out', fill: 'both' }))
      })
    },
    dispose() {
      animations.forEach(animation => animation.cancel())
      layers.forEach(layer => layer.remove())
    },
  }
}
