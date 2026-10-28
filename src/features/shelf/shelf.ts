/*
 * 「搁置」：不想读又不想移出书库的漫画。Suwayomi 没有按漫画关闭更新的设置，只有分类能排除更新
 * （漫画所在的任一分类排除更新，自动更新和整库更新就跳过它），所以每个账号用一个隐藏分类实现，
 * 第一次搁置时创建并打上分类元数据。只认元数据不认名称；两台设备同时创建出多个时都算搁置分类。
 * 这里只放纯逻辑（Node 测试直接导入），不依赖 React、Apollo 或路径别名。
 */

export const SHELF_META = 'sukimi.shelf'

type Meta = readonly { key: string; value: string }[]

export function shelfIds(categories: readonly { id: number; meta: Meta }[] = []): ReadonlySet<number> {
  return new Set(categories.filter((c) => c.meta.some((m) => m.key === SHELF_META)).map((c) => c.id))
}

export const isShelved = (m: { categories: { nodes: readonly { id: number }[] } }, shelf: ReadonlySet<number>) =>
  m.categories.nodes.some((c) => shelf.has(c.id))

/** 列给用户看的分类去掉搁置分类，搁置只在筛选和菜单里出现 */
export const withoutShelf = <C extends { id: number }>(categories: readonly C[], shelf: ReadonlySet<number>) =>
  categories.filter((c) => !shelf.has(c.id))
