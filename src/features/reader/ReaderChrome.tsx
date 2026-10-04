import { AnimatePresence } from 'motion/react'
import {
  ArrowLeftRight,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Columns2,
  Expand,
  GalleryVertical,
  RectangleVertical,
  Rows3,
  Settings2,
  Shrink,
} from 'lucide-react'
import { MotionGlass } from '@/components/glass/Glass'
import { spring } from '@/design/motion'
import { cn } from '@/lib/cn'
import { FITS, MODES, cycle, type ReadMode, type ReaderSettings } from './settings'

export const MODE_ICON: Record<ReadMode, typeof BookOpen> = {
  single: RectangleVertical,
  double: Columns2,
  vertical: Rows3,
  webtoon: GalleryVertical,
}

const ib = 'inline-grid size-[42px] flex-none place-items-center rounded-full transition-colors hover:bg-g-hi'
const tb = 'inline-flex min-h-[42px] items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold whitespace-nowrap transition-colors hover:bg-g-hi disabled:opacity-40 disabled:hover:bg-transparent'
const on = 'bg-g-hi shadow-[inset_0_0_0_1px_var(--g-glow)]'

const enter = {
  top: { initial: { opacity: 0, y: -16 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -16 } },
  bottom: { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: 16 } },
}

export function ReaderChrome({
  visible,
  suspendRefract,
  onBack,
  title,
  chapterLabel,
  pageLabel,
  settings,
  set,
  panel,
  onTogglePanel,
  fullscreen,
  onFullscreen,
  pageCount,
  shown,
  readUpTo,
  onJump,
  hasPrev,
  hasNext,
  onPrevChapter,
  onNextChapter,
}: {
  visible: boolean
  suspendRefract: boolean
  onBack: () => void
  title: string
  chapterLabel: string
  pageLabel: string
  settings: ReaderSettings
  set: (p: Partial<ReaderSettings>) => void
  panel: boolean
  onTogglePanel: () => void
  fullscreen: boolean
  onFullscreen: () => void
  pageCount: number
  /** 当前屏显示的页 */
  shown: number[]
  readUpTo: number
  onJump: (page: number) => void
  hasPrev: boolean
  hasNext: boolean
  onPrevChapter: () => void
  onNextChapter: () => void
}) {
  const paged = settings.mode === 'single' || settings.mode === 'double'
  const first = Math.min(...shown)
  const last = Math.max(...shown)
  const manyPages = pageCount > 60

  return (
    <AnimatePresence>
      {visible && (
        <>
          <div key="top" className="pointer-events-none absolute inset-x-4 top-4 z-10 flex items-start justify-between gap-3">
            <MotionGlass
              {...enter.top}
              transition={spring.fast}
              suspendRefract={suspendRefract}
              dense
              className="pointer-events-auto flex min-w-0 items-center gap-1 rounded-full p-[5px]"
            >
              <button type="button" onClick={onBack} className={ib} aria-label="返回漫画详情">
                <ChevronLeft className="size-[22px]" strokeWidth={1.8} />
              </button>
              <div className="flex min-w-0 flex-col pr-3.5 pl-1 leading-tight">
                <span className="truncate font-bold">{title}</span>
                <span className="truncate text-xs text-muted num">
                  {chapterLabel} · {pageLabel}
                </span>
              </div>
            </MotionGlass>

            <MotionGlass
              {...enter.top}
              transition={spring.fast}
              suspendRefract={suspendRefract}
              dense
              role="toolbar"
              aria-label="阅读工具"
              className="pointer-events-auto flex flex-none items-center gap-1 rounded-full p-[5px]"
            >
              <span className="flex max-md:hidden">
                {MODES.map((m) => {
                  const Icon = MODE_ICON[m.value]
                  return (
                    <button
                      key={m.value}
                      type="button"
                      className={cn(ib, settings.mode === m.value && on)}
                      onClick={() => set({ mode: m.value })}
                      aria-label={m.label}
                      title={`${m.label}（M）`}
                      aria-pressed={settings.mode === m.value}
                    >
                      <Icon className="size-5" strokeWidth={1.8} />
                    </button>
                  )
                })}
                <span className="mx-1 h-[22px] w-px self-center bg-line" />
              </span>
              <button
                type="button"
                className={tb}
                disabled={!paged}
                onClick={() => set({ dir: settings.dir === 'rtl' ? 'ltr' : 'rtl' })}
                title="切换翻页方向（D）"
              >
                <ArrowLeftRight className="size-[18px]" strokeWidth={1.8} />
                {settings.dir.toUpperCase()}
              </button>
              <button type="button" className={cn(tb, 'max-sm:hidden')} onClick={() => set({ fit: cycle(FITS, settings.fit) })} title="切换缩放（Z）">
                {FITS.find((f) => f.value === settings.fit)?.label}
              </button>
              <span className="mx-1 h-[22px] w-px self-center bg-line" />
              <button type="button" className={cn(ib, panel && on)} onClick={onTogglePanel} aria-label="阅读设置" aria-pressed={panel}>
                <Settings2 className="size-5" strokeWidth={1.8} />
              </button>
              <button type="button" className={ib} onClick={onFullscreen} aria-label={fullscreen ? '退出全屏' : '全屏'} title="全屏（F）">
                {fullscreen ? <Shrink className="size-5" strokeWidth={1.8} /> : <Expand className="size-5" strokeWidth={1.8} />}
              </button>
            </MotionGlass>
          </div>

          <div key="bottom" className="pointer-events-none absolute inset-x-4 bottom-[max(18px,env(safe-area-inset-bottom))] z-10 flex justify-center max-sm:inset-x-2">
            <MotionGlass
              {...enter.bottom}
              transition={spring.fast}
              suspendRefract={suspendRefract}
              dense
              className="pointer-events-auto flex w-[min(920px,100%)] items-center gap-3 rounded-full px-2.5 py-2 max-sm:gap-1.5"
            >
              <button type="button" className={tb} disabled={!hasPrev} onClick={onPrevChapter} title="上一话（[）">
                <ChevronLeft className="size-[18px]" strokeWidth={1.8} />
                <span className="max-sm:hidden">上一话</span>
              </button>
              <span className="w-[72px] flex-none text-center text-[13px] font-bold num max-sm:w-auto">{pageLabel}</span>
              <div
                role="group"
                aria-label="页面进度"
                className={cn('flex h-[42px] min-w-0 flex-1 items-center gap-[3px]', manyPages ? 'hidden' : 'max-sm:hidden')}
                style={{ direction: paged && settings.dir === 'rtl' ? 'rtl' : 'ltr' }}
              >
                {Array.from({ length: pageCount }, (_, i) => {
                  const cur = i >= first && i <= last
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => onJump(i)}
                      aria-label={`第 ${i + 1} 页`}
                      title={`第 ${i + 1} 页`}
                      className={cn(
                        'h-1.5 min-w-0 flex-1 rounded-[3px] transition-[height] hover:h-3',
                        cur
                          ? 'h-3.5 bg-accent'
                          : i < first
                            ? 'bg-[color-mix(in_srgb,var(--text)_55%,transparent)]'
                            : i <= readUpTo
                              ? 'bg-[color-mix(in_srgb,var(--text)_30%,transparent)]'
                              : 'bg-track',
                      )}
                    />
                  )
                })}
              </div>
              {/* 手机或页数很多时用滑块代替分段 */}
              <input
                type="range"
                min={1}
                max={pageCount}
                value={first + 1}
                onChange={(e) => onJump(Number(e.target.value) - 1)}
                aria-label="跳转到页"
                className={cn('h-[42px] min-w-0 flex-1 accent-[var(--accent)]', manyPages ? '' : 'sm:hidden')}
                style={{ direction: paged && settings.dir === 'rtl' ? 'rtl' : 'ltr' }}
              />
              <span className="text-xs whitespace-nowrap text-muted max-md:hidden">预加载 {settings.preload} 页</span>
              <button type="button" className={tb} disabled={!hasNext} onClick={onNextChapter} title="下一话（]）">
                <span className="max-sm:hidden">下一话</span>
                <ChevronRight className="size-[18px]" strokeWidth={1.8} />
              </button>
            </MotionGlass>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}
