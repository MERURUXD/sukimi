let loading = 0
let scrolling = false
let idleTimer: number | undefined

function resume() {
  window.clearTimeout(idleTimer)
  idleTimer = undefined
  scrolling = false
  document.documentElement.removeAttribute('data-cover-scrolling')
}

function pause() {
  if (!scrolling) {
    scrolling = true
    document.documentElement.setAttribute('data-cover-scrolling', '')
  }
  window.clearTimeout(idleTimer)
  // 没有 scrollend 的浏览器也能恢复；惯性滚动期间继续等待。
  idleTimer = window.setTimeout(resume, 150)
}

/** 加载占位共用一个滚动监听，全部载入或卸载后停止监听。 */
export function trackCoverLoading(element: HTMLSpanElement | null) {
  if (!element) return
  if (loading++ === 0) {
    window.addEventListener('scroll', pause, { passive: true })
    window.addEventListener('scrollend', resume)
  }
  let active = true
  return () => {
    if (!active) return
    active = false
    if (--loading === 0) {
      window.removeEventListener('scroll', pause)
      window.removeEventListener('scrollend', resume)
      resume()
    }
  }
}
