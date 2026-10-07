import { CategoryManager } from '../CategoryManager'
import { SChoice, SSwitch } from '../fields'
import { Section } from '../parts'
import { RequireSettings, SettingsNotice } from '../gate'

const INTERVALS = [
  { value: 0, label: '关闭' },
  { value: 6, label: '每 6 小时' },
  { value: 12, label: '每 12 小时' },
  { value: 24, label: '每天' },
  { value: 48, label: '每 2 天' },
  { value: 72, label: '每 3 天' },
  { value: 168, label: '每周' },
]

export function LibraryTab() {
  return (
    <>
      <SettingsNotice />
      <Section title="分类" desc="书库按分类分组；漫画可以属于多个分类。">
        <CategoryManager />
      </Section>

      <RequireSettings>
        <Section title="自动检查更新" desc="服务端定时检查书库里的漫画有没有新章节。手动检查在书库页和更新页。">
          <SChoice<number> k="globalUpdateInterval" label="检查频率" options={INTERVALS} />
          <SSwitch k="excludeUnreadChapters" label="跳过有未读章节的漫画" hint="还有没读完的，就先不查新章节" />
          <SSwitch k="excludeNotStarted" label="跳过还没开始读的漫画" />
          <SSwitch k="excludeCompleted" label="跳过已完结的漫画" />
          <SSwitch k="updateMangas" label="同时刷新漫画信息和封面" hint="检查章节时顺便更新简介、作者、封面，会更慢" />
        </Section>
      </RequireSettings>
    </>
  )
}
