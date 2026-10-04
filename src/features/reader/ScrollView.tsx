import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { aspectOf, rememberAspect } from './pageCache'
import type { ReaderSettings } from './settings'

/**
 * 纵向连续 / Webtoon：页面竖排滚动。
 * 当前页 = 跨过视口 45% 高度那条线的页面。
 * 未加载的页按已知宽高比（或 0.7）占位，Chrome 的滚动锚定会抵消加载后的高度变化。
 */
export function ScrollView({
  pages,
  startPage,
  settings,
  onPage,
  onCenter,
  onScroll,
  onScrolling,
  footer,
  scrollerRef,
}: {
  pages: string[]
  startPage: number
  settings: ReaderSettings
  onPage: (i: number) => void
  onCenter: () => void
  /** 点击分区翻屏：1 向下、-1 向上 */
  onScroll: (d: 1 | -1) => void
  onScrolling: (v: boolean) => void
  footer: ReactNode
  scrollerRef: React.RefObject<HTMLDivElement | null>
}) {
  const items = useRef<(HTMLImageElement | null)[]>([])
  const onPageRef = useRef(onPage)
  onPageRef.current = onPage
  const webtoon = settings.mode === 'webtoon'

  // 打开时跳到续读的页
  useLayoutEffect(() => {
    items.current[startPage]?.scrollIntoView({ block: 'start' })
    scrollerRef.current?.focus({ preventScroll: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const root = scrollerRef.current
    if (!root) return
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) onPageRef.current(Number((e.target as HTMLElement).dataset.i))
      },
      { root, rootMargin: '-45% 0px -55% 0px' },
    )
    items.current.forEach((el) => el && io.observe(el))
    return () => io.disconnect()
  }, [pages, scrollerRef])

  // 滚动中通知外层（工具栏的折射临时退回毛玻璃）
  useEffect(() => {
    const root = scrollerRef.current
    if (!root) return
    let t: ReturnType<typeof setTimeout>
    const onScroll = () => {
      onScrolling(true)
      clearTimeout(t)
      t = setTimeout(() => onScrolling(false), 180)
    }
    root.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      clearTimeout(t)
      root.removeEventListener('scroll', onScroll)
    }
  }, [scrollerRef, onScrolling])

  const width = {
    screen: 'min(100%, 760px)',
    height: 'min(100%, 760px)',
    width: '100%',
    original: undefined,
  }[settings.fit]

  return (
    <div
      ref={scrollerRef}
      tabIndex={-1}
      onClick={(e) => {
        const zones = settings.tapZones === 'auto' ? 'tb' : settings.tapZones
        const pos = zones === 'lr' ? e.clientX / window.innerWidth : e.clientY / window.innerHeight
        if (zones === 'off' || (pos >= 0.3 && pos <= 0.7)) onCenter()
        else onScroll(pos < 0.3 ? -1 : 1)
      }}
      // 长按图片不弹「保存图片」菜单（鼠标右键照常）；滚到头不触发下拉刷新
      onContextMenu={(e) => (e.nativeEvent as PointerEvent).pointerType === 'touch' && e.preventDefault()}
      className="absolute inset-0 overflow-y-auto overscroll-none outline-none [overflow-anchor:auto] [-webkit-touch-callout:none]"
    >
      <div className={cn('mx-auto flex flex-col items-center', webtoon ? 'gap-0' : 'gap-4 py-4')}>
        {pages.map((src, i) => (
          <img
            key={src}
            ref={(el) => {
              items.current[i] = el
            }}
            data-i={i}
            src={src}
            alt={`第 ${i + 1} 页`}
            loading={Math.abs(i - startPage) <= settings.preload ? 'eager' : 'lazy'}
            decoding="async"
            draggable={false}
            onLoad={(e) => rememberAspect(src, e.currentTarget)}
            className="block h-auto max-w-full select-none"
            style={{ width, aspectRatio: aspectOf(src) ?? 'auto 0.7' }}
          />
        ))}
        {footer}
      </div>
    </div>
  )
}
