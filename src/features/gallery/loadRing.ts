/**
 * 阅读档案加载时外圈进度的算法。纯函数：不碰 DOM，测试直接导入。
 *
 * 章节一页页取回来，进度如果只按「已取 ÷ 已读」画，每到一页就跳一大段、等下一页时又停住。
 * 所以显示值平滑地追目标，等下一页时目标自己慢慢往前挪一点（最多挪到这一页的一部分），新的一页到了再接着追。
 */

/** 加载中最多走到这里，剩下的一段留给数据到齐时滑满 */
export const LOAD_CAP = 0.96
/** 等下一页时最多往前挪这一页的多少 */
const CREEP = 0.6
/** 往前挪的快慢（毫秒），越大越慢 */
const CREEP_MS = 1800
/** 显示值追目标的快慢（毫秒） */
const CHASE_MS = 260
/** 还不知道总数（书库没加载完）时，假定一页占整圈的这么多，只用来慢慢挪 */
const UNKNOWN_STEP = 0.25

/**
 * 这一刻外圈该追到的位置（0～LOAD_CAP）。
 * fetched：已取的话数；expected：大约要取的话数（书库的已读话数，不知道时为 null）；
 * page：一页的话数；since：距上一页到达（或开始加载）过了多少毫秒。
 * 查询取的是「已读或有阅读时间」的章节，已取的可能比已读多，所以一律封顶。
 */
export function loadTarget(fetched: number, expected: number | null, page: number, since: number) {
  const known = expected != null && expected > 0
  const base = known ? fetched / expected : 0
  const step = known ? page / expected : UNKNOWN_STEP
  const creep = (1 - Math.exp(-Math.max(0, since) / CREEP_MS)) * CREEP * step
  return Math.min(LOAD_CAP, base + creep)
}

/**
 * 下一帧的显示值：按经过的时间平滑地追目标，只进不退。
 * 总数从不知道变成知道、或者变大时，目标会往回落，这时停在原处等目标追上来。
 */
export function chase(shown: number, target: number, dt: number) {
  if (target <= shown) return shown
  return shown + (target - shown) * (1 - Math.exp(-Math.max(0, dt) / CHASE_MS))
}
