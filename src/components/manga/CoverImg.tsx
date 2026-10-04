import { ImageOff } from 'lucide-react'
import { useState, type ImgHTMLAttributes } from 'react'

/**
 * 放在 .cv 里的封面图。服务端从来源取封面失败（比如来源网站连不上）时返回 500，
 * 这时显示占位图标而不是破图。
 */
export function CoverImg({ src, ...rest }: { src: string | null | undefined } & Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'>) {
  const [failed, setFailed] = useState<string | null>(null)
  if (!src || failed === src) {
    return (
      <span className="absolute inset-0 grid place-items-center text-faint" aria-hidden>
        <ImageOff className="size-1/4 max-w-8" strokeWidth={1.5} />
      </span>
    )
  }
  return <img src={src} alt="" decoding="async" draggable={false} onError={() => setFailed(src)} {...rest} />
}
