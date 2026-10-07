import type { ReactNode } from 'react'
import { useCan } from '@/api/auth'

/*
 * 服务端设置需要 MANAGE_SETTINGS。没有这个权限时服务端返回的是默认值的遮蔽视图，
 * 不是真实配置，所以不能当真实值展示，也不能让人去改：这些选项直接隐藏，并说明原因。
 */
const useCanManageSettings = () => useCan('MANAGE_SETTINGS')

const NOTICE = '你没有「管理服务端设置」的权限，服务端选项已隐藏。需要的话请联系管理员。'

/** 整页都是服务端设置：没有权限就只显示说明 */
export function SettingsGate({ children }: { children: ReactNode }) {
  const can = useCanManageSettings()
  return can ? children : <p className="text-muted">{NOTICE}</p>
}

/** 一整块服务端设置：没有权限就隐藏 */
export function RequireSettings({ children }: { children: ReactNode }) {
  return useCanManageSettings() ? children : null
}

/** 页内混有个人内容与服务端设置时，在顶部给一行说明 */
export function SettingsNotice() {
  return useCanManageSettings() ? null : <p className="text-muted">{NOTICE}</p>
}
