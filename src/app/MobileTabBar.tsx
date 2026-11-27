import { NavLink, useLocation, useNavigate } from 'react-router'
import { useLive } from '@/api/live'
import { Glass } from '@/components/glass/Glass'
import { NavLensTrack } from '@/components/ui/NavPill'
import { cn } from '@/lib/cn'
import { exitGalleryToLibrary } from '@/features/gallery/readMorph'
import { activeTabIndex, markNavDirection, TABS, updatesTabLabel } from './navTabs'
import { t } from '@/i18n'

export function MobileTabBar() {
  const downloading = useLive((s) => s.queue.length)
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const activeIndex = activeTabIndex(pathname)
  const commitTab = (index: number) => {
    const target = TABS[index]
    if (!target) return
    if (target.to === '/library' && exitGalleryToLibrary({ button: 0, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false })) return
    markNavDirection(pathname, target.to)
    void navigate(target.to, { viewTransition: true })
  }

  return (
    <div data-vt-bar="tabbar" className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[max(10px,env(safe-area-inset-bottom))] md:hidden">
      <Glass as="nav" data-vt-glass="tabbar-tabs" dense aria-label={t('app.nav.main')} className="pointer-events-auto w-full max-w-[440px] rounded-[26px]">
        <NavLensTrack
          orientation="horizontal"
          activeIndex={activeIndex}
          pillClassName="rounded-[20px]"
          pillRadius={20}
          magnification={1.07}
          dragMagBoost={0.04}
          trackClassName="optical-track optical-x rounded-[26px] p-1.5"
          listClassName="grid w-full grid-cols-5"
          measureKey={`${TABS.length}:${downloading > 0 ? 1 : 0}`}
          onCommit={commitTab}
          clone={TABS.map((tab) => (
            <span
              key={tab.to}
              className="relative flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-[20px] text-[11px] font-semibold text-text"
            >
              <tab.icon className="size-[22px]" strokeWidth={1.8} />
              {tab.label}
              {tab.to === '/updates' && downloading > 0 && (
                <span className="absolute top-1.5 right-[calc(50%-20px)] grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-on-accent num">
                  {downloading}
                </span>
              )}
            </span>
          ))}
        >
          {TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              viewTransition
              draggable={false}
              onClick={(e) => {
                if (tab.to === '/library' && exitGalleryToLibrary(e)) return e.preventDefault()
                markNavDirection(pathname, tab.to)
              }}
              aria-label={tab.to === '/updates' ? updatesTabLabel(downloading) : undefined}
              className={({ isActive }) =>
                cn(
                  'relative flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-[20px] text-[11px] font-semibold no-underline transition-colors',
                  isActive ? 'text-text' : 'text-muted',
                )
              }
            >
              <tab.icon className="size-[22px]" strokeWidth={1.8} />
              {tab.label}
              {tab.to === '/updates' && downloading > 0 && (
                <span aria-hidden className="absolute top-1.5 right-[calc(50%-20px)] grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-on-accent num">
                  {downloading}
                </span>
              )}
            </NavLink>
          ))}
        </NavLensTrack>
      </Glass>
    </div>
  )
}
