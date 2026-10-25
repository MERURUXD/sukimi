import { useQuery } from '@apollo/client/react'
import { useState } from 'react'
import { StaleSessionError } from '@/api/userContext'
import { toastError } from '@/components/ui/toast'
import { Categories } from '@/features/library/queries'
import { Row, Section, Switch } from '@/features/settings/parts'
import { useNsfwActions, useNsfwStore } from './useNsfw'

/** 设置 → 外观里的「隐私」：开关只存在这台设备，单部和分类的标记存在服务端 */
export function NsfwSettings() {
  const { hide, bySource, blur, revealed, set } = useNsfwStore()
  return (
    <Section title="隐私" desc="显示开关仅保存在当前浏览器；单部漫画与分类的 NSFW 标记保存在服务端，跨设备同步。">
      <Row label="隐藏 NSFW 内容" hint="在首页和画廊中隐藏；阅读档案只计数、不显示封面">
        <Switch label="隐藏 NSFW 内容" on={hide} onChange={(v) => set({ hide: v })} />
      </Row>
      <Row
        label="按来源自动标记"
        hint="自动包含标明为 NSFW 的来源"
        help="来源本身标记为 NSFW 时，其中的作品全部视为 NSFW；个别作品可在漫画详情页的「更多」菜单里单独取消。"
      >
        <Switch label="按来源自动标记 NSFW" on={bySource} onChange={(v) => set({ bySource: v })} />
      </Row>
      <Row label="其他列表模糊封面" hint="书库、更新和阅读历史中模糊封面，悬停或聚焦时看清">
        <Switch label="其他列表模糊 NSFW 封面" on={blur} onChange={(v) => set({ blur: v })} />
      </Row>
      <Row
        label="临时显示全部"
        hint={
          <>
            刷新页面后恢复隐藏；也可在任意页面按 <kbd className="font-sans font-semibold text-text">Shift + H</kbd> 切换
          </>
        }
      >
        <Switch label="临时显示全部 NSFW 内容" on={revealed} onChange={(v) => set({ revealed: v })} />
      </Row>
      <NsfwCategories />
    </Section>
  )
}

function NsfwCategories() {
  const { data } = useQuery(Categories)
  const marked = useNsfwStore((s) => s.marks.categories)
  const { setCategory } = useNsfwActions()
  const [busy, setBusy] = useState<number | null>(null)
  const cats = (data?.categories.nodes ?? []).filter((c) => !c.default)
  if (!cats.length) return null
  const toggle = async (id: number, on: boolean) => {
    setBusy(id)
    try {
      await setCategory(id, on)
    } catch (e) {
      if (!(e instanceof StaleSessionError)) toastError('修改分类失败', e)
    } finally {
      setBusy(null)
    }
  }
  return (
    <>
      <h3 className="m-0 mt-2 text-base font-bold">整个分类视为 NSFW</h3>
      {cats.map((c) => (
        <Row key={c.id} label={c.name}>
          <Switch label={`分类「${c.name}」视为 NSFW`} on={marked.includes(c.id)} disabled={busy === c.id} onChange={(v) => void toggle(c.id, v)} />
        </Row>
      ))}
    </>
  )
}
