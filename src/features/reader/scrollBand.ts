/**
 * 纵向 / Webtoon 用视口顶部的一条窄带判断当前页。
 * 以前是 45% 高度处的一条 0 高度线：短页用 scrollIntoView 顶对齐后，线仍落在后面的页上，
 * 交叉观察器把刚按方向键跳过去的页码拉回去。带有高度且贴着顶部，顶对齐的短页也会穿过它。
 */

/** 观察带占滚动容器高度的百分比，从顶部往下 */
export const SCROLL_BAND_PERCENT = 8

export const SCROLL_BAND = { start: 0, end: SCROLL_BAND_PERCENT / 100 }

export function scrollBandRootMargin(band: { start: number; end: number } = SCROLL_BAND): string {
  const top = Math.round(band.start * 100)
  const bottom = Math.round((1 - band.end) * 100)
  return `${top === 0 ? '0px' : `-${top}%`} 0px -${bottom}% 0px`
}

export interface BandHit {
  index: number
  overlap: number
  half?: number
}

/** 同时穿过观察带的几页里，取得重叠更高的那一页；一样高时取更靠前的 */
export function bestBandHit<T extends BandHit>(hits: readonly T[]): T | undefined {
  let best: T | undefined
  for (const hit of hits) {
    if (!(hit.overlap > 0)) continue
    if (
      !best ||
      hit.overlap > best.overlap ||
      (hit.overlap === best.overlap && (hit.index < best.index || (hit.index === best.index && (hit.half ?? -1) < (best.half ?? -1))))
    ) {
      best = hit
    }
  }
  return best
}

/**
 * 给定各页在内容里的位置，当前滚动下观察带落在哪一页。
 * 0 高度的带当成一条线：线严格落在页内才算。
 */
export function pageAtBand(
  pages: readonly { index: number; top: number; height: number }[],
  scrollTop: number,
  viewHeight: number,
  band: { start: number; end: number },
): number | undefined {
  const bandTop = scrollTop + band.start * viewHeight
  const bandBottom = scrollTop + band.end * viewHeight
  const line = bandBottom <= bandTop
  const hits: BandHit[] = []
  for (const page of pages) {
    const top = page.top
    const bottom = page.top + page.height
    let overlap = Math.min(bottom, bandBottom) - Math.max(top, bandTop)
    if (line && top <= bandTop && bottom > bandTop) overlap = 1
    if (overlap > 0) hits.push({ index: page.index, overlap })
  }
  return bestBandHit(hits)?.index
}

/**
 * 把 target 顶对齐（够不着时停在最大滚动）之后，观察器会认定的页码。
 * 页与页之间留 gap，最后一页后面不留。
 */
export function pageAfterTopAlign(
  pages: readonly { index: number; height: number }[],
  target: number,
  viewHeight: number,
  gap: number,
  band: { start: number; end: number } = SCROLL_BAND,
): number | undefined {
  let y = 0
  const laid = pages.map((page, n) => {
    const laidPage = { index: page.index, top: y, height: page.height }
    y += page.height + (n === pages.length - 1 ? 0 : gap)
    return laidPage
  })
  const found = laid.find((page) => page.index === target)
  if (!found) return undefined
  const scrollTop = Math.min(Math.max(0, found.top), Math.max(0, y - viewHeight))
  return pageAtBand(laid, scrollTop, viewHeight, band)
}

/**
 * 跳页之后观察器报上来的页。还没落到目标页时丢掉这次，避免把页码拉回跳之前的那一页。
 * 落到了、或这次不是跳页，就采用报上来的页。
 */
export function observedAfterJump(landed: number | null, observed: number): number | null {
  if (landed !== null && observed !== landed) return null
  return observed
}
