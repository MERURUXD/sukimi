import { useEffect, useState, type CSSProperties } from 'react'
import { CoverFlow } from '@/components/manga/CoverFlow'
import { useAppearance } from '@/design/settings'
import { cn } from '@/lib/cn'

// 背景越过大图区再延伸这么多，在章节标题与前几行背后慢慢淡出，而不是在区块底边整齐截断
const EXTEND = 'clamp(200px, 32vh, 380px)'

/**
 * 详情页背景：和首页一样从封面取色、色块缓慢流动（速度减半，关闭「动态背景」时静止）。
 * 画在整个详情页的最底层而不是大图区里：大图区有自己的层叠上下文，
 * 背景若在里面向下延伸会盖住后面的章节列表。
 */
export function MangaBackdrop({ src, hero, intro }: { src?: string | null; hero: HTMLElement | null; intro: boolean }) {
  const motion = useAppearance((s) => s.homeMotionBg)
  const [h, setH] = useState(0)

  useEffect(() => {
    const el = hero
    if (!el) return
    // 开始观察时会先回调一次，不必在这里同步读取
    const ro = new ResizeObserver(() => setH(el.offsetHeight))
    ro.observe(el)
    return () => ro.disconnect()
  }, [hero])

  if (!h) return null
  const height = `calc(${h}px + ${EXTEND})`
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10" style={{ height }}>
      {/* 裁切层保持不动，避免进场缩放撑宽手机视口；比淡出层短 2px，防止画布取整后在底边漏出亮线 */}
      <div className="absolute inset-x-0 top-0 bottom-0.5 overflow-hidden">
        <div className={cn('absolute inset-0', intro && 'bg-in')}>
          <CoverFlow
            src={src}
            speed={0.5}
            still={!motion}
            className="absolute inset-0"
            fallback={
              src && <img src={src} alt="" className="absolute -top-1/2 -left-[10%] h-[200%] w-[120%] object-cover blur-[70px] saturate-[1.6]" />
            }
          />
        </div>
      </div>
      <div className="absolute inset-0" style={{ background: 'linear-gradient(90deg, var(--scrim-b), var(--scrim-a) 65%, transparent)' }} />
      {/* 从大图区四成高度开始淡出，一直到延伸部分的底部 */}
      <div className="fade-to-bg absolute inset-0" style={{ '--from': `${Math.round(h * 0.4)}px` } as CSSProperties} />
    </div>
  )
}
