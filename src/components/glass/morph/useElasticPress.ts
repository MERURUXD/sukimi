import { useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState, type RefObject } from 'react'
import { createMotionController, type MotionController } from './motion'

export interface ElasticPressOptions {
  enabled?: boolean
  /** 缩放与拖拽位移的强度系数（默认 1；紧凑工具栏内可调低避免邻近按钮碰边） */
  intensity?: number
}

const TRANSFORM_EPS = 1e-4

function usePrefersReducedMotion(): boolean {
  const motionReduced = Boolean(useReducedMotion())
  const [mediaReduced, setMediaReduced] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false,
  )

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setMediaReduced(query.matches)
    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])

  return motionReduced || mediaReduced
}

/**
 * 为独立玻璃按钮或工具栏按钮接入 PrismUI `ElasticPress` 弹簧按压与拖拽跟随，
 * 仅驱动 CSS `transform`，不触发布局重排或 SVG 折射位移图重绘。
 */
export function useElasticPress(
  targetRef: RefObject<HTMLElement | null>,
  options: ElasticPressOptions = {},
): void {
  const { enabled = true, intensity = 1 } = options
  const reduced = usePrefersReducedMotion()
  const controllerRef = useRef<MotionController | null>(null)
  const intensityRef = useRef(intensity)

  useEffect(() => {
    intensityRef.current = intensity
  }, [intensity])

  useEffect(() => {
    controllerRef.current?.setReducedMotion(reduced)
  }, [reduced])

  useEffect(() => {
    const el = targetRef.current
    if (!el || !enabled || reduced) {
      if (el?.hasAttribute('data-elastic-press')) {
        el.style.transform = ''
        el.removeAttribute('data-elastic-press')
      }
      return
    }

    const scheduleFrame =
      typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function'
        ? window.requestAnimationFrame.bind(window)
        : typeof requestAnimationFrame === 'function'
          ? requestAnimationFrame
          : null
    const cancelFrame =
      typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function'
        ? window.cancelAnimationFrame.bind(window)
        : typeof cancelAnimationFrame === 'function'
          ? cancelAnimationFrame
          : null

    let rafId = 0
    let activePointerId: number | null = null
    let startX = 0
    let startY = 0
    let targetSize = { width: 44, height: 44 }
    let lastTs = 0
    let disposed = false

    const clearTransform = () => {
      if (el.hasAttribute('data-elastic-press')) {
        el.style.transform = ''
        el.removeAttribute('data-elastic-press')
      }
    }

    const applyFrame = () => {
      const ctrl = controllerRef.current
      if (!ctrl) return false
      if (el.hasAttribute('data-morphing')) {
        clearTransform()
        return false
      }
      const s = ctrl.getState()
      const scale = intensityRef.current
      const sx = 1 + (s.pressScaleX - 1) * scale
      const sy = 1 + (s.pressScaleY - 1) * scale
      const ox = s.pressOffsetX * scale
      const oy = s.pressOffsetY * scale
      const isIdentity =
        Math.abs(sx - 1) < TRANSFORM_EPS &&
        Math.abs(sy - 1) < TRANSFORM_EPS &&
        Math.abs(ox) < 0.05 &&
        Math.abs(oy) < 0.05

      if (isIdentity && !s.isAnimating && activePointerId === null) {
        clearTransform()
        return false
      }
      el.setAttribute('data-elastic-press', 'true')
      el.style.transform = `translate3d(${ox.toFixed(2)}px, ${oy.toFixed(2)}px, 0) scale(${sx.toFixed(4)}, ${sy.toFixed(4)})`
      return s.isAnimating || activePointerId !== null
    }

    const tick = () => {
      rafId = 0
      if (disposed) return
      const ctrl = controllerRef.current
      if (!ctrl) return
      const now = performance.now()
      const dt = Math.min(0.05, Math.max(0, (now - lastTs) / 1000))
      lastTs = now
      if (dt > 0) ctrl.step(dt)
      if (applyFrame() && scheduleFrame) {
        rafId = scheduleFrame(tick)
      }
    }

    const ensureLoop = () => {
      if (rafId || disposed || !scheduleFrame) return
      lastTs = performance.now()
      rafId = scheduleFrame(tick)
    }

    const releasePointer = () => {
      if (activePointerId === null) return
      activePointerId = null
      window.removeEventListener('pointermove', onWindowMove)
      window.removeEventListener('pointerup', onWindowEnd)
      window.removeEventListener('pointercancel', onWindowEnd)
      window.removeEventListener('blur', onWindowEnd)
      controllerRef.current?.pressRelease()
      if (scheduleFrame) ensureLoop()
      else clearTransform()
    }

    const onWindowMove = (e: PointerEvent) => {
      if (e.pointerId !== activePointerId) return
      controllerRef.current?.pressMove({ x: e.clientX - startX, y: e.clientY - startY }, targetSize)
      ensureLoop()
    }

    const onWindowEnd = (e: Event) => {
      if ('pointerId' in e && (e as PointerEvent).pointerId !== activePointerId) return
      releasePointer()
    }

    const onPointerDown = (e: PointerEvent) => {
      if (!enabled || reduced) return
      if (e.pointerType === 'mouse' && e.button !== 0) return
      if (el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true') return
      if (el.hasAttribute('data-morphing')) return

      const ctrl = (controllerRef.current ??= createMotionController({ reducedMotion: reduced }))
      const box = el.getBoundingClientRect()
      // 用未缩放的布局宽高作为按压基准，避免连续点击时倍率叠加
      targetSize = {
        width: Math.max(1, el.offsetWidth || box.width),
        height: Math.max(1, el.offsetHeight || box.height),
      }
      startX = e.clientX
      startY = e.clientY
      activePointerId = e.pointerId

      window.addEventListener('pointermove', onWindowMove, { passive: true })
      window.addEventListener('pointerup', onWindowEnd)
      window.addEventListener('pointercancel', onWindowEnd)
      window.addEventListener('blur', onWindowEnd)

      ctrl.pressStart(targetSize)
      applyFrame()
      ensureLoop()
    }

    el.addEventListener('pointerdown', onPointerDown)
    return () => {
      disposed = true
      el.removeEventListener('pointerdown', onPointerDown)
      releasePointer()
      if (rafId && cancelFrame) cancelFrame(rafId)
      clearTransform()
      controllerRef.current?.dispose()
      controllerRef.current = null
    }
  }, [targetRef, enabled, reduced])
}
