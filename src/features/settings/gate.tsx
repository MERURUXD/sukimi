import type { ReactNode } from 'react'
import { useCan } from '@/api/auth'
import { t } from '@/i18n'

/*
 * 服务端设置需要 MANAGE_SETTINGS。没有这个权限时服务端返回的是默认值的遮蔽视图，
 * 不是真实配置，所以不能当真实值展示，也不能让人去改：这些选项直接隐藏，并说明原因。
 */
const useCanManageSettings = () => useCan('MANAGE_SETTINGS')

const NOTICE = t('settings.gate.notice')

export function SettingsGate({ children }: { children: ReactNode }) {
  const can = useCanManageSettings()
  return can ? children : <p className="mb-8 max-w-[62ch] text-[13px] leading-snug text-muted">{NOTICE}</p>
}

export function RequireSettings({ children }: { children: ReactNode }) {
  return useCanManageSettings() ? children : null
}

export function SettingsNotice() {
  return useCanManageSettings() ? null : <p className="mb-8 max-w-[62ch] text-[13px] leading-snug text-muted">{NOTICE}</p>
}
