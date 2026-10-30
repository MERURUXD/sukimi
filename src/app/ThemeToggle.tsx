import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useId, useState, type MouseEvent } from 'react'
import { flushSync } from 'react-dom'
import { Glass } from '@/components/glass/Glass'
import { toast } from '@/components/ui/toast'
import { spring } from '@/design/motion'
import { themeForced, useAppearance } from '@/design/settings'
import { t } from '@/i18n'

const RAYS = Array.from({ length: 8 }, (_, i) => i * 45)
/** 月牙缺口里的两颗星：x、y、大小、闪烁错开的延迟（样式在 index.css 的 .theme-star，只在悬停时闪） */
const STARS = [
  { x: 18.4, y: 5.6, s: 1.5, d: '0s' },
  { x: 20.6, y: 10.6, s: 1, d: '0.5s' },
]

/** 太阳 ⇄ 月亮：圆盘放大成月牙（用一个黑圆从右上角滑进来挖掉一块），光芒收起并转动 */
function SunMoon({ dark }: { dark: boolean }) {
  const mask = useId()
  // 全局的 reduced-motion 样式管不到 motion 的脚本动画，开了「减少动态效果」时图标要直接切换
  const transition = useReducedMotion() ? { duration: 0 } : spring.default
  return (
    <svg viewBox="0 0 24 24" className="size-5 overflow-visible" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
      <mask id={mask}>
        <rect width="24" height="24" fill="white" stroke="none" />
        <motion.circle r="7" fill="black" stroke="none" initial={false} animate={dark ? { cx: 17, cy: 7 } : { cx: 32, cy: -8 }} transition={transition} />
      </mask>
      {/* 深色悬停时月牙侧转（CSS），连同遮罩一起转，所以包在 g 上 */}
      <g className="theme-moon">
        <motion.circle cx="12" cy="12" fill="currentColor" mask={`url(#${mask})`} initial={false} animate={{ r: dark ? 8.5 : 4.5 }} transition={transition} />
      </g>
      {/* 外层 g 负责悬停时的持续自转（CSS），里层 g 负责切换时的收起（motion），两个 transform 不能放同一个元素 */}
      <g className="theme-rays">
        <motion.g initial={false} animate={dark ? { rotate: 90, scale: 0.4, opacity: 0 } : { rotate: 0, scale: 1, opacity: 1 }} transition={transition} style={{ transformOrigin: '12px 12px' }}>
          {RAYS.map((deg) => (
            <line key={deg} x1="12" y1="2.6" x2="12" y2="4.4" transform={`rotate(${deg} 12 12)`} />
          ))}
        </motion.g>
      </g>
      {dark &&
        STARS.map((s) => (
          <path
            key={s.x}
            className="theme-star"
            fill="currentColor"
            stroke="none"
            style={{ animationDelay: s.d }}
            d={`M${s.x} ${s.y - s.s}L${s.x + s.s * 0.3} ${s.y - s.s * 0.3}L${s.x + s.s} ${s.y}L${s.x + s.s * 0.3} ${s.y + s.s * 0.3}L${s.x} ${s.y + s.s}L${s.x - s.s * 0.3} ${s.y + s.s * 0.3}L${s.x - s.s} ${s.y}L${s.x - s.s * 0.3} ${s.y - s.s * 0.3}Z`}
          />
        ))}
    </svg>
  )
}

/** 最近一次发起的切换编号，转场收尾时据此判断自己是不是最新的 */
let latestToggle = 0

/**
 * 顶栏的深浅色切换。
 * 页面颜色用 View Transitions 做「从按钮位置向外扩散」的圆形揭开，做法参考 BewlyCat 的 useDark；
 * 悬停时深色下月牙自己发光、轻轻侧转，缺口里的星星闪烁；浅色下太阳光芒缓慢自转。
 * 不支持、开了「减少动态效果」，或过渡被跳过时直接切换。
 */
export function ThemeToggle() {
  const theme = useAppearance((s) => s.theme)
  const setTheme = useAppearance((s) => s.setTheme)
  // 「跟随系统」时按系统当前的深浅显示图标，系统切换时跟着变
  const [systemDark, setSystemDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches)
  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)')
    const on = () => setSystemDark(query.matches)
    query.addEventListener('change', on)
    return () => query.removeEventListener('change', on)
  }, [])
  const dark = theme === 'system' ? systemDark : theme === 'dark'
  const next = dark ? 'light' : 'dark'

  const toggle = (e: MouseEvent<HTMLButtonElement>) => {
    const root = document.documentElement
    // 过渡的新快照在回调返回后拍，所以同步写好 data-theme 并让状态落地
    const apply = () => {
      root.dataset.theme = next
      flushSync(() => setTheme(next))
    }
    // 书库画廊固定深色：只记下选择，离开画廊后生效，页面颜色不动
    if (themeForced()) {
      setTheme(next)
      toast(t('app.themeToggle.galleryDark', { theme: t(`common.themeName.${next}`) }))
      return
    }
    if (!document.startViewTransition || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return apply()

    const box = e.currentTarget.getBoundingClientRect()
    // 圆心按画面比例写成百分比，不用像素：网页缩放不是 100% 时，过渡伪元素的像素坐标会和页面坐标差一个缩放比，
    // 圆心就会偏离按钮（放大偏向左上，缩小偏向右下）；百分比跟着伪元素自己的尺寸走，不受影响
    const x = `${(((box.left + box.width / 2) / window.innerWidth) * 100).toFixed(3)}%`
    const y = `${(((box.top + box.height / 2) / window.innerHeight) * 100).toFixed(3)}%`
    // 圆半径的百分比以宽高的均方根为基准，150% 约为对角线的 1.06 倍，圆心在屏幕任意位置都盖得住全屏
    const radius = '150%'
    // 圆心和半径也写成变量：index.css 让动在上面的那一层一开始就是裁好的，
    // 否则伪元素出现到脚本挂上动画之间，新的整屏画面会先闪一帧
    root.style.setProperty('--vt-x', x)
    root.style.setProperty('--vt-y', y)
    root.style.setProperty('--vt-r', radius)
    // 写目标主题：index.css 据此关掉全部 CSS 过渡（否则新快照里颜色还在渐变，圆圈揭开的不是最终画面），并决定叠放层次
    root.dataset.themeVt = next
    const transition = document.startViewTransition(apply)
    // 上一次转场还没结束就再点：新转场会让旧的被跳过，旧的收尾不能清掉新的标记和变量
    const token = ++latestToggle
    let reveal: Animation | undefined
    transition.ready
      .then(() => {
        if (token !== latestToggle) return
        // 变深：新的（深色）画面在上面，从按钮处放大盖住旧画面；
        // 变浅：旧的（深色）画面在上面，向按钮处缩小露出新画面。始终是深色那层在动，参考 BewlyCat
        const toDark = next === 'dark'
        const circle = [`circle(0% at ${x} ${y})`, `circle(${radius} at ${x} ${y})`]
        reveal = root.animate(
          { clipPath: toDark ? circle : circle.toReversed() },
          // forwards：停在终点直到过渡结束，不会在最后一帧弹回起点
          { duration: 360, easing: 'ease-in-out', fill: 'forwards', pseudoElement: toDark ? '::view-transition-new(root)' : '::view-transition-old(root)' },
        )
      })
      .catch(() => {})
    void transition.finished
      .finally(() => {
        // 挂在根元素上的伪元素动画不会随过渡自动清掉，forwards 的终点会留到下一次切换，必须手动取消
        reveal?.cancel()
        if (token !== latestToggle) return
        delete root.dataset.themeVt
        root.style.removeProperty('--vt-x')
        root.style.removeProperty('--vt-y')
        root.style.removeProperty('--vt-r')
      })
      .catch(() => {})
  }

  return (
    <div className="theme-btn" data-dark={dark || undefined}>
      <Glass as="button" data-vt-glass="topnav-theme" type="button" className="gicon rounded-full" onClick={toggle} aria-label={t('app.themeToggle.switchTo', { theme: t(`common.themeName.${dark ? 'light' : 'dark'}`) })} title={t('app.themeToggle.switchToShort', { theme: t(`common.themeName.${dark ? 'light' : 'dark'}`) })}>
        <SunMoon dark={dark} />
      </Glass>
    </div>
  )
}
