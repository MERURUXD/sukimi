import { Outlet, Link } from 'react-router'
import { ConfirmHost } from '@/components/ui/Confirm'
import { Toaster } from '@/components/ui/toast'
import { Glass } from '@/components/glass/Glass'
import { PreviewBadge } from '@/app/PreviewBadge'
import { useApplyAppearance } from '@/design/settings'
import { NsfwSync } from '@/features/nsfw/useNsfw'
import { t } from '@/i18n'

export function DemoGate() {
  useApplyAppearance()
  return <div data-sfw="">
    <Outlet />
    <Toaster />
    <ConfirmHost />
    <PreviewBadge />
    <NsfwSync />
  </div>
}

export function DemoUnavailable() {
  return <div className="wrap flex min-h-[50dvh] flex-col items-start justify-center gap-4">
    <h1 className="m-0 text-3xl font-bold">{t('misc.demo.unavailableTitle')}</h1>
    <p className="m-0 text-muted">{t('misc.demo.unavailableDesc')}</p>
    <Link to="/" className="solid no-underline">{t('misc.demo.backHome')}</Link>
  </div>
}

export function DemoNotice() {
  return <Glass data-vt-glass="topnav-demo" className="flex items-center gap-2 rounded-full px-3 py-2 text-xs">
    <span className="font-semibold">{t('misc.demo.badge')}</span>
    <a href="/login" className="text-muted no-underline hover:text-text">{t('misc.demo.exit')}</a>
  </Glass>
}
