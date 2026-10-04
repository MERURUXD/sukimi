import { useWindowVirtualizer } from '@tanstack/react-virtual'
import { Check, Download } from 'lucide-react'
import { useLayoutEffect, useRef, useState, type CSSProperties, type MouseEvent } from 'react'
import { Link } from 'react-router'
import { CoverImg } from '@/components/manga/CoverImg'
import { useRestoredOffset } from '@/app/ScrollManager'
import { usePrefetchManga } from '@/features/manga/prefetch'
import { useLongPress } from '@/lib/useLongPress'
import { sfwAttr } from '@/lib/devSafe'
import { timeAgo } from '@/lib/format'
import { cn } from '@/lib/cn'
import { riseDelay, useIntro } from '@/lib/intro'
import { lastUpdated } from './filtering'
import type { LibraryManga } from './queries'
import type { Density } from './store'

interface Props {
  items: LibraryManga[]
  /** 首屏封面错开淡入（只在第一次从网络拿到数据时） */
  intro?: boolean
  density: Density
  selecting: boolean
  selected: ReadonlySet<number>
  onToggle: (id: number, index: number, e: MouseEvent) => void
  /** 触屏长按某一部：进入多选 */
  onLongPress: (id: number, index: number) => void
}

const GAP_X = 20
const GAP_Y = 26

/** 容器宽度与它在文档里的纵向位置（虚拟列表的 scrollMargin） */
function useBox() {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [top, setTop] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width))
    ro.observe(el)
    setWidth(el.getBoundingClientRect().width)
    return () => ro.disconnect()
  }, [])
  // 上方工具栏、批量栏出现时位置会变，每次渲染后校正
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const t = el.getBoundingClientRect().top + window.scrollY
    if (Math.abs(t - top) > 0.5) setTop(t)
  })
  return [ref, width, top] as const
}

export function LibraryGrid(props: Props) {
  const intro = useIntro(!!props.intro, props.items.length > 0)
  return props.density === 'list' ? <ListView {...props} intro={intro} /> : <GridView {...props} intro={intro} />
}

/** 第一次加载、还没有数据时的占位格子 */
export function LibrarySkeleton({ density }: { density: Density }) {
  if (density === 'list') {
    return (
      <div className="flex flex-col gap-1" aria-hidden>
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="flex h-16 items-center gap-3.5 px-3">
            <span className="skel h-[60px] w-10 rounded-[7px]" style={{ '--d': `${i * 60}ms` } as CSSProperties} />
            <span className="skel h-3.5 w-1/3 rounded-full" style={{ '--d': `${i * 60}ms` } as CSSProperties} />
          </div>
        ))}
      </div>
    )
  }
  const minW = density === 'compact' ? 120 : 160
  return (
    <div
      className="grid"
      style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${minW}px, 1fr))`, columnGap: GAP_X, rowGap: GAP_Y }}
      aria-hidden
    >
      {Array.from({ length: 18 }, (_, i) => (
        <div key={i} className="flex flex-col gap-2">
          <span className="skel aspect-[2/3] rounded-xl" style={{ '--d': `${(i % 9) * 70}ms` } as CSSProperties} />
          <span className="skel h-3.5 w-3/4 rounded-full" style={{ '--d': `${(i % 9) * 70}ms` } as CSSProperties} />
        </div>
      ))}
    </div>
  )
}

/* ───────── 封面网格（按行虚拟化）───────── */
function GridView({ items, intro, density, selecting, selected, onToggle, onLongPress }: Props) {
  const [ref, width, top] = useBox()
  const initialOffset = useRestoredOffset()
  const minW = density === 'compact' ? 120 : 160
  const cols = Math.max(2, Math.floor((width + GAP_X) / (minW + GAP_X)))
  const tileW = width ? (width - GAP_X * (cols - 1)) / cols : minW
  const textH = density === 'compact' ? 30 : 48
  const rowH = tileW * 1.5 + 8 + textH + GAP_Y
  const rows = Math.ceil(items.length / cols)

  const v = useWindowVirtualizer({
    count: rows,
    estimateSize: () => rowH,
    overscan: 3,
    scrollMargin: top,
    // 默认会取创建时的 window.scrollY，切页时那是上一页的位置；改用 ScrollManager 记下的位置
    initialOffset,
  })
  // 列数或尺寸变化时重新估算
  useLayoutEffect(() => v.measure(), [v, rowH, cols])

  return (
    <div ref={ref} className="relative w-full" style={{ height: v.getTotalSize() }}>
      {width > 0 &&
        v.getVirtualItems().map((row, _, all) => (
          <div
            key={row.key}
            className="absolute inset-x-0 top-0 grid"
            style={{
              transform: `translateY(${row.start - v.options.scrollMargin}px)`,
              gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
              columnGap: GAP_X,
            }}
          >
            {items.slice(row.index * cols, row.index * cols + cols).map((m, i) => (
              <Tile
                key={m.id}
                m={m}
                index={row.index * cols + i}
                rise={intro ? riseDelay(row.index - all[0].index, i) : undefined}
                compact={density === 'compact'}
                selecting={selecting}
                selected={selected.has(m.id)}
                onToggle={onToggle}
                onLongPress={onLongPress}
              />
            ))}
          </div>
        ))}
    </div>
  )
}

function Tile({
  m,
  index,
  rise,
  compact,
  selecting,
  selected,
  onToggle,
  onLongPress,
}: {
  m: LibraryManga
  index: number
  rise?: CSSProperties
  compact: boolean
  selecting: boolean
  selected: boolean
  onToggle: Props['onToggle']
  onLongPress: Props['onLongPress']
}) {
  const press = useLongPress(() => !selecting && onLongPress(m.id, index))
  const prefetch = usePrefetchManga(m.id)
  const body = (
    <>
      <span
        className={cn(
          'cv rounded-xl shadow-[0_12px_28px_rgba(0,0,0,.28)] transition-transform duration-200 group-hover:-translate-y-[3px]',
          selected && 'outline-3 outline-offset-2 outline-accent',
        )}
      >
        <CoverImg src={m.thumbnailUrl} loading="lazy" />
        {m.unreadCount > 0 && (
          <span className="absolute top-2 left-2 z-[2] inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-accent px-[7px] text-xs font-bold text-on-accent num">
            {m.unreadCount}
          </span>
        )}
        {m.downloadCount > 0 && !selecting && (
          <span className="absolute top-2 right-2 z-[2] inline-flex h-6 items-center gap-[3px] rounded-full border border-white/20 bg-black/45 px-2 text-[11px] font-bold text-white backdrop-blur-md num">
            <Download className="size-3" strokeWidth={2.4} />
            {m.downloadCount}
          </span>
        )}
        {selected && (
          <span className="absolute right-2 bottom-2 z-[2] grid size-7 place-items-center rounded-full bg-accent text-on-accent">
            <Check className="size-4" strokeWidth={3} />
          </span>
        )}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className={cn('truncate font-semibold', compact && 'text-[13px]')}>{m.title}</span>
        {!compact && (
          <span className="truncate text-xs text-muted">
            {[m.source?.displayName, timeAgo(lastUpdated(m))].filter(Boolean).join(' · ')}
          </span>
        )}
      </span>
    </>
  )

  const cls = cn('group flex min-w-0 flex-col gap-2 text-left text-text no-underline', rise && 'rise')
  return selecting ? (
    <button type="button" className={cls} style={rise} aria-pressed={selected} data-sfw={sfwAttr(m.source?.displayName)} {...press} onClick={(e) => onToggle(m.id, index, e)}>
      {body}
    </button>
  ) : (
    <Link to={`/manga/${m.id}`} viewTransition className={cls} style={rise} data-sfw={sfwAttr(m.source?.displayName)} {...prefetch} {...press}>
      {body}
    </Link>
  )
}

/* ───────── 列表视图 ───────── */
const LIST_ROW = 68

function ListView({ items, intro, selecting, selected, onToggle }: Props) {
  const [ref, , top] = useBox()
  const initialOffset = useRestoredOffset()
  const v = useWindowVirtualizer({
    count: items.length,
    estimateSize: () => LIST_ROW,
    overscan: 8,
    scrollMargin: top,
    // 默认会取创建时的 window.scrollY，切页时那是上一页的位置；改用 ScrollManager 记下的位置
    initialOffset,
  })

  return (
    <div ref={ref} className="relative w-full" style={{ height: v.getTotalSize() }}>
      {v.getVirtualItems().map((r, _, all) => {
        const m = items[r.index]
        const isSel = selected.has(m.id)
        const cls = cn(
          'absolute inset-x-0 top-0 flex h-[64px] items-center gap-3.5 rounded-[14px] px-3 text-left text-text no-underline transition-colors hover:bg-hover',
          isSel && 'bg-accent-soft hover:bg-accent-soft',
          intro && 'rise',
        )
        const style = {
          transform: `translateY(${r.start - v.options.scrollMargin}px)`,
          ...(intro && riseDelay(r.index - all[0].index, 0)),
        }
        const body = (
          <>
            <span className="cv w-10 flex-none rounded-[7px]">
              <CoverImg src={m.thumbnailUrl} loading="lazy" />
              {isSel && (
                <span className="absolute inset-0 grid place-items-center bg-black/45 text-white">
                  <Check className="size-5" strokeWidth={3} />
                </span>
              )}
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate font-semibold">{m.title}</span>
              <span className="truncate text-xs text-muted">
                {[m.author, m.source?.displayName].filter(Boolean).join(' · ')}
              </span>
            </span>
            <span className="w-[100px] text-xs text-muted max-md:hidden">{timeAgo(lastUpdated(m))}</span>
            <span className="w-[72px] text-right text-xs text-muted num">未读 {m.unreadCount}</span>
            <span className="w-[72px] text-right text-xs text-muted num max-sm:hidden">下载 {m.downloadCount}</span>
          </>
        )
        return selecting ? (
          <button key={m.id} type="button" className={cls} style={style} aria-pressed={isSel} data-sfw={sfwAttr(m.source?.displayName)} onClick={(e) => onToggle(m.id, r.index, e)}>
            {body}
          </button>
        ) : (
          <Link key={m.id} to={`/manga/${m.id}`} viewTransition className={cls} style={style} data-sfw={sfwAttr(m.source?.displayName)}>
            {body}
          </Link>
        )
      })}
    </div>
  )
}
