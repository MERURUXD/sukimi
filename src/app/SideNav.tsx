import { NavLink, useLocation } from 'react-router'
import { useLive } from '@/api/live'
import { Glass } from '@/components/glass/Glass'
import { NavPill } from '@/components/ui/NavPill'
import { useNavPill } from '@/components/ui/useNavPill'
import { cn } from '@/lib/cn'
import { exitGalleryToLibrary } from '@/features/gallery/readMorph'
import { markNavDirection, TABS } from './navTabs'

/**
 * 平板（768–1279px）左侧玻璃导航栏。宽度和内容让位由 index.css 的 --side-w 统一给出，
 * 顶栏只保留返回键和右侧按钮，标志移到这里，和顶栏的按钮排在同一行高度。
 */
export function SideNav() {
  const downloading = useLive((s) => s.queue.length)
  const { pathname } = useLocation()
  const { ref: pillRef, box: pillBox } = useNavPill(pathname)
  return (
    <div data-vt-bar="sidenav" className="pointer-events-none fixed top-0 left-0 z-40 hidden w-[var(--side-w)] flex-col items-end md:max-xl:flex">
      <div className="flex h-[var(--nav-h)] w-[72px] items-center justify-center">
        <NavLink to="/" aria-label="Sukimi 首页" className="pointer-events-auto rounded-full text-text no-underline">
          <Glass as="span" className="flex rounded-full p-[5px] text-[17px] font-bold">
            <span className="grid size-10 place-items-center rounded-full bg-solid text-on-solid">S</span>
          </Glass>
        </NavLink>
      </div>
      <Glass as="nav" ref={pillRef} dense aria-label="主导航" className="pointer-events-auto flex w-[72px] flex-col gap-1 rounded-[26px] p-1.5">
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
            className={({ isActive }) =>
              cn(
                'relative flex min-h-[58px] flex-col items-center justify-center gap-0.5 rounded-[20px] text-[11px] font-semibold no-underline transition-colors',
                isActive ? 'text-text' : 'text-muted hover:text-text',
              )
            }
          >
            <t.icon className="size-[22px]" strokeWidth={1.8} />
            {t.label}
            {t.to === '/updates' && downloading > 0 && (
              <span className="absolute top-1.5 right-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-on-accent num">
                {downloading}
              </span>
            )}
          </NavLink>
        ))}
      </Glass>
    </div>
  )
}
