/**
 * 把页面分成「一屏显示的组」。
 * - 单页 / 纵向：每页一组
 * - 双页：两两成对；横向的页（跨页大图）独占一组；offsetFirst 时第一页（封面）单独
 * aspects[i] = 宽 / 高，未加载完的页按竖页处理。
 */
export function buildSpreads(count: number, double: boolean, offsetFirst: boolean, aspects: readonly (number | undefined)[]) {
  const spreads: number[][] = []
  if (!double) {
    for (let i = 0; i < count; i++) spreads.push([i])
    return spreads
  }
  const wide = (i: number) => (aspects[i] ?? 0.7) > 1.1
  let i = 0
  if (offsetFirst && count > 0) {
    spreads.push([0])
    i = 1
  }
  while (i < count) {
    if (wide(i) || i + 1 >= count || wide(i + 1)) {
      spreads.push([i])
      i += 1
    } else {
      spreads.push([i, i + 1])
      i += 2
    }
  }
  return spreads
}

export function spreadOf(spreads: readonly number[][], page: number) {
  const idx = spreads.findIndex((s) => s.includes(page))
  return idx < 0 ? 0 : idx
}
