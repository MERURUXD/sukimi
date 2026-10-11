let observer: IntersectionObserver | undefined
const callbacks = new WeakMap<Element, (visible: boolean) => void>()

/** 只取载入后的首次可见性，避免逐张同步测量布局；屏外封面不需要渐显。 */
export function onCoverVisibility(image: HTMLImageElement, callback: (visible: boolean) => void) {
  if (typeof IntersectionObserver === 'undefined') {
    callback(true)
    return () => {}
  }
  observer ??= new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const callback = callbacks.get(entry.target)
      callbacks.delete(entry.target)
      observer!.unobserve(entry.target)
      callback?.(entry.isIntersecting)
    }
  })
  callbacks.set(image, callback)
  observer.observe(image)
  return () => {
    // 旧请求的清理不能取消同一元素后来注册的请求。
    if (callbacks.get(image) !== callback) return
    callbacks.delete(image)
    observer!.unobserve(image)
  }
}
