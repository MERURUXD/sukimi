import { motion } from 'motion/react'
import { spring } from '@/design/motion'
import { cn } from '@/lib/cn'
import type { PillBox } from './useNavPill'

/**
 * 导航的选中块：一个常驻元素，按容器内坐标滑到当前链接下面（位置由 useNavPill 量出）。
 *
 * 不用 motion 的 layoutId 共享布局：它按页面坐标测量，顶栏、底栏是 fixed，
 * 页面滑动过再切换时，新页面渲染后才滚回顶部，旧位置带着滚动距离，选中块会从错位的地方飞过来。
 *
 * 容器需要定位且 isolate（玻璃 .glass 已经是）。没有当前链接时不显示；
 * 重新出现时 initial={false} 直接放到位，不从左上角滑过来。
 */
export function NavPill({ box, className }: { box: PillBox | null; className?: string }) {
  if (!box) return null
  return (
    <motion.span
      aria-hidden
      initial={false}
      animate={box}
      transition={spring.fast}
      className={cn('pointer-events-none absolute top-0 left-0 -z-10 bg-g-hi shadow-[inset_0_0_0_1px_var(--g-glow)]', className)}
    />
  )
}
