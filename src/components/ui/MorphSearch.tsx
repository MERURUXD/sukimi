import { Search } from 'lucide-react'
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Glass } from '@/components/glass/Glass'
import { Popover } from '@/components/ui/Popover'
import { searchMorph } from '@/design/motion'
import { cn } from '@/lib/cn'
import { isImeComposing } from '@/lib/keyboard'
import { useMediaQuery } from '@/lib/useMediaQuery'

/**
 * 页面搜索：宽屏平时是圆形按钮，聚焦或有搜索词时由 Popover 的形变从按钮原位长成搜索条
 * （跟随外观里的「菜单液态形变」，关闭时淡入淡出）。Popover 根节点固定 44px 贴右：形变坐标以它为原点，
 * 开合中途反向时旧快照才对得上；展开后的占位交给外层容器，面板向左溢出、宽度取容器宽（100cqw）。
 * 外层容器的 flex-basis 始终是 44px、展开时只放开 flex-grow（上限为 width）：换行按 basis 算，
 * 行里还有空间时展开收起不会让所在的行重新换行，空间不足 width 时搜索条随之变窄；
 * 但不窄于 MIN_OPEN（会撑到下一行），否则输入框只剩几个字宽。
 * 手机上始终展开：那一行剩余宽度不定，从按钮长出来可能只剩一个图标宽。
 */
const MIN_OPEN = 200

export function MorphSearch({
  value,
  onChange,
  label,
  placeholder,
  width,
  mobileClassName,
  flat = false,
  suffix,
  onSubmit,
  inputClassName,
}: {
  value: string
  onChange: (value: string) => void
  label: string
  placeholder: string
  /** 宽屏展开后的宽度（px） */
  width: number
  /** 手机上常驻搜索框在所在行里的伸缩方式 */
  mobileClassName: string
  /** 直接放在纯色页面上（玻璃约定） */
  flat?: boolean
  /** 输入框右侧的附注，如结果数 */
  suffix?: ReactNode
  /** 回车提交；给了就包一层 form */
  onSubmit?: () => void
  inputClassName?: string
}) {
  const mobile = useMediaQuery('(max-width: 767px)')
  const [focused, setFocused] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const trigger = useRef<HTMLElement>(null)
  const panelId = useId()
  const open = focused || value !== ''
  // 收起动画播完前外层保持展开：面板宽取容器宽，容器先缩回 44px，收起形变的起点也就跟着塌成圆钮
  const [laidOut, setLaidOut] = useState(open)
  if (open && !laidOut) setLaidOut(true)
  const expanded = open || laidOut

  // 只在用户点按钮后把焦点送进输入框：带着搜索词进页面时不抢焦点。
  // 用 effect 而不是 autoFocus：收起途中再点开时输入框不会重新挂载
  const focusOnOpen = useRef(false)
  useEffect(() => {
    if (!open || !focusOnOpen.current) return
    focusOnOpen.current = false
    input.current?.focus()
  }, [open])

  const body = (
    <>
      <Search className="size-[18px] flex-none" strokeWidth={1.8} />
      <input
        ref={input}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={(e) => {
          if (mobile || e.key !== 'Escape' || isImeComposing(e.nativeEvent)) return
          // 这次 Esc 归搜索框：先清空，再按一次才收起，不再传给页面（如书库退出多选）
          e.stopPropagation()
          e.preventDefault()
          if (value) onChange('')
          else trigger.current?.focus()
        }}
        aria-label={label}
        placeholder={placeholder}
        className={cn('min-w-0 flex-1 border-0 bg-transparent text-text outline-none placeholder:text-faint', inputClassName)}
      />
      {suffix}
    </>
  )

  const Wrap = onSubmit ? 'form' : 'div'
  const submit = onSubmit && ((e: FormEvent) => {
    e.preventDefault()
    onSubmit()
  })

  if (mobile) {
    return (
      <Wrap onSubmit={submit} className={cn('min-w-0', mobileClassName)}>
        <Glass as="label" flat={flat} className="flex h-11 w-full items-center gap-2.5 rounded-full px-4 text-muted">
          {body}
        </Glass>
      </Wrap>
    )
  }

  return (
    // isolate 把面板的 z-50 关在这里：有搜索词时它常驻，滚动时不能盖住顶栏
    <Wrap
      onSubmit={submit}
      style={expanded ? { maxWidth: width, minWidth: Math.min(MIN_OPEN, width) } : undefined}
      className={cn('@container isolate flex min-w-0 justify-end', expanded ? 'flex-[999_0_44px]' : 'flex-[0_0_44px]')}
    >
      <Popover
        open={open}
        onClose={() => input.current?.blur()}
        // 开合跟着输入框焦点走：点外面会自然失焦，Esc 由输入框自己处理
        dismissible={false}
        onExitComplete={() => setLaidOut(false)}
        label={label}
        id={panelId}
        role="search"
        dense={false}
        flat={flat}
        maxStretchY={searchMorph.maxStretchY}
        rootClassName="flex-none"
        className="top-0 right-0 flex h-11 w-[100cqw] rounded-full p-0 text-muted [--g-drop:initial]"
        trigger={
          <Glass
            as="button"
            ref={trigger}
            type="button"
            flat={flat}
            className="gicon rounded-full"
            aria-label={label}
            aria-expanded={open}
            aria-controls={open ? panelId : undefined}
            tabIndex={open ? -1 : undefined}
            onClick={() => {
              focusOnOpen.current = true
              setFocused(true)
            }}
          >
            <Search className="size-[18px]" strokeWidth={1.8} />
          </Glass>
        }
      >
        {/* 点放大镜、附注或边距时焦点留在输入框：否则先失焦，空搜索条会当场收起 */}
        <div
          className="flex min-w-0 flex-1 cursor-text items-center gap-2.5 px-4"
          onMouseDown={(e) => {
            if (e.target === input.current) return
            e.preventDefault()
            input.current?.focus()
          }}
        >
          {body}
        </div>
      </Popover>
    </Wrap>
  )
}
