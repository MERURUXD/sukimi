/**
 * 发现页结果记在内存里，带回的 inLibrary 是当时的副本。
 * 缓存里已经有这部漫画时以缓存为准（详情页加入或移出之后会改它）；还没有时才用来源结果。
 */
export function libraryMark(cached: boolean | undefined, listed: boolean) {
  return cached ?? listed
}
