import type { FormEvent, InputHTMLAttributes, ReactNode } from 'react'
import { Glass } from '@/components/glass/Glass'
import { PreviewBadge } from '@/app/PreviewBadge'
import { useApplyAppearance } from '@/design/settings'

/** 登录、注册、找回共用的输入框（放在玻璃里） */
export function AuthInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Glass className="rounded-full">
      <input
        className="h-12 w-full rounded-full border-0 bg-transparent px-5 text-[15px] text-text outline-none placeholder:text-muted"
        {...props}
      />
    </Glass>
  )
}

/** 未登录页面的外壳：氛围光、标志、标题与表单 */
export function AuthLayout({
  title,
  subtitle,
  onSubmit,
  children,
}: {
  title: string
  subtitle?: ReactNode
  onSubmit: (e: FormEvent) => void
  children: ReactNode
}) {
  useApplyAppearance()
  return (
    <div className="relative isolate grid min-h-dvh place-items-center overflow-hidden px-4">
      {/* 没有封面可用时的中性氛围光 */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 opacity-70 blur-[90px]"
        style={{
          background:
            'radial-gradient(40% 50% at 30% 30%, color-mix(in srgb, var(--text) 18%, transparent), transparent), radial-gradient(35% 45% at 72% 70%, color-mix(in srgb, var(--text) 10%, transparent), transparent)',
        }}
      />

      <form onSubmit={onSubmit} className="flex w-full max-w-[360px] flex-col items-center">
        <span className="grid size-14 place-items-center rounded-[16px] bg-solid text-2xl font-bold text-on-solid">S</span>
        <h1 className="mt-6 mb-1 text-[28px] font-bold">{title}</h1>
        <p className="m-0 text-center text-muted num">{subtitle ?? ' '}</p>
        {children}
      </form>
      <PreviewBadge />
    </div>
  )
}
