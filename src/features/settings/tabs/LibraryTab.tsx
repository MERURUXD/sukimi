import { CategoryManager } from '../CategoryManager'
import { SChoice, SSwitch } from '../fields'
import { useLibraryView } from '@/features/library/store'
import { Row, Section, Switch } from '../parts'
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
  const laterAutoRemove = useLibraryView((s) => s.laterAutoRemove)
  const setLaterAutoRemove = useLibraryView((s) => s.setLaterAutoRemove)
  return (
    <>
      <SettingsNotice />
      <Section title="分类" desc="书库按分类分组；漫画可以属于多个分类。">
        <CategoryManager />
      </Section>

      <Section title="稍后再看" desc="在书库的「稍后再看」标签里查看。列表存在服务端，换设备也一样。">
        <Row label="读完后自动移出" hint="加入之后把已有章节都读完，就从稍后再看里移出。只影响这台设备上的判断。">
          <Switch label="读完后自动移出稍后再看" on={laterAutoRemove} onChange={setLaterAutoRemove} />
        </Row>
      </Section>

      <Section title="自动检查更新" desc="服务端定时检查书库里的漫画有没有新章节。手动检查在书库页和更新页。跳过规则只影响你自己的账号。">
        <RequireSettings>
          <SChoice<number> k="globalUpdateInterval" label="检查频率" options={INTERVALS} hint="所有用户共用" />
        </RequireSettings>
        <SSwitch k="excludeUnreadChapters" label="跳过有未读章节的漫画" hint="还有没读完的，就先不查新章节" />
        <SSwitch k="excludeNotStarted" label="跳过还没开始读的漫画" />
        <SSwitch k="excludeCompleted" label="跳过已完结的漫画" />
        <SSwitch k="updateMangas" label="同时刷新漫画信息和封面" hint="检查章节时顺便更新简介、作者、封面，会更慢" />
      </Section>
    </>
  )
}
