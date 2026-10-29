import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Compass,
  DatabaseBackup,
  Download,
  Info,
  House,
  LibraryBig,
  ListChecks,
  Palette,
  RefreshCcw,
  Server,
  TriangleAlert,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { useLayoutEffect, useRef, useState, type ComponentType, type ReactNode } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router'
import { useAuth } from '@/api/auth'
import { MotionGlass } from '@/components/glass/Glass'
import { PageHeader } from '@/components/ui/PageHeader'
import { spring } from '@/design/motion'
import { can } from '@/features/auth/permissions'
import { cn } from '@/lib/cn'
import { SettingsPageTitle } from './parts'
import { ReaderDefaults } from './ReaderDefaults'
import { usePendingRestart } from './server'
import { AboutTab } from './tabs/AboutTab'
import { AppearanceTab } from './tabs/AppearanceTab'
import { HomeTab } from './tabs/HomeTab'
import { BackupTab } from './tabs/BackupTab'
import { BrowseTab } from './tabs/BrowseTab'
import { DownloadsTab } from './tabs/DownloadsTab'
import { LibraryTab } from './tabs/LibraryTab'
import { ServerTab } from './tabs/ServerTab'
import { SyncTab } from './tabs/SyncTab'
import { TrackingTab } from './tabs/TrackingTab'
import { UsersTab } from './tabs/UsersTab'
import { t } from '@/i18n'

function ReadingTab() {
  return <ReaderDefaults />
}

export interface SettingsTab {
  id: string
  label: string
  icon: LucideIcon
  desc: string
  Component: ComponentType
  /** 分组只靠留白区分，见 GROUPS */
  group: SettingsGroupId
  /** 只有管理用户的账号才看得到；旧服务端没有用户账号，也不显示 */
  adminOnly?: boolean
}

export type SettingsGroupId = 'personal' | 'content' | 'system'

const GROUPS: { id: SettingsGroupId; label: string }[] = [
  { id: 'personal', label: t('settings.groups.personal') },
  { id: 'content', label: t('settings.groups.content') },
  { id: 'system', label: t('settings.groups.system') },
]

/** 布局验收页按分栏渲染正式组件，所以导出 */
export const SETTINGS_TABS: SettingsTab[] = [
  { id: 'appearance', label: t('settings.tabs.appearance.label'), icon: Palette, desc: t('settings.tabs.appearance.desc'), Component: AppearanceTab, group: 'personal' },
  { id: 'home', label: t('settings.tabs.home.label'), icon: House, desc: t('settings.tabs.home.desc'), Component: HomeTab, group: 'personal' },
  { id: 'reading', label: t('settings.tabs.reading.label'), icon: BookOpen, desc: t('settings.tabs.reading.desc'), Component: ReadingTab, group: 'personal' },
  { id: 'library', label: t('settings.tabs.library.label'), icon: LibraryBig, desc: t('settings.tabs.library.desc'), Component: LibraryTab, group: 'personal' },
  { id: 'downloads', label: t('settings.tabs.downloads.label'), icon: Download, desc: t('settings.tabs.downloads.desc'), Component: DownloadsTab, group: 'content' },
  { id: 'browse', label: t('settings.tabs.browse.label'), icon: Compass, desc: t('settings.tabs.browse.desc'), Component: BrowseTab, group: 'content' },
  { id: 'backup', label: t('settings.tabs.backup.label'), icon: DatabaseBackup, desc: t('settings.tabs.backup.desc'), Component: BackupTab, group: 'content' },
  { id: 'sync', label: t('settings.tabs.sync.label'), icon: RefreshCcw, desc: t('settings.tabs.sync.desc'), Component: SyncTab, group: 'content' },
  { id: 'tracking', label: t('settings.tabs.tracking.label'), icon: ListChecks, desc: t('settings.tabs.tracking.desc'), Component: TrackingTab, group: 'content' },
  { id: 'server', label: t('settings.tabs.server.label'), icon: Server, desc: t('settings.tabs.server.desc'), Component: ServerTab, group: 'system' },
  { id: 'users', label: t('settings.tabs.users.label'), icon: Users, desc: t('settings.tabs.users.desc'), Component: UsersTab, group: 'system', adminOnly: true },
  { id: 'about', label: t('settings.tabs.about.label'), icon: Info, desc: t('settings.tabs.about.desc'), Component: AboutTab, group: 'system' },
]

/** 按当前用户的权限筛出能看到的分栏 */
function useVisibleTabs() {
  const user = useAuth((s) => s.user)
  const manageUsers = !!user && !user.legacy && can(user, 'MANAGE_USERS')
  return SETTINGS_TABS.filter((tab) => !tab.adminOnly || manageUsers)
}

/**
 * 不做整块玻璃底板，文字直接放在背景上，分组只靠留白。
 * 电脑：只有选中项是一颗玻璃胶囊，用容器内坐标滑动，页面滚动和 sticky 不会改变动画起点。
 * 手机：整页分组列表，不加玻璃（列表背后没有可折射的内容）。两套结构用断点切换。
 */
export function SettingsNavigation({ selected, singlePage, basePath = '/settings', tabs: given }: { selected: string; singlePage?: boolean; basePath?: string; tabs?: SettingsTab[] }) {
  const root = useRef<HTMLDivElement>(null)
  const visible = useVisibleTabs()
  const tabs = given ?? visible
  const groups = GROUPS.map((g) => ({ ...g, tabs: tabs.filter((t) => t.group === g.id) })).filter((g) => g.tabs.length)
  const [highlight, setHighlight] = useState<{ y: number; height: number } | null>(null)
  useLayoutEffect(() => {
    const container = root.current
    if (!container) return
    const measure = () => {
      const active = container.querySelector<HTMLElement>('[aria-current="page"]')
      if (active) setHighlight({ y: active.offsetTop, height: active.offsetHeight })
    }
    measure()
    const resize = new ResizeObserver(measure)
    resize.observe(container)
    return () => resize.disconnect()
  }, [selected])

  const to = (t: SettingsTab) => `${basePath}/${t.id}`

  return (
    <nav aria-label={t('settings.shell.navAria')} className={cn('md:sticky md:top-[calc(var(--nav-h)+12px)]', singlePage && 'max-md:hidden')}>
      <div ref={root} className="relative isolate flex flex-col gap-4 max-md:hidden">
        {/* 胶囊自身做位移动画，祖先不加透明度或滤镜，玻璃才采得到背后的内容 */}
        {highlight && <MotionGlass aria-hidden initial={false} animate={highlight} transition={spring.fast} className="pointer-events-none absolute top-0 inset-x-0 -z-10 rounded-full" />}
        {groups.map((g) => (
          <div key={g.id} role="group" aria-label={g.label} className="flex flex-col gap-px">
            {g.tabs.map((t) => {
              const on = t.id === selected
              return (
                <Link key={t.id} to={to(t)} replace={!!singlePage} aria-current={on ? 'page' : undefined}
                  className={cn('flex min-h-10 items-center gap-3 rounded-full px-3.5 text-[15px] no-underline transition-colors', on ? 'font-semibold text-text' : 'text-muted hover:bg-hover hover:text-text')}>
                  <t.icon className="size-[18px] flex-none" strokeWidth={on ? 2 : 1.8} />
                  <span className="min-w-0 flex-1 truncate">{t.label}</span>
                </Link>
              )
            })}
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-6 md:hidden">
        {groups.map((g) => (
          <section key={g.id} aria-label={g.label}>
            <h2 className="m-0 mb-1 px-1 text-[13px] font-medium text-muted">{g.label}</h2>
            <div className="-mx-2 flex flex-col">
              {g.tabs.map((t) => (
                <Link key={t.id} to={to(t)} replace={!!singlePage}
                  className="flex min-h-[60px] items-center gap-4 rounded-[18px] px-3 text-text no-underline transition-colors active:bg-hover">
                  <t.icon className="size-[22px] flex-none" strokeWidth={1.8} />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="font-medium">{t.label}</span>
                    <span className="truncate text-[13px] text-muted">{t.desc}</span>
                  </span>
                  <ChevronRight className="size-[18px] flex-none text-faint" />
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </nav>
  )
}

/**
 * 设置外壳：电脑和平板上左侧分栏；手机上先显示分栏列表，点进去是单独一页（可以返回）。
 * 正式设置和演示设置共用，只是分栏清单不同。地址是 <basePath>/<分栏>，没带分栏时电脑上显示第一栏。
 */
export function SettingsShell({ tabs, basePath = '/settings', intro }: { tabs: SettingsTab[]; basePath?: string; intro?: ReactNode }) {
  const { tab } = useParams()
  const navigate = useNavigate()
  const current = tabs.find((t) => t.id === tab)
  const shown = current ?? tabs[0]
  const pending = usePendingRestart((s) => s.keys.length)

  if (tab && !current) return <Navigate to={basePath} replace />

  const back = () => ((window.history.state?.idx ?? 0) > 0 ? navigate(-1) : navigate(basePath))

  return (
    // 设置页没有书库内容，开发安全模式下不打码
    <div className="wrap pb-24" data-sfw="">
      <PageHeader
        className={cn(intro && 'pb-3')}
        lead={current && (
          <button type="button" className="gicon plain rounded-full md:hidden" onClick={back} aria-label={t('settings.shell.backToList')}>
            <ChevronLeft className="size-6" strokeWidth={1.8} />
          </button>
        )}
        title={<>
          <span className={cn(current && 'max-md:hidden')}>{t('settings.shell.title')}</span>
          {current && <span className="md:hidden">{current.label}</span>}
        </>}
      />
      {intro && <p className={cn('mt-0 mb-6 max-w-[62ch] text-sm text-muted', current && 'max-md:hidden')}>{intro}</p>}

      {/* 和其他页同宽，标题与分栏对齐顶栏图标；右栏限宽，宽屏上设置项不会被拉得太长，右边留白 */}
      <div className="md:grid md:grid-cols-[220px_minmax(0,760px)] md:items-start md:gap-10 lg:grid-cols-[240px_minmax(0,760px)]">
        {/* 电脑：粘在左侧的玻璃分栏；手机：整页列表 */}
        <SettingsNavigation selected={shown.id} singlePage={!!current} basePath={basePath} tabs={tabs} />

        <div className={cn('min-w-0', !current && 'max-md:hidden')}>
          {pending > 0 && (
            <div className="plain mb-8 flex items-center gap-3 rounded-[18px] px-4 py-3 text-sm">
              <TriangleAlert className="size-5 flex-none" strokeWidth={1.8} />
              {t('settings.shell.pendingRestart', { count: pending })}
            </div>
          )}
          {/* 换栏时内容轻轻淡入 */}
          <div key={shown.id} className="rise" style={{ animationDuration: '0.35s' }}>
            <SettingsPageTitle.Provider value={current?.label}>
              <shown.Component />
            </SettingsPageTitle.Provider>
          </div>
        </div>
      </div>
    </div>
  )
}

export function SettingsPage() {
  return <SettingsShell tabs={useVisibleTabs()} />
}
