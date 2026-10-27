import { ImageOff, LoaderCircle, RotateCw } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { Glass } from '@/components/glass/Glass'
import { cn } from '@/lib/cn'
import { bust, releaseShown, retainShown, retryOriginal } from './pageImage'

/**
 * 一页图片。加载失败时原位换成提示和「重新加载」按钮，页码、排版占位保持不变；
 * 点了按钮先重新请求原图，成功了才换回图片，失败就留在提示上（不闪一下破图）。
 * 裁边 / 拆页的旧 Blob 不再拿来重试；新的处理结果出来后再换上。
 * url 是原图地址（缓存都按它记），src 是实际显示的地址（可能是裁边 / 拆半后的 Blob）。
 */
export function ReaderImage({
  page,
  url,
  src,
  className,
  style,
  fallback,
  marks,
  loading,
  holdSpace,
  onLoad,
}: {
  /** 第几页（从 0 数） */
  page: number
  url: string
  src: string
  className: string
  style?: CSSProperties
  /** 失败提示占的位置（图片自己的尺寸靠内容撑开，没了图要另给） */
  fallback?: CSSProperties
  /** 给外层定位用的 data-* 标记，图片和失败提示都要带 */
  marks?: Record<string, string | number | undefined>
  loading?: 'eager' | 'lazy'
  /** 没加载完时按 fallback 的尺寸占住位置并显示加载提示：双页并排时，另一页不会因为宽度为 0 被挤到中间 */
  holdSpace?: boolean
  onLoad?: (e: React.SyntheticEvent<HTMLImageElement>) => void
}) {
  const [failed, setFailed] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [loaded, setLoaded] = useState(false)
  // 重试成功后先显示刚请求到的原图。父组件稍后换成新的 Blob 时再改回去，避免中间一帧还指着刚回收的地址。
  const [fresh, setFresh] = useState<string | null>(null)
  const seenBlob = useRef(src.startsWith('blob:') ? src : null)
  useEffect(() => {
    if (!fresh) {
      if (src.startsWith('blob:')) seenBlob.current = src
      return
    }
    if (src.startsWith('blob:') && src !== seenBlob.current) setFresh(null)
  }, [src, fresh])
  const displaySrc = fresh ?? (src.startsWith('blob:') ? src : bust(src, src === url ? attempt : 0))

  // 挂在文档里的 Blob 不回收。失败提示不占着那张图，回收才不会把重试用的地址一起废掉。
  useLayoutEffect(() => {
    if (failed || !displaySrc.startsWith('blob:')) return
    retainShown(displaySrc)
    return () => releaseShown(displaySrc)
  }, [failed, displaySrc])

  const retry = () => {
    if (retrying) return
    setRetrying(true)
    const next = attempt + 1
    void retryOriginal(url, next).then((ok) => {
      if (!ok) {
        setRetrying(false)
        return
      }
      setAttempt(next)
      setFresh(bust(url, next))
      setLoaded(false)
      setFailed(false)
      setRetrying(false)
    })
  }

  if (failed) {
    return (
      <div
        {...marks}
        role="group"
        aria-label={`第 ${page + 1} 页${retrying ? '加载中' : '加载失败'}`}
        className="flex max-w-full min-w-[min(100%,260px)] flex-none flex-col items-center justify-center gap-3 bg-white/[0.04] text-sm text-white/70 select-none"
        style={fallback}
      >
        {retrying ? <LoaderCircle className="size-7 animate-spin" strokeWidth={1.6} /> : <ImageOff className="size-7" strokeWidth={1.6} />}
        <span>{retrying ? `第 ${page + 1} 页加载中…` : `第 ${page + 1} 页加载失败`}</span>
        {!retrying && (
          // 阅读区的点击和拖动都挂在外层：按钮自己吃掉点击，免得顺带翻页或切换工具栏
          <Glass as="button" type="button" className="gbtn rounded-full" onClick={(e) => { e.stopPropagation(); retry() }}>
            <RotateCw className="size-4" strokeWidth={2} />
            重新加载
          </Glass>
        )}
      </div>
    )
  }
  const waiting = holdSpace && !loaded
  return (
    <>
      {waiting && (
        <div
          role="status"
          aria-label={`第 ${page + 1} 页加载中`}
          className="flex max-w-full flex-none items-center justify-center text-white/60 select-none"
          style={fallback}
        >
          <LoaderCircle className="size-7 animate-spin" strokeWidth={1.6} />
        </div>
      )}
      <img
        {...marks}
        key={attempt}
        // 缓存里已有的图挂载时就绪，不闪占位
        ref={(el) => {
          if (el?.complete && el.naturalWidth) setLoaded(true)
        }}
        src={displaySrc}
        alt={`第 ${page + 1} 页`}
        loading={loading}
        decoding="async"
        draggable={false}
        onLoad={(e) => {
          setLoaded(true)
          onLoad?.(e)
        }}
        onError={() => setFailed(true)}
        // 加载中的图留在文档里继续请求，但不占位、不可见，由上面的占位顶着
        className={cn(className, waiting && 'pointer-events-none invisible absolute')}
        style={style}
      />
    </>
  )
}
