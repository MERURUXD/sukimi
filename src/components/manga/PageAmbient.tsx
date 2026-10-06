/**
 * 页面顶部的氛围光：有封面时跟随封面取色，没有就用中性光晕，
 * 这样首页以外的功能页（书库、更新、阅读历史、发现、设置）底色保持一致。
 */
export function PageAmbient({ src, sfw }: { src?: string | null; sfw?: '' }) {
  return (
    <div className="ambient" aria-hidden data-sfw={sfw}>
      {src ? <img src={src} alt="" /> : <div className="ambient-neutral" />}
    </div>
  )
}
