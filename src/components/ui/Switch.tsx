import { motion, useMotionValue, useReducedMotion, useTransform, useVelocity } from 'motion/react'
import { useEffect, useState } from 'react'
import { spring, still } from '@/design/motion'
import { cn } from '@/lib/cn'

const THUMB_SIZE = 20
const PRESSED_WIDTH = 24
const TRAVEL = 18

export function Switch({
  on,
  onChange,
  label,
  disabled,
}: {
  on: boolean
  onChange: (v: boolean) => void
  label: string
  disabled?: boolean
}) {
  const reduced = Boolean(useReducedMotion())
  const [pressing, setPressing] = useState(false)
  const x = useMotionValue(on ? TRAVEL : 0)
  const vx = useVelocity(x)
  const scaleX = useTransform(vx, (v) => 1 + Math.min(Math.abs(v) / 700, 0.22))
  const scaleY = useTransform(vx, (v) => 1 - Math.min(Math.abs(v) / 1400, 0.08))

  useEffect(() => {
    if (!pressing) return
    const release = () => setPressing(false)
    window.addEventListener('pointerup', release)
    window.addEventListener('pointercancel', release)
    window.addEventListener('blur', release)
    return () => {
      window.removeEventListener('pointerup', release)
      window.removeEventListener('pointercancel', release)
      window.removeEventListener('blur', release)
    }
  }, [pressing])

  const stretched = pressing && !disabled && !reduced
  const targetWidth = stretched ? PRESSED_WIDTH : THUMB_SIZE
  const targetX = on ? (stretched ? TRAVEL - (PRESSED_WIDTH - THUMB_SIZE) : TRAVEL) : 0

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onPointerDown={(e) => {
        if (disabled || reduced) return
        if (e.pointerType === 'mouse' && e.button !== 0) return
        setPressing(true)
      }}
      onClick={() => onChange(!on)}
      className={cn(
        'relative h-[26px] w-11 flex-none rounded-full transition-colors before:absolute before:-inset-y-[9px] before:inset-x-0 disabled:opacity-50',
        on ? 'bg-accent' : 'bg-switch-off',
      )}
    >
      <motion.span
        aria-hidden
        initial={false}
        animate={{ x: targetX, width: targetWidth }}
        transition={reduced ? still : spring.fast}
        style={reduced ? { x, scaleX: 1, scaleY: 1 } : { x, scaleX, scaleY }}
        className={cn(
          'pointer-events-none absolute top-[3px] left-[3px] h-5 rounded-full transition-colors',
          // 浅色下关闭时白圆点压在浅灰轨道上，保留投影才看得清轮廓
          'shadow-[0_1px_2px_rgba(0,0,0,.18),0_2px_6px_rgba(0,0,0,.12)] dark:shadow-none',
          on ? 'bg-on-accent' : 'bg-white',
        )}
      />
    </button>
  )
}
