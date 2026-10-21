import { useId } from 'react'
import { BRAND_BLUSH, BRAND_BLUSH_R, BRAND_BODY, BRAND_EARS, BRAND_EYE, BRAND_EYES, BRAND_INNER, BRAND_PINK } from '@/design/brand'
import { cn } from '@/lib/cn'

/**
 * 实心的兔耳书签，用在登录页这类大尺寸处。
 * 用强调色：深色模式是白兔带腮红，浅色模式是墨兔（对应设计稿 02 / 04）；眼睛挖空透出底色。
 */
export function BrandBunny({ className }: { className?: string }) {
  // 遮罩 id 要唯一，避免和页面上其他实例冲突
  const mask = `brand-eyes-${useId()}`
  return (
    <svg viewBox="26 5 484 484" aria-hidden="true" className={cn('shrink-0 text-solid', className)}>
      <mask id={mask} maskUnits="userSpaceOnUse" x="0" y="0" width="512" height="512">
        <rect width="512" height="512" fill="#fff" />
        {BRAND_EYES.map((e) => (
          <rect
            key={e.cx}
            x={e.cx - BRAND_EYE.w / 2}
            y={e.cy - BRAND_EYE.h / 2}
            width={BRAND_EYE.w}
            height={BRAND_EYE.h}
            rx={BRAND_EYE.w / 2}
            transform={`rotate(${BRAND_EYE.tilt} ${e.cx} ${e.cy})`}
            fill="#000"
          />
        ))}
      </mask>
      {/* 先耳朵、再耳内粉色，最后身体盖住耳根 */}
      <path d={BRAND_EARS} fill="currentColor" />
      <path d={BRAND_INNER} fill={BRAND_PINK} />
      <path d={BRAND_BODY} fill="currentColor" mask={`url(#${mask})`} />
      <g fill={BRAND_PINK} className="hidden dark:inline">
        {BRAND_BLUSH.map((b) => (
          <ellipse key={b.cx} cx={b.cx} cy={b.cy} rx={BRAND_BLUSH_R.x} ry={BRAND_BLUSH_R.y} />
        ))}
      </g>
    </svg>
  )
}

/**
 * 站点标志，顶栏和平板侧栏共用：兔耳书签的简化描线版，线宽和导航里的其他图标一致，颜色跟随文字。
 * 图形在 24 格里按外框居中；完整的彩色图标见 public/ 和 design/icons。
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span className={cn('grid size-10 shrink-0 place-items-center', className)}>
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="size-7"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* 竖耳、垂耳、书签身体、两只斜眼 */}
        <path d="M7.5 9.1C6.6 6.6 6.3 4 7.2 3.3C8.4 2.5 9.6 5 9.8 9.1" />
        <path d="M12.6 9.1C12.8 6.3 14.2 4.7 15.8 4.9C17.4 5.1 18.9 7.2 19 8.6C19.1 9.6 18.2 9.9 17 9.4" />
        <path d="M5 11.1a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2V21l-6-3.4L5 21Z" />
        <path d="M9.4 13 8.8 15.1M13.4 13 12.8 15.1" />
      </svg>
    </span>
  )
}
