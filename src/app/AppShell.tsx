import { Navigate, Outlet, useLocation, useMatch } from 'react-router'
import { cn } from '@/lib/cn'
import { restoreSession, useAuth } from '@/api/auth'
import { LiveStatus } from '@/api/live'
import { ConfirmHost } from '@/components/ui/Confirm'
import { Toaster } from '@/components/ui/toast'
import { useApplyAppearance } from '@/design/settings'
import { MobileTabBar } from './MobileTabBar'
import { ScrollManager } from './ScrollManager'
import { SideNav } from './SideNav'
import { TopNav } from './TopNav'
import { UpdatePrompt } from './UpdatePrompt'

/** 需要登录的页面外壳：未登录跳登录页，连不上服务器给重试 */
export function AuthGate() {
  useApplyAppearance()
  const status = useAuth((s) => s.status)
  const userId = useAuth((s) => s.user?.id)
  const location = useLocation()

  if (status === 'checking') return null
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
      <LiveStatus key={userId} />
    </>
  )
}

/** 常规页面布局：手机底部标签栏，平板左侧导航栏，桌面顶部导航 */
export function AppShell() {
  // 详情页在手机上不显示底部标签栏（返回键在左上角，底部留给批量栏）
  const tabbar = !useMatch('/manga/:id/*')
  const { pathname } = useLocation()
  return (
    <div className={cn('app-shell relative isolate min-h-dvh', tabbar && 'has-tabbar')}>
      <TopNav />
      <SideNav />
      {/* 导航悬浮在内容之上；详情页的封面背景会延伸到导航下面 */}
      {/* data-page-path：封面飞回动画用来判断「从哪页回到哪页」，见 lib/coverTransition */}
      <main className="pt-[var(--nav-h)] pb-[var(--tabbar-h)]" data-page-path={pathname}>
        <Outlet />
      </main>
      {tabbar && <MobileTabBar />}
      <UpdatePrompt />
      <ScrollManager />
    </div>
  )
}
