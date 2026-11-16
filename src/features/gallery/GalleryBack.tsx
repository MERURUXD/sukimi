import { ChevronLeft } from 'lucide-react'
import { Glass } from '@/components/glass/Glass'
import { cn } from '@/lib/cn'
import { t } from '@/i18n'

/** 与 TopNav 左侧标志同位置；画布和阅读档案没有顶栏，用它替代标志。 */
export const BACK_SLOT = 'md:top-[calc((var(--nav-h)-52px)/2)] md:left-[max(32px,calc((100%-1320px)/2+32px))] lg:left-[max(48px,calc((100%-1320px)/2+48px))]'

export function GalleryBack({ onClick, title, className }: { onClick: () => void; title?: string; className?: string }) {
  return (
    <Glass
      as="button"
      type="button"
      onClick={onClick}
      aria-label={t('gallery.backAria')}
      title={title}
      className={cn('flex items-center rounded-full text-text max-md:size-11 max-md:justify-center max-md:p-0 md:h-[52px] md:gap-1 md:pr-5 md:pl-3.5 md:text-[17px] md:font-bold', className)}
    >
      <ChevronLeft className="size-6" strokeWidth={1.8} />
      <span className="max-md:hidden">{t('gallery.short')}</span>
    </Glass>
  )
}
