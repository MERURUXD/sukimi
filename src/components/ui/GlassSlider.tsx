import { motion, useReducedMotion, type Transition } from 'motion/react'
import { useEffect, useState } from 'react'
import { PRISM_CONSTANTS } from '@/components/glass/morph/contracts'
import { still } from '@/design/motion'
import { cn } from '@/lib/cn'

const THUMB_W = 20

const DROPLET_SPRING: Transition = {
  type: 'spring',
  mass: PRISM_CONSTANTS.SPRINGS.elasticPress.mass,
  stiffness: PRISM_CONSTANTS.SPRINGS.elasticPress.stiffness,
  damping:
    2 *
    PRISM_CONSTANTS.SPRINGS.elasticPress.dampingRatio *
    Math.sqrt(PRISM_CONSTANTS.SPRINGS.elasticPress.stiffness * PRISM_CONSTANTS.SPRINGS.elasticPress.mass),
}

export interface GlassSliderProps {
  value: number
  min: number
  max: number
  step?: number
  onChange: (value: number) => void
  'aria-label'?: string
  rtl?: boolean
  disabled?: boolean
  className?: string
}

/**
 * 液滴抬起滑块：保留原生 `<input type="range">` 的键盘、RTL 与无障碍语义，
 * 按住或拖动时拇指按 `SPRINGS.elasticPress` 弹性抬起并变为透出底轨的半透明玻璃胶囊。
 */
export function GlassSlider({
  value,
  min,
  max,
  step = 1,
  onChange,
  'aria-label': ariaLabel,
  rtl = false,
  disabled = false,
  className,
}: GlassSliderProps) {
  const reduced = Boolean(useReducedMotion())
  const [active, setActive] = useState(false)

  useEffect(() => {
    if (!active) return
    const end = () => setActive(false)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
    window.addEventListener('blur', end)
    return () => {
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
      window.removeEventListener('blur', end)
    }
  }, [active])

  const span = max - min
  const ratio = span > 0 ? Math.min(1, Math.max(0, (value - min) / span)) : 0
  const pct = ratio * 100
  const lifted = active && !disabled && !reduced

  const thumbOffset = `calc(${pct.toFixed(4)}% - ${(ratio * THUMB_W).toFixed(4)}px)`

  return (
    <div
      className={cn(
        'relative flex h-7 min-w-0 items-center select-none',
        disabled && 'opacity-50',
        className,
      )}
    >
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-label={ariaLabel}
        onPointerDown={(e) => {
          if (disabled || reduced) return
          if (e.pointerType === 'mouse' && e.button !== 0) return
          setActive(true)
        }}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ direction: rtl ? 'rtl' : 'ltr' }}
        className="peer absolute inset-0 z-10 m-0 h-full w-full cursor-pointer touch-pan-y opacity-0 disabled:cursor-not-allowed"
      />
      <div className="pointer-events-none relative h-1.5 w-full overflow-hidden rounded-full bg-track">
        <div
          className="absolute inset-y-0 rounded-full bg-accent"
          style={{
            left: rtl ? undefined : 0,
            right: rtl ? 0 : undefined,
            width: `${pct.toFixed(4)}%`,
          }}
        />
      </div>
      <motion.span
        aria-hidden
        initial={false}
        animate={lifted ? { scaleX: 1.38, scaleY: 1.32 } : { scaleX: 1, scaleY: 1 }}
        transition={reduced ? still : DROPLET_SPRING}
        style={{
          left: rtl ? undefined : thumbOffset,
          right: rtl ? thumbOffset : undefined,
          backdropFilter: lifted ? 'blur(8px) saturate(1.7)' : undefined,
          WebkitBackdropFilter: lifted ? 'blur(8px) saturate(1.7)' : undefined,
        }}
        className={cn(
          'pointer-events-none absolute top-1/2 h-3.5 w-5 -translate-y-1/2 rounded-full transition-[background-color,border-color,box-shadow] duration-150',
          'peer-focus-visible:ring-2 peer-focus-visible:ring-accent peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-bg',
          lifted
            ? 'border border-white/55 bg-white/32 shadow-[inset_0_1px_1.5px_rgba(255,255,255,0.65),0_4px_14px_rgba(0,0,0,0.24)] dark:border-white/40 dark:bg-white/20'
            : 'border border-black/12 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.22),0_2px_6px_rgba(0,0,0,0.12)] dark:border-white/20',
        )}
      />
    </div>
  )
}
