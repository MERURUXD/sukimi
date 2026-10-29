import { useId, type ReactNode } from 'react'
import type { HomeLayout } from '@/design/settings'
import type { Fit, ReadMode, ReaderBg, TapZones } from '@/features/reader/settings'
import { BGS } from '@/features/reader/settings'
import { cn } from '@/lib/cn'

export interface ThumbItem<T> {
  value: T
  label: string
  thumb: ReactNode
}

/**
 * 能画出来的设置（主题、玻璃、布局、阅读方式）用小示意图来选，比一排文字直观。
 * 选中项外圈描边、文字加粗；整组放在标题下面左对齐，各行起点一致。
 */
export function ThumbPicker<T extends string>({
  items,
  value,
  onChange,
  label,
}: {
  items: ThumbItem<T>[]
  value: T
  onChange: (v: T) => void
  label: string
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-x-2 gap-y-3 pt-1 pb-3">
      {items.map((it) => (
        <button
          key={it.value}
          type="button"
          aria-pressed={it.value === value}
          onClick={() => onChange(it.value)}
          className="group flex w-[80px] flex-col md:w-[100px] items-center gap-1.5 rounded-[14px] pt-1 pb-0.5 outline-none"
        >
          <span
            className={cn(
              'block h-[50px] w-[72px] overflow-hidden rounded-[10px] md:h-[64px] md:w-[92px] md:rounded-[12px] bg-accent-soft shadow-[inset_0_0_0_1px_var(--line)] outline-2 outline-offset-2 outline-transparent transition-[outline-color]',
              // 焦点圈画在描边外面一层，选中项拿到焦点时也看得出来
              'group-hover:outline-line group-aria-pressed:outline-accent group-focus-visible:shadow-[inset_0_0_0_1px_var(--line),0_0_0_6px_var(--muted)]',
            )}
          >
            {it.thumb}
          </span>
          <span className="text-center text-xs leading-tight text-muted transition-colors group-hover:text-text group-aria-pressed:font-semibold group-aria-pressed:text-text">
            {it.label}
          </span>
        </button>
      ))}
    </div>
  )
}

/** 64×44 的画布；线条和色块都跟着主题取色，主题和阅读背景这类本身就是颜色的除外 */
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

/**
 * 一排封面上浮着一条导航玻璃，和应用里玻璃的实际用法一致：
 * 液态是透镜放大背后的封面并带亮边，毛玻璃把背后糊开，不透明直接盖住
 */
export function GlassThumb({ kind }: { kind: 'refract' | 'frosted' | 'solid' }) {
  const id = useId()
  // 封面上的浅色横条是标题位置，透镜放大后能看出它变粗、错位
  const covers = (
    <g>
      {[
        [2, '#9aa1ab'],
        [23, '#c7ad89'],
        [44, '#6c7380'],
      ].map(([x, c]) => (
        <g key={x}>
          <rect x={x} y="3" width="18" height="38" rx="3" fill={c as string} />
          <rect x={(x as number) + 3} y="29" width="12" height="3" rx="1.5" fill="#fff" fillOpacity=".55" />
        </g>
      ))}
    </g>
  )
  const bar = { x: 7, y: 23, w: 50, h: 15, r: 7.5 }
  return (
    <Canvas>
      <defs>
        <clipPath id={`${id}c`}>
          <rect x={bar.x} y={bar.y} width={bar.w} height={bar.h} rx={bar.r} />
        </clipPath>
        <filter id={`${id}b`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>
      {covers}
      {kind === 'solid' ? (
        <rect x={bar.x} y={bar.y} width={bar.w} height={bar.h} rx={bar.r} className="fill-solid" />
      ) : (
        <g clipPath={`url(#${id}c)`}>
          {kind === 'refract' ? (
            <g transform="translate(32 30.5) scale(1.55) translate(-32 -30.5)">{covers}</g>
          ) : (
            <g filter={`url(#${id}b)`}>{covers}</g>
          )}
          <rect width="64" height="44" fill="#fff" fillOpacity={kind === 'refract' ? 0.06 : 0.4} />
        </g>
      )}
      {kind === 'refract' && (
        <>
          {/* 上沿亮、下沿暗，看上去是有厚度的透镜 */}
          <rect x={bar.x + 0.5} y={bar.y + 0.5} width={bar.w - 1} height={bar.h - 1} rx={bar.r - 0.5} fill="none" stroke="#000" strokeOpacity=".25" strokeWidth="1" />
          <path d={`M${bar.x + bar.r} ${bar.y + 0.7}H${bar.x + bar.w - bar.r}`} stroke="#fff" strokeOpacity=".95" strokeWidth="1.2" strokeLinecap="round" />
          <rect x={bar.x + 0.5} y={bar.y + 0.5} width={bar.w - 1} height={bar.h - 1} rx={bar.r - 0.5} fill="none" stroke="#fff" strokeOpacity=".45" strokeWidth=".8" />
        </>
      )}
      <g className={kind === 'solid' ? 'fill-on-solid' : 'fill-white'} opacity=".85">
        <circle cx="19" cy="30.5" r="1.6" />
        <circle cx="32" cy="30.5" r="1.6" />
        <circle cx="45" cy="30.5" r="1.6" />
      </g>
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

export function DirThumb({ dir }: { dir: 'rtl' | 'ltr' }) {
  return (
    <Canvas>
      {/* 先读的那页颜色深，箭头指向往后翻的方向 */}
      <rect x="14" y="7" width="17.5" height="24" rx="2" className={dir === 'ltr' ? block : soft} />
      <rect x="32.5" y="7" width="17.5" height="24" rx="2" className={dir === 'rtl' ? block : soft} />
      <path
        d={dir === 'rtl' ? 'M42 37.5H22m4-3-4 3 4 3' : 'M22 37.5h20m-4-3 4 3-4 3'}
        className="stroke-muted"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
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

export function BgThumb({ bg }: { bg: ReaderBg }) {
  return (
    <Canvas>
      <rect width="64" height="44" fill={BGS.find((b) => b.value === bg)?.color} />
      <rect x="23" y="6" width="18" height="32" rx="2" fill="#8a8a8f" />
    </Canvas>
  )
}
