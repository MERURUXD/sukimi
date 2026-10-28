import { useQuery } from '@apollo/client/react'
import { useState } from 'react'
import { StaleSessionError } from '@/api/userContext'
import { toastError } from '@/components/ui/toast'
import { Categories } from '@/features/library/queries'
import { Row, Section, Switch } from '@/features/settings/parts'
import { useNsfwActions, useNsfwStore } from './useNsfw'
import { t } from '@/i18n'

/** 设置 → 外观里的「隐私」：开关只存在这台设备，单部和分类的标记存在服务端 */
export function NsfwSettings() {
  const { hide, bySource, blur, revealed, set } = useNsfwStore()
  return (
    <Section title={t('settings.nsfw.title')} desc={t('settings.nsfw.desc')}>
      <Row label={t('settings.nsfw.hide')} hint={t('settings.nsfw.hideHint')}>
        <Switch label={t('settings.nsfw.hide')} on={hide} onChange={(v) => set({ hide: v })} />
      </Row>
      <Row
        label={t('settings.nsfw.bySource')}
        hint={t('settings.nsfw.bySourceHint')}
        help={t('settings.nsfw.bySourceHelp')}
      >
        <Switch label={t('settings.nsfw.bySourceAria')} on={bySource} onChange={(v) => set({ bySource: v })} />
      </Row>
      <Row label={t('settings.nsfw.blur')} hint={t('settings.nsfw.blurHint')}>
        <Switch label={t('settings.nsfw.blurAria')} on={blur} onChange={(v) => set({ blur: v })} />
      </Row>
      <Row
        label={t('settings.nsfw.reveal')}
        hint={
          <>
            {t('settings.nsfw.revealHintBefore')}<kbd className="font-sans font-semibold text-text">Shift + H</kbd>{t('settings.nsfw.revealHintAfter')}
          </>
        }
      >
        <Switch label={t('settings.nsfw.revealAria')} on={revealed} onChange={(v) => set({ revealed: v })} />
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
      if (!(e instanceof StaleSessionError)) toastError(t('settings.nsfw.categoryFailed'), e)
    } finally {
      setBusy(null)
    }
  }
  return (
    <>
      <h3 className="m-0 mt-2 text-base font-bold">{t('settings.nsfw.categoriesTitle')}</h3>
      {cats.map((c) => (
        <Row key={c.id} label={c.name}>
          <Switch label={t('settings.nsfw.categoryAria', { name: c.name })} on={marked.includes(c.id)} disabled={busy === c.id} onChange={(v) => void toggle(c.id, v)} />
        </Row>
      ))}
    </>
  )
}
