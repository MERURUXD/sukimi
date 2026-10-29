import { CategoryManager } from '../CategoryManager'
import { SChoice, SSwitch } from '../fields'
import { useLibraryView } from '@/features/library/store'
import { TagManager } from '@/features/tags/TagManager'
import { Row, Section, Switch } from '../parts'
import { RequireSettings, SettingsNotice } from '../gate'
import { t } from '@/i18n'

const INTERVALS = [
  { value: 0, label: t('cfg.lib.off') },
  { value: 6, label: t('cfg.lib.h6') },
  { value: 12, label: t('cfg.lib.h12') },
  { value: 24, label: t('cfg.lib.daily') },
  { value: 48, label: t('cfg.lib.d2') },
  { value: 72, label: t('cfg.lib.d3') },
  { value: 168, label: t('cfg.lib.weekly') },
]

export function LibraryTab() {
  const laterAutoRemove = useLibraryView((s) => s.laterAutoRemove)
  const setLaterAutoRemove = useLibraryView((s) => s.setLaterAutoRemove)
  return (
    <>
      <SettingsNotice />
      <Section title={t('cfg.lib.cats')} desc={t('cfg.lib.catsDesc')}>
        <CategoryManager />
      </Section>

      <Section title={t('misc.tags.title')} desc={t('misc.tags.manageDesc')}>
        <TagManager />
      </Section>

      <Section title={t('home.section.later')} desc={t('cfg.lib.laterDesc')}>
        <Row label={t('cfg.lib.autoRemove')} hint={t('cfg.lib.autoRemoveHint')}>
          <Switch label={t('cfg.lib.autoRemoveLabel')} on={laterAutoRemove} onChange={setLaterAutoRemove} />
        </Row>
      </Section>

      <Section title={t('cfg.lib.updTitle')} desc={t('cfg.lib.updDesc')}>
        <RequireSettings>
          <SChoice<number> k="globalUpdateInterval" label={t('cfg.lib.freq')} options={INTERVALS} hint={t('cfg.lib.freqHint')} />
        </RequireSettings>
        <SSwitch k="excludeUnreadChapters" label={t('cfg.lib.skipUnread')} />
        <SSwitch k="excludeNotStarted" label={t('cfg.lib.skipNotStarted')} />
        <SSwitch k="excludeCompleted" label={t('cfg.lib.skipDone')} />
        <SSwitch k="updateMangas" label={t('cfg.lib.refreshInfo')} hint={t('cfg.lib.refreshInfoHint')} />
      </Section>
    </>
  )
}
