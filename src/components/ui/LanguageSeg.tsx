import { useState } from 'react'
import { readLocalePref, setLocalePref, t, type LocalePref } from '@/i18n'
import { Seg } from './Seg'

/** 界面语言切换：设置 → 外观和登录页共用。选定后保存偏好并刷新页面 */
export function LanguageSeg({ glass = false, className }: { glass?: boolean; className?: string }) {
  const [pref] = useState(readLocalePref)
  return (
    <Seg<LocalePref>
      glass={glass}
      label={t('settings.language.label')}
      items={[
        { value: 'system', label: t('settings.language.system') },
        { value: 'zh-CN', label: t('settings.language.zhCN') },
        { value: 'en', label: t('settings.language.en') },
      ]}
      value={pref}
      onChange={setLocalePref}
      className={className}
    />
  )
}
