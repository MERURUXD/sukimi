/**
 * 书库按评分排序用的分数：各网站分制不同（Bangumi 十分制、AniList 百分制、表情三档），
 * 按分数在该网站评分档位里的位置折算到 0–10 再比较；第一档（'' 或 '0'）表示未评分。
 * 绑定多个网站时取已评分的平均；都没评分、或还不知道分制时返回 null，排序时放在最后
 */
export function libraryScore(records: readonly { trackerId: number; displayScore: string }[], scales: ReadonlyMap<number, readonly string[]>) {
  const scores = records.flatMap((r) => {
    const list = scales.get(r.trackerId)
    const i = list ? list.indexOf(r.displayScore) : -1
    return list && i > 0 ? [(i / (list.length - 1)) * 10] : []
  })
  return scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null
}

/** 两个排序值比大小；null（没有这项数据）不论正序倒序都排在最后，相等返回 0 由调用方再按标题排 */
export function compareSortValues(a: number | string | null, b: number | string | null, desc: boolean, collate: (a: string, b: string) => number) {
  if (a === null || b === null) return a === b ? 0 : a === null ? 1 : -1
  const c = typeof a === 'string' ? collate(a, b as string) : a - (b as number)
  return c === 0 ? 0 : desc ? -c : c
}
