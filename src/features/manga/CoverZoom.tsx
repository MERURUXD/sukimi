import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { X } from 'lucide-react'
import { useState } from 'react'
import { MotionGlass } from '@/components/glass/Glass'
import { Dialog } from '@/components/ui/Dialog'
import { spring, still } from '@/design/motion'
import { t } from '@/i18n'

/**
 * 焦点、Tab 循环和背景 inert 交给共用对话框。
 * 图片复用详情页缓存；宽高比读到前按 2:3 占位。透明度动画放在玻璃自身，外层不能做透明度。
 */
export function CoverZoom({ src, title, onClose }: { src: string; title: string; onClose: () => void }) {
  const reduced = useReducedMotion()
  const [ratio, setRatio] = useState(2 / 3)
  const [failed, setFailed] = useState(false)
  const pop = reduced ? still : spring.default

  return (
    <Dialog label={t('manga.coverOf', { title })} onClose={onClose} fill backdropClassName="bg-black/70">
      {failed ? (
        <p className="relative m-0 text-sm text-muted">{t('manga.coverFailed')}</p>
      ) : (
        <motion.img
          src={src}
          alt={title}
          draggable={false}
          initial={reduced ? false : { opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.94 }}
          transition={pop}
          onLoad={(e) => {
            const { naturalWidth: w, naturalHeight: h } = e.currentTarget
            if (w && h) setRatio(w / h)
          }}
          onError={() => setFailed(true)}
          style={{ aspectRatio: ratio, height: `min(calc(100dvh - 96px), calc((100vw - 32px) / ${ratio}))` }}
          className="relative rounded-[14px] object-contain shadow-[0_40px_100px_rgba(0,0,0,.6),0_0_0_1px_rgba(255,255,255,.1)]"
        />
      )}
      <MotionGlass
        as="button"
        aria-label={t('common.close')}
        title={t('common.close')}
        initial={reduced ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={reduced ? still : { duration: 0.2 }}
        className="gicon absolute top-4 right-4 rounded-full"
        onClick={(e: React.MouseEvent) => { e.stopPropagation(); onClose() }}
      >
        <X className="size-5" strokeWidth={1.8} />
      </MotionGlass>
    </Dialog>
  )
}

/** 受控版本：挂在 AnimatePresence 里才有退出动画 */
export function CoverZoomHost({ src, title, open, onClose }: { src: string | null | undefined; title: string; open: boolean; onClose: () => void }) {
  return <AnimatePresence>{open && src && <CoverZoom key="zoom" src={src} title={title} onClose={onClose} />}</AnimatePresence>
}
