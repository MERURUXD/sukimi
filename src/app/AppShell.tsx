import { useEffect, useLayoutEffect, useRef } from 'react'
import { Navigate, Outlet, useLocation, useMatch } from 'react-router'
import { cn } from '@/lib/cn'
import { isDevLab } from '@/lib/demo'
import { restoreSession, useAuth } from '@/api/auth'
import { LiveStatus } from '@/api/live'
import { useSnapshots } from '@/api/persist'
import { LegacyMetasMigrate } from '@/features/auth/LegacyMetasMigrate'
import { showBeforeVerified } from '@/features/auth/userScope'
import { ConfirmHost } from '@/components/ui/Confirm'
import { Toaster } from '@/components/ui/toast'
import { useApplyAppearance } from '@/design/settings'
import { NsfwSync } from '@/features/nsfw/useNsfw'
import { useReaderPreload } from '@/features/reader/preload'
import { MobileTabBar } from './MobileTabBar'
import { PreviewBadge } from './PreviewBadge'
import { takeNavDirection } from './navTabs'
import { ScrollManager } from './ScrollManager'
import { SideNav } from './SideNav'
import { TopNav } from './TopNav'
import { UpdatePrompt } from './UpdatePrompt'
import { AwayPrompt } from '@/features/favorite/AwayPrompt'
import { MovingGlassBackdrop } from '@/components/glass/MovingGlassBackdrop'

/** 需要登录的页面外壳：未登录跳登录页，连不上服务器给重试 */
export function AuthGate() {
  useApplyAppearance()
  const status = useAuth((s) => s.status)
  const userId = useAuth((s) => s.user?.id)
  const location = useLocation()
  const snapshotsLoaded = useSnapshots((s) => s.loaded)
  // 重开页面时首页、书库、更新页先用上次的快照显示，登录验证在后台进行（往返服务端要零点几秒到一秒多）
  const early = showBeforeVerified(status, userId, snapshotsLoaded, location.pathname)
  // 虚构验收页启动时用虚构用户、没有恢复登录；从验收页里的链接站内跳进正式页面时整页重新加载，走正常的登录恢复
  const href = location.pathname + location.search + location.hash
  useEffect(() => {
    if (isDevLab) window.location.assign(href)
  }, [href])

  if (isDevLab) return null
  if (status === 'checking' && !early) return null
  if (status === 'signedOut') return <Navigate to="/login" replace state={{ from: location }} />
  if (status === 'unreachable') {
    return (
      <div className="grid min-h-dvh place-items-center px-4 text-center">
        <div>
          <p className="text-lg font-semibold">连不上 Suwayomi 服务器</p>
          <p className="mt-1 text-muted">确认服务端已启动后重试。</p>
          <button className="solid mt-6" onClick={() => void restoreSession()}>
            重试
          </button>
        </div>
      </div>
    )
  }
  return (
    <>
      {/* 换账号时整树重建，各页面与订阅不会带着上一个用户的状态 */}
      <Outlet key={userId} />
      <Toaster />
      <ConfirmHost />
      {/* 挂在这里而不是 AppShell：阅读器等全屏页同样会写真实数据，也要看得到 */}
      <PreviewBadge />
      {/* 和上面的 Outlet 同在一层，key 不能重复 */}
      <LiveStatus key={`live-${userId}`} />
      <NsfwSync key={`nsfw-${userId}`} />
      <LegacyMetasMigrate key={`legacy-${userId}`} />
    </>
  )
}

/** 常规页面布局：手机底部标签栏，平板左侧导航栏，桌面顶部导航 */
export function AppShell() {
  // 详情页在手机上不显示底部标签栏（返回键在左上角，底部留给批量栏）
  const tabbar = !useMatch('/manga/:id/*')
  const { pathname } = useLocation()
  const main = useRef<HTMLElement>(null)
  useReaderPreload()

  // 主标签之间切换：新页面带一点水平滑入，淡入淡出由整页过渡负责。
  // 只用位移不用透明度，祖先的透明度会让里面玻璃的背景采样失效；导航栏不在 main 里，保持不动
  useLayoutEffect(() => {
    const dir = takeNavDirection()
    if (!dir || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    main.current?.animate([{ translate: `${dir * 28}px 0` }, { translate: '0 0' }], { duration: 340, easing: 'cubic-bezier(0.2, 0, 0, 1)' })
  }, [pathname])

  return (
    // overflow-x: clip：滑入时 main 暂时比屏幕宽，不能撑出横向滚动条
    <MovingGlassBackdrop value={pathname.startsWith('/library/gallery') ? 'suspend' : pathname === '/'}>
    <div className={cn('app-shell relative isolate min-h-dvh overflow-x-clip', tabbar && 'has-tabbar')}>
      <TopNav />
      <SideNav />
      {/* 导航悬浮在内容之上；详情页的封面背景会延伸到导航下面 */}
      {/* data-page-path：封面飞回动画用来判断「从哪页回到哪页」，见 lib/coverTransition */}
      <main ref={main} className="pt-[var(--nav-h)] pb-[var(--tabbar-h)]" data-page-path={pathname}>
        <Outlet />
      </main>
      {tabbar && <MobileTabBar />}
      <UpdatePrompt />
      <AwayPrompt />
      <ScrollManager />
    </div>
    </MovingGlassBackdrop>
  )
}
