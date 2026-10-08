/**
 * 把页面分成「一屏显示的组」。
 * - 单页 / 纵向：每页一组
 * - 双页：两两成对；横向的页（跨页大图）独占一组；offsetFirst 时第一页（封面）单独
 * aspects[i] = 宽 / 高，未加载完的页按竖页处理。
 *
 * 配对从第一页顺序往后算，所以前面任何一页的宽高比变了，后面整本的配对都会错一位。
 * 图片是边看边加载的：从中途续读、拖进度条跳页时，前面的页都还没加载，
 * 等它们加载出横页，正在看的这一屏就会被换成另一种配对。因此阅读器只用这个全局结果
 * 决定「落脚点」（续读、跳页），之后的翻页用 nextOf / prevOf 接着当前屏走，
 * 并用 pickSpread 把已经显示的拼版钉住。
 */

/** 宽高比超过这个值的页当作跨页大图，独占一屏 */
const WIDE = 1.1

const wide = (aspects: readonly (number | undefined)[], i: number) => (aspects[i] ?? 0.7) > WIDE

/** 从第 from 页起的一屏：双页时和下一页成对，除非任何一个是横页或已是最后一页 */
function spreadFrom(count: number, double: boolean, from: number, aspects: readonly (number | undefined)[]) {
  if (!double || from + 1 >= count || wide(aspects, from) || wide(aspects, from + 1)) return [from]
  return [from, from + 1]
}

export function buildSpreads(count: number, double: boolean, offsetFirst: boolean, aspects: readonly (number | undefined)[]) {
  const spreads: number[][] = []
  let i = 0
  if (double && offsetFirst && count > 0) {
    spreads.push([0])
    i = 1
  }
  while (i < count) {
    const s = spreadFrom(count, double, i, aspects)
    spreads.push(s)
    i += s.length
  }
  return spreads
}

export function spreadOf(spreads: readonly number[][], page: number) {
  const idx = spreads.findIndex((s) => s.includes(page))
  return idx < 0 ? 0 : idx
}

/** 当前屏之后的一屏：从它的最后一页接着往后配对，不受前面页面宽高比的影响 */
export function nextOf(count: number, double: boolean, cur: readonly number[], aspects: readonly (number | undefined)[]) {
  const from = cur[cur.length - 1] + 1
  return from < count ? spreadFrom(count, double, from, aspects) : undefined
}

/**
 * 当前屏之前的一屏：取全局拼版里包含前一页的那组，裁掉已经和当前屏重叠的部分。
 * 页码总是和当前屏首尾相接，不会漏页也不会重复。
 */
export function prevOf(spreads: readonly number[][], cur: readonly number[]) {
  if (cur[0] <= 0) return undefined
  const s = spreads[spreadOf(spreads, cur[0] - 1)].filter((p) => p < cur[0])
  return s.length ? s : undefined
}

/**
 * 当前页所在的一屏。钉住的拼版（上一次翻页或落脚点确定的那一屏）只要还成立就继续用，
 * 避免加载出新的宽高比后整本重新配对、把正在看的页换掉；
 * 钉子不含当前页、页码不连续，或有横页混在两页之间，才回到全局结果。
 */
export function pickSpread(
  spreads: readonly number[][],
  page: number,
  pin: readonly number[] | null,
  aspects: readonly (number | undefined)[],
  count: number,
) {
  if (pin && pin.includes(page) && pin[pin.length - 1] < count) {
    const ok = pin.length === 1 || (pin.length === 2 && pin[1] === pin[0] + 1 && !wide(aspects, pin[0]) && !wide(aspects, pin[1]))
    if (ok) return pin as number[]
  }
  return spreads[spreadOf(spreads, page)] ?? [page]
}
