import { ImageOff } from 'lucide-react'
import { useCallback, useRef, useState, type ImgHTMLAttributes } from 'react'
import { refreshAccessToken, tokenExpiring, useAuth } from '@/api/auth'
import { onCoverVisibility } from '@/lib/coverVisibility'
import { CoverSkeleton } from './CoverSkeleton'

/**
 * 放在 .cv 里的封面图。服务端从来源取封面失败（比如来源网站连不上）时返回 500，
 * 这时显示占位图标而不是破图。
 *
 * 封面较大时加载要几秒：加载期间显示流光占位，载入后渐显，避免整块纯黑像坏图。
 * 已经在浏览器缓存里的封面第一帧就是完整的，直接显示，不播渐显。
 *
 * 重开页面时书库等页面在登录验证完成前就先显示，这时封面 Cookie 可能已过期而加载失败：
 * 先保持占位，验证完成后重新加载一次，不当成坏图。
 * 同样，令牌过期后（比如服务端停机很久又恢复）Cookie 也失效，先续期再重试一次。
 */
export function CoverImg({ src, ...rest }: { src: string | null | undefined } & Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'>) {
  const [failed, setFailed] = useState<string | null>(null)
  // 登录验证完成前加载失败的地址，验证完成后重试
  const [deferred, setDeferred] = useState<string | null>(null)
  const checking = useAuth((s) => s.status === 'checking')
  const [renewing, setRenewing] = useState(false)
  // 已载入的地址；只对在屏内等待后载入的封面渐显
  const [loaded, setLoaded] = useState<{ src: string; fade: boolean } | null>(null)
  const cancelVisibility = useRef<(() => void) | undefined>(undefined)

  const attach = useCallback((el: HTMLImageElement | null) => {
    cancelVisibility.current?.()
    cancelVisibility.current = undefined
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
  const retry = deferred === src
  if (retry && (checking || renewing)) return <CoverSkeleton />
  return (
    <>
      {!ready && <CoverSkeleton />}
      <img
        // 重试时换一个元素重新请求
        key={retry ? 'retry' : 'first'}
        ref={attach}
        src={src}
        alt=""
        decoding="async"
        draggable={false}
        data-cover={ready ? (loaded.fade ? 'fade' : 'done') : 'loading'}
        onLoad={(e) => {
          if (loaded?.src === src) return
          cancelVisibility.current?.()
          const image = e.currentTarget
          cancelVisibility.current = onCoverVisibility(image, (fade) => {
            if (!image.isConnected || image.getAttribute('src') !== src) return
            setLoaded((l) => (l?.src === src ? l : { src, fade }))
          })
        }}
        onError={() => {
          const { status } = useAuth.getState()
          if (retry) return setFailed(src)
          if (status === 'checking') return setDeferred(src)
          if (status === 'signedIn' && tokenExpiring()) {
            setDeferred(src)
            setRenewing(true)
            void refreshAccessToken()
              .catch(() => {})
              .finally(() => setRenewing(false))
            return
          }
          setFailed(src)
        }}
        {...rest}
      />
    </>
  )
}
