import { AnimatePresence } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { MotionGlass } from '@/components/glass/Glass'
import { Seg } from '@/components/ui/Seg'
import { spring } from '@/design/motion'
import { cn } from '@/lib/cn'
import { MODE_ICON } from './ReaderChrome'
import { DEVICE_LABEL } from './remote'
import { BGS, DEFAULTS, FITS, MODES, TAP_ZONES, deviceKind, useReaderStore, type ReaderSettings } from './settings'
import { wakeLockSupported } from './wakeLock'
import { t } from '@/i18n'

function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={cn(
        'relative h-[26px] w-11 flex-none rounded-full transition-colors',
        on ? 'bg-accent' : 'bg-switch-off',
        // 与设置页的开关一致：圆点带投影，浅色下关闭时也看得出轮廓
        "after:absolute after:top-[3px] after:left-[3px] after:size-5 after:rounded-full after:shadow-[0_1px_2px_rgba(0,0,0,.18),0_2px_6px_rgba(0,0,0,.12)] dark:after:shadow-none after:transition-[left] after:content-['']",
        on ? 'after:left-[21px] after:bg-on-accent' : 'after:bg-white',
      )}
    />
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-3">
      <span>{label}</span>
      {children}
    </div>
  )
}

function Slider({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-3">
      <span className="flex-none">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={5}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
        className="h-[26px] w-36 min-w-0 accent-[var(--accent)]"
      />
      <span className="w-10 flex-none text-right text-[13px] text-muted num">{value}%</span>
    </div>
  )
}

const Hint = ({ children }: { children: React.ReactNode }) => <p className="mt-0.5 mb-1 text-xs text-muted">{children}</p>

const H = ({ children }: { children: string }) => (
  <h3 className="mt-0 mb-2 text-xs font-bold tracking-[.08em] text-muted">{children}</h3>
)

const KEYS: [string, string][] = [
  ['← →', t('reader.panel.keys.arrows')],
  ['Space', t('reader.panel.keys.space')],
  ['[ ]', t('reader.panel.keys.chapters')],
  ['M', t('reader.panel.keys.mode')],
  ['Z', t('reader.panel.keys.fit')],
  ['D', t('reader.panel.keys.dir')],
  ['F', t('reader.panel.keys.fullscreen')],
  ['B', t('reader.panel.keys.bookmark')],
  ['Shift + B', t('reader.panel.keys.bookmarkShift')],
  ['Esc', t('reader.panel.keys.esc')],
]

export function SettingsPanel({
  open,
  settings,
  set,
  syncLabel,
  rememberPerManga,
  onRememberChange,
  bookmarks,
  onJump,
}: {
  open: boolean
  settings: ReaderSettings
  set: (p: Partial<ReaderSettings>) => void
  syncLabel: string
  rememberPerManga?: boolean
  onRememberChange?: (remember: boolean) => void
  /** 本话的页面书签；不传时不显示这一节 */
  bookmarks?: number[]
  onJump?: (page: number) => void
}) {
  const [scrolling, setScrolling] = useState(false)
  const scrollIdle = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => {
    return () => clearTimeout(scrollIdle.current)
  }, [])
  const onScroll = () => {
    setScrolling(true)
    clearTimeout(scrollIdle.current)
    scrollIdle.current = setTimeout(() => setScrolling(false), 160)
  }
  const storedRemember = useReaderStore((s) => s.rememberPerManga)
  const setStoredRemember = useReaderStore((s) => s.setRemember)
  const remember = rememberPerManga ?? storedRemember
  const setRemember = onRememberChange ?? setStoredRemember
  const perDevice = useReaderStore((s) => s.perDevice)
  const setPerDevice = useReaderStore((s) => s.setPerDevice)
  const filtered = settings.brightness !== 100 || settings.warmth !== 0 || settings.grayscale || settings.invert
  const paged = settings.mode === 'single' || settings.mode === 'double'

  return (
    <AnimatePresence>
      {open && (
        <MotionGlass
          as="aside"
          aria-label={t('reader.chrome.settings')}
          dense
          // 大面板滚动时三通道色散开销高；保留单次折射，停下后恢复用户参数。
          lens={scrolling ? { dispersion: 0 } : undefined}
          onScroll={onScroll}
          layoutScroll
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 24 }}
          transition={spring.fast}
          className="no-scrollbar absolute top-[84px] right-4 bottom-24 z-10 flex w-[340px] max-w-[calc(100vw-32px)] flex-col gap-[22px] overflow-y-auto overscroll-contain rounded-[26px] px-[18px] pt-[18px] pb-[22px] [&>div]:shrink-0"
        >
          <div>
            <H>{t('reader.panel.mode')}</H>
            <div className="grid grid-cols-2 gap-2">
              {MODES.map((m) => {
                const Icon = MODE_ICON[m.value]
                const active = settings.mode === m.value
                return (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => set({ mode: m.value })}
                    aria-pressed={active}
                    className={cn(
                      'flex min-h-[78px] flex-col items-start gap-1.5 rounded-2xl border p-3 text-left transition-colors',
                      active ? 'border-accent bg-accent-soft' : 'border-line hover:bg-accent-soft',
                    )}
                  >
                    <Icon className={cn('size-5', active && 'text-accent')} strokeWidth={1.8} />
                    <b className="text-[13px]">{m.label}</b>
                    <span className="text-[11px] text-muted">{m.hint}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <H>{t('reader.panel.dir')}</H>
            <Seg
              label={t('reader.panel.dir')}
              glass={false}
              className="grid w-full grid-cols-2 [&>button]:justify-center"
              items={[
                { value: 'ltr', label: t('reader.panel.ltr') },
                { value: 'rtl', label: t('reader.panel.rtl') },
              ]}
              value={settings.dir}
              onChange={(dir) => set({ dir })}
            />
            <p className="mt-1.5 mb-0 text-xs text-muted">
              {!paged
                ? t('reader.panel.dirVertical')
                : settings.dir === 'rtl'
                  ? t('reader.panel.dirRtl')
                  : t('reader.panel.dirLtr')}
            </p>
          </div>

          <div>
            <H>{t('reader.panel.fit')}</H>
            <Seg
              label={t('reader.panel.fit')}
              glass={false}
              className="grid w-full grid-cols-4 [&>button]:justify-center [&>button]:px-1.5"
              items={FITS}
              value={settings.fit}
              onChange={(fit) => set({ fit })}
            />
          </div>

          <div>
            <H>{t('reader.panel.paging')}</H>
            <Row label={t('reader.panel.offsetFirst')}>
              <Switch on={settings.offsetFirst} onChange={(offsetFirst) => set({ offsetFirst })} label={t('reader.panel.offsetFirst')} />
            </Row>
            <Row label={t('reader.panel.preloadCount')}>
              <div className="flex items-center gap-1 rounded-full bg-accent-soft p-[3px]">
                <button type="button" className="size-9 rounded-full text-lg font-semibold hover:bg-g-hi" onClick={() => set({ preload: Math.max(1, settings.preload - 1) })} aria-label={t('reader.panel.preloadDec')}>
                  −
                </button>
                <span className="w-7 text-center font-bold num">{settings.preload}</span>
                <button type="button" className="size-9 rounded-full text-lg font-semibold hover:bg-g-hi" onClick={() => set({ preload: Math.min(10, settings.preload + 1) })} aria-label={t('reader.panel.preloadInc')}>
                  +
                </button>
              </div>
            </Row>
            <Row label={t('reader.panel.autoNext')}>
              <Switch on={settings.autoNext} onChange={(autoNext) => set({ autoNext })} label={t('reader.panel.autoNext')} />
            </Row>
            <Row label={t('reader.panel.keepAwake')}>
              <Switch on={settings.keepAwake} onChange={(keepAwake) => set({ keepAwake })} label={t('reader.panel.keepAwake')} />
            </Row>
            {settings.keepAwake && !wakeLockSupported() && <Hint>{t('reader.panel.keepAwakeUnsupported')}</Hint>}
            <Row label={t('reader.panel.rememberManga')}>
              <Switch on={remember} onChange={setRemember} label={t('reader.panel.rememberManga')} />
            </Row>
            {remember && (
              <>
                <Row label={t('reader.panel.deviceOnly', { device: DEVICE_LABEL[deviceKind()] })}>
                  <Switch on={perDevice} onChange={setPerDevice} label={t('reader.panel.deviceOnly', { device: DEVICE_LABEL[deviceKind()] })} />
                </Row>
                <Hint>{t('reader.panel.deviceHint', { device: DEVICE_LABEL[deviceKind()] })}</Hint>
              </>
            )}
          </div>

          <div>
            <H>{t('reader.panel.processing')}</H>
            <Row label={t('reader.panel.crop')}>
              <Switch on={settings.crop} onChange={(crop) => set({ crop })} label={t('reader.panel.crop')} />
            </Row>
            <Hint>{t('reader.panel.cropHint')}</Hint>
            <Row label={t('reader.panel.split')}>
              <Switch on={settings.split} onChange={(split) => set({ split })} label={t('reader.panel.split')} />
            </Row>
            <Hint>{t('reader.panel.splitHint')}</Hint>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <H>{t('reader.panel.filters')}</H>
              {filtered && (
                <button
                  type="button"
                  className="mb-2 text-xs text-muted hover:text-text"
                  onClick={() => set({ brightness: DEFAULTS.brightness, warmth: DEFAULTS.warmth, grayscale: DEFAULTS.grayscale, invert: DEFAULTS.invert })}
                >
                  {t('reader.panel.reset')}
                </button>
              )}
            </div>
            <Slider label={t('reader.panel.brightness')} value={settings.brightness} min={30} max={100} onChange={(brightness) => set({ brightness })} />
            <Slider label={t('reader.panel.warmth')} value={settings.warmth} min={0} max={60} onChange={(warmth) => set({ warmth })} />
            <Row label={t('reader.panel.grayscale')}>
              <Switch on={settings.grayscale} onChange={(grayscale) => set({ grayscale })} label={t('reader.panel.grayscale')} />
            </Row>
            <Row label={t('reader.panel.invert')}>
              <Switch on={settings.invert} onChange={(invert) => set({ invert })} label={t('reader.panel.invert')} />
            </Row>
          </div>

          {bookmarks && (
            <div>
              <H>{t('reader.panel.bookmarks')}</H>
              {bookmarks.length ? (
                <div className="flex flex-wrap gap-2">
                  {bookmarks.map((p) => (
                    <button key={p} type="button" className="gbtn min-h-9 rounded-full px-3.5 text-[13px] num" onClick={() => onJump?.(p)}>
                      {t('reader.chrome.page', { n: p + 1 })}
                    </button>
                  ))}
                </div>
              ) : (
                <Hint>{t('reader.panel.bookmarksHint')}</Hint>
              )}
            </div>
          )}

          <div>
            <H>{t('reader.panel.tapZones')}</H>
            <Seg
              label={t('reader.panel.tapZones')}
              glass={false}
              className="grid w-full grid-cols-4 [&>button]:justify-center [&>button]:px-1.5"
              items={TAP_ZONES}
              value={settings.tapZones}
              onChange={(tapZones) => set({ tapZones })}
            />
            <p className="mt-1.5 mb-0 text-xs text-muted">{TAP_ZONES.find((z) => z.value === settings.tapZones)?.hint}</p>
          </div>

          <div>
            <H>{t('reader.panel.background')}</H>
            <div className="flex gap-2.5">
              {BGS.map((b) => (
                <button
                  key={b.value}
                  type="button"
                  onClick={() => set({ bg: b.value })}
                  aria-label={t('reader.panel.bgAria', { label: b.label })}
                  title={b.label}
                  aria-pressed={settings.bg === b.value}
                  className={cn(
                    'size-11 rounded-full border-2',
                    settings.bg === b.value ? 'border-accent shadow-[0_0_0_3px_var(--accent-soft)]' : 'border-line',
                  )}
                  style={{ background: b.color }}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2.5 rounded-2xl bg-accent-soft px-3.5 py-3 text-[13px]">
            <span className="size-2 flex-none rounded-full bg-[#3FB77A]" />
            <span>{syncLabel}</span>
          </div>

          <div>
            <H>{t('reader.panel.shortcuts')}</H>
            <div className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2 text-[13px]">
              {KEYS.map(([k, d]) => (
                <div key={k} className="contents">
                  <kbd className="justify-self-start rounded-md border border-b-2 border-line bg-accent-soft px-[7px] py-px font-[inherit] text-xs font-semibold whitespace-nowrap">
                    {k}
                  </kbd>
                  <span className="text-muted">{d}</span>
                </div>
              ))}
            </div>
          </div>
        </MotionGlass>
      )}
    </AnimatePresence>
  )
}
