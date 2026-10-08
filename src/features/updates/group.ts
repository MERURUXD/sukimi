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
