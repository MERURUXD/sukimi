import { RotateCcw } from 'lucide-react'
import { supportsRefract } from '@/components/glass/refract'
import { GlassPreview, GlassSliders } from '@/components/settings/GlassTuner'
import { Seg } from '@/components/ui/Seg'
import { useGlassTuning } from '@/design/glassTuning'
import { useAppearance } from '@/design/settings'
import { NsfwSettings } from '@/features/nsfw/NsfwSettings'
import { Dropdown, Row, Section, Switch } from '../parts'
import { ThumbPicker, GlassThumb, ThemeThumb } from '../thumbs'
import { readLocalePref, setLocalePref, t, type LocalePref } from '@/i18n'

export function AppearanceTab() {
  const {
    theme, glass, mangaDetailMotion, readerMotion, autoHideNav, navBlur, homeMotionBg, homeIntro,
    setTheme, setGlass, setMangaDetailMotion, setReaderMotion, setAutoHideNav, setNavBlur, setHomeMotionBg, setHomeIntro,
  } = useAppearance()
  const reset = useGlassTuning((s) => s.reset)
  const tone = useGlassTuning((s) => s.tone)
  const switchPreset = useGlassTuning((s) => s.switchPreset)
  const glassTheme = useGlassTuning((s) => s.theme)
  const canRefract = supportsRefract()

  return (
    <>
      <Section title={t('settings.appearance.title')} desc={t('settings.appearance.desc')}>
        <Row label={t('settings.language.label')} hint={t('settings.language.hint')}>
          <Dropdown<LocalePref>
            label={t('settings.language.label')}
            className="min-w-[160px]"
            options={[
              { value: 'system', label: t('settings.language.system') },
              { value: 'zh-CN', label: t('settings.language.zhCN') },
              { value: 'en', label: t('settings.language.en') },
            ]}
            value={readLocalePref()}
            onChange={setLocalePref}
          />
        </Row>
        <Row label={t('settings.appearance.theme')} stack>
          <ThumbPicker
            label={t('settings.appearance.theme')}
            items={[
              { value: 'dark', label: t('common.theme.dark'), thumb: <ThemeThumb theme="dark" /> },
              { value: 'light', label: t('common.theme.light'), thumb: <ThemeThumb theme="light" /> },
              { value: 'system', label: t('common.theme.system'), thumb: <ThemeThumb theme="system" /> },
            ]}
            value={theme}
            onChange={setTheme}
          />
        </Row>
        <Row
          label={t('settings.appearance.glass')}
          stack
          hint={canRefract ? t('settings.appearance.glassHint') : undefined}
          warn={canRefract ? undefined : t('settings.appearance.glassWarn')}
        >
          <ThumbPicker
            label={t('settings.appearance.glass')}
            items={[
              { value: 'refract', label: t('common.glass.refract'), thumb: <GlassThumb kind="refract" /> },
              { value: 'frosted', label: t('common.glass.frosted'), thumb: <GlassThumb kind="frosted" /> },
              { value: 'solid', label: t('common.glass.solid'), thumb: <GlassThumb kind="solid" /> },
            ]}
            value={glass}
            onChange={setGlass}
          />
        </Row>
      </Section>

      <Section title={t('settings.appearance.motionTitle')} desc={t('settings.appearance.motionDesc')}>
        <Row
          label={t('settings.appearance.homeIntro')}
          hint={t('settings.appearance.homeIntroHint')}
          help={t('settings.appearance.homeIntroHelp')}
        >
          <Switch on={homeIntro} onChange={setHomeIntro} label={t('settings.appearance.homeIntro')} />
        </Row>
        <Row
          label={t('settings.appearance.detailMotion')}
          hint={t('settings.appearance.detailMotionHint')}
          help={t('settings.appearance.detailMotionHelp')}
        >
          <Switch on={mangaDetailMotion} onChange={setMangaDetailMotion} label={t('settings.appearance.detailMotion')} />
        </Row>
        <Row
          label={t('settings.appearance.readerMotion')}
          hint={t('settings.appearance.readerMotionHint')}
          help={t('settings.appearance.readerMotionHelp')}
        >
          <Switch on={readerMotion} onChange={setReaderMotion} label={t('settings.appearance.readerMotion')} />
        </Row>
        <Row
          label={t('settings.appearance.motionBg')}
          hint={t('settings.appearance.motionBgHint')}
          help={t('settings.appearance.motionBgHelp')}
        >
          <Switch on={homeMotionBg} onChange={setHomeMotionBg} label={t('settings.appearance.motionBg')} />
        </Row>
      </Section>

      <Section title={t('settings.appearance.topbar')} desc={t('settings.appearance.topbarDesc')}>
        <Row label={t('settings.appearance.autoHideNav')} hint={t('settings.appearance.autoHideNavHint')}>
          <Switch on={autoHideNav} onChange={setAutoHideNav} label={t('settings.appearance.autoHideNav')} />
        </Row>
        <Row
          label={t('settings.appearance.navBlur')}
          hint={t('settings.appearance.navBlurHint')}
          warn={t('settings.appearance.navBlurWarn')}
        >
          <Switch on={navBlur} onChange={setNavBlur} label={t('settings.appearance.navBlur')} />
        </Row>
      </Section>

      <NsfwSettings />

      <Section
        fold
        title={t('settings.appearance.glassSection')}
        desc={t('settings.appearance.glassSectionDesc')}
        action={
          <button type="button" className="gbtn plain min-h-9 w-fit rounded-full px-3.5 text-[13px]" onClick={reset} aria-label={t('settings.appearance.glassResetAria', { theme: t(`common.themeName.${glassTheme}`) })}>
            <RotateCcw className="size-4" strokeWidth={1.8} />
            {t('settings.appearance.glassReset')}
          </button>
        }
      >
        <div className="grid min-w-0 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
          <GlassPreview className="lg:sticky lg:top-[calc(var(--nav-h)+12px)]" />
          <div className="flex min-w-0 flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <span className="text-sm">{t('settings.appearance.tuneMode')}</span>
              <Seg
                glass={false}
                label={t('settings.appearance.tuneModeAria')}
                items={[
                  { value: 'light', label: t('common.theme.light') },
                  { value: 'dark', label: t('common.theme.dark') },
                ]}
                value={glassTheme}
                onChange={setTheme}
              />
              <span className="text-[13px] text-faint">{t('settings.appearance.tuneModeHint')}</span>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-sm">{t('settings.appearance.preset')}</span>
              <Seg
                glass={false}
                label={t('settings.appearance.presetAria')}
                items={[
                  { value: 'tint', label: t('settings.appearance.presetDefault') },
                  { value: 'veil', label: t('settings.appearance.presetVeil') },
                ]}
                value={tone}
                onChange={switchPreset}
              />
              <span className="text-[13px] text-faint">
                {t('settings.appearance.presetHint')}
              </span>
            </div>
            <GlassSliders />
          </div>
        </div>
      </Section>
    </>
  )
}
