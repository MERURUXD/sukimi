import { createElement, useCallback, useContext, useRef, type ComponentPropsWithoutRef, type Ref } from 'react'
import { motion } from 'motion/react'
import { supportsSvgBackdropRefraction, type RefractFilterConfig } from '@sessile/dom'
import { useAppearance } from '@/design/settings'
import { cn } from '@/lib/cn'
import { GLASS_REFRACT_SCALE_MULTIPLIER, useGlassTuning } from '@/design/glassTuning'
import { glassBackdropProbe } from './backdrop'
import { useElasticPress } from './elasticPress'
import { MovingGlassBackdrop } from './MovingGlassBackdrop'
import { useGlassSurface } from './surface'

type LensOptions = Pick<RefractFilterConfig, 'bezel' | 'strength' | 'dispersion' | 'scaleMultiplier' | 'profile' | 'ior' | 'caustics'>

type Tag = 'div' | 'span' | 'nav' | 'header' | 'section' | 'aside' | 'form' | 'footer' | 'label' | 'button' | 'a'

type GlassProps<T extends Tag> = {
  as?: T
  /** 浮在内容之上的条（批量栏、下载条、阅读器工具栏），底色更实、模糊更强 */
  dense?: boolean
  /** 关掉透镜（尺寸动画、长列表快速滚动、背后只是氛围光时），底色和模糊照旧 */
  suspendRefract?: boolean
  /** 直接放在纯色页面上：背后没有可采样的内容，用不透明表面，不挂模糊和折射 */
  flat?: boolean
  /** 单独覆盖折射参数 */
  lens?: Partial<LensOptions & { blur: number }>
  /** 按压弹性反馈：非 flat 的 button / a 默认开启 */
  elastic?: boolean
  ref?: Ref<HTMLElement>
} & ComponentPropsWithoutRef<T>

/**
 * 玻璃容器。外观取决于设置里的玻璃档位：
 * - refract / frosted：由 Sessile 控制器绘制（见 surface.ts），材质取自 .glass 的 CSS；
 *   refract 在 Chromium 上挂透镜位移滤镜，其他浏览器自动退回毛玻璃。关掉透镜时仍用折射档的底色，
 *   不然会突然换成毛玻璃的白底，在氛围光上明显发亮
 * - solid 与 flat：纯 CSS 的不透明表面
 * - 开启「自适应底色」时按背后的内容调整底色、提亮和压缩力度，保证文字对比度
 */
export function Glass<T extends Tag = 'div'>({
  as,
  dense,
  suspendRefract,
  flat,
  lens,
  elastic,
  className,
  style,
  children,
  ref,
  ...rest
}: GlassProps<T>) {
  const mode = useAppearance((s) => s.glass)
  const t = useGlassTuning()
  const moving = useContext(MovingGlassBackdrop)
  const adaptive = useAppearance((s) => s.glassAdaptiveTint)
  const host = useRef<HTMLElement>(null)
  const isDisabled = 'disabled' in rest && Boolean(rest.disabled)
  const elasticEnabled = (elastic ?? ((as === 'button' || as === 'a') && !flat)) && !isDisabled
  useElasticPress(host, { enabled: elasticEnabled })
  const tone = !flat && mode === 'refract' && supportsSvgBackdropRefraction()
  const on = tone && !suspendRefract && moving !== 'suspend'
  const o: LensOptions = {
    bezel: lens?.bezel ?? t.bezel,
    strength: lens?.strength ?? t.strength,
    dispersion: lens?.dispersion ?? (moving ? 0 : t.dispersion),
    scaleMultiplier: lens?.scaleMultiplier ?? GLASS_REFRACT_SCALE_MULTIPLIER,
    profile: lens?.profile ?? t.profile,
    ior: lens?.ior ?? t.ior,
    caustics: lens?.caustics,
  }
  const blur = lens?.blur ?? (dense ? t.denseBlur : t.blur)
  const classes = typeof className === 'string' ? className.split(/\s+/) : []
  // 文字按 WCAG AA（4.5:1）托住；纯图标按钮只需非文字对比度（3:1），玻璃保持更通透
  const tier = classes.includes('glass-legible') ? 'legible' : classes.includes('gicon') ? 'clear' : 'regular'
  useGlassSurface(host, {
    enabled: !flat && mode !== 'solid',
    refract: on,
    tone,
    // 毛玻璃档的模糊与饱和度取 .glass 的 CSS
    blur: tone ? blur : null,
    saturate: tone ? t.saturate : null,
    refraction: o,
    legibility: adaptive ? { tier, probe: glassBackdropProbe } : null,
    styleKey: `${t.preset}|${t.tint}|${t.denseTint}|${dense}|${className}`,
  })
  const setRef = useCallback(
    (el: HTMLElement | null) => {
      host.current = el
      if (typeof ref === 'function') ref(el)
      else if (ref) ref.current = el
    },
    [ref],
  )

  return createElement(
    as ?? 'div',
    {
      ...rest,
      ref: setRef,
      'data-refract': tone || undefined,
      'data-flat': flat || undefined,
      className: cn('glass', dense && 'dense', className),
      style,
    },
    children,
  )
}

/**
 * 可做动画的玻璃。透明度动画必须加在玻璃自身上：
 * 祖先元素 opacity < 1 时 Chrome 会把它当成 backdrop 根，玻璃里就采不到背后的内容。
 */
export const MotionGlass = motion.create(Glass)
