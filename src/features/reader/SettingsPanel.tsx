import { AnimatePresence } from 'motion/react'
import { MotionGlass } from '@/components/glass/Glass'
import { Seg } from '@/components/ui/Seg'
import { spring } from '@/design/motion'
import { cn } from '@/lib/cn'
import { MODE_ICON } from './ReaderChrome'
import { DEVICE_LABEL } from './remote'
import { BGS, DEFAULTS, FITS, MODES, TAP_ZONES, deviceKind, useReaderStore, type ReaderSettings } from './settings'
import { wakeLockSupported } from './wakeLock'

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
        on ? 'bg-accent' : 'bg-track',
        "after:absolute after:top-[3px] after:left-[3px] after:size-5 after:rounded-full after:transition-[left] after:content-['']",
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
  ['← →', '翻页（随方向自动对调）'],
  ['Space', '下一页 / 向下滚动'],
  ['[ ]', '上一话 / 下一话'],
  ['M', '切换阅读模式'],
  ['Z', '切换缩放适配'],
  ['D', '切换 LTR / RTL'],
  ['F', '全屏'],
  ['B', '给当前页加 / 取消书签'],
  ['Esc', '关闭设置 / 隐藏工具栏'],
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
          aria-label="阅读设置"
          dense
          layoutScroll
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 24 }}
          transition={spring.fast}
          className="no-scrollbar absolute top-[84px] right-4 bottom-24 z-10 flex w-[340px] max-w-[calc(100vw-32px)] flex-col gap-[22px] overflow-y-auto overscroll-contain rounded-[26px] px-[18px] pt-[18px] pb-[22px] [&>div]:shrink-0"
        >
          <div>
            <H>阅读模式</H>
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
            <H>翻页方向</H>
            <Seg
              label="翻页方向"
              glass={false}
              className="grid w-full grid-cols-2 [&>button]:justify-center"
              items={[
                { value: 'ltr', label: '从左到右 LTR' },
                { value: 'rtl', label: '从右到左 RTL' },
              ]}
              value={settings.dir}
              onChange={(dir) => set({ dir })}
            />
            <p className="mt-1.5 mb-0 text-xs text-muted">
              {!paged
                ? '纵向模式下始终自上而下阅读。'
                : settings.dir === 'rtl'
                  ? '日漫习惯：点击左侧或按 ← 前进到下一页。'
                  : '美漫 / 国漫习惯：点击右侧或按 → 前进到下一页。'}
            </p>
          </div>

          <div>
            <H>缩放适配</H>
            <Seg
              label="缩放适配"
              glass={false}
              className="grid w-full grid-cols-4 [&>button]:justify-center [&>button]:px-1.5"
              items={FITS}
              value={settings.fit}
              onChange={(fit) => set({ fit })}
            />
          </div>

          <div>
            <H>翻页与加载</H>
            <Row label="双页时首页单独显示">
              <Switch on={settings.offsetFirst} onChange={(offsetFirst) => set({ offsetFirst })} label="双页时首页单独显示" />
            </Row>
            <Row label="预加载页数">
              <div className="flex items-center gap-1 rounded-full bg-accent-soft p-[3px]">
                <button type="button" className="size-9 rounded-full text-lg font-semibold hover:bg-g-hi" onClick={() => set({ preload: Math.max(1, settings.preload - 1) })} aria-label="减少预加载">
                  −
                </button>
                <span className="w-7 text-center font-bold num">{settings.preload}</span>
                <button type="button" className="size-9 rounded-full text-lg font-semibold hover:bg-g-hi" onClick={() => set({ preload: Math.min(10, settings.preload + 1) })} aria-label="增加预加载">
                  +
                </button>
              </div>
            </Row>
            <Row label="读完自动进入下一话">
              <Switch on={settings.autoNext} onChange={(autoNext) => set({ autoNext })} label="读完自动进入下一话" />
            </Row>
            <Row label="阅读时屏幕常亮">
              <Switch on={settings.keepAwake} onChange={(keepAwake) => set({ keepAwake })} label="阅读时屏幕常亮" />
            </Row>
            {settings.keepAwake && !wakeLockSupported() && <Hint>当前浏览器不支持，或页面不是通过 HTTPS / localhost 打开的。</Hint>}
            <Row label="按漫画记住阅读模式">
              <Switch on={remember} onChange={setRemember} label="按漫画记住阅读模式" />
            </Row>
            {remember && (
              <>
                <Row label={`${DEVICE_LABEL[deviceKind()]}上单独记住`}>
                  <Switch on={perDevice} onChange={setPerDevice} label={`${DEVICE_LABEL[deviceKind()]}上单独记住`} />
                </Row>
                <Hint>开启后，在这台{DEVICE_LABEL[deviceKind()]}上改的模式、方向和缩放只对{DEVICE_LABEL[deviceKind()]}生效；没改过的漫画沿用通用设置。</Hint>
              </>
            )}
          </div>

          <div>
            <H>页面处理</H>
            <Row label="自动裁掉白边">
              <Switch on={settings.crop} onChange={(crop) => set({ crop })} label="自动裁掉白边" />
            </Row>
            <Hint>裁掉页面四周的白边或黑边；Webtoon 模式不裁。</Hint>
            <Row label="宽页拆成两半">
              <Switch on={settings.split} onChange={(split) => set({ split })} label="宽页拆成两半" />
            </Row>
            <Hint>单页与纵向模式下，跨页大图按阅读方向分两次显示。</Hint>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <H>图像滤镜</H>
              {filtered && (
                <button
                  type="button"
                  className="mb-2 text-xs text-muted hover:text-text"
                  onClick={() => set({ brightness: DEFAULTS.brightness, warmth: DEFAULTS.warmth, grayscale: DEFAULTS.grayscale, invert: DEFAULTS.invert })}
                >
                  恢复默认
                </button>
              )}
            </div>
            <Slider label="亮度" value={settings.brightness} min={30} max={100} onChange={(brightness) => set({ brightness })} />
            <Slider label="暖色" value={settings.warmth} min={0} max={60} onChange={(warmth) => set({ warmth })} />
            <Row label="灰度">
              <Switch on={settings.grayscale} onChange={(grayscale) => set({ grayscale })} label="灰度" />
            </Row>
            <Row label="反色">
              <Switch on={settings.invert} onChange={(invert) => set({ invert })} label="反色" />
            </Row>
          </div>

          {bookmarks && (
            <div>
              <H>本话书签页</H>
              {bookmarks.length ? (
                <div className="flex flex-wrap gap-2">
                  {bookmarks.map((p) => (
                    <button key={p} type="button" className="gbtn min-h-9 rounded-full px-3.5 text-[13px] num" onClick={() => onJump?.(p)}>
                      第 {p + 1} 页
                    </button>
                  ))}
                </div>
              ) : (
                <Hint>点工具栏的书签按钮或按 B，给当前页加书签。</Hint>
              )}
            </div>
          )}

          <div>
            <H>点击分区</H>
            <Seg
              label="点击分区"
              glass={false}
              className="grid w-full grid-cols-4 [&>button]:justify-center [&>button]:px-1.5"
              items={TAP_ZONES}
              value={settings.tapZones}
              onChange={(tapZones) => set({ tapZones })}
            />
            <p className="mt-1.5 mb-0 text-xs text-muted">{TAP_ZONES.find((z) => z.value === settings.tapZones)?.hint}</p>
          </div>

          <div>
            <H>背景</H>
            <div className="flex gap-2.5">
              {BGS.map((b) => (
                <button
                  key={b.value}
                  type="button"
                  onClick={() => set({ bg: b.value })}
                  aria-label={`${b.label}背景`}
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
            <H>键盘快捷键</H>
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
