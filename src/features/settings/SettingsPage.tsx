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
import { useLayoutEffect, useRef, useState, type ComponentType } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router'
import { useAuth } from '@/api/auth'
import { MotionGlass } from '@/components/glass/Glass'
import { spring } from '@/design/motion'
import { can } from '@/features/auth/permissions'
import { cn } from '@/lib/cn'
import { Section } from './parts'
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

function ReadingTab() {
  return (
    <Section title="阅读" desc="新打开的漫画使用这些默认值；阅读器里的设置面板可以针对单部漫画修改。只保存在这台设备上。">
      <ReaderDefaults />
    </Section>
  )
}

interface Tab {
  id: string
  label: string
  icon: LucideIcon
  desc: string
  Component: ComponentType
  /** 分组只靠留白区分，见 GROUPS */
  group: GroupId
  /** 只有管理用户的账号才看得到；旧服务端没有用户账号，也不显示 */
  adminOnly?: boolean
}

type GroupId = 'personal' | 'content' | 'system'

const GROUPS: { id: GroupId; label: string }[] = [
  { id: 'personal', label: '浏览与阅读' },
  { id: 'content', label: '内容与数据' },
  { id: 'system', label: '服务端与账号' },
]

const TABS: Tab[] = [
  { id: 'appearance', label: '外观', icon: Palette, desc: '主题、玻璃效果、动态背景、NSFW 隐私', Component: AppearanceTab, group: 'personal' },
  { id: 'home', label: '首页', icon: House, desc: '首页布局、内容开关、显示顺序', Component: HomeTab, group: 'personal' },
  { id: 'reading', label: '阅读', icon: BookOpen, desc: '阅读模式、翻页、点击分区', Component: ReadingTab, group: 'personal' },
  { id: 'library', label: '书库', icon: LibraryBig, desc: '分类、自动检查更新', Component: LibraryTab, group: 'personal' },
  { id: 'downloads', label: '下载', icon: Download, desc: '下载目录、自动下载、格式转换', Component: DownloadsTab, group: 'content' },
  { id: 'browse', label: '来源与扩展', icon: Compass, desc: '扩展仓库、Cloudflare、缓存', Component: BrowseTab, group: 'content' },
  { id: 'backup', label: '备份', icon: DatabaseBackup, desc: '备份与恢复、自动备份', Component: BackupTab, group: 'content' },
  { id: 'sync', label: '同步', icon: RefreshCcw, desc: 'SyncYomi、KOReader', Component: SyncTab, group: 'content' },
  { id: 'tracking', label: '追踪', icon: ListChecks, desc: 'AniList、MyAnimeList 等，同步阅读进度', Component: TrackingTab, group: 'content' },
  { id: 'server', label: '服务端', icon: Server, desc: '网络、登录、代理、日志、OPDS', Component: ServerTab, group: 'system' },
  { id: 'users', label: '用户', icon: Users, desc: '邀请新用户、权限、找回码', Component: UsersTab, group: 'system', adminOnly: true },
  { id: 'about', label: '关于', icon: Info, desc: '版本、检查更新、退出登录', Component: AboutTab, group: 'system' },
]

/** 按当前用户的权限筛出能看到的分栏 */
function useVisibleTabs() {
  const user = useAuth((s) => s.user)
  const manageUsers = !!user && !user.legacy && can(user, 'MANAGE_USERS')
  return TABS.filter((t) => !t.adminOnly || manageUsers)
}

/**
 * 不做整块玻璃底板，文字直接放在背景上，分组只靠留白。
 * 电脑：只有选中项是一颗玻璃胶囊，用容器内坐标滑动，页面滚动和 sticky 不会改变动画起点。
 * 手机：整页分组列表，不加玻璃（列表背后没有可折射的内容）。两套结构用断点切换。
 */
export function SettingsNavigation({ selected, singlePage, basePath = '/settings' }: { selected: string; singlePage?: boolean; basePath?: string }) {
  const root = useRef<HTMLDivElement>(null)
  const tabs = useVisibleTabs()
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

  const to = (t: Tab) => `${basePath}/${t.id}`

  return (
    <nav aria-label="设置分栏" className={cn('md:sticky md:top-[calc(var(--nav-h)+12px)]', singlePage && 'max-md:hidden')}>
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
 * 设置：电脑和平板上左侧分栏；手机上先显示分栏列表，点进去是单独一页（可以返回）。
 * 地址是 /settings/<分栏>，没带分栏时电脑上显示第一栏。
 */
export function SettingsPage() {
  const { tab } = useParams()
  const navigate = useNavigate()
  const tabs = useVisibleTabs()
  const current = tabs.find((t) => t.id === tab)
  const shown = current ?? tabs[0]
  const pending = usePendingRestart((s) => s.keys.length)

  if (tab && !current) return <Navigate to="/settings" replace />

  const back = () => ((window.history.state?.idx ?? 0) > 0 ? navigate(-1) : navigate('/settings'))

  return (
    // 设置页没有书库内容，开发安全模式下不打码
    <div className="wrap max-w-[1120px]! pb-24" data-sfw="">
      <div className="flex items-center gap-2 pt-7 pb-6">
        {current && (
          <button type="button" className="gicon plain rounded-full md:hidden" onClick={back} aria-label="返回设置列表">
            <ChevronLeft className="size-6" strokeWidth={1.8} />
          </button>
        )}
        <h1 className="m-0 font-cjk text-[40px] leading-[1.1] font-black">
          <span className={cn(current && 'max-md:hidden')}>设置</span>
          {current && <span className="md:hidden">{current.label}</span>}
        </h1>
      </div>

      <div className="md:grid md:grid-cols-[220px_minmax(0,1fr)] md:items-start md:gap-10 lg:grid-cols-[240px_minmax(0,1fr)]">
        {/* 电脑：粘在左侧的玻璃分栏；手机：整页列表 */}
        <SettingsNavigation selected={shown.id} singlePage={!!current} />

        <div className={cn('min-w-0', !current && 'max-md:hidden')}>
          {pending > 0 && (
            <div className="plain mb-8 flex items-center gap-3 rounded-[18px] px-4 py-3 text-sm">
              <TriangleAlert className="size-5 flex-none" strokeWidth={1.8} />
              有 {pending} 项改动要重启服务端后才生效。
            </div>
          )}
          {/* 换栏时内容轻轻淡入 */}
          <div key={shown.id} className="rise" style={{ animationDuration: '0.35s' }}>
            <shown.Component />
          </div>
        </div>
      </div>
    </div>
  )
}
