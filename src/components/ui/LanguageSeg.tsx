import { useState } from 'react'
import { readLocalePref, setLocalePref, t, type LocalePref } from '@/i18n'
import { Seg } from './Seg'

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
