import { Check, ChevronDown, LoaderCircle } from 'lucide-react'
import { useEffect, useId, useState, type InputHTMLAttributes, type ReactNode } from 'react'
import { Glass } from '@/components/glass/Glass'
import { cn } from '@/lib/cn'

/** 分栏里的一组设置：标题 + 说明，组与组之间只靠留白分开 */
export function Section({ title, desc, children, action }: { title: string; desc?: ReactNode; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="flex flex-col gap-5 pb-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="m-0 text-xl font-bold">{title}</h2>
          {desc && <p className="mt-1 mb-0 max-w-[62ch] text-sm text-muted">{desc}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export function Row({
  label,
  hint,
  restart,
  status = 'idle',
  children,
  stack,
}: {
  label: ReactNode
  hint?: ReactNode
  /** 改了需要重启服务端 */
  restart?: boolean
  status?: SaveStatus
  children?: ReactNode
  /** 控件放到标签下面（长输入框） */
  stack?: boolean
}) {
  return (
    <div className={cn('flex flex-wrap justify-between gap-x-6 gap-y-2.5', stack ? 'flex-col' : 'items-center')}>
      <div className={cn('min-w-0', !stack && 'flex-[1_1_240px]')}>
        <div className="flex items-center gap-2 font-semibold">
          {label}
          {restart && <span className="rounded-full border border-line px-2 text-[11px] font-semibold text-muted">需重启</span>}
          <StatusIcon status={status} />
        </div>
        {hint && <div className="mt-0.5 max-w-[62ch] text-xs leading-relaxed text-muted">{hint}</div>}
      </div>
      {children}
    </div>
  )
}

function StatusIcon({ status }: { status: SaveStatus }) {
  // 「已保存」显示一会儿就淡出
  const [show, setShow] = useState(false)
  useEffect(() => {
    if (status !== 'saved') return setShow(false)
    setShow(true)
    const t = setTimeout(() => setShow(false), 1600)
    return () => clearTimeout(t)
  }, [status])
  if (status === 'saving') return <LoaderCircle className="size-3.5 animate-spin text-muted" aria-label="正在保存" />
  return (
    <Check
      className={cn('size-3.5 text-muted transition-opacity duration-500', show ? 'opacity-100' : 'opacity-0')}
      strokeWidth={3}
      aria-label={show ? '已保存' : undefined}
      aria-hidden={!show}
    />
  )
}

export function Switch({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={cn(
        'relative h-[26px] w-11 flex-none rounded-full transition-colors disabled:opacity-50',
        on ? 'bg-accent' : 'bg-track',
        "after:absolute after:top-[3px] after:left-[3px] after:size-5 after:rounded-full after:transition-[left] after:content-['']",
        on ? 'after:left-[21px] after:bg-on-accent' : 'after:bg-white',
      )}
    />
  )
}

/** 玻璃输入框；suffix 放单位 */
export function TextInput({
  className,
  suffix,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { suffix?: ReactNode }) {
  return (
    <Glass as="label" className={cn('flex h-11 min-w-0 items-center gap-2 rounded-[14px] px-3.5', className)}>
      <input
        {...props}
        className="min-w-0 flex-1 border-0 bg-transparent text-[15px] text-text outline-none placeholder:text-faint disabled:opacity-60"
      />
      {suffix && <span className="flex-none text-[13px] text-muted">{suffix}</span>}
    </Glass>
  )
}

/** 选项多时用的下拉框（少于等于 4 个用 Seg） */
export function Select<T extends string | number>({
  value,
  options,
  onChange,
  label,
  className,
}: {
  value: T
  options: { value: T; label: string; disabled?: boolean }[]
  onChange: (v: T) => void
  label: string
  className?: string
}) {
  const id = useId()
  return (
    <Glass as="label" htmlFor={id} className={cn('relative flex h-11 items-center rounded-[14px]', className)}>
      <select
        id={id}
        aria-label={label}
        value={String(value)}
        onChange={(e) => onChange(options.find((o) => String(o.value) === e.target.value)!.value)}
        className="h-full w-full cursor-pointer appearance-none border-0 bg-transparent pr-9 pl-3.5 text-[15px] text-text outline-none"
      >
        {options.map((o) => (
          <option key={String(o.value)} value={String(o.value)} disabled={o.disabled} className="bg-bg text-text">
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 size-4 text-muted" />
    </Glass>
  )
}
