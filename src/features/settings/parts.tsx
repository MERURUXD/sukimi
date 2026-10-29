import { Check, ChevronDown, ChevronsUpDown, CircleHelp, LoaderCircle, TriangleAlert, type LucideIcon } from 'lucide-react'
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type InputHTMLAttributes, type KeyboardEvent, type ReactNode } from 'react'
import { Popover } from '@/components/ui/Popover'
import { cn } from '@/lib/cn'
import { t } from '@/i18n'

/** 手机上子页的大标题就是分栏名；同名的小节标题只留给读屏，免得同一个词上下各出现一次 */
export const SettingsPageTitle = createContext<string | undefined>(undefined)

/**
 * 分栏里的一组设置：标题 + 说明，组与组之间只靠留白分开。
 * fold：不常改的高级项默认收起，点「展开」才渲染内容；说明留在外面，一眼知道里面是什么。
 * wide：双栏预览等需要占满内容区时打开；常规设置列限制阅读宽度，避免桌面端短标签与右侧控件相距过远。
 */
export function Section({
  title,
  desc,
  children,
  action,
  fold,
  wide,
}: {
  title: string
  desc?: ReactNode
  children: ReactNode
  action?: ReactNode
  fold?: boolean
  wide?: boolean
}) {
  const [open, setOpen] = useState(!fold)
  const pageTitle = useContext(SettingsPageTitle)
  return (
    <section className={cn('flex flex-col gap-3.5 pb-10', !wide && 'max-w-[660px]')}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className={cn('m-0 text-xl font-bold', title === pageTitle && 'max-md:sr-only')}>{title}</h2>
          {desc && <p className="mt-1 mb-0 max-w-[62ch] text-[13px] leading-relaxed text-muted">{desc}</p>}
        </div>
        {(action || fold) && (
          <div className="flex flex-wrap items-center gap-2">
            {action}
            {fold && (
              <button
                type="button"
                className="gbtn plain min-h-9 w-fit rounded-full px-3.5 text-[13px]"
                aria-expanded={open}
                aria-label={t(open ? 'settings.parts.collapseAria' : 'settings.parts.expandAria', { title })}
                onClick={() => setOpen((v) => !v)}
              >
                {open ? t('settings.parts.collapse') : t('settings.parts.expand')}
                <ChevronDown className={cn('size-4 transition-transform', open && 'rotate-180')} strokeWidth={1.8} />
              </button>
            )}
          </div>
        )}
      </div>
      {open && children}
    </section>
  )
}

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export function Row({
  label,
  hint,
  help,
  warn,
  restart,
  status = 'idle',
  children,
  stack,
}: {
  label: ReactNode
  hint?: ReactNode
  /** 点图标弹出小窗的详细说明（首次/再次播放机制、兼容细节等），支持点击、键盘与触屏 */
  help?: ReactNode
  /** 关键限制、性能影响或操作风险；标题旁显示红色警示图标，点开看原因 */
  warn?: ReactNode
  /** 改了需要重启服务端 */
  restart?: boolean
  status?: SaveStatus
  children?: ReactNode
  /** 控件放到标签下面（长输入框） */
  stack?: boolean
}) {
  const labelText = typeof label === 'string' ? label : t('settings.parts.thisItem')

  return (
    <div
      className={cn(
        'flex flex-wrap justify-between gap-x-4 gap-y-2 py-0.5',
        stack ? 'flex-col' : 'min-h-11 items-center',
      )}
    >
      <div className={cn('min-w-0', !stack && 'flex-[1_1_180px]')}>
        <div className="flex flex-wrap items-center gap-1.5 font-semibold">
          <span>{label}</span>
          {help && <InfoPop icon={CircleHelp} label={t('settings.parts.helpAria', { label: labelText })}>{help}</InfoPop>}
          {warn && <InfoPop icon={TriangleAlert} danger label={t('settings.parts.warnAria', { label: labelText })}>{warn}</InfoPop>}
          {restart && <span className="rounded-full border border-line px-2 py-px text-[11px] font-semibold text-muted">{t('cfg.needRestart')}</span>}
          <StatusBadge status={status} />
        </div>
        {hint && <div className="mt-0.5 max-w-[58ch] text-[13px] leading-snug text-muted">{hint}</div>}
      </div>
      {children}
    </div>
  )
}

/** 标题旁的图标，点开是浮在旁边的小窗：不占行内空间，右侧控件不会被挤动 */
function InfoPop({ icon: Icon, danger, label, children }: { icon: LucideIcon; danger?: boolean; label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  return (
    <Popover
      open={open}
      onClose={() => setOpen(false)}
      align="left"
      id={id}
      label={label}
      rootClassName="-my-1 flex-none"
      // 小窗直接压在设置文字上：「通透」底色加折射只糊 2px，下面的字会透出来，所以底色加厚并改回大半径模糊
      className="glass-legible w-[min(300px,calc(100vw-48px))] !bg-[color-mix(in_srgb,var(--bg)_88%,transparent)] ![backdrop-filter:blur(18px)_saturate(1.4)] px-4 py-3 text-[13px] leading-relaxed font-normal text-text/90"
      trigger={
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          aria-label={label}
          onClick={() => setOpen((v) => !v)}
          className={cn(
            // 图标保持 28px，伪元素把触屏可点范围扩到 44px
            'relative inline-flex size-7 flex-none items-center justify-center rounded-full transition-colors after:absolute after:-inset-2 after:rounded-full hover:bg-hover',
            danger ? 'text-danger' : cn('text-muted hover:text-text', open && 'text-text'),
          )}
        >
          <Icon className="size-4" strokeWidth={danger ? 2 : 1.8} />
        </button>
      }
    >
      {children}
    </Popover>
  )
}

function StatusBadge({ status }: { status: SaveStatus }) {
  // 「已保存」显示一会儿就淡出；「保存失败」常驻显示，直到下次操作
  const [showSaved, setShowSaved] = useState(false)
  useEffect(() => {
    if (status !== 'saved') return setShowSaved(false)
    setShowSaved(true)
    const t = setTimeout(() => setShowSaved(false), 1600)
    return () => clearTimeout(t)
  }, [status])

  if (status === 'saving') {
    return (
      <span role="status" className="inline-flex items-center gap-1 text-xs font-medium text-muted">
        <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
        {t('settings.parts.saving')}
      </span>
    )
  }
  if (status === 'error') {
    return (
      <span role="alert" className="inline-flex items-center gap-1 text-xs font-semibold text-danger">
        <TriangleAlert className="size-3.5" strokeWidth={2} aria-hidden />
        {t('settings.parts.saveFailed')}
      </span>
    )
  }
  return (
    <span
      role={showSaved ? 'status' : undefined}
      aria-hidden={!showSaved}
      className={cn(
        'inline-flex items-center gap-1 text-xs font-medium text-muted transition-opacity duration-500',
        showSaved ? 'opacity-100' : 'pointer-events-none opacity-0',
      )}
    >
      <Check className="size-3.5" strokeWidth={2.5} aria-hidden />
      {t('settings.parts.saved')}
    </span>
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
        'relative h-[26px] w-11 flex-none rounded-full transition-colors before:absolute before:-inset-y-[9px] before:inset-x-0 disabled:opacity-50',
        on ? 'bg-accent' : 'bg-switch-off',
        // 圆点带投影：浅色下关闭时白点压在浅灰轨道上，没有投影就只剩一团灰
        "after:absolute after:top-[3px] after:left-[3px] after:size-5 after:rounded-full after:shadow-[0_1px_2px_rgba(0,0,0,.18),0_2px_6px_rgba(0,0,0,.12)] dark:after:shadow-none after:transition-[left] after:content-['']",
        on ? 'after:left-[21px] after:bg-on-accent' : 'after:bg-white',
      )}
    />
  )
}

/** 输入框（普通表面）；suffix 放单位 */
export function TextInput({
  className,
  suffix,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { suffix?: ReactNode }) {
  return (
    <label className={cn('plain flex h-11 min-w-0 items-center gap-2 rounded-[14px] px-3.5', className)}>
      <input
        {...props}
        className="min-w-0 flex-1 border-0 bg-transparent text-[15px] text-text outline-none placeholder:text-faint disabled:opacity-60"
      />
      {suffix && <span className="flex-none text-[13px] text-muted">{suffix}</span>}
    </label>
  )
}

/**
 * 设置行右侧的下拉菜单：平时只显示当前值，点开是锚在按钮旁的玻璃菜单。
 * 上下方向键在选项间移动，Esc 关闭后焦点回到按钮。
 */
export function Dropdown<T extends string | number>({
  value,
  options,
  onChange,
  label,
  className,
  align = 'right',
}: {
  value: T
  options: { value: T; label: string; disabled?: boolean }[]
  onChange: (v: T) => void
  label: string
  className?: string
  /** 放在一行最左边时传 left，菜单往右展开，免得手机上被屏幕左缘切掉 */
  align?: 'left' | 'right'
}) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const trigger = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const current = options.find((o) => o.value === value)
  const close = useCallback(() => setOpen(false), [])
  // 打开时把焦点放到当前选中项上，键盘用户直接从这里开始挑
  useEffect(() => {
    if (!open) return
    const items = menu.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]:not(:disabled)')
    const on = menu.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]:not(:disabled)')
    ;(on ?? items?.[0])?.focus({ preventScroll: true })
  }, [open])
  const pick = (v: T) => {
    setOpen(false)
    trigger.current?.focus()
    if (v !== value) onChange(v)
  }
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') trigger.current?.focus()
    // Tab 让焦点照常前进，同时收起菜单，免得它留在原处挡住内容
    if (e.key === 'Tab') setOpen(false)
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End') return
    e.preventDefault()
    const items = [...(menu.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]:not(:disabled)') ?? [])]
    const i = items.indexOf(document.activeElement as HTMLButtonElement)
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : (i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
    items[next]?.focus()
  }
  return (
    <Popover
      open={open}
      onClose={close}
      id={id}
      label={label}
      align={align}
      fitViewport={options.length > 8}
      rootClassName={cn('max-w-full', className)}
      className="glass-legible min-w-full p-1.5"
      trigger={
        <button
          ref={trigger}
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((v) => !v)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              e.preventDefault()
              setOpen(true)
            }
          }}
          className={cn(
            'plain flex h-11 w-full min-w-0 items-center justify-between gap-2 rounded-full pr-3 pl-4 text-[15px] transition-colors hover:bg-hover',
            open && 'bg-hover',
          )}
        >
          <span className="truncate">
            <span className="sr-only">{label} </span>
            {current?.label ?? String(value)}
          </span>
          <ChevronsUpDown className="size-4 flex-none text-muted" strokeWidth={1.8} />
        </button>
      }
    >
      <div ref={menu} role="menu" aria-label={label} onKeyDown={onKey} className="flex flex-col gap-0.5">
        {options.map((o) => {
          const on = o.value === value
          return (
            <button
              key={String(o.value)}
              type="button"
              role="menuitemradio"
              aria-checked={on}
              disabled={o.disabled}
              onClick={() => pick(o.value)}
              className={cn(
                'flex min-h-10 items-center justify-between gap-6 rounded-[14px] px-3 text-left text-[15px] whitespace-nowrap transition-colors outline-none hover:bg-hover focus-visible:bg-hover disabled:opacity-40',
                on && 'font-semibold',
              )}
            >
              {o.label}
              <Check className={cn('size-4 flex-none', !on && 'invisible')} strokeWidth={2.2} aria-hidden />
            </button>
          )
        })}
      </div>
    </Popover>
  )
}

/** 选项多时用的原生下拉框；弹层、对话框里会被裁切的地方继续用它，设置行用 Dropdown */
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
    <label htmlFor={id} className={cn('plain relative flex h-11 items-center rounded-[14px]', className)}>
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
    </label>
  )
}
