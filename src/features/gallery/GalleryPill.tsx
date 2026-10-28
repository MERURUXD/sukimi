import { GlassLink } from '@/components/glass/GlassLink'
import { enterGalleryFromLibrary, plainClick, prefetchGallery } from './readMorph'
import './pill.css'
import { t } from '@/i18n'

/**
 * 书库页头右侧的「画廊」入口。玻璃和链接是同一个元素；
 * 点击沿用书库封面飞上画廊那面墙的动画（见 readMorph 的 enterGalleryFromLibrary）。
 */
export function GalleryPill() {
  return (
    <GlassLink
      to="/library/gallery"
      state={{ from: 'library' }}
      viewTransition
      onClick={(e) => plainClick(e) && !window.matchMedia('(prefers-reduced-motion: reduce)').matches && enterGalleryFromLibrary()}
      // 指到按钮上就先载入画廊页的代码：第一次点开时过场不用边飞边等下载和解析
      onPointerEnter={prefetchGallery}
      onFocus={prefetchGallery}
      className="gbtn gallery-pill no-underline max-sm:size-11 max-sm:px-0"
      aria-label={t('gallery.name')}
      title={t('gallery.name')}
    >
      <GalleryIcon />
      <span className="max-sm:hidden" aria-hidden>
        {t('gallery.short')}
      </span>
    </GlassLink>
  )
}

/** lucide 的 images 图标拆成几块，好分别做动画（形状同 lucide，ISC 许可）：后面一张、前面一张、太阳、山 */
function GalleryIcon() {
  return (
    <svg
      className="gallery-icon size-[18px]"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path className="gi-back" d="M18 22H4a2 2 0 0 1-2-2V6" />
      <g className="gi-front">
        <rect width="16" height="16" x="6" y="2" rx="2" />
        <circle className="gi-sun" cx="12" cy="8" r="2" />
        <path className="gi-hill" pathLength={1} d="m22 13-1.296-1.296a2.41 2.41 0 0 0-3.408 0L11 18" />
      </g>
    </svg>
  )
}
