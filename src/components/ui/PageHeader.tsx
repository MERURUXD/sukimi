import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

/** 标题左缘对齐顶栏图标；右侧操作在中等宽度下优先压缩搜索框。 */
export function PageHeader({
  title,
  sub,
  lead,
  actions,
  className,
}: {
  title: ReactNode
  sub?: ReactNode
  lead?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-wrap items-end gap-x-6 gap-y-4 pt-7 pb-6', className)}>
      <div className="flex min-w-min flex-1 items-center gap-2">
        {lead}
        <div className="min-w-0">
          <h1 className="m-0 font-cjk text-[40px] leading-[1.1] font-black">{title}</h1>
          {sub && <p className="mt-1.5 mb-0 text-sm text-muted num">{sub}</p>}
        </div>
      </div>
      {actions}
    </div>
  )
}
