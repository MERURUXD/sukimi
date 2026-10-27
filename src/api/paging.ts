/**
 * 带 @connection 的列表把已加载页拼在同一条缓存里，但查询变量仍停在挂载时的 first。
 * 之后任何 refetch（检查更新结束时刷新活动查询也算）都会按这个 first 重取，把列表截回第一页。
 * 翻页完成后把变量改成已加载条数，后面的 refetch 就覆盖整个窗口。连接键不含 first，改变量不会另开一条缓存。
 */
export function rememberLoadedWindow(
  query: { options: { variables?: { first?: number; offset?: number } } },
  loaded: number,
  page: number,
) {
  const variables = query.options.variables
  if (!variables || typeof variables.first !== 'number') return
  const first = Math.max(page, loaded, variables.first)
  if (first === variables.first && (variables.offset ?? 0) === 0) return
  query.options.variables = { ...variables, first, offset: 0 }
}
