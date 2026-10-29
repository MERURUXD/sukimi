import { AnimatePresence } from 'motion/react'
import {
  ArrowLeftRight,
  BookOpen,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Columns2,
  Download,
  Expand,
  GalleryVertical,
  RectangleVertical,
  Rows3,
  Settings2,
  Share2,
  Shrink,
} from 'lucide-react'
import { useCallback, useState } from 'react'
import { MotionGlass } from '@/components/glass/Glass'
import { Popover } from '@/components/ui/Popover'
import { spring } from '@/design/motion'
import { cn } from '@/lib/cn'
import { FITS, MODES, cycle, type ReadMode, type ReaderSettings } from './settings'
import { t } from '@/i18n'

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

/**
 * 书签按钮。单页直接切换当前页；双页时展开菜单，选左页还是右页。
 * 菜单的展开状态放在这里：工具栏收起、翻到单页时组件卸载，状态随之清掉。
 */
function BookmarkControl({
  pages,
  bookmarks,
  rtl,
  onToggle,
}: {
  pages: number[]
  bookmarks: number[]
  rtl: boolean
  onToggle: (page: number) => void
}) {
  const [menu, setMenu] = useState(false)
  const close = useCallback(() => setMenu(false), [])
  const spread = pages.length > 1
  const marks = pages.map((p) => bookmarks.includes(p))
  const bookmarked = marks.some(Boolean)
  const label = spread ? t('reader.chrome.bookmarkPages') : bookmarked ? t('reader.chrome.bookmarkRemove') : t('reader.chrome.bookmarkAdd')
  const button = (
    <button
      type="button"
      className={cn(ib, bookmarked && on)}
      onClick={spread ? () => setMenu((v) => !v) : () => onToggle(pages[0])}
      aria-label={label}
      aria-pressed={spread ? undefined : bookmarked}
      aria-haspopup={spread ? 'menu' : undefined}
      aria-expanded={spread ? menu : undefined}
      title={spread ? t('reader.chrome.bookmarkPickTitle') : t('reader.withKey', { label, key: 'B' })}
    >
      <Bookmark className={cn('size-5', bookmarked && 'fill-current')} strokeWidth={1.8} />
    </button>
  )
  if (!spread) return button

  // 按画面左右排列：从右往左读时页码小的在右边
  const sides = pages.map((p, i) => ({ p, marked: marks[i] }))
  if (rtl) sides.reverse()
  return (
    <Popover open={menu} onClose={close} trigger={button} label={t('reader.chrome.bookmarkPick')} rootClassName="flex-none" className="flex w-[200px] flex-col rounded-[22px] p-2">
      {sides.map(({ p, marked }, i) => (
        <button
          key={p}
          type="button"
          role="menuitemcheckbox"
          aria-checked={marked}
          className="opt"
          onClick={() => {
            onToggle(p)
            close()
          }}
        >
          <Bookmark className={cn('size-5', marked && 'fill-current')} strokeWidth={1.8} />
          <span className="flex-1">
            {t('reader.chrome.side', { side: i === 0 ? t('reader.chrome.left') : t('reader.chrome.right'), n: p + 1 })}
          </span>
        </button>
      ))}
    </Popover>
  )
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
  bookmarks,
  bookmarkPages,
  onToggleBookmark,
  saving,
  onSave,
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
  /** 本话的页面书签（从 0 开始的页码） */
  bookmarks: number[]
  /** 当前屏可加书签的页（升序）；双页时有两页，各自一个按钮 */
  bookmarkPages: number[]
  onToggleBookmark: (page: number) => void
  saving: boolean
  onSave: () => void
}) {
  const paged = settings.mode === 'single' || settings.mode === 'double'
  const rtl = paged && settings.dir === 'rtl'
  const first = Math.min(...shown)
  const last = Math.max(...shown)
  const manyPages = pageCount > 60
  // 触屏调起系统分享（可存到相册），电脑直接下载
  const touch = matchMedia('(pointer: coarse)').matches
  const saveLabel = touch ? t('reader.chrome.share') : t('reader.chrome.save')

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
              <button type="button" onClick={onBack} className={ib} aria-label={t('reader.chrome.back')}>
                <ChevronLeft className="size-[22px]" strokeWidth={1.8} />
              </button>
              <div className="flex min-w-0 flex-col pr-3.5 pl-1 leading-tight">
                <span className="truncate font-bold">{title}</span>
                {/* 手机上底栏已有页码，这里只留章节名，免得章节名被截成省略号 */}
                <span className="truncate text-xs text-muted num">
                  {chapterLabel}
                  <span className="max-sm:hidden"> · {pageLabel}</span>
                </span>
              </div>
            </MotionGlass>

            <MotionGlass
              {...enter.top}
              transition={spring.fast}
              suspendRefract={suspendRefract}
              dense
              role="toolbar"
              aria-label={t('reader.chrome.tools')}
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
                      title={t('reader.withKey', { label: m.label, key: 'M' })}
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
                // 手机上收进设置面板，给书名和书签、分享按钮腾地方
                className={cn(tb, 'max-sm:hidden')}
                disabled={!paged}
                onClick={() => set({ dir: settings.dir === 'rtl' ? 'ltr' : 'rtl' })}
                title={t('reader.withKey', { label: t('reader.chrome.toggleDir'), key: 'D' })}
              >
                <ArrowLeftRight className="size-[18px]" strokeWidth={1.8} />
                {settings.dir.toUpperCase()}
              </button>
              <button type="button" className={cn(tb, 'max-sm:hidden')} onClick={() => set({ fit: cycle(FITS, settings.fit) })} title={t('reader.withKey', { label: t('reader.chrome.toggleFit'), key: 'Z' })}>
                {FITS.find((f) => f.value === settings.fit)?.label}
              </button>
              <span className="mx-1 h-[22px] w-px self-center bg-line max-sm:hidden" />
              <BookmarkControl pages={bookmarkPages} bookmarks={bookmarks} rtl={rtl} onToggle={onToggleBookmark} />
              <button type="button" className={ib} onClick={onSave} disabled={saving} aria-label={saveLabel} title={saveLabel}>
                {touch ? <Share2 className="size-5" strokeWidth={1.8} /> : <Download className="size-5" strokeWidth={1.8} />}
              </button>
              <button type="button" className={cn(ib, panel && on)} onClick={onTogglePanel} aria-label={t('reader.chrome.settings')} aria-pressed={panel}>
                <Settings2 className="size-5" strokeWidth={1.8} />
              </button>
              <button
                type="button"
                // 不支持全屏的浏览器（iPhone Safari）不显示
                className={cn(ib, !document.fullscreenEnabled && 'hidden')}
                onClick={onFullscreen}
                aria-label={fullscreen ? t('reader.chrome.exitFullscreen') : t('reader.chrome.fullscreen')}
                title={t('reader.withKey', { label: t('reader.chrome.fullscreen'), key: 'F' })}
              >
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
              {/* 从右往左读时，下一话在左、上一话在右，和翻页方向一致；用 order 换位，中间的页码与进度条不动 */}
              <button type="button" className={cn(tb, rtl && 'order-last')} disabled={!hasPrev} onClick={onPrevChapter} title={t('reader.withKey', { label: t('reader.chrome.prevChapter'), key: '[' })}>
                {rtl ? <ChevronRight className="size-[18px]" strokeWidth={1.8} /> : <ChevronLeft className="size-[18px]" strokeWidth={1.8} />}
                <span className="max-sm:hidden">{t('reader.chrome.prevChapter')}</span>
              </button>
              <span className="w-[72px] flex-none text-center text-[13px] font-bold num max-sm:w-auto">{pageLabel}</span>
              <div
                role="group"
                aria-label={t('reader.chrome.progress')}
                className={cn('flex h-[42px] min-w-0 flex-1 items-center gap-[3px]', manyPages ? 'hidden' : 'max-sm:hidden')}
                style={{ direction: paged && settings.dir === 'rtl' ? 'rtl' : 'ltr' }}
              >
                {Array.from({ length: pageCount }, (_, i) => {
                  const cur = i >= first && i <= last
                  const marked = bookmarks.includes(i)
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => onJump(i)}
                      aria-label={marked ? t('reader.chrome.pageMarked', { n: i + 1 }) : t('reader.chrome.page', { n: i + 1 })}
                      title={marked ? t('reader.chrome.pageMarkedTitle', { n: i + 1 }) : t('reader.chrome.page', { n: i + 1 })}
                      className={cn(
                        'relative h-1.5 min-w-0 flex-1 rounded-[3px] transition-[height] hover:h-3',
                        // 有书签的页上方一个小点
                        marked && "after:absolute after:-top-2 after:left-1/2 after:size-1 after:-translate-x-1/2 after:rounded-full after:bg-accent after:content-['']",
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
                aria-label={t('reader.chrome.jump')}
                className={cn('h-[42px] min-w-0 flex-1 accent-[var(--accent)]', manyPages ? '' : 'sm:hidden')}
                style={{ direction: paged && settings.dir === 'rtl' ? 'rtl' : 'ltr' }}
              />
              <span className="text-xs whitespace-nowrap text-muted max-md:hidden">{t('reader.chrome.preload', { n: settings.preload })}</span>
              <button type="button" className={cn(tb, rtl && '-order-1')} disabled={!hasNext} onClick={onNextChapter} title={t('reader.withKey', { label: t('reader.chrome.nextChapter'), key: ']' })}>
                {rtl ? <ChevronLeft className="size-[18px]" strokeWidth={1.8} /> : null}
                <span className="max-sm:hidden">{t('reader.chrome.nextChapter')}</span>
                {rtl ? null : <ChevronRight className="size-[18px]" strokeWidth={1.8} />}
              </button>
            </MotionGlass>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}
