import type { FilterChangeInput, SortSelectionInput, SourceFilterFieldsFragment, TriState } from '@/api/gql/graphql'

export type SourceFilter = Exclude<SourceFilterFieldsFragment, { __typename: 'GroupFilter' }> | {
  __typename: 'GroupFilter'
  name: string
  filters?: readonly SourceFilter[]
}
export type FilterValue = string | boolean | number | SortSelectionInput | null
export type FilterValues = Record<string, FilterValue>

export const TRI_STATES: TriState[] = ['IGNORE', 'INCLUDE', 'EXCLUDE']
export const TRI_LABELS: Record<TriState, string> = { IGNORE: '不限', INCLUDE: '包含', EXCLUDE: '排除' }

export function defaultValue(filter: SourceFilter): FilterValue {
  switch (filter.__typename) {
    case 'TextFilter': return filter.textDefault
    case 'CheckBoxFilter': return filter.checkBoxDefault
    case 'TriStateFilter': return filter.triStateDefault
    case 'SelectFilter': return filter.selectDefault
    case 'SortFilter': return filter.sortDefault ? { index: filter.sortDefault.index, ascending: filter.sortDefault.ascending } : null
    default: return null
  }
}

function isValidValue(filter: SourceFilter, value: FilterValue): boolean {
  switch (filter.__typename) {
    case 'TextFilter': return typeof value === 'string'
    case 'CheckBoxFilter': return typeof value === 'boolean'
    case 'TriStateFilter': return typeof value === 'string' && TRI_STATES.includes(value as TriState)
    case 'SelectFilter': return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < filter.values.length
    case 'SortFilter': return value === null || (typeof value === 'object' && Number.isInteger(value.index) && value.index >= 0 && value.index < filter.values.length && typeof value.ascending === 'boolean')
    default: return false
  }
}

/** 每次搜索都从来源默认值开始，只传改过的叶子；分组里的每个叶子各包装一条完整路径。 */
export function filterChanges(filters: readonly SourceFilter[], values: FilterValues, parent: number[] = []): FilterChangeInput[] {
  return filters.flatMap((filter, position) => {
    const path = [...parent, position]
    if (filter.__typename === 'GroupFilter') {
      return filter.filters ? filterChanges(filter.filters, values, path) : []
    }
    const value = values[path.join('.')]
    const original = defaultValue(filter)
    if (value === undefined || !isValidValue(filter, value) || JSON.stringify(value) === JSON.stringify(original)) return []
    let change: FilterChangeInput
    switch (filter.__typename) {
      case 'TextFilter': change = { position, textState: value as string }; break
      case 'CheckBoxFilter': change = { position, checkBoxState: value as boolean }; break
      case 'TriStateFilter': change = { position, triState: value as TriState }; break
      case 'SelectFilter': change = { position, selectState: value as number }; break
      case 'SortFilter':
        // 服务端不接受 null sortState；恢复默认排序靠省略这条变更。
        if (value === null) return []
        change = { position, sortState: value as SortSelectionInput }
        break
      default: return []
    }
    for (const group of parent.toReversed()) change = { position: group, groupChange: change }
    return [change]
  })
}

/** 恢复已应用的条件；来源更新后不存在或越界的选项不再带入草稿。 */
export function filterValues(filters: readonly SourceFilter[], changes: readonly FilterChangeInput[]): FilterValues {
  const values: FilterValues = {}
  const restore = (list: readonly SourceFilter[], change: FilterChangeInput, parent: number[]) => {
    const filter = list[change.position]
    if (!filter) return
    const path = [...parent, change.position]
    if (filter.__typename === 'GroupFilter') {
      if (filter.filters && change.groupChange) restore(filter.filters, change.groupChange, path)
      return
    }
    const value = change.textState ?? change.checkBoxState ?? change.triState ?? change.selectState ?? change.sortState
    if (value !== undefined && value !== null && isValidValue(filter, value)) values[path.join('.')] = value
  }
  for (const change of changes) restore(filters, change, [])
  return values
}

export const hasIncompleteFilters = (filters: readonly SourceFilter[]): boolean =>
  filters.some((filter) => filter.__typename === 'GroupFilter' && (!filter.filters || hasIncompleteFilters(filter.filters)))

/** 用结构化键，避免关键词里的分隔符和不同条件串到同一份分页结果。 */
export const sourceBrowseKey = (source: string, mode: string, query: string, changes: readonly FilterChangeInput[]) =>
  JSON.stringify([source, mode, mode === 'SEARCH' ? query : '', mode === 'SEARCH' ? changes : []])
