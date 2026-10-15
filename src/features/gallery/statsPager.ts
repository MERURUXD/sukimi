/*
 * 阅读档案两屏之间的进度与封面翻页位置。
 *
 * 两样都每帧在变：p 是第一屏 → 第二屏的进度（0～1），cur 是封面翻到第几部（可以是小数）。
 * 不放进 React 状态：每帧重绘整页（时钟刻度、几十张封面）太浪费；各部分订阅后自己改样式。
 */
import { clamp01 } from './canvasMath.ts'

export const seg = (p: number, a: number, b: number) => clamp01((p - a) / (b - a))
export const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2)
export const easeOut = (x: number) => 1 - (1 - clamp01(x)) ** 3

export interface Pager {
  readonly p: number
  readonly cur: number
  /** 方向键、箭头连按时累加的目标，不按动画中途的位置算 */
  readonly goal: number
  /** 正在切屏（含切完后的一小段冷却，挡住触控板滚动的惯性） */
  readonly busy: boolean
  /** 还没汇总完或没有排行时不能去第二屏 */
  readonly enabled: boolean
  readonly count: number
  /** 排行有几部、能不能去第二屏；汇总出来后由页面设定 */
  limit(count: number, enabled: boolean): void
  /** 回到第一屏、第一部，不播动画 */
  reset(): void
  subscribe(fn: () => void): () => void
  /** ms：从 0 走到 1 要多久；离开页面前收回第一屏时走得快些 */
  go(to: 0 | 1, done?: () => void, ms?: number): void
  /** 拖动、横向滚动时直接设位置，不吸附 */
  setCur(x: number): void
  /** 滑到第 i 部并停下 */
  flip(i: number): void
  dispose(): void
}

export function createPager(init: { p: number; cur: number; count: number; reduced: boolean }): Pager {
  const subs = new Set<() => void>()
  let p = init.p
  let cur = init.cur
  let goal = Math.round(init.cur)
  let busy = false
  let pageRaf = 0
  let flipRaf = 0
  let cool = 0
  let count = init.count
  let enabled = false
  const emit = () => subs.forEach((fn) => fn())
  const clampIdx = (x: number) => Math.max(0, Math.min(count - 1, x))

  const pager: Pager = {
    get p() {
      return p
    },
    get cur() {
      return cur
    },
    get goal() {
      return goal
    },
    get busy() {
      return busy
    },
    get enabled() {
      return enabled
    },
    get count() {
      return count
    },
    limit(n, ok) {
      count = n
      enabled = ok
      // 从详情返回时排行可能变短（比如刚移出书库）：记住的位置收回到最后一部，免得正中空着
      if (n > 0 && (cur > n - 1 || goal > n - 1)) {
        cancelAnimationFrame(flipRaf)
        cur = Math.min(cur, n - 1)
        goal = Math.min(goal, n - 1)
        emit()
      }
    },
    reset() {
      cancelAnimationFrame(pageRaf)
      cancelAnimationFrame(flipRaf)
      p = cur = goal = 0
      emit()
    },
    subscribe(fn) {
      subs.add(fn)
      return () => subs.delete(fn)
    },
    go(to, done, ms = 1300) {
      if (to === 1 && !enabled) return
      cancelAnimationFrame(pageRaf)
      window.clearTimeout(cool)
      const from = p
      // 动画按进度线性走，缓动在各段自己算（表盘、封面、口味各有各的起止）
      const D = (init.reduced ? Math.min(ms, 260) : ms) * Math.abs(to - from)
      busy = true
      const finish = () => {
        cool = window.setTimeout(() => (busy = false), 320)
        done?.()
      }
      if (!D) {
        p = to
        emit()
        return finish()
      }
      const t0 = performance.now()
      const step = (now: number) => {
        const k = clamp01((now - t0) / D)
        p = from + (to - from) * k
        emit()
        if (k < 1) pageRaf = requestAnimationFrame(step)
        else finish()
      }
      pageRaf = requestAnimationFrame(step)
    },
    setCur(x) {
      cancelAnimationFrame(flipRaf)
      cur = Math.max(-0.4, Math.min(count - 0.6, x))
      emit()
    },
    flip(i) {
      const target = (goal = clampIdx(Math.round(i)))
      cancelAnimationFrame(flipRaf)
      if (init.reduced) {
        cur = target
        return emit()
      }
      const from = cur
      const D = 260 + Math.min(6, Math.abs(target - from)) * 70
      const t0 = performance.now()
      const step = (now: number) => {
        const k = easeOut((now - t0) / D)
        cur = from + (target - from) * k
        emit()
        if (k < 1) flipRaf = requestAnimationFrame(step)
      }
      flipRaf = requestAnimationFrame(step)
    },
    dispose() {
      cancelAnimationFrame(pageRaf)
      cancelAnimationFrame(flipRaf)
      window.clearTimeout(cool)
      subs.clear()
    },
  }
  return pager
}
