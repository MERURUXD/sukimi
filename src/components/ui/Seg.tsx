import { motion } from 'motion/react'
import { useId, type ReactNode } from 'react'
import { Glass } from '@/components/glass/Glass'
import { spring } from '@/design/motion'
import { cn } from '@/lib/cn'

export interface SegItem<T> {
  value: T
  label: ReactNode
  count?: number
}

/** 玻璃分段控件，选中块在选项间滑动 */
export function Seg<T extends string | number>({
  items,
  value,
  onChange,
  label,
  className,
  glass = true,
}: {
  items: SegItem<T>[]
  value: T
  onChange: (v: T) => void
  label: string
  className?: string
  glass?: boolean
}) {
  const layoutId = useId()
  const body = items.map((it) => {
    const on = it.value === value
    return (
      <button key={String(it.value)} type="button" aria-pressed={on} onClick={() => onChange(it.value)}>
        {on && <motion.span layoutId={layoutId} transition={spring.fast} className="seg-on" />}
        {it.label}
        {it.count != null && <span className="c num">{it.count.toLocaleString('en-US')}</span>}
      </button>
    )
  })
  return glass ? (
    <Glass role="group" aria-label={label} className={cn('seg', className)}>
      {body}
    </Glass>
  ) : (
    <div role="group" aria-label={label} className={cn('seg isolate bg-accent-soft', className)}>
      {body}
    </div>
  )
}
