/*
 * 阅读档案三屏之间的进度与排行翻到第几组。
 *
 * p 每帧在变：0 是第一屏，1 是排行，2 是口味，切屏途中是小数。
 * 不放进 React 状态：每帧重绘整页（时钟刻度、几十张封面）太浪费；各部分订阅后自己改样式。
 * cur 是排行停在第几组（整数），换组时也通知订阅者。
 */
import { clamp01 } from './canvasMath.ts'

export const seg = (p: number, a: number, b: number) => clamp01((p - a) / (b - a))
export const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2)
export const easeOut = (x: number) => 1 - (1 - clamp01(x)) ** 3

/** 最后一屏的编号：0 概览、1 排行、2 口味 */
export const LAST_SCREEN = 2

export interface Pager {
  readonly p: number
  readonly cur: number
  /** 正在切屏（含切完后的一小段冷却，挡住触控板滚动的惯性） */
  readonly busy: boolean
  /** 仅动画帧期间为 true，不含输入冷却；用于临时提升合成层与暂停折射。 */
  readonly animating: boolean
  /** 还没汇总完或没有排行时不能离开第一屏 */
  readonly enabled: boolean
  /** 排行分几组 */
  readonly count: number
  /** 排行分几组、能不能离开第一屏；汇总出来后由页面设定 */
  limit(count: number, enabled: boolean): void
  /** 回到第一屏、第一组，不播动画 */
  reset(): void
  subscribe(fn: () => void): () => void
  /** 切到第 to 屏；ms 是每切一屏要多久，离开页面前收回第一屏时走得快些 */
  go(to: number, done?: () => void, ms?: number): void
  /** 排行翻到第 i 组 */
  flip(i: number): void
  dispose(): void
}

export function createPager(init: { p: number; cur: number; count: number; reduced: boolean }): Pager {
  const subs = new Set<() => void>()
  let p = init.p
  let cur = init.cur
  let busy = false
  let animating = false
  let pageRaf = 0
  let cool = 0
  let count = init.count
  let enabled = false
  const emit = () => subs.forEach((fn) => fn())

  const pager: Pager = {
    get p() {
      return p
    },
    get cur() {
      return cur
    },
    get busy() {
      return busy
    },
    get animating() { return animating },
    get enabled() {
      return enabled
    },
    get count() {
      return count
    },
    limit(n, ok) {
      count = n
      enabled = ok
      // 从详情返回时排行可能变短（比如刚移出书库）：记住的组收回到最后一组，免得翻到空页
      if (n > 0 && cur > n - 1) {
        cur = n - 1
        emit()
      }
    },
    reset() {
      cancelAnimationFrame(pageRaf)
      window.clearTimeout(cool)
      busy = animating = false
      p = cur = 0
      emit()
    },
    subscribe(fn) {
      subs.add(fn)
      return () => subs.delete(fn)
    },
    go(target, done, ms = 1300) {
      const to = Math.max(0, Math.min(LAST_SCREEN, Math.round(target)))
      if (to > 0 && !enabled) return
      cancelAnimationFrame(pageRaf)
      window.clearTimeout(cool)
      const from = p
      // 动画按进度线性走，缓动在各段自己算（表盘、封面、口味各有各的起止）；隔一屏跳过去也不拖太久
      const D = (init.reduced ? Math.min(ms, 260) : ms) * Math.min(1.5, Math.abs(to - from))
      busy = true
      animating = true
      const finish = () => {
        animating = false
        emit()
        cool = window.setTimeout(() => (busy = false), 320)
        done?.()
      }
      if (!D) {
        p = to
        emit()
        return finish()
      }
      const t0 = performance.now()
      emit()
      const step = (now: number) => {
        const k = clamp01((now - t0) / D)
        p = from + (to - from) * k
        emit()
        if (k < 1) pageRaf = requestAnimationFrame(step)
        else finish()
      }
      pageRaf = requestAnimationFrame(step)
    },
    flip(i) {
      const target = Math.max(0, Math.min(count - 1, Math.round(i)))
      if (target === cur) return
      cur = target
      emit()
    },
    dispose() {
      cancelAnimationFrame(pageRaf)
      window.clearTimeout(cool)
      subs.clear()
    },
  }
  return pager
}
