import { useWindowVirtualizer } from '@tanstack/react-virtual'
import { Bookmark, Check, Download, Star } from 'lucide-react'
import { memo, useLayoutEffect, useRef, useState, type CSSProperties, type MouseEvent } from 'react'
import { Link } from 'react-router'
import { CoverImg } from '@/components/manga/CoverImg'
import { useRestoredOffset } from '@/app/ScrollManager'
import { usePrefetchManga } from '@/features/manga/prefetch'
import { useLongPress } from '@/lib/useLongPress'
import { isMouseContext } from '@/components/ui/ContextMenu'
import { sfwAttr } from '@/lib/devSafe'
import { useNsfw, useNsfwBlur } from '@/features/nsfw/useNsfw'
import { timeAgo } from '@/lib/format'
import { cn } from '@/lib/cn'
import { riseDelay, useIntro } from '@/lib/intro'
import { isCompleted, lastUpdated } from './filtering'
import type { LibraryManga } from './queries'
import { DEFAULT_BADGES, DEFAULT_SUBLINE, type BadgeKey, type Density, type SublineKey, type TitleLines } from './store'

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
  /** 封面最小宽度，缺省按密度取；画廊手机版用更小的值排成三列 */
  minTile?: number
  /** 提供时在封面角标显示评分（书库按评分排序时传入）；返回 null 表示未评分，不显示 */
  scoreOf?: (m: LibraryManga) => number | null
  /** 书库「显示」里的封面设置；缺省时按加入这些设置之前的样子显示 */
  display?: TileDisplay
  /** 特别关心：开着星标角标时在封面上标出 */
  favorites?: ReadonlyMap<number, number>
  /** 鼠标右键某一部：打开操作菜单（触屏长按仍是多选）；要保持引用稳定，格子才不会跟着重画 */
  onMenu?: (m: LibraryManga, x: number, y: number) => void
}

export interface TileDisplay {
  /** 每行封面数，0 = 按宽度自动 */
  cols: number
  badges: Record<BadgeKey, boolean>
  titleLines: TitleLines
  subline: Record<SublineKey, boolean>
}

const DEFAULT_DISPLAY: TileDisplay = { cols: 0, badges: DEFAULT_BADGES, titleLines: 1, subline: DEFAULT_SUBLINE }

const PILL = 'inline-flex h-6 items-center gap-[3px] rounded-full border border-white/20 bg-black/45 px-2 text-[11px] font-bold text-white backdrop-blur-md num'

/** 来源语言的角标文字；「全部」和本地来源没有具体语言，不显示 */
const langLabel = (lang?: string) => (!lang || lang === 'all' || lang === 'localsourcelang' ? null : lang.toUpperCase())

/** 封面下文字的高度，虚拟列表按它估算行高；行高 24 / 22、附加信息 16、题材标签 18 + 4 间距，另留 8 余量 */
function textHeight(d: TileDisplay, compact: boolean) {
  const title = d.titleLines * (compact ? 22 : 24)
  const sub = !compact && (d.subline.source || d.subline.time || d.subline.author) ? 16 : 0
  const genre = !compact && d.subline.genre ? 22 : 0
  const h = title + sub + genre
  return h ? h + 8 : 0
}

const GAP_X = 20
const GAP_Y = 26

/** 容器宽度与它在文档里的纵向位置（虚拟列表的 scrollMargin） */
function useBox() {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [top, setTop] = useState(0)
  const measuredTop = useRef(0)
  const measureTop = () => {
    const el = ref.current
    if (!el) return
    const t = el.getBoundingClientRect().top + window.scrollY
    if (Math.abs(t - measuredTop.current) > 0.5) {
      measuredTop.current = t
      setTop(t)
    }
  }
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const own = entries.find((e) => e.target === el)
      if (own) setWidth(own.contentRect.width)
      measureTop()
    })
    ro.observe(el)
    // 字体加载、上方工具栏换行也会移动网格，不能只等父组件重新渲染才校正。
    const page = el.closest('main')
    if (page) ro.observe(page)
    setWidth(el.getBoundingClientRect().width)
    return () => ro.disconnect()
  }, [])
  // 上方工具栏、批量栏出现时位置会变，每次渲染后校正
  useLayoutEffect(measureTop)
  return [ref, width, top] as const
}

export function LibraryGrid(props: Props) {
  const intro = useIntro(!!props.intro, props.items.length > 0)
  // 位置测量留在外层：工具栏等布局变化仍会校正，虚拟列表自身滚动更新无需重复读取布局。
  const [ref, width, top] = useBox()
  return (
    <div ref={ref} className="w-full">
      {props.density === 'list'
        ? <ListView {...props} intro={intro} top={top} />
        : <GridView {...props} intro={intro} width={width} top={top} />}
    </div>
  )
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
function GridView({ items, intro, density, selecting, selected, onToggle, onLongPress, minTile, scoreOf, display = DEFAULT_DISPLAY, favorites, onMenu, width, top }: Props & { width: number; top: number }) {
  const initialOffset = useRestoredOffset()
  const minW = minTile ?? (density === 'compact' ? 120 : 160)
  const cols = display.cols || Math.max(2, Math.floor((width + GAP_X) / (minW + GAP_X)))
  const tileW = width ? (width - GAP_X * (cols - 1)) / cols : minW
  const textH = textHeight(display, density === 'compact')
  // 文字区和封面之间的 8px 间距只在有文字时存在
  const rowH = tileW * 1.5 + (textH ? 8 + textH : 0) + GAP_Y
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
    <div className="relative w-full" style={{ height: v.getTotalSize() }}>
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
                score={scoreOf?.(m)}
                display={display}
                selecting={selecting}
                selected={selected.has(m.id)}
                favorite={display.badges.favorite && !!favorites?.has(m.id)}
                onToggle={onToggle}
                onLongPress={onLongPress}
                onMenu={onMenu}
              />
            ))}
          </div>
        ))}
    </div>
  )
}

// 滚动只替换进入视口的行，保留行里的封面在内容和交互状态未变时不必重画。
const Tile = memo(function Tile({
  m,
  index,
  rise,
  compact,
  score,
  display,
  selecting,
  selected,
  favorite,
  onToggle,
  onLongPress,
  onMenu,
}: {
  m: LibraryManga
  index: number
  rise?: CSSProperties
  compact: boolean
  score?: number | null
  display: TileDisplay
  selecting: boolean
  selected: boolean
  favorite: boolean
  onToggle: Props['onToggle']
  onLongPress: Props['onLongPress']
  onMenu: Props['onMenu']
}) {
  const longPress = useLongPress(() => !selecting && onLongPress(m.id, index))
  const press = {
    ...longPress,
    onContextMenu: (e: MouseEvent) => {
      if (!onMenu || selecting || !isMouseContext(e)) return longPress.onContextMenu(e)
      e.preventDefault()
      onMenu(m, e.clientX, e.clientY)
    },
  }
  const prefetch = usePrefetchManga(m.id)
  const nsfw = useNsfwBlur(m)
  const { badges, subline } = display
  const dl = badges.downloaded && m.downloadCount > 0
  const lang = badges.lang ? langLabel(m.source?.lang) : null
  const bookmarks = badges.bookmarks && m.bookmarkCount > 0
  const completed = badges.completed && isCompleted(m)
  const marks = bookmarks || completed
  // 紧凑网格只留标题
  const sub = compact ? '' : [subline.author && m.author, subline.source && m.source?.displayName, subline.time && timeAgo(lastUpdated(m))].filter(Boolean).join(' · ')
  const genres = !compact && subline.genre ? m.genre.slice(0, 4) : []
  const body = (
    <>
      <span
        className={cn(
          'cv rounded-xl shadow-[0_12px_28px_rgba(0,0,0,.28)] transition-transform duration-200 group-hover:-translate-y-[3px]',
          selected && 'outline-3 outline-offset-2 outline-accent',
        )}
      >
        <CoverImg src={m.thumbnailUrl} loading="lazy" />
        {badges.unread && m.unreadCount > 0 && (
          <span className="absolute top-2 left-2 z-[2] inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-accent px-[7px] text-xs font-bold text-on-accent num">
            {m.unreadCount}
          </span>
        )}
        {!selecting && (favorite || dl || lang) && (
          <span className="absolute top-2 right-2 z-[2] flex flex-col items-end gap-1">
            {/* 实心星：和评分角标的空心星区分开 */}
            {favorite && (
              <span className={PILL} aria-label="特别关心" title="特别关心">
                <Star className="size-3 fill-current" strokeWidth={2.4} />
              </span>
            )}
            {dl && (
              <span className={PILL}>
                <Download className="size-3" strokeWidth={2.4} />
                {m.downloadCount}
              </span>
            )}
            {lang && <span className={PILL}>{lang}</span>}
          </span>
        )}
        {(score != null || marks) && (
          <span className={cn('absolute bottom-2 left-2 z-[2] flex flex-wrap gap-1', selected ? 'right-11' : 'right-2')}>
            {score != null && (
              <span className={PILL}>
                <Star className="size-3" strokeWidth={2.4} />
                {score.toFixed(1)}
              </span>
            )}
            {bookmarks && (
              <span className={PILL}>
                <Bookmark className="size-3" strokeWidth={2.4} />
                {m.bookmarkCount}
              </span>
            )}
            {completed && <span className={PILL}>完结</span>}
          </span>
        )}
        {selected && (
          <span className="absolute right-2 bottom-2 z-[2] grid size-7 place-items-center rounded-full bg-accent text-on-accent">
            <Check className="size-4" strokeWidth={3} />
          </span>
        )}
      </span>
      {display.titleLines + (sub ? 1 : 0) + (genres.length ? 1 : 0) > 0 && (
        <span className="flex min-w-0 flex-col">
          {display.titleLines > 0 && (
            <span className={cn('font-semibold', display.titleLines === 1 ? 'truncate' : 'line-clamp-2 break-words', compact && 'text-[13px]')}>{m.title}</span>
          )}
          {sub && <span className="truncate text-xs text-muted">{sub}</span>}
          {genres.length > 0 && (
            <span className="mt-1 flex h-[18px] gap-1 overflow-hidden">
              {genres.map((g) => (
                <span key={g} className="flex-none rounded-full bg-hover px-1.5 text-[11px] leading-[18px] text-muted">{g}</span>
              ))}
            </span>
          )}
        </span>
      )}
    </>
  )

  const cls = cn('group flex min-w-0 flex-col gap-2 text-left text-text no-underline', rise && 'rise')
  return selecting ? (
    <button type="button" className={cls} style={rise} aria-pressed={selected} data-sfw={sfwAttr(m.source?.displayName)} data-nsfw={nsfw} {...press} onClick={(e) => onToggle(m.id, index, e)}>
      {body}
    </button>
  ) : (
    <Link to={`/manga/${m.id}`} viewTransition className={cls} style={rise} data-sfw={sfwAttr(m.source?.displayName)} data-nsfw={nsfw} {...prefetch} {...press}>
      {body}
    </Link>
  )
})

/* ───────── 列表视图 ───────── */
const LIST_ROW = 68

function ListView({ items, intro, selecting, selected, onToggle, scoreOf, display = DEFAULT_DISPLAY, favorites, onMenu, top }: Props & { top: number }) {
  const initialOffset = useRestoredOffset()
  const { blurred } = useNsfw()
  const v = useWindowVirtualizer({
    count: items.length,
    estimateSize: () => LIST_ROW,
    overscan: 8,
    scrollMargin: top,
    // 默认会取创建时的 window.scrollY，切页时那是上一页的位置；改用 ScrollManager 记下的位置
    initialOffset,
  })

  return (
    <div className="relative w-full" style={{ height: v.getTotalSize() }}>
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
              <span className="flex min-w-0 items-center gap-1.5">
                {display.badges.favorite && favorites?.has(m.id) && <Star className="size-3.5 flex-none fill-current" strokeWidth={2.2} aria-label="特别关心" />}
                <span className="truncate font-semibold">{m.title}</span>
              </span>
              <span className="truncate text-xs text-muted">
                {[m.author, m.source?.displayName].filter(Boolean).join(' · ')}
              </span>
            </span>
            {scoreOf && <span className="w-10 text-right text-xs text-muted num">{scoreOf(m)?.toFixed(1) ?? '—'}</span>}
            <span className="w-[100px] text-xs text-muted max-md:hidden">{timeAgo(lastUpdated(m))}</span>
            <span className="w-[72px] text-right text-xs text-muted num">未读 {m.unreadCount}</span>
            <span className="w-[72px] text-right text-xs text-muted num max-sm:hidden">下载 {m.downloadCount}</span>
          </>
        )
        return selecting ? (
          <button key={m.id} type="button" className={cls} style={style} aria-pressed={isSel} data-sfw={sfwAttr(m.source?.displayName)} data-nsfw={blurred(m) ? '' : undefined} onClick={(e) => onToggle(m.id, r.index, e)}>
            {body}
          </button>
        ) : (
          <Link key={m.id} to={`/manga/${m.id}`} viewTransition className={cls} style={style} data-sfw={sfwAttr(m.source?.displayName)} data-nsfw={blurred(m) ? '' : undefined}
            onContextMenu={onMenu && ((e) => {
              if (!isMouseContext(e)) return
              e.preventDefault()
              onMenu(m, e.clientX, e.clientY)
            })}>
            {body}
          </Link>
        )
      })}
    </div>
  )
}
