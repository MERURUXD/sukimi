import { AnimatePresence } from 'motion/react'
import { LogOut, Settings2, SlidersHorizontal } from 'lucide-react'
import { Link } from 'react-router'
import { useEffect, useRef, useState } from 'react'
import { signOut } from '@/api/auth'
import { Glass, MotionGlass } from '@/components/glass/Glass'
import { spring } from '@/design/motion'
import { useAppearance, type GlassMode, type ThemePref } from '@/design/settings'
import { cn } from '@/lib/cn'

const THEMES: { value: ThemePref; label: string }[] = [
  { value: 'dark', label: '深色' },
  { value: 'light', label: '浅色' },
  { value: 'system', label: '跟随系统' },
]

const GLASSES: { value: GlassMode; label: string }[] = [
  { value: 'refract', label: '液态' },
  { value: 'frosted', label: '毛玻璃' },
  { value: 'solid', label: '不透明' },
]

function Seg<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="flex gap-0.5 rounded-full bg-accent-soft p-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'min-h-8 flex-1 rounded-full px-3 text-[13px] font-semibold whitespace-nowrap transition-colors',
            o.value === value ? 'bg-g-hi text-text shadow-[inset_0_0_0_1px_var(--g-glow)]' : 'text-muted hover:text-text',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** 外观快捷设置；完整设置在 /settings */
export function AppearanceMenu() {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const { theme, glass, setTheme, setGlass } = useAppearance()

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={root} className="relative">
      <Glass as="button" className="gicon rounded-full" aria-label="外观设置" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <Settings2 className="size-5" strokeWidth={1.8} />
      </Glass>

      <AnimatePresence>
        {open && (
          <MotionGlass
            initial={{ opacity: 0, scale: 0.94, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -4 }}
            transition={spring.fast}
            className="absolute top-[calc(100%+10px)] right-0 z-50 flex w-[280px] origin-top-right flex-col gap-4 rounded-[22px] p-4"
          >
            <div className="flex flex-col gap-2">
              <span className="text-xs font-bold tracking-[.14em] text-muted">主题</span>
              <Seg value={theme} options={THEMES} onChange={setTheme} />
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-xs font-bold tracking-[.14em] text-muted">玻璃</span>
              <Seg value={glass} options={GLASSES} onChange={setGlass} />
            </div>
            <div className="-mx-2 flex flex-col">
              <Link to="/settings" onClick={() => setOpen(false)} className="gbtn min-h-10 justify-start text-muted no-underline hover:text-text">
                <SlidersHorizontal className="size-4" />
                全部设置
              </Link>
              <button className="gbtn min-h-10 justify-start text-muted hover:text-text" onClick={signOut}>
                <LogOut className="size-4" />
                退出登录
              </button>
            </div>
          </MotionGlass>
        )}
      </AnimatePresence>
    </div>
  )
}
