import { MotionConfig, Reorder, useDragControls } from 'motion/react'
import { GripVertical, RotateCcw } from 'lucide-react'
import { useState, type KeyboardEvent } from 'react'
import { useAppearance } from '@/design/settings'
import { HOME_SECTION_LABELS, HOME_SECTION_ORDER, moveHomeSection, type HomeSection } from '@/features/home/preferences'
import { cn } from '@/lib/cn'
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
  // 拖动中的顺序只放在本地，松手才写入偏好，免得每换一次位置就存一次、读屏播报一次
  const [dragOrder, setDragOrder] = useState<HomeSection[] | null>(null)
  const shown = dragOrder ?? homeSectionOrder

  const commit = (order: HomeSection[], id: HomeSection) => {
    setHomeSectionOrder(order)
    setNotice(t('cfg.home.moved', { label: HOME_SECTION_LABELS[id], n: order.indexOf(id) + 1 }))
  }
  const drop = (id: HomeSection) => {
    if (dragOrder && dragOrder.join() !== homeSectionOrder.join()) commit(dragOrder, id)
    setDragOrder(null)
  }
  const nudge = (id: HomeSection, direction: -1 | 1) => {
    const order = moveHomeSection(homeSectionOrder, id, direction)
    if (order.join() === homeSectionOrder.join()) return
    commit(order, id)
    // 往下挪时 React 会移动这一行的节点，焦点可能丢掉，换完顺序再放回拖动柄上
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-home-setting="${id}"] [data-drag-handle]`)?.focus())
  }

  return (
    <>
      <Section title={t('cfg.home.layout')} desc={t('cfg.home.layoutDesc')} help={t('cfg.home.layoutHelp')}>
        <div className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
          <Row label={t('cfg.home.mobile')} stack>
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
          <Row label={t('cfg.home.desktop')} stack>
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
        </div>
      </Section>

      <Section
        title={t('cfg.home.content')}
        desc={t('cfg.home.contentDesc')}
        help={t('cfg.home.contentHelp')}
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
        {/* 换位是 motion 的 JS 动画，全局的 reduced-motion 样式管不到，要单独声明 */}
        <MotionConfig reducedMotion="user">
        <Reorder.Group as="ol" axis="y" values={shown} onReorder={setDragOrder} aria-label={t('cfg.home.orderAria')} className="m-0 flex list-none flex-col p-0">
          {shown.map((id, i) => (
            <SectionRow
              key={id}
              id={id}
              index={i}
              on={id === 'gallery' ? homeGallery : homeSections[id]}
              onToggle={(on) => (id === 'gallery' ? setHomeGallery(on) : setHomeSection(id, on))}
              onDrop={() => drop(id)}
              onNudge={(by) => nudge(id, by)}
            />
          ))}
        </Reorder.Group>
        </MotionConfig>
        <span role="status" className="sr">
          {notice}
        </span>
      </Section>
    </>
  )
}

/** 一个首页模块：序号、名称与一句说明，右侧拖动柄和开关。只有拖动柄能拖，手机上划动列表不会误触 */
function SectionRow({
  id,
  index,
  on,
  onToggle,
  onDrop,
  onNudge,
}: {
  id: HomeSection
  index: number
  on: boolean
  onToggle: (on: boolean) => void
  onDrop: () => void
  onNudge: (by: -1 | 1) => void
}) {
  const controls = useDragControls()
  const [dragging, setDragging] = useState(false)
  const label = HOME_SECTION_LABELS[id]
  const keys = (e: KeyboardEvent) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault()
      onNudge(e.key === 'ArrowUp' ? -1 : 1)
    }
  }
  return (
    <Reorder.Item
      as="li"
      value={id}
      data-home-setting={id}
      dragListener={false}
      dragControls={controls}
      onDragStart={() => setDragging(true)}
      onDragEnd={() => {
        setDragging(false)
        onDrop()
      }}
      whileDrag={{ scale: 1.015 }}
      // 拖动时盖住下面的行，才需要实色底
      className={cn('relative -mx-2 flex min-h-14 items-center gap-3 rounded-2xl px-2 py-1.5', dragging && 'z-10 bg-bg shadow-[0_16px_40px_rgba(0,0,0,.25)]')}
    >
      <span aria-hidden className="num w-4 flex-none text-center text-[13px] text-faint">
        {index + 1}
      </span>
      <div className="min-w-0 flex-1">
        <div className="font-medium">{label}</div>
        <p className="mt-0.5 mb-0 text-[13px] leading-snug text-muted">{HINTS[id]}</p>
      </div>
      {/* 读屏在手机上双击只产生一次点击，拖不动也按不了方向键，给它留一对上移 / 下移 */}
      <button type="button" className="sr-only" onClick={() => onNudge(-1)}>{t('cfg.home.upAria', { label })}</button>
      <button type="button" className="sr-only" onClick={() => onNudge(1)}>{t('cfg.home.downAria', { label })}</button>
      <button
        type="button"
        data-drag-handle=""
        aria-label={t('cfg.home.dragAria', { label })}
        onPointerDown={(e) => controls.start(e)}
        onKeyDown={keys}
        className="gicon size-10 flex-none cursor-grab touch-none rounded-full text-faint hover:text-text active:cursor-grabbing focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text"
      >
        <GripVertical className="size-[18px]" />
      </button>
      <Switch label={id === 'gallery' ? t('cfg.home.galleryWindow') : t('cfg.home.show', { label })} on={on} onChange={onToggle} />
    </Reorder.Item>
  )
}
