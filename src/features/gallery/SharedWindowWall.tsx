import { useLayoutEffect, useRef } from 'react'
import type { LibraryManga } from '@/features/library/queries'
import { cn } from '@/lib/cn'
import { attachWindowWall } from './windowScene'
import './window.css'

/** 页面只提供墙的挂载位置，换页时实际封面层由 windowScene 保留。 */
export function WindowWall({ kind, items, mobile, picks, shade, className }: {
  kind: 'window' | 'gallery'
  items: readonly LibraryManga[]
  mobile: boolean
  picks?: readonly number[]
  shade?: string
  className?: string
}) {
  const host = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (!host.current || !items.length) return
    return attachWindowWall({ kind, host: host.current, items, mobile, picks, shade })
  }, [kind, items, mobile, picks, shade])
  return <div ref={host} aria-hidden data-wall-anchor={kind} className={cn('pointer-events-none absolute inset-0', className)} />
}
