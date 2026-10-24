import { createElement, useCallback, useContext, useId, useRef, type ComponentPropsWithoutRef, type CSSProperties, type Ref } from 'react'
import { motion } from 'motion/react'
import { useAppearance } from '@/design/settings'
import { cn } from '@/lib/cn'
import { useGlassTuning } from '@/design/glassTuning'
import { LensFilter, supportsRefract, useLensMap, type LensOptions } from './refract'
import { MovingGlassBackdrop } from './MovingGlassBackdrop'

type Tag = 'div' | 'span' | 'nav' | 'header' | 'section' | 'aside' | 'form' | 'footer' | 'label' | 'button' | 'a'

type GlassProps<T extends Tag> = {
  as?: T
  /** 浮在内容之上的条（批量栏、下载条、阅读器工具栏），底色更实、模糊更强 */
  dense?: boolean
  /** 临时关闭折射（尺寸动画、长列表快速滚动时） */
  suspendRefract?: boolean
  /** 单独覆盖折射参数 */
  lens?: Partial<LensOptions & { blur: number }>
  ref?: Ref<HTMLElement>
} & ComponentPropsWithoutRef<T>

/**
 * 玻璃容器。外观取决于设置里的玻璃档位：
 * - frosted / solid：纯 CSS（.glass 与 [data-glass] 规则）
 * - refract：在 Chromium 上额外挂透镜位移滤镜，其他浏览器自动退回毛玻璃
 */
export function Glass<T extends Tag = 'div'>({
  as,
  dense,
  suspendRefract,
  lens,
  className,
  style,
  children,
  ref,
  ...rest
}: GlassProps<T>) {
  const mode = useAppearance((s) => s.glass)
  const t = useGlassTuning()
  const moving = useContext(MovingGlassBackdrop)
  const host = useRef<HTMLElement>(null)
  const filterId = `lens${useId().replace(/[:«»]/g, '')}`
  const on = mode === 'refract' && !suspendRefract && moving !== 'suspend' && supportsRefract()
  const o: LensOptions = {
    bezel: lens?.bezel ?? t.bezel,
    strength: lens?.strength ?? t.strength,
    falloff: lens?.falloff ?? t.falloff,
    dispersion: lens?.dispersion ?? (moving ? 0 : t.dispersion),
  }
  const blur = lens?.blur ?? (dense ? t.denseBlur : t.blur)
  const feImage = useLensMap(host, on, o)
  const setRef = useCallback(
    (el: HTMLElement | null) => {
      host.current = el
      if (typeof ref === 'function') ref(el)
      else if (ref) ref.current = el
    },
    [ref],
  )

  const refractStyle: CSSProperties | undefined = on
    ? {
        // veil 档：提亮 / 压暗按主题和 dense 取自 CSS 变量 --g-veil（见 index.css）；
        // 透镜放到最后，弯折和色散的彩边不再被模糊揉开。外缘一个像素要挤进好几个像素的画面，
        // 黑白文字会挤成断续的虚线，透镜后再补 0.5px 抹平这些台阶
        backdropFilter:
          t.tone === 'veil'
            ? `blur(${blur}px) saturate(${t.saturate}) var(--g-veil) url(#${filterId}) blur(0.5px)`
            : `url(#${filterId}) blur(${blur}px) saturate(${t.saturate})`,
      }
    : undefined

  return createElement(
    as ?? 'div',
    {
      ...rest,
      ref: setRef,
      'data-refract': on || undefined,
      className: cn('glass', dense && 'dense', className),
      style: { ...refractStyle, ...style },
    },
    on && <LensFilter id={filterId} feImage={feImage} dispersion={o.dispersion} />,
    children,
  )
}

/**
 * 可做动画的玻璃。透明度动画必须加在玻璃自身上：
 * 祖先元素 opacity < 1 时 Chrome 会把它当成 backdrop 根，玻璃里就采不到背后的内容。
 */
export const MotionGlass = motion.create(Glass)
