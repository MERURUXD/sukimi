import { motion } from 'motion/react'
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Compass,
  DatabaseBackup,
  Download,
  Info,
  LibraryBig,
  ListChecks,
  Palette,
  RefreshCcw,
  Server,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react'
import { useLayoutEffect, useRef, useState, type ComponentType } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router'
import { Glass } from '@/components/glass/Glass'
import { spring } from '@/design/motion'
import { cn } from '@/lib/cn'
import { Section } from './parts'
import { ReaderDefaults } from './ReaderDefaults'
import { usePendingRestart } from './server'
import { AboutTab } from './tabs/AboutTab'
import { AppearanceTab } from './tabs/AppearanceTab'
import { BackupTab } from './tabs/BackupTab'
import { BrowseTab } from './tabs/BrowseTab'
import { DownloadsTab } from './tabs/DownloadsTab'
import { LibraryTab } from './tabs/LibraryTab'
import { ServerTab } from './tabs/ServerTab'
import { SyncTab } from './tabs/SyncTab'
import { TrackingTab } from './tabs/TrackingTab'

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
}

const TABS: Tab[] = [
  { id: 'appearance', label: '外观', icon: Palette, desc: '主题、玻璃效果、首页布局', Component: AppearanceTab },
  { id: 'reading', label: '阅读', icon: BookOpen, desc: '阅读模式、翻页、点击分区', Component: ReadingTab },
  { id: 'library', label: '书库', icon: LibraryBig, desc: '分类、自动检查更新', Component: LibraryTab },
  { id: 'downloads', label: '下载', icon: Download, desc: '下载目录、自动下载、格式转换', Component: DownloadsTab },
  { id: 'browse', label: '来源与扩展', icon: Compass, desc: '扩展仓库、Cloudflare、缓存', Component: BrowseTab },
  { id: 'backup', label: '备份', icon: DatabaseBackup, desc: '备份与恢复、自动备份', Component: BackupTab },
  { id: 'sync', label: '同步', icon: RefreshCcw, desc: 'SyncYomi、KOReader', Component: SyncTab },
  { id: 'tracking', label: '追踪', icon: ListChecks, desc: 'AniList、MyAnimeList 等，同步阅读进度', Component: TrackingTab },
  { id: 'server', label: '服务器', icon: Server, desc: '网络、登录、代理、日志、OPDS', Component: ServerTab },
  { id: 'about', label: '关于', icon: Info, desc: '版本、检查更新、退出登录', Component: AboutTab },
]

/** 选中块使用玻璃容器内的坐标，页面滚动和 sticky 不会改变动画起点。 */
export function SettingsNavigation({ selected, singlePage, basePath = '/settings' }: { selected: string; singlePage?: boolean; basePath?: string }) {
  const root = useRef<HTMLElement>(null)
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

  return (
    <nav aria-label="设置分栏" className={cn('md:sticky md:top-[calc(var(--nav-h)+12px)]', singlePage && 'max-md:hidden')}>
      <Glass ref={root} className="isolate flex flex-col gap-0.5 rounded-[22px] p-1.5 max-md:rounded-[26px]">
        {highlight && <motion.span aria-hidden initial={false} animate={highlight} transition={spring.fast} className="pointer-events-none absolute top-0 right-1.5 left-1.5 -z-10 rounded-[16px] bg-g-hi shadow-[inset_0_0_0_1px_var(--g-glow)] max-md:hidden" />}
        {TABS.map((t) => {
          const on = t.id === selected
          return (
            <Link key={t.id} to={`${basePath}/${t.id}`} replace={!!singlePage} aria-current={on ? 'page' : undefined}
              className={cn('relative flex min-h-11 items-center gap-3 rounded-[16px] px-3 text-text no-underline transition-colors max-md:min-h-[60px]', !on && 'hover:bg-hover', on ? 'font-semibold' : 'md:text-muted md:hover:text-text')}>
              <t.icon className="size-5 flex-none" strokeWidth={1.8} />
              <span className="flex min-w-0 flex-1 flex-col">
                {t.label}
                <span className="truncate text-xs font-normal text-muted md:hidden">{t.desc}</span>
              </span>
              <ChevronRight className="size-5 text-faint md:hidden" />
            </Link>
          )
        })}
      </Glass>
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
  const current = TABS.find((t) => t.id === tab)
  const shown = current ?? TABS[0]
  const pending = usePendingRestart((s) => s.keys.length)

  if (tab && !current) return <Navigate to="/settings" replace />

  const back = () => ((window.history.state?.idx ?? 0) > 0 ? navigate(-1) : navigate('/settings'))

  return (
    // 设置页没有书库内容，开发安全模式下不打码
    <div className="wrap max-w-[1120px]! pb-24" data-sfw="">
      <div className="flex items-center gap-2 pt-7 pb-6">
        {current && (
          <Glass as="button" type="button" className="gicon rounded-full md:hidden" onClick={back} aria-label="返回设置列表">
            <ChevronLeft className="size-6" strokeWidth={1.8} />
          </Glass>
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
            <Glass className="mb-8 flex items-center gap-3 rounded-[18px] px-4 py-3 text-sm">
              <TriangleAlert className="size-5 flex-none" strokeWidth={1.8} />
              有 {pending} 项改动要重启服务端后才生效。
            </Glass>
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
