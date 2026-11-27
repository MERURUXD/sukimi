import { NavLink, useLocation, useNavigate } from 'react-router'
import { useLive } from '@/api/live'
import { Glass } from '@/components/glass/Glass'
import { NavLensTrack } from '@/components/ui/NavPill'
import { cn } from '@/lib/cn'
import { exitGalleryToLibrary } from '@/features/gallery/readMorph'
import { BrandMark } from './BrandMark'
import { activeTabIndex, markNavDirection, TABS, updatesTabLabel } from './navTabs'
import { t } from '@/i18n'

/** 触控移动设备在 768–1279px 使用左侧导航栏；宽度和内容让位由 index.css 的 --side-w 统一给出。 */
export function SideNav() {
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
    <div data-vt-bar="sidenav" className="side-nav pointer-events-none fixed top-0 left-0 z-40 w-[var(--side-w)] flex-col items-end">
      <div className="flex h-[var(--nav-h)] w-[72px] items-center justify-center">
        <NavLink to="/" aria-label={t('app.nav.brandHome')} className="pointer-events-auto rounded-full text-text no-underline">
          <Glass as="span" data-vt-glass="sidenav-brand" className="flex rounded-full p-[5px] text-[17px] font-bold">
            <BrandMark />
          </Glass>
        </NavLink>
      </div>
      <Glass as="nav" data-vt-glass="sidenav-tabs" dense aria-label={t('app.nav.main')} className="pointer-events-auto w-[72px] rounded-[26px]">
        <NavLensTrack
          orientation="vertical"
          activeIndex={activeIndex}
          pillClassName="rounded-[20px]"
          pillRadius={20}
          magnification={1.07}
          dragMagBoost={0.04}
          trackClassName="optical-track optical-y rounded-[26px] p-1.5"
          listClassName="flex flex-col gap-1"
          measureKey={`${TABS.length}:${downloading > 0 ? 1 : 0}`}
          onCommit={commitTab}
          clone={TABS.map((tab) => (
            <span
              key={tab.to}
              className="relative flex min-h-[58px] flex-col items-center justify-center gap-0.5 rounded-[20px] text-[11px] font-semibold text-text"
            >
              <tab.icon className="size-[22px]" strokeWidth={1.8} />
              {tab.label}
              {tab.to === '/updates' && downloading > 0 && (
                <span className="absolute top-1.5 right-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-on-accent num">
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
                  'relative flex min-h-[58px] flex-col items-center justify-center gap-0.5 rounded-[20px] text-[11px] font-semibold no-underline transition-colors',
                  isActive ? 'text-text' : 'text-muted hover:text-text',
                )
              }
            >
              <tab.icon className="size-[22px]" strokeWidth={1.8} />
              {tab.label}
              {tab.to === '/updates' && downloading > 0 && (
                <span aria-hidden className="absolute top-1.5 right-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-on-accent num">
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
