import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * 各页的标题行：左边大标题和一行说明，右边放这一页的操作（搜索框、入口按钮）。
 * 标题左缘对齐顶栏的 Sukimi 图标；字号、留白各页一致，新页面也用它。
 *
 * 标题区按 flex-1 分剩余宽度、最窄不小于标题本身（min-w-min），
 * 右侧搜索框在中等宽度时跟着变窄而不是掉到下一行；要在手机上单独占一行，调用方给它 max-sm:basis-full。
 * 右侧默认和说明文字底边对齐，需要和标题那一行对齐时调用方加 self-start。
 */
export function PageHeader({
  title,
  sub,
  lead,
  actions,
  className,
}: {
  title: ReactNode
  sub?: ReactNode
  /** 标题左边的返回按钮 */
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
