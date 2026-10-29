import { NavLink, useLocation } from 'react-router'
import { useLive } from '@/api/live'
import { Glass } from '@/components/glass/Glass'
import { NavPill } from '@/components/ui/NavPill'
import { useNavPill } from '@/components/ui/useNavPill'
import { cn } from '@/lib/cn'
import { exitGalleryToLibrary } from '@/features/gallery/readMorph'
import { markNavDirection, TABS, updatesTabLabel } from './navTabs'
import { t } from '@/i18n'

/** 手机（< 768px）底部标签栏；平板用左侧导航栏，桌面用顶部导航 */
export function MobileTabBar() {
  const downloading = useLive((s) => s.queue.length)
  const { pathname } = useLocation()
  const { ref: pillRef, box: pillBox } = useNavPill(pathname)
  return (
    <div data-vt-bar="tabbar" className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[max(10px,env(safe-area-inset-bottom))] md:hidden">
      <Glass as="nav" data-vt-glass="tabbar-tabs" ref={pillRef} dense aria-label={t('app.nav.main')} className="pointer-events-auto grid w-full max-w-[440px] grid-cols-5 rounded-[26px] p-1.5">
        <NavPill box={pillBox} className="rounded-[20px]" />
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            viewTransition
            onClick={(e) => {
              if (t.to === '/library' && exitGalleryToLibrary(e)) return e.preventDefault()
              markNavDirection(pathname, t.to)
            }}
            aria-label={t.to === '/updates' ? updatesTabLabel(downloading) : undefined}
            className={({ isActive }) =>
              cn(
                'relative flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-[20px] text-[11px] font-semibold no-underline transition-colors',
                isActive ? 'text-text' : 'text-muted',
              )
            }
          >
            <t.icon className="size-[22px]" strokeWidth={1.8} />
            {t.label}
            {t.to === '/updates' && downloading > 0 && (
              <span aria-hidden className="absolute top-1.5 right-[calc(50%-20px)] grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-on-accent num">
                {downloading}
              </span>
            )}
          </NavLink>
        ))}
      </Glass>
    </div>
  )
}
