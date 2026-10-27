import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { aspectOf, rememberAspect } from './pageCache'
import { ReaderImage } from './ReaderImage'
import { halfAspect, type Half } from './pageTools'
import { bestBandHit, scrollBandRootMargin } from './scrollBand'
import type { ReaderSettings } from './settings'

/**
 * 纵向连续 / Webtoon：页面竖排滚动。
 * 当前页 = 穿过视口顶部一条窄带的页面。短页顶对齐后仍算在这一页。
 * 未加载的页按已知宽高比（或 0.7）占位，Chrome 的滚动锚定会抵消加载后的高度变化。
 * 拆分宽页时一页显示成上下两张（先读的一半在上），两张都标着同一个页码。
 */
export function ScrollView({
  pages,
  src,
  splits,
  startPage,
  settings,
  onPage,
  onAspect,
  onCenter,
  onScroll,
  onScrolling,
  onInteract,
  footer,
  scrollerRef,
}: {
  pages: string[]
  /** 实际显示的地址（裁边 / 拆半后的图）；拆半页还没处理好时为 undefined */
  src: (i: number, half?: Half) => string | undefined
  /** 这一页要不要拆成两半 */
  splits: (i: number) => boolean
  /** 记下一页的宽高比后通知外层，宽页才能重新判定要不要拆 */
  onAspect: () => void
  startPage: number
  settings: ReaderSettings
  /** 穿过顶部观察带的页；拆成两半的页同时给出是哪一半 */
  onPage: (i: number, half?: Half) => void
  onCenter: () => void
  /** 点击分区翻屏：1 向下、-1 向上 */
  onScroll: (d: 1 | -1) => void
  onScrolling: (v: boolean) => void
  /** 用户自己滚动或点按：跳页时先压住的页码可以交给观察器 */
  onInteract?: () => void
  footer: ReactNode
  scrollerRef: React.RefObject<HTMLDivElement | null>
}) {
  const onPageRef = useRef(onPage)
  onPageRef.current = onPage
  const webtoon = settings.mode === 'webtoon'
  const entries = pages.flatMap((url, i) => (splits(i) ? ([0, 1] as const).map((h) => ({ url, i, half: h as Half | undefined })) : [{ url, i, half: undefined }]))
  // 哪些页拆成了两半、哪半还在占位：变了 DOM 元素就换了，要重新登记当前页的观察对象
  const layout = entries.map((e) => `${e.i}${e.half ?? ''}${src(e.i, e.half) ? '' : '?'}`).join(',')

  // 打开时跳到续读的页
  useLayoutEffect(() => {
    scrollerRef.current?.querySelector(`[data-i="${startPage}"]`)?.scrollIntoView({ block: 'start' })
    scrollerRef.current?.focus({ preventScroll: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const root = scrollerRef.current
    if (!root) return
    const hits = new Map<Element, { index: number; overlap: number; half?: Half }>()
    const emit = () => {
      const best = bestBandHit([...hits.values()])
      if (best) onPageRef.current(best.index, best.half)
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const el = e.target as HTMLElement
          if (!e.isIntersecting || e.intersectionRect.height <= 0) {
            hits.delete(el)
            continue
          }
          const { i, half } = el.dataset
          hits.set(el, {
            index: Number(i),
            overlap: e.intersectionRect.height,
            half: half === undefined || half === '' ? undefined : (Number(half) as Half),
          })
        }
        emit()
      },
      { root, rootMargin: scrollBandRootMargin() },
    )
    root.querySelectorAll('[data-i]').forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [pages, scrollerRef, layout])

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
      onPointerDown={() => onInteract?.()}
      onWheel={() => onInteract?.()}
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
        {entries.map(({ url, i, half }) => {
          const shown = src(i, half)
          const known = aspectOf(url)
          // 处理过的图宽高比和原图不同：先按估计值占位，载入后按图片自己的比例
          const ratio = shown === url ? (known ?? 'auto 0.7') : half === undefined ? `auto ${known ?? 0.7}` : `auto ${halfAspect(known) ?? 0.7}`
          const key = `${url}#${half ?? ''}`
          if (!shown) return <div key={key} data-i={i} data-half={half} className="block max-w-full" style={{ width, aspectRatio: ratio }} aria-label={`第 ${i + 1} 页（处理中）`} />
          return (
            <ReaderImage
              key={key}
              marks={{ 'data-i': i, 'data-half': half }}
              page={i}
              url={url}
              src={shown}
              loading={Math.abs(i - startPage) <= settings.preload ? 'eager' : 'lazy'}
              onLoad={(e) => {
                if (shown !== url) return
                rememberAspect(url, e.currentTarget)
                onAspect()
              }}
              className="reader-page block h-auto max-w-full select-none"
              style={{ width, aspectRatio: ratio }}
              fallback={{ width, aspectRatio: ratio, minHeight: 240 }}
            />
          )
        })}
        {footer}
      </div>
    </div>
  )
}
