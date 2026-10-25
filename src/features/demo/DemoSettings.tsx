import { BookOpen, House, Palette, UserRound, Users } from 'lucide-react'
import { useAuth } from '@/api/auth'
import { Seg } from '@/components/ui/Seg'
import { PREVIEW_ADMIN, PREVIEW_MEMBER } from '@/features/auth/previewUsers'
import { ReaderDefaults } from '@/features/settings/ReaderDefaults'
import { Row, Section } from '@/features/settings/parts'
import { SettingsShell, type SettingsTab } from '@/features/settings/SettingsPage'
import { AccountSection } from '@/features/settings/tabs/AccountSection'
import { AppearanceTab } from '@/features/settings/tabs/AppearanceTab'
import { HomeTab } from '@/features/settings/tabs/HomeTab'
import { UsersTab } from '@/features/settings/tabs/UsersTab'

/** 演示里切换虚构身份，看管理员与普通用户各自能看到什么；只改内存，刷新后回到管理员 */
function DemoIdentity() {
  const id = useAuth((s) => s.user?.id)
  return <Section title="演示身份" desc="两个都是虚构用户。切换后，设置里的「用户」页、下载入口等会按权限显示或隐藏。">
    <Row label="当前身份">
      <Seg glass={false} label="演示身份" value={id === PREVIEW_MEMBER.id ? 'member' : 'admin'}
        onChange={(v) => useAuth.setState({ user: v === 'member' ? PREVIEW_MEMBER : PREVIEW_ADMIN })}
        items={[{ value: 'admin', label: '管理员' }, { value: 'member', label: '普通用户' }]} />
    </Row>
  </Section>
}

function ReadingTab() {
  return <ReaderDefaults />
}

function AccountTab() {
  return <><DemoIdentity /><AccountSection hideSignOut /></>
}

/** 与正式设置共用外壳（左侧分栏、手机列表），分栏只留演示数据能跑的几项 */
const TABS: SettingsTab[] = [
  { id: 'appearance', label: '外观', icon: Palette, desc: '主题、玻璃效果、动态背景、NSFW 隐私', Component: AppearanceTab, group: 'personal' },
  { id: 'home', label: '首页', icon: House, desc: '首页布局、内容开关、显示顺序', Component: HomeTab, group: 'personal' },
  { id: 'reading', label: '阅读', icon: BookOpen, desc: '阅读模式、翻页、点击分区', Component: ReadingTab, group: 'personal' },
  { id: 'account', label: '账号', icon: UserRound, desc: '演示身份、修改密码', Component: AccountTab, group: 'system' },
  { id: 'users', label: '用户', icon: Users, desc: '邀请新用户、权限、找回码', Component: UsersTab, group: 'system', adminOnly: true },
]

export function DemoSettings() {
  const isAdmin = useAuth((s) => s.user?.roles.includes('ADMIN'))
  return <SettingsShell tabs={TABS.filter((t) => !t.adminOnly || isAdmin)}
    intro={<>演示设置单独保存在这台设备上，刷新后阅读进度与书库会恢复初始状态。服务端设置、备份和账号管理需要登录后使用。<a href="/login" className="ml-1 text-text">退出演示</a></>} />
}
