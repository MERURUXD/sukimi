/**
 * 书库按评分排序用的分数：各网站分制不同（Bangumi 十分制、AniList 百分制、表情三档），
 * 按分数在该网站评分档位里的位置折算到 0–10 再比较；第一档（'' 或 '0'）表示未评分。
 * 网站改过分制、旧分数不在当前档位里时，按数值和档位里的最大数折算，不当成未评分。
 * 绑定多个网站时取已评分的平均；都没评分、或还不知道分制时返回 null，排序时放在最后
 */
export function libraryScore(records: readonly { trackerId: number; displayScore: string }[], scales: ReadonlyMap<number, readonly string[]>) {
  const scores = records.flatMap((r) => {
    const list = scales.get(r.trackerId)
    if (!list) return []
    const i = list.indexOf(r.displayScore)
    if (i >= 0) return i > 0 ? [(i / (list.length - 1)) * 10] : []
    const n = Number(r.displayScore)
    const max = Math.max(0, ...list.map(Number).filter(Number.isFinite))
    return r.displayScore !== '' && n > 0 && max > 0 ? [Math.min(10, (n / max) * 10)] : []
  })
  return scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null
}

/**
 * 两个排序值比大小；null（没有这项数据）默认不论正序倒序都排在最后，相等返回 0 由调用方再按标题排。
 * nullsLow 为真时把 null 当作最小值：正序排在最前、倒序排在最后（评分排序用，未评分就是最低分）
 */
export function compareSortValues(
  a: number | string | null,
  b: number | string | null,
  desc: boolean,
  collate: (a: string, b: string) => number,
  nullsLow = false,
) {
  if (a === null || b === null) {
    if (a === b) return 0
    const aFirst = nullsLow ? !desc : false
    return (a === null) === aFirst ? -1 : 1
  }
  const c = typeof a === 'string' ? collate(a, b as string) : a - (b as number)
  return c === 0 ? 0 : desc ? -c : c
}
