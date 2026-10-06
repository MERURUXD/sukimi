import { Bell, Compass, House, LibraryBig, Settings } from 'lucide-react'

/** 手机底部标签栏和平板左侧导航栏共用的主导航项 */
export const TABS = [
  { to: '/', label: '首页', icon: House, end: true },
  { to: '/library', label: '书库', icon: LibraryBig },
  { to: '/updates', label: '更新', icon: Bell },
  { to: '/browse', label: '发现', icon: Compass },
  { to: '/settings', label: '设置', icon: Settings },
]
