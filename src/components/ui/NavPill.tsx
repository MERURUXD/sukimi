import { motion, useMotionValue, useTransform, useVelocity } from 'motion/react'
import { spring } from '@/design/motion'
import { cn } from '@/lib/cn'
import type { PillBox } from './useNavPill'

/** 速度到拉伸量：每 px/s 拉多少，以及上限（再大就不像玻璃块了） */
const STRETCH = 1 / 5000
const MAX_STRETCH = 0.16

/**
 * 导航的选中块：一个常驻元素，按容器内坐标滑到当前链接下面（位置由 useNavPill 量出）。
 * 滑动时顺着运动方向拉长、垂直方向微微压扁（按速度算，停下就回弹到原样），像一滴液体。
 *
 * 不用 motion 的 layoutId 共享布局：它按页面坐标测量，顶栏、底栏是 fixed，
 * 页面滑动过再切换时，新页面渲染后才滚回顶部，旧位置带着滚动距离，选中块会从错位的地方飞过来。
 *
 * 容器需要定位且 isolate（玻璃 .glass 已经是）。没有当前链接时不显示；
 * 重新出现时 initial={false} 直接放到位，不从左上角滑过来。
 */
export function NavPill({ box, className }: { box: PillBox | null; className?: string }) {
  // x、y 交给 animate 驱动，同时从它们的速度推出拉伸，横向（顶栏）与纵向（平板侧栏）通用
  const x = useMotionValue(box?.x ?? 0)
  const y = useMotionValue(box?.y ?? 0)
  const vx = useVelocity(x)
  const vy = useVelocity(y)
  const stretch = (v: number) => Math.min(Math.abs(v) * STRETCH, MAX_STRETCH)
  const scaleX = useTransform([vx, vy], ([a, b]: number[]) => 1 + stretch(a) - stretch(b) / 2)
  const scaleY = useTransform([vx, vy], ([a, b]: number[]) => 1 + stretch(b) - stretch(a) / 2)

  if (!box) return null
  return (
    <motion.span
      aria-hidden
      initial={false}
      animate={box}
      transition={spring.fast}
      style={{ x, y, scaleX, scaleY }}
      className={cn('pointer-events-none absolute top-0 left-0 -z-10 bg-g-hi shadow-[inset_0_0_0_1px_var(--g-glow)]', className)}
    />
  )
}
