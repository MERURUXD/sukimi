import { Outlet, Link } from 'react-router'
import { ConfirmHost } from '@/components/ui/Confirm'
import { Toaster } from '@/components/ui/toast'
import { Glass } from '@/components/glass/Glass'
import { PreviewBadge } from '@/app/PreviewBadge'
import { useApplyAppearance } from '@/design/settings'
import { NsfwSync } from '@/features/nsfw/useNsfw'

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
    <h1 className="m-0 text-3xl font-bold">这项功能需要连接服务端</h1>
    <p className="m-0 text-muted">演示中可以体验首页、书库、发现、更新、阅读历史和阅读器，所有内容都是虚构的。</p>
    <Link to="/" className="solid no-underline">返回演示首页</Link>
  </div>
}

export function DemoNotice() {
  return <Glass data-vt-glass="topnav-demo" className="flex items-center gap-2 rounded-full px-3 py-2 text-xs">
    <span className="font-semibold">演示模式</span>
    <a href="/login" className="text-muted no-underline hover:text-text">退出演示</a>
  </Glass>
}
