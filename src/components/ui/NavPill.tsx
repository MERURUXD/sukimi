import { useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { useOpticalSlider, type SliderOrientation } from './opticalSlider'

export interface NavLensTrackProps {
  orientation?: SliderOrientation
  activeIndex: number
  pillClassName?: string
  pillRadius?: number
  magnification?: number
  dragMagBoost?: number
  trackClassName?: string
  listClassName?: string
  measureKey: string | number
  onCommit: (index: number) => void
  children: ReactNode
  clone: ReactNode
}

/**
 * 导航栏光学放大镜滑块轨道：
 * 外层玻璃留在调用方（<Glass>），内部拆为「速度拉伸高光滑块」与「不拉伸光学放大镜克隆层」，
 * 仅对包裹真实 <NavLink> 的内层 wrapper 施加 SVG 挖洞遮罩去除重影，同时支持按住拖拽滑动。
 */
export function NavLensTrack({
  orientation = 'horizontal',
  activeIndex,
  pillClassName,
  pillRadius = 999,
  magnification = 1.08,
  dragMagBoost = 0.04,
  trackClassName,
  listClassName,
  measureKey,
  onCommit,
  children,
  clone,
}: NavLensTrackProps) {
  const reduced = Boolean(useReducedMotion())
  const {
    maskId,
    setTrackRef,
    baseRef,
    pillBgRef,
    lensWinRef,
    lensCloneRef,
    maskRef,
    maskBgRef,
    maskHoleRef,
    pointerProps,
  } = useOpticalSlider({
    orientation,
    activeIndex,
    itemSelector: 'a',
    magnification,
    dragMagBoost,
    pillRadius,
    reduced,
    maskMode: 'wrapper',
    maskIdPrefix: 'nav-cutout',
    measureKey,
    onCommit,
  })

  return (
    <div
      ref={setTrackRef}
      className={cn('relative z-0 isolate', trackClassName)}
      {...pointerProps}
    >
      {!reduced && (
        <svg width="0" height="0" className="pointer-events-none absolute" aria-hidden>
          <defs>
            <mask ref={maskRef} id={maskId} maskUnits="userSpaceOnUse" x="-16" y="-16" width="800" height="200">
              <rect ref={maskBgRef} x="-16" y="-16" width="800" height="200" fill="white" />
              <rect ref={maskHoleRef} x="0" y="0" width="0" height="0" rx={pillRadius} ry={pillRadius} fill="black" />
            </mask>
          </defs>
        </svg>
      )}

      <span
        ref={pillBgRef}
        aria-hidden
        className={cn('nav-pill pointer-events-none absolute top-0 left-0 -z-10', pillClassName)}
      />

      <div ref={baseRef} className={cn('relative z-10', listClassName)}>
        {children}
      </div>

      {!reduced && (
        <div
          ref={lensWinRef}
          aria-hidden
          className={cn('nav-lens-window pointer-events-none absolute top-0 left-0 z-20 overflow-hidden', pillClassName)}
        >
          <div ref={lensCloneRef} className={cn('nav-lens-clone', listClassName)}>
            {clone}
          </div>
        </div>
      )}
    </div>
  )
}
