import { LogOut, Settings2, SlidersHorizontal } from 'lucide-react'
import { Link } from 'react-router'
import { useCallback, useState } from 'react'
import { signOut } from '@/api/auth'
import { Glass } from '@/components/glass/Glass'
import { confirm } from '@/components/ui/Confirm'
import { Popover } from '@/components/ui/Popover'
import { Seg } from '@/components/ui/Seg'
import { useAppearance, type GlassMode, type ThemePref } from '@/design/settings'
import { t } from '@/i18n'

const THEMES: { value: ThemePref; label: string }[] = [
  { value: 'dark', label: t('common.theme.dark') },
  { value: 'light', label: t('common.theme.light') },
  { value: 'system', label: t('common.theme.system') },
]

const GLASSES: { value: GlassMode; label: string }[] = [
  { value: 'refract', label: t('common.glass.refract') },
  { value: 'frosted', label: t('common.glass.frosted') },
  { value: 'solid', label: t('common.glass.solid') },
]

/** 外观快捷设置；完整设置在 /settings。面板从设置按钮长出来（Popover） */
export function AppearanceMenu() {
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  const { theme, glass, setTheme, setGlass } = useAppearance()
  const leave = async () => {
    if (await confirm({ title: t('app.appearanceMenu.signOutAsk'), ok: t('app.appearanceMenu.signOutOk'), local: true })) signOut()
  }

  return (
    <Popover
      open={open}
      onClose={close}
      label={t('app.appearanceMenu.title')}
      dense={false}
      vtGlass="topnav-appearance-panel"
      className="flex w-[280px] flex-col gap-4 rounded-[22px] p-4"
      trigger={
        <Glass as="button" type="button" data-vt-glass="topnav-appearance" className="gicon rounded-full" aria-label={t('app.appearanceMenu.title')} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          <Settings2 className="size-5" strokeWidth={1.8} />
        </Glass>
      }
    >
      <div className="flex flex-col gap-2">
        <span className="text-xs font-bold tracking-[.14em] text-muted">{t('app.appearanceMenu.theme')}</span>
        <Seg glass={false} label={t('app.appearanceMenu.theme')} items={THEMES} value={theme} onChange={setTheme} className="w-full [&>button]:flex-1 [&>button]:justify-center [&>button]:px-2" />
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-xs font-bold tracking-[.14em] text-muted">{t('app.appearanceMenu.glass')}</span>
        <Seg glass={false} label={t('app.appearanceMenu.glass')} items={GLASSES} value={glass} onChange={setGlass} className="w-full [&>button]:flex-1 [&>button]:justify-center [&>button]:px-2" />
      </div>
      <div className="-mx-2 flex flex-col">
        <Link to="/settings" onClick={close} className="gbtn min-h-10 justify-start text-muted no-underline hover:text-text">
          <SlidersHorizontal className="size-4" />
          {t('app.appearanceMenu.allSettings')}
        </Link>
        <button type="button" className="gbtn min-h-10 justify-start text-muted hover:text-text" onClick={() => void leave()}>
          <LogOut className="size-4" />
          {t('app.appearanceMenu.signOut')}
        </button>
      </div>
    </Popover>
  )
}
