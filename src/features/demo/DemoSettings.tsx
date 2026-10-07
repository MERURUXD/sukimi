import { Link, useParams } from 'react-router'
import { useAuth } from '@/api/auth'
import { Seg } from '@/components/ui/Seg'
import { PREVIEW_ADMIN, PREVIEW_MEMBER } from '@/features/auth/previewUsers'
import { AppearanceTab } from '@/features/settings/tabs/AppearanceTab'
import { AccountSection } from '@/features/settings/tabs/AccountSection'
import { UsersTab } from '@/features/settings/tabs/UsersTab'
import { ReaderDefaults } from '@/features/settings/ReaderDefaults'
import { Row, Section } from '@/features/settings/parts'

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

export function DemoSettings() {
  const { tab = 'appearance' } = useParams()
  const isAdmin = useAuth((s) => s.user?.roles.includes('ADMIN'))
  const tabs = [['appearance', '外观'], ['reading', '阅读'], ['account', '账户'], ...(isAdmin ? [['users', '用户']] : [])]
  return <div className="wrap max-w-[1120px]! pb-24">
    <h1 className="pt-7 text-[40px] font-black">设置</h1>
    <p className="mb-6 text-sm text-muted">演示设置单独保存在这台设备上，刷新后阅读进度与书库会恢复初始状态。</p>
    <nav aria-label="演示设置" className="mb-8 flex flex-wrap gap-2">
      {tabs.map(([id, label]) =>
        <Link key={id} to={`/settings/${id}`} className="fopt no-underline" aria-current={tab === id ? 'page' : undefined} aria-pressed={tab === id}>{label}</Link>)}
    </nav>
    {tab === 'appearance' ? <AppearanceTab /> : tab === 'reading' ? <Section title="阅读"><ReaderDefaults /></Section> :
      tab === 'account' ? <><DemoIdentity /><AccountSection hideSignOut /></> :
      tab === 'users' && isAdmin ? <UsersTab /> :
      <Section title="演示模式" desc="服务端设置、备份和账户管理需要登录后使用。"><a href="/login" className="solid no-underline">退出演示</a></Section>}
  </div>
}
