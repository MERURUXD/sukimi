import { ImageOff } from 'lucide-react'
import { useCallback, useState, type ImgHTMLAttributes } from 'react'

/**
 * 放在 .cv 里的封面图。服务端从来源取封面失败（比如来源网站连不上）时返回 500，
 * 这时显示占位图标而不是破图。
 *
 * 封面较大时加载要几秒：加载期间显示流光占位，载入后渐显，避免整块纯黑像坏图。
 * 已经在浏览器缓存里的封面第一帧就是完整的，直接显示，不播渐显。
 */
export function CoverImg({ src, ...rest }: { src: string | null | undefined } & Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'>) {
  const [failed, setFailed] = useState<string | null>(null)
  // 已载入的地址；fade 表示是在等待之后才载入的，需要渐显
  const [loaded, setLoaded] = useState<{ src: string; fade: boolean } | null>(null)

  const attach = useCallback((el: HTMLImageElement | null) => {
    const current = el?.getAttribute('src')
    if (current && el!.complete && el!.naturalWidth > 0) setLoaded((l) => (l?.src === current ? l : { src: current, fade: false }))
  }, [])

  if (!src || failed === src) {
    return (
      <span className="absolute inset-0 grid place-items-center text-faint" aria-hidden>
        <ImageOff className="size-1/4 max-w-8" strokeWidth={1.5} />
      </span>
    )
  }
  const ready = loaded?.src === src
  return (
    <>
      {!ready && <span className="cover-skeleton" aria-hidden />}
      <img
        ref={attach}
        src={src}
        alt=""
        decoding="async"
        draggable={false}
        data-cover={ready ? (loaded.fade ? 'fade' : 'done') : 'loading'}
        onLoad={() => setLoaded((l) => (l?.src === src ? l : { src, fade: true }))}
        onError={() => setFailed(src)}
        {...rest}
      />
    </>
  )
}
