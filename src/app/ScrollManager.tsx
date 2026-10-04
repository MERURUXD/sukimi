import { useEffect, useLayoutEffect } from 'react'
import { useLocation, useNavigationType } from 'react-router'

const positions = new Map<string, number>()

/**
 * 虚拟列表的 initialOffset：后退回来时直接按离开时的位置渲染第一帧。
 * 否则第一帧只渲染顶部几行，封面飞回动画在截图时找不到原来那个格子。
 */
export function useRestoredOffset() {
  const { key } = useLocation()
  const nav = useNavigationType()
  return nav === 'POP' ? (positions.get(key) ?? 0) : 0
}

/**
 * 滚动位置管理：前进到新页面回到顶部，后退时恢复离开时的位置。
 * 虚拟列表首帧的高度还是估算值，所以恢复后再在下一帧校正一次。
 */
export function ScrollManager() {
  const { key } = useLocation()
  const nav = useNavigationType()

  useEffect(() => {
    history.scrollRestoration = 'manual'
  }, [])

  // 滚动时持续记录当前页面的位置（离开时再记录会被新页面的高度截断）
  useEffect(() => {
    const save = () => positions.set(key, window.scrollY)
    window.addEventListener('scroll', save, { passive: true })
    return () => window.removeEventListener('scroll', save)
  }, [key])

  useLayoutEffect(() => {
    const target = nav === 'POP' ? (positions.get(key) ?? 0) : 0
    window.scrollTo(0, target)
    if (!target) return
    let frames = 0
    let raf = requestAnimationFrame(function fix() {
      if (Math.abs(window.scrollY - target) > 1) window.scrollTo(0, target)
      if (++frames < 10) raf = requestAnimationFrame(fix)
    })
    // 用户自己开始滚动就不再校正
    const stop = () => cancelAnimationFrame(raf)
    window.addEventListener('wheel', stop, { once: true, passive: true })
    window.addEventListener('touchstart', stop, { once: true, passive: true })
    return () => {
      stop()
      window.removeEventListener('wheel', stop)
      window.removeEventListener('touchstart', stop)
    }
  }, [key, nav])

  return null
}
