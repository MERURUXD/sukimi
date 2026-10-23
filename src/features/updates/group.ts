/** 同一天里同一部漫画的多话，合并成一组；单话的组只有一行 */
export type UpdateGroup<T> = { key: string; mangaId: number; rows: T[] }

/**
 * 把一天内的更新按漫画合并。组的位置取该漫画最靠前（最新）的一话，
 * 组内保持原顺序，所以第一行就是最新的一话；不同漫画交错抓取时也能合到一起。
 */
export function groupByManga<T extends { mangaId: number }>(rows: T[], day: string): UpdateGroup<T>[] {
  const groups = new Map<number, UpdateGroup<T>>()
  for (const r of rows) {
    const g = groups.get(r.mangaId)
    if (g) g.rows.push(r)
    else groups.set(r.mangaId, { key: `${day}#${r.mangaId}`, mangaId: r.mangaId, rows: [r] })
  }
  return [...groups.values()]
}

/** 一天里排在哪一档：没读完的特别关心 0、其他没读完的 1、读完的 2；组里有一话没读就算没读完 */
export function groupRank<T extends { isRead: boolean }>(g: UpdateGroup<T>, favorite: boolean) {
  return g.rows.some((r) => !r.isRead) ? (favorite ? 0 : 1) : 2
}

/** 按档位重排一天里的组，同一档保持原顺序（抓取时间新的在前）；不改输入 */
export function sortGroups<G>(groups: readonly G[], rank: (g: G) => number) {
  const ranks = new Map(groups.map((g) => [g, rank(g)]))
  return [...groups].sort((a, b) => ranks.get(a)! - ranks.get(b)!)
}
