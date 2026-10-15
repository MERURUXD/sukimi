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
    <Section title="隐私" desc="NSFW 作品在首页和画廊里不出现，阅读档案只计数、不显示封面。下面的开关只保存在这台设备上；哪些作品和分类算 NSFW 存在服务端，换设备也一样。">
      <Row label="隐藏 NSFW 内容" hint="关闭后首页和画廊照常显示全部作品">
        <Switch label="隐藏 NSFW 内容" on={hide} onChange={(v) => set({ hide: v })} />
      </Row>
      <Row label="按来源自动标记" hint="来源本身标明是 NSFW 的，其中的作品都算；个别作品可以在详情页的「更多」里单独取消">
        <Switch label="按来源自动标记 NSFW" on={bySource} onChange={(v) => set({ bySource: v })} />
      </Row>
      <Row label="其他列表模糊封面" hint="书库、更新和阅读历史里，NSFW 作品的封面会模糊；用鼠标指上去可以看清">
        <Switch label="其他列表模糊 NSFW 封面" on={blur} onChange={(v) => set({ blur: v })} />
      </Row>
      <Row label="临时显示全部" hint={<>在任意页面按 <kbd className="font-sans font-semibold text-text">Shift + H</kbd> 也能切换。刷新页面后恢复隐藏</>}>
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
