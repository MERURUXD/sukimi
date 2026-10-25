import { AnimatePresence, motion } from 'motion/react'
import { X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { MotionGlass } from '@/components/glass/Glass'
import { spring } from '@/design/motion'

/**
 * 详情页封面的放大查看：点封面打开，点任意处、按 Esc 或关闭按钮收起。
 * 图片已在详情页载入过，直接复用浏览器缓存；按真实宽高比铺满可用区域，宽高比读到之前先按 2:3 占位。
 * 遮罩和玻璃按钮的透明度各自动画，外层不做透明度，玻璃才能采样到背后的页面。
 */
export function CoverZoom({ src, title, onClose }: { src: string; title: string; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const [ratio, setRatio] = useState(2 / 3)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    closeRef.current?.focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div className="fixed inset-0 z-[70] grid place-items-center p-4" role="dialog" aria-modal="true" aria-label={`${title} 的封面`} onClick={onClose}>
      <motion.div className="absolute inset-0 bg-black/70" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} />
      {failed ? (
        <p className="relative m-0 text-sm text-muted">封面加载失败</p>
      ) : (
        <motion.img
          src={src}
          alt={title}
          draggable={false}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.94 }}
          transition={spring.default}
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
        ref={closeRef}
        aria-label="关闭"
        title="关闭"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="gicon absolute top-4 right-4 rounded-full"
        onClick={(e: React.MouseEvent) => { e.stopPropagation(); onClose() }}
      >
        <X className="size-5" strokeWidth={1.8} />
      </MotionGlass>
    </div>,
    document.body,
  )
}

/** 受控版本：挂在 AnimatePresence 里才有退出动画 */
export function CoverZoomHost({ src, title, open, onClose }: { src: string | null | undefined; title: string; open: boolean; onClose: () => void }) {
  return <AnimatePresence>{open && src && <CoverZoom key="zoom" src={src} title={title} onClose={onClose} />}</AnimatePresence>
}
