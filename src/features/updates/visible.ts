/**
 * 更新页只列加入书库之后才抓到的章节（和 Mihon 一致）。
 * 迁移时新来源的整本章节是在加入书库的前一刻抓的，加入时间之后才有的才是真正的更新。
 * 两个字段都是秒；同一秒算「一起抓的」，不显示。
 */
export const isFreshUpdate = (c: { fetchedAt: string; manga: { inLibraryAt: string } }) => Number(c.fetchedAt) > Number(c.manga.inLibraryAt)
