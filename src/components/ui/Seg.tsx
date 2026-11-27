import { useReducedMotion } from 'motion/react'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Glass } from '@/components/glass/Glass'
import { cn } from '@/lib/cn'
import { useOpticalSlider, type SliderBox } from './opticalSlider'

export interface SegItem<T> {
  value: T
  label: ReactNode
  count?: number
}

/** glass=false 时用普通表面；flat / suspendRefract 透传给玻璃。 */
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
  const reduced = Boolean(useReducedMotion())
  const root = useRef<HTMLDivElement>(null)
  const cloneItemsRef = useRef<(HTMLSpanElement | null)[]>([])

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

  const activeIndex = items.findIndex((it) => it.value === value)
  const measureKey = items.map((it) => `${String(it.value)}:${it.count ?? ''}`).join('|')

  const handleCommit = useCallback(
    (index: number) => {
      const next = items[index]
      if (next && next.value !== value) onChange(next.value)
    },
    [items, onChange, value],
  )

  const handleMeasure = useCallback((boxes: SliderBox[]) => {
    for (let i = 0; i < boxes.length; i++) {
      const span = cloneItemsRef.current[i]
      const b = boxes[i]
      if (!span || !b) continue
      span.style.left = `${b.x}px`
      span.style.top = `${b.y}px`
      span.style.width = `${b.width}px`
      span.style.height = `${b.height}px`
    }
  }, [])

  const {
    maskId,
    setTrackRef: sliderSetTrackRef,
    pillBgRef,
    lensWinRef,
    lensCloneRef,
    setItemMaskRef,
    pointerProps: sliderPointerProps,
  } = useOpticalSlider({
    orientation: 'horizontal',
    activeIndex,
    itemSelector: ':scope > button',
    magnification: 1.07,
    dragMagBoost: 0.04,
    pillRadius: 999,
    reduced,
    maskMode: 'items',
    maskIdPrefix: 'seg-cutout',
    measureKey,
    onCommit: handleCommit,
    onMeasure: handleMeasure,
  })

  const setTrackRef = useCallback(
    (el: HTMLElement | null) => {
      root.current = el as HTMLDivElement | null
      sliderSetTrackRef(el)
    },
    [sliderSetTrackRef],
  )

  const body = (
    <>
      {!reduced && (
        <svg width="0" height="0" className="pointer-events-none absolute" aria-hidden>
          <defs>
            {items.map((it, i) => (
              <mask
                key={String(it.value)}
                ref={setItemMaskRef(i, 'mask')}
                id={`${maskId}-${i}`}
                maskUnits="userSpaceOnUse"
                x="-16"
                y="-16"
                width="300"
                height="120"
              >
                <rect ref={setItemMaskRef(i, 'bg')} x="-16" y="-16" width="300" height="120" fill="white" />
                <rect ref={setItemMaskRef(i, 'hole')} x="0" y="0" width="0" height="0" rx="999" ry="999" fill="black" />
              </mask>
            ))}
          </defs>
        </svg>
      )}
      {!reduced && <span ref={pillBgRef} aria-hidden className="seg-pill-bg" />}
      {items.map((it) => {
        const on = it.value === value
        return (
          <button key={String(it.value)} type="button" aria-pressed={on} onClick={() => onChange(it.value)}>
            {reduced && on && <span className="seg-on" />}
            {it.label}
            {it.count != null && <span className="c num">{it.count.toLocaleString('en-US')}</span>}
          </button>
        )
      })}
      {!reduced && (
        <div ref={lensWinRef} aria-hidden className="seg-lens-window">
          <div ref={lensCloneRef} className="seg-lens-clone">
            {items.map((it, i) => (
              <span
                key={String(it.value)}
                ref={(el) => {
                  cloneItemsRef.current[i] = el
                }}
                className="seg-lens-item"
              >
                {it.label}
                {it.count != null && <span className="c num">{it.count.toLocaleString('en-US')}</span>}
              </span>
            ))}
          </div>
        </div>
      )}
    </>
  )

  const pointerProps = reduced ? undefined : sliderPointerProps

  return glass ? (
    <Glass
      ref={setTrackRef as React.Ref<HTMLElement>}
      flat={flat}
      suspendRefract={suspendRefract}
      role="group"
      aria-label={label}
      data-fade={fade}
      className={cn('seg', className)}
      {...pointerProps}
    >
      {body}
    </Glass>
  ) : (
    <div
      ref={setTrackRef as React.Ref<HTMLDivElement>}
      role="group"
      aria-label={label}
      data-fade={fade}
      className={cn('seg plain isolate', className)}
      {...pointerProps}
    >
      {body}
    </div>
  )
}
