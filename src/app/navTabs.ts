import { Bell, Compass, History, House, LibraryBig, Settings } from 'lucide-react'

/** 手机底部标签栏和平板左侧导航栏共用的主导航项 */
export const TABS = [
  { to: '/', label: '首页', icon: House, end: true },
  { to: '/library', label: '书库', icon: LibraryBig },
  { to: '/history', label: '历史', icon: History },
  { to: '/updates', label: '更新', icon: Bell },
  { to: '/browse', label: '发现', icon: Compass },
  { to: '/settings', label: '设置', icon: Settings },
]

const tabIndex = (path: string) => TABS.findIndex((t) => (t.end ? path === t.to : path === t.to || path.startsWith(`${t.to}/`)))

let clearTimer: ReturnType<typeof setTimeout> | undefined

/**
 * 点主导航前记下切换方向（按标签顺序：往后的新页从右边滑入，往前的从左边），
 * AppShell 在新页面挂上的同一帧读走并播放滑入。只在主标签之间切换时标记，
 * 进详情页等其他导航不带方向；定时清除是为了导航被拦下时不把方向留给下一次。
 */
export function markNavDirection(from: string, to: string) {
  const a = tabIndex(from)
  const b = tabIndex(to)
  if (a < 0 || b < 0 || a === b) return
  document.documentElement.dataset.navDir = b > a ? 'next' : 'prev'
  clearTimeout(clearTimer)
  clearTimer = setTimeout(() => delete document.documentElement.dataset.navDir, 1500)
}

/** 取走并清除方向；没有则返回 null */
export function takeNavDirection() {
  const dir = document.documentElement.dataset.navDir
  if (!dir) return null
  delete document.documentElement.dataset.navDir
  return dir === 'prev' ? -1 : 1
}
