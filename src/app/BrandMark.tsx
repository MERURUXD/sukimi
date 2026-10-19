import { cn } from '@/lib/cn'

/** 站点标志，顶栏和平板侧栏共用；目前是占位的字母圆标，换图标只改这里 */
export function BrandMark({ className }: { className?: string }) {
  return <span className={cn('grid size-10 place-items-center rounded-full bg-solid text-on-solid', className)}>S</span>
}
