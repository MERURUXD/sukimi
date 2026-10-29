import { ArrowDown, ArrowUp, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { useAppearance } from '@/design/settings'
import { HOME_SECTION_LABELS, HOME_SECTION_ORDER, moveHomeSection, type HomeSection } from '@/features/home/preferences'
import { Row, Section, Switch } from '../parts'
import { ThumbPicker, HomeDesktopThumb, HomeMobileThumb } from '../thumbs'
import { t } from '@/i18n'

const HINTS: Record<HomeSection, string> = {
  week: t('cfg.home.hint.week'),
  favorite: t('cfg.home.hint.favorite'),
  updates: t('cfg.home.hint.updates'),
  stale: t('cfg.home.hint.stale'),
  fresh: t('cfg.home.hint.fresh'),
  recent: t('cfg.home.hint.recent'),
  gallery: t('cfg.home.hint.gallery'),
  later: t('cfg.home.hint.later'),
}

export function HomeTab() {
  const {
    homeMobileLayout,
    homeDesktopLayout,
    setHomeMobileLayout,
    setHomeDesktopLayout,
    homeSections,
    homeSectionOrder,
    homeGallery,
    setHomeSection,
    setHomeSectionOrder,
    setHomeGallery,
  } = useAppearance()
  const [notice, setNotice] = useState('')
  const move = (id: HomeSection, direction: -1 | 1) => {
    const order = moveHomeSection(homeSectionOrder, id, direction)
    setHomeSectionOrder(order)
    setNotice(t('cfg.home.moved', { label: HOME_SECTION_LABELS[id], n: order.indexOf(id) + 1 }))
  }

  return (
    <>
      <Section title={t('cfg.home.layout')} desc={t('cfg.home.layoutDesc')}>
        <Row label={t('cfg.home.mobileLayout')} hint={t('cfg.home.mobileLayoutHint')} stack>
          <ThumbPicker
            label={t('cfg.home.mobileLayout')}
            items={[
              { value: 'poster', label: t('cfg.home.poster'), thumb: <HomeMobileThumb layout="poster" /> },
              { value: 'cover', label: t('cfg.home.cover'), thumb: <HomeMobileThumb layout="cover" /> },
            ]}
            value={homeMobileLayout}
            onChange={setHomeMobileLayout}
          />
        </Row>
        <Row label={t('cfg.home.desktopLayout')} hint={t('cfg.home.desktopLayoutHint')} stack>
          <ThumbPicker
            label={t('cfg.home.desktopLayout')}
            items={[
              { value: 'poster', label: t('cfg.home.stage'), thumb: <HomeDesktopThumb layout="poster" /> },
              { value: 'cover', label: t('cfg.home.cover'), thumb: <HomeDesktopThumb layout="cover" /> },
            ]}
            value={homeDesktopLayout}
            onChange={setHomeDesktopLayout}
          />
        </Row>
      </Section>

      <Section
        title={t('cfg.home.content')}
        desc={t('cfg.home.contentDesc')}
        action={
          <button
            type="button"
            className="gbtn plain min-h-9 w-fit rounded-full px-3.5 text-[13px]"
            onClick={() => {
              setHomeSectionOrder(HOME_SECTION_ORDER)
              setNotice(t('cfg.home.resetDone'))
            }}
          >
            <RotateCcw className="size-4" strokeWidth={1.8} />
            {t('cfg.home.reset')}
          </button>
        }
      >
        <ol aria-label={t('cfg.home.orderAria')} className="m-0 flex list-none flex-col gap-3 p-0">
          {homeSectionOrder.map((id, i) => (
            <li key={id} data-home-setting={id} className="flex min-h-11 items-center justify-between gap-3 py-0.5">
              <div className="flex min-w-0 flex-1 items-baseline gap-2.5">
                <span aria-hidden className="num w-4 flex-none text-[13px] text-faint">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <span className="font-semibold">{HOME_SECTION_LABELS[id]}</span>
                  <p className="mt-0.5 mb-0 text-[13px] leading-snug text-muted">{HINTS[id]}</p>
                </div>
              </div>
              <div className="flex flex-none items-center gap-2.5">
                <div className="flex flex-none gap-1">
                  <button
                    type="button"
                    disabled={i === 0}
                    aria-label={t('cfg.home.upAria', { label: HOME_SECTION_LABELS[id] })}
                    onClick={() => move(id, -1)}
                    className="gicon plain size-10 rounded-full disabled:opacity-25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text"
                  >
                    <ArrowUp className="size-4" strokeWidth={1.8} />
                  </button>
                  <button
                    type="button"
                    disabled={i === homeSectionOrder.length - 1}
                    aria-label={t('cfg.home.downAria', { label: HOME_SECTION_LABELS[id] })}
                    onClick={() => move(id, 1)}
                    className="gicon plain size-10 rounded-full disabled:opacity-25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text"
                  >
                    <ArrowDown className="size-4" strokeWidth={1.8} />
                  </button>
                </div>
                {id === 'gallery' ? (
                  <Switch label={t('cfg.home.galleryWindow')} on={homeGallery} onChange={setHomeGallery} />
                ) : (
                  <Switch label={t('cfg.home.show', { label: HOME_SECTION_LABELS[id] })} on={homeSections[id]} onChange={(on) => setHomeSection(id, on)} />
                )}
              </div>
            </li>
          ))}
        </ol>
        <span role="status" className="sr">
          {notice}
        </span>
      </Section>
    </>
  )
}
