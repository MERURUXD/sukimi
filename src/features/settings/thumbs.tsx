import type { ReactNode } from 'react'
import type { HomeLayout } from '@/design/settings'
import type { Fit, ReadMode, TapZones } from '@/features/reader/settings'
import { cn } from '@/lib/cn'

export interface ThumbItem<T> {
  value: T
  label: string
  /** 示意图；compact 时改用 icon，与文字排成一行 */
  thumb?: ReactNode
  icon?: ReactNode
}

/**
 * 能画出来的设置（主题、玻璃、布局、阅读方式）用选项块来选：几个选项就把一行等分几份，
 * 不再是一排固定大小的小方块、右边空一大截。选中项描边、文字加粗；未选中的不加边框。
 * compact：方向、背景这类一个图标就说清的，图标和文字放一行，块更矮。
 */
export function ThumbPicker<T extends string>({
  items,
  value,
  onChange,
  label,
  compact,
}: {
  items: ThumbItem<T>[]
  value: T
  onChange: (v: T) => void
  label: string
  compact?: boolean
}) {
  return (
    <div role="group" aria-label={label} className="grid gap-2" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
      {items.map((it) => (
        <button
          key={it.value}
          type="button"
          aria-pressed={it.value === value}
          onClick={() => onChange(it.value)}
          className={cn(
            'group flex min-w-0 items-center justify-center rounded-[14px] bg-accent-soft text-[13px] leading-tight text-muted outline-none transition-colors',
            'shadow-[inset_0_0_0_1.5px_transparent] hover:text-text aria-pressed:font-semibold aria-pressed:text-text aria-pressed:shadow-[inset_0_0_0_1.5px_var(--accent)]',
            // 焦点圈画在块外面一层，选中项拿到焦点时也看得出来
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-muted',
            compact ? 'min-h-11 gap-2 px-2 py-2.5' : 'flex-col gap-1.5 px-1.5 pt-2.5 pb-2',
          )}
        >
          {compact ? (
            it.icon
          ) : (
            <span className="block h-[38px] w-[56px] flex-none overflow-hidden rounded-[8px] bg-bg shadow-[inset_0_0_0_1px_var(--line)] md:h-[44px] md:w-[64px]">{it.thumb}</span>
          )}
          <span className="min-w-0 text-center break-words">{it.label}</span>
        </button>
      ))}
    </div>
  )
}

/** 64×44 的画布；线条和色块都跟着主题取色，主题这类本身就是颜色的除外 */
function Canvas({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 64 44" className="block size-full" aria-hidden>
      {children}
    </svg>
  )
}

const block = 'fill-text/30'
const soft = 'fill-track'

const THEME_COLORS = {
  light: { bg: '#f4f3ef', bar: '#d6d4cc', card: '#ffffff' },
  dark: { bg: '#0b0b0d', bar: '#3a3a3f', card: '#1c1c20' },
}

export function ThemeThumb({ theme }: { theme: 'light' | 'dark' | 'system' }) {
  return (
    <Canvas>
      {theme === 'system' ? (
        <>
          <rect width="64" height="44" fill={THEME_COLORS.light.bg} />
          <rect x="8" y="8" width="20" height="4" rx="2" fill={THEME_COLORS.light.bar} />
          <rect x="8" y="17" width="24" height="19" rx="4" fill={THEME_COLORS.light.card} />
          <rect x="32" width="32" height="44" fill={THEME_COLORS.dark.bg} />
          <path d="M32 17h20a4 4 0 0 1 4 4v11a4 4 0 0 1-4 4H32z" fill={THEME_COLORS.dark.card} />
        </>
      ) : (
        <>
          <rect width="64" height="44" fill={THEME_COLORS[theme].bg} />
          <rect x="8" y="8" width="20" height="4" rx="2" fill={THEME_COLORS[theme].bar} />
          <rect x="8" y="17" width="48" height="19" rx="4" fill={THEME_COLORS[theme].card} />
        </>
      )}
    </Canvas>
  )
}

export function HomeMobileThumb({ layout }: { layout: HomeLayout }) {
  return (
    <Canvas>
      <rect x="21" y="3" width="22" height="38" rx="5" className="fill-surface stroke-line" />
      {layout === 'poster' ? (
        <>
          <rect x="25.5" y="8" width="13" height="19" rx="2" className={block} />
          <rect x="27" y="31" width="10" height="2" rx="1" className={soft} />
        </>
      ) : (
        <g className={block}>
          <rect x="24" y="7" width="7.5" height="11" rx="1.5" />
          <rect x="32.5" y="7" width="7.5" height="11" rx="1.5" />
          <rect x="24" y="20" width="7.5" height="11" rx="1.5" />
          <rect x="32.5" y="20" width="7.5" height="11" rx="1.5" />
        </g>
      )}
    </Canvas>
  )
}

export function HomeDesktopThumb({ layout }: { layout: HomeLayout }) {
  return (
    <Canvas>
      {layout === 'poster' ? (
        <>
          <g className={soft}>
            <rect x="14" y="11" width="13" height="19" rx="2" transform="rotate(-14 20 30)" />
            <rect x="37" y="11" width="13" height="19" rx="2" transform="rotate(14 44 30)" />
          </g>
          <rect x="25" y="8" width="14" height="22" rx="2" className={block} />
          <rect x="22" y="35" width="20" height="2" rx="1" className={soft} />
        </>
      ) : (
        <g className={block}>
          {[8, 21, 34, 47].map((x) => (
            <g key={x}>
              <rect x={x} y="8" width="10" height="14" rx="1.5" />
              <rect x={x} y="25" width="10" height="11" rx="1.5" />
            </g>
          ))}
        </g>
      )}
    </Canvas>
  )
}

export function ModeThumb({ mode }: { mode: ReadMode }) {
  return (
    <Canvas>
      {mode === 'single' && <rect x="23" y="6" width="18" height="32" rx="2" className={block} />}
      {mode === 'double' && (
        <g className={block}>
          <rect x="14" y="6" width="17.5" height="32" rx="2" />
          <rect x="32.5" y="6" width="17.5" height="32" rx="2" />
        </g>
      )}
      {mode === 'vertical' && (
        <g className={block}>
          <rect x="24" y="-9" width="16" height="22" rx="2" />
          <rect x="24" y="16" width="16" height="22" rx="2" />
          <rect x="24" y="41" width="16" height="10" rx="2" />
        </g>
      )}
      {mode === 'webtoon' && (
        <>
          <rect x="24" width="16" height="44" className={block} />
          <path d="M24 15h16M24 30h16" className="stroke-bg/40" strokeWidth=".8" />
        </>
      )}
    </Canvas>
  )
}

/** 虚线是屏幕，色块是漫画页；超出屏幕的部分照画，表示要滚动 */
export function FitThumb({ fit }: { fit: Fit }) {
  return (
    <Canvas>
      {fit === 'screen' && <rect x="23" y="7" width="17" height="30" rx="2" className={block} />}
      {fit === 'width' && <rect x="9" y="7" width="46" height="44" rx="2" className={block} />}
      {fit === 'height' && <rect x="23" y="2" width="17" height="40" rx="2" className={block} />}
      {fit === 'original' && <rect x="15" y="1" width="34" height="50" rx="2" className={block} />}
      <rect x="9" y="7" width="46" height="30" rx="3" fill="none" className="stroke-text/60" strokeDasharray="2 2" />
    </Canvas>
  )
}

/** 自动：左边是分页时的左右分区，右边是纵向时的上下分区 */
export function TapThumb({ zones }: { zones: TapZones }) {
  return (
    <Canvas>
      {zones === 'auto' && (
        <>
          <rect x="5" y="5" width="25" height="34" rx="4" className="fill-none stroke-line" />
          <rect x="34" y="5" width="25" height="34" rx="4" className="fill-none stroke-line" />
          <g className={soft}>
            <rect x="7" y="7" width="7" height="30" rx="2.5" />
            <rect x="21" y="7" width="7" height="30" rx="2.5" />
            <rect x="36" y="7" width="21" height="9" rx="2.5" />
            <rect x="36" y="28" width="21" height="9" rx="2.5" />
          </g>
        </>
      )}
      {zones === 'lr' && (
        <g className={soft}>
          <rect x="5" y="5" width="16" height="34" rx="4" />
          <rect x="43" y="5" width="16" height="34" rx="4" />
        </g>
      )}
      {zones === 'tb' && (
        <g className={soft}>
          <rect x="5" y="5" width="54" height="12" rx="4" />
          <rect x="5" y="27" width="54" height="12" rx="4" />
        </g>
      )}
      {zones === 'off' && <path d="M26 16l12 12M38 16 26 28" className="stroke-muted" strokeWidth="1.5" strokeLinecap="round" />}
    </Canvas>
  )
}
