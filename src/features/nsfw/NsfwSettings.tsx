import { useQuery } from '@apollo/client/react'
import { useState } from 'react'
import { StaleSessionError } from '@/api/userContext'
import { toastError } from '@/components/ui/toast'
import { langLabel, Sources } from '@/features/browse/queries'
import { Categories } from '@/features/library/queries'
import { Row, Section, Switch } from '@/features/settings/parts'
import { shelfIds, withoutShelf } from '@/features/shelf/shelf'
import { useNsfwActions, useNsfwStore } from './useNsfw'
import { t } from '@/i18n'

/** 设置 → 外观里的「隐私」：开关只存在这台设备，单部、分类和来源的标记存在服务端 */
export function NsfwSettings() {
  const { hide, blur, revealed, set } = useNsfwStore()
  return (
    <Section title={t('settings.nsfw.title')} desc={t('settings.nsfw.desc')} help={t('settings.nsfw.help')}>
      <Row label={t('settings.nsfw.hide')} hint={t('settings.nsfw.hideHint')}>
        <Switch label={t('settings.nsfw.hide')} on={hide} onChange={(v) => set({ hide: v })} />
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
      <NsfwSources />
    </Section>
  )
}

function NsfwCategories() {
  const { data } = useQuery(Categories)
  const marked = useNsfwStore((s) => s.marks.categories)
  const { setCategory } = useNsfwActions()
  const [busy, setBusy] = useState<number | null>(null)
  const nodes = data?.categories.nodes ?? []
  const cats = withoutShelf(nodes, shelfIds(nodes)).filter((c) => !c.default)
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

function NsfwSources() {
  const { data } = useQuery(Sources)
  const marked = useNsfwStore((s) => s.marks.sources)
  const { setSource } = useNsfwActions()
  const [busy, setBusy] = useState<string | null>(null)
  const sources = [...(data?.sources.nodes ?? [])]
    .filter((s) => s.id !== '0')
    .sort((a, b) => a.displayName.localeCompare(b.displayName))
  if (!sources.length) return null
  const toggle = async (id: string, on: boolean) => {
    setBusy(id)
    try {
      await setSource(id, on)
    } catch (e) {
      if (!(e instanceof StaleSessionError)) toastError(t('settings.nsfw.sourceFailed'), e)
    } finally {
      setBusy(null)
    }
  }
  return (
    <>
      <h3 className="m-0 mt-2 text-base font-bold">{t('settings.nsfw.sourcesTitle')}</h3>
      <p className="m-0 -mt-1.5 text-xs text-muted">{t('settings.nsfw.sourcesHelp')}</p>
      {sources.map((s) => (
        <Row key={s.id} label={s.displayName} hint={langLabel(s.lang)}>
          <Switch label={t('settings.nsfw.sourceAria', { name: s.displayName })} on={marked.includes(s.id)} disabled={busy === s.id} onChange={(v) => void toggle(s.id, v)} />
        </Row>
      ))}
    </>
  )
}
