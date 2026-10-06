import { Link, useParams } from 'react-router'
import { PageAmbient } from '@/components/manga/PageAmbient'
import { AppearanceTab } from '@/features/settings/tabs/AppearanceTab'
import { ReaderDefaults } from '@/features/settings/ReaderDefaults'
import { Section } from '@/features/settings/parts'

export function DemoSettings() {
  const { tab = 'appearance' } = useParams()
  return <div className="wrap max-w-[1120px]! pb-24">
    <PageAmbient />
    <h1 className="pt-7 text-[40px] font-black">设置</h1>
    <p className="mb-6 text-sm text-muted">演示设置单独保存在这台设备上，刷新后阅读进度与书库会恢复初始状态。</p>
    <nav aria-label="演示设置" className="mb-8 flex flex-wrap gap-2">
      {[['appearance', '外观'], ['reading', '阅读']].map(([id, label]) =>
        <Link key={id} to={`/settings/${id}`} className="fopt no-underline" aria-current={tab === id ? 'page' : undefined} aria-pressed={tab === id}>{label}</Link>)}
    </nav>
    {tab === 'appearance' ? <AppearanceTab /> : tab === 'reading' ? <Section title="阅读"><ReaderDefaults /></Section> :
      <Section title="演示模式" desc="服务端设置、备份和账户管理需要登录后使用。"><a href="/login" className="solid no-underline">退出演示</a></Section>}
  </div>
}
