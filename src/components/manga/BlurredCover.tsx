import { useEffect, useRef } from 'react'
import { motion, type HTMLMotionProps } from 'motion/react'
import { registerBackdrop, swatchTelemetry } from '@/components/glass/backdrop'
import { coverPalette, NEUTRAL_SWATCHES } from '@/lib/coverColor'

/**
 * 高度模糊的封面背景（关闭「动态背景」或动态背景不可用时的静态版本）。
 * 画面只剩封面的几团主色，所以和 CoverFlow 一样按色板登记为玻璃的背景统计：
 * 同一张封面，开不开动态背景，浮在上面的玻璃都按同样的明暗保证文字可读。
 * 读不到封面颜色（跨域、加载失败）时不登记，玻璃按页面底色处理。
 */
export function BlurredCover({ src, ...rest }: Omit<HTMLMotionProps<'img'>, 'src'> & { src?: string | null }) {
  const img = useRef<HTMLImageElement>(null)

  useEffect(() => {
    const el = img.current
    if (!el || !src) return
    let live = true
    let unregister: (() => void) | undefined
    void coverPalette(src).then((swatches) => {
      const telemetry = live && swatches !== NEUTRAL_SWATCHES && swatchTelemetry(swatches)
      if (telemetry) unregister = registerBackdrop(el, () => telemetry)
    })
    return () => {
      live = false
      unregister?.()
    }
  }, [src])

  return <motion.img ref={img} src={src ?? undefined} alt="" {...rest} />
}
