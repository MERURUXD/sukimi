import { useEffect, useState, type CSSProperties } from 'react'

/**
 * 列表第一次从网络拿到数据时的进场动画开关（配合 .rise）。
 * 数据出现后动画放完就关掉，之后新挂载的条目（滚动、筛选）不再播。
 */
export function useIntro(wanted: boolean, ready: boolean) {
  const [on, setOn] = useState(wanted)
  useEffect(() => {
    if (!on || !ready) return
    const t = setTimeout(() => setOn(false), 1400)
    return () => clearTimeout(t)
  }, [on, ready])
  return on
}

/** 网格：从左上往右下斜着推开，最多 0.6 秒 */
export const riseDelay = (row: number, col: number): CSSProperties =>
  ({ '--d': `${Math.min((row * 2 + col) * 40, 600)}ms` }) as CSSProperties

/** 线性列表：每条晚 35ms，最多 0.6 秒 */
export const riseStep = (i: number): CSSProperties => ({ '--d': `${Math.min(i * 35, 600)}ms` }) as CSSProperties
