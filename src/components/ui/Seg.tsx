import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Glass } from '@/components/glass/Glass'
import { spring } from '@/design/motion'
import { cn } from '@/lib/cn'

export interface SegItem<T> {
  value: T
  label: ReactNode
  count?: number
}

/** 分段控件，选中块在选项间滑动；glass=false 时用普通表面（静态页面里的设置项），flat / suspendRefract 透传给玻璃（纯色页面上的工具栏 / 只衬氛围光时）*/
export function Seg<T extends string | number>({
  items,
  value,
  onChange,
  label,
  className,
  glass = true,
  flat,
  suspendRefract,
}: {
  items: SegItem<T>[]
  value: T
  onChange: (v: T) => void
  label: string
  className?: string
  glass?: boolean
  flat?: boolean
  suspendRefract?: boolean
}) {
  const layoutId = useId()
  const reduced = useReducedMotion()
  const root = useRef<HTMLDivElement>(null)
  // 选项放不下时 .seg 内部横向滚动：哪一侧还有内容，那一侧边缘渐隐作提示
  const [fade, setFade] = useState<'l' | 'r' | 'lr' | undefined>()
  useEffect(() => {
    const el = root.current
    if (!el) return
    const measure = () => {
      const l = el.scrollLeft > 2
      const r = el.scrollLeft + el.clientWidth < el.scrollWidth - 2
      setFade(l && r ? 'lr' : l ? 'l' : r ? 'r' : undefined)
    }
    measure()
    el.addEventListener('scroll', measure, { passive: true })
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', measure)
      ro.disconnect()
    }
  }, [items.length])
  // 选中项被滚出可视区时（例如从别处带入的筛选）拉回来
  useEffect(() => {
    const el = root.current
    const on = el?.querySelector<HTMLElement>('[aria-pressed="true"]')
    if (!el || !on) return
    const left = on.offsetLeft - 8
    const right = on.offsetLeft + on.offsetWidth + 8
    const behavior = reduced ? 'auto' : 'smooth'
    if (left < el.scrollLeft) el.scrollTo({ left, behavior })
    else if (right > el.scrollLeft + el.clientWidth) el.scrollTo({ left: right - el.clientWidth, behavior })
  }, [value, reduced])
  const body = items.map((it) => {
    const on = it.value === value
    return (
      <button key={String(it.value)} type="button" aria-pressed={on} onClick={() => onChange(it.value)}>
        {on && (reduced
          ? <span className="seg-on" />
          : <motion.span layoutId={layoutId} transition={spring.fast} className="seg-on" />)}
        {it.label}
        {it.count != null && <span className="c num">{it.count.toLocaleString('en-US')}</span>}
      </button>
    )
  })
  return glass ? (
    <Glass ref={root as React.Ref<HTMLElement>} flat={flat} suspendRefract={suspendRefract} role="group" aria-label={label} data-fade={fade} className={cn('seg', className)}>
      {body}
    </Glass>
  ) : (
    <div ref={root} role="group" aria-label={label} data-fade={fade} className={cn('seg plain isolate', className)}>
      {body}
    </div>
  )
}
