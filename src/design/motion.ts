import type { Transition } from 'motion/react'

/*
 * 动效参数：Material 3 的分类（空间 = 位置/尺寸，效果 = 透明度/颜色）
 * × Apple 式「时长 + 回弹」写法。效果类不回弹。
 * 首页与转场用 default/slow（表现型），功能页用 fast（高效型）。
 */
export const spring = {
  fast: { type: 'spring', duration: 0.35, bounce: 0.12 },
  default: { type: 'spring', duration: 0.5, bounce: 0.18 },
  slow: { type: 'spring', duration: 0.65, bounce: 0.2 },
} satisfies Record<string, Transition>

export const fade = {
  fast: { duration: 0.15, ease: [0.2, 0, 0, 1] },
  default: { duration: 0.2, ease: [0.2, 0, 0, 1] },
  slow: { duration: 0.3, ease: [0.2, 0, 0, 1] },
} satisfies Record<string, Transition>

/** 系统开启「减少动态效果」时用：不位移、不缩放 */
export const still = { duration: 0 } satisfies Transition

/**
 * 弹出层从触发按钮长出来（components/ui/Popover.tsx）：展开带一点回弹，收起干脆不回弹。
 * 位移和缩放保持布局尺寸不变，另有圆角补偿重绘；折射位移图不用逐帧重画。
 */
export const morph = {
  open: { type: 'spring', duration: 0.45, bounce: 0.16 },
  close: { type: 'spring', duration: 0.3, bounce: 0 },
} satisfies Record<string, Transition>

/**
 * 进出阅读器（lib/readerTransition.ts）：仿 iOS 打开 / 关闭应用的弹簧，
 * 写法同 SwiftUI 的 .spring(response:dampingFraction:)，max 为时长上限（秒）。
 * radius 是展开途中的圆角，落定前收成直角；depth 是背后页面推近的比例。
 * ready 是开始展开前最多等阅读器首屏图片多久（秒），等不到就照常展开。
 */
export const readerVt = {
  ready: 0.4,
  enter: { response: 0.36, damping: 0.86, max: 0.4 },
  exit: { response: 0.3, damping: 0.95, max: 0.36 },
  radius: 24,
  depth: 0.04,
}
