import { BookOpen, House, LibraryBig, Palette, UserRound, Users } from 'lucide-react'
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
import { TagManager } from '@/features/tags/TagManager'
import { t } from '@/i18n'

/** 演示里切换虚构身份，看管理员与普通用户各自能看到什么；只改内存，刷新后回到管理员 */
function DemoIdentity() {
  const id = useAuth((s) => s.user?.id)
  return <Section title={t('misc.demo.identityTitle')} desc={t('misc.demo.identityDesc')}>
    <Row label={t('misc.demo.identityRow')}>
      <Seg glass={false} label={t('misc.demo.identityAria')} value={id === PREVIEW_MEMBER.id ? 'member' : 'admin'}
        onChange={(v) => useAuth.setState({ user: v === 'member' ? PREVIEW_MEMBER : PREVIEW_ADMIN })}
        items={[{ value: 'admin', label: t('misc.demo.admin') }, { value: 'member', label: t('misc.demo.member') }]} />
    </Row>
  </Section>
}

function ReadingTab() {
  return <ReaderDefaults />
}

/** 正式的书库分栏要连服务端设置，演示里只放能用虚构数据跑的标签管理 */
function LibraryTab() {
  return <Section title={t('misc.tags.title')} desc={t('misc.tags.manageDesc')} help={t('misc.tags.manageHelp')}><TagManager /></Section>
}

function AccountTab() {
  return <><DemoIdentity /><AccountSection hideSignOut /></>
}

/** 与正式设置共用外壳（左侧分栏、手机列表），分栏只留演示数据能跑的几项 */
const TABS: SettingsTab[] = [
  { id: 'appearance', label: t('settings.tabs.appearance.label'), icon: Palette, desc: t('settings.tabs.appearance.desc'), Component: AppearanceTab, group: 'personal' },
  { id: 'home', label: t('settings.tabs.home.label'), icon: House, desc: t('settings.tabs.home.desc'), Component: HomeTab, group: 'personal' },
  { id: 'reading', label: t('settings.tabs.reading.label'), icon: BookOpen, desc: t('settings.tabs.reading.desc'), Component: ReadingTab, group: 'personal' },
  { id: 'library', label: t('settings.tabs.library.label'), icon: LibraryBig, desc: t('settings.tabs.library.desc'), Component: LibraryTab, group: 'personal' },
  { id: 'account', label: t('settings.tabs.account.label'), icon: UserRound, desc: t('settings.tabs.account.desc'), Component: AccountTab, group: 'system' },
  { id: 'users', label: t('settings.tabs.users.label'), icon: Users, desc: t('settings.tabs.users.desc'), Component: UsersTab, group: 'system', adminOnly: true },
]

export function DemoSettings() {
  const isAdmin = useAuth((s) => s.user?.roles.includes('ADMIN'))
  return <SettingsShell tabs={TABS.filter((tab) => !tab.adminOnly || isAdmin)}
    intro={<>{t('misc.demo.settingsIntro')}<a href="/login" className="ml-1 text-text">{t('misc.demo.exit')}</a></>} />
}
