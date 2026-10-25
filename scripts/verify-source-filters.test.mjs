import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { onlineSources, sourcesToFetch, summarizeMultiSearch } from '../src/features/browse/multiSearch.ts'
import { buildSchema, experimentalExecuteIncrementally as execute, validate } from 'graphql'
import { SourceFiltersDocument, FetchSourceMangaDocument } from '../src/api/gql/graphql.ts'
import { defaultValue, filterChanges, filterValues, hasIncompleteFilters, sourceBrowseKey } from '../src/features/browse/filters.ts'
import { createCache } from '../src/api/cache.ts'

// 全部使用虚构选项，不读取真实书库或来源结果。
const filters = [
  { __typename: 'HeaderFilter', name: '说明' },
  { __typename: 'TextFilter', name: '作者', textDefault: '默认作者' },
  { __typename: 'SeparatorFilter', name: '' },
  { __typename: 'SelectFilter', name: '状态', values: ['全部', '连载', '完结'], selectDefault: 1 },
  { __typename: 'CheckBoxFilter', name: '仅原创', checkBoxDefault: true },
  { __typename: 'TriStateFilter', name: '冒险', triStateDefault: 'IGNORE' },
  { __typename: 'SortFilter', name: '排序', values: ['热度', '时间'], sortDefault: { __typename: 'SortSelection', index: 0, ascending: false } },
  { __typename: 'GroupFilter', name: '标签', filters: [
    { __typename: 'HeaderFilter', name: '可多选' },
    { __typename: 'CheckBoxFilter', name: '科幻', checkBoxDefault: false },
    { __typename: 'GroupFilter', name: '嵌套', filters: [
      { __typename: 'SeparatorFilter', name: '' },
      { __typename: 'TriStateFilter', name: '短篇', triStateDefault: 'INCLUDE' },
      { __typename: 'CheckBoxFilter', name: '完结', checkBoxDefault: false },
    ] },
  ] },
]

test('所有可编辑类型保留原始位置，空字符串、false 和 0 正确发送', () => {
  assert.deepEqual(filterChanges(filters, { 1: '', 3: 0, 4: false, 5: 'EXCLUDE', 6: { index: 1, ascending: true } }), [
    { position: 1, textState: '' },
    { position: 3, selectState: 0 },
    { position: 4, checkBoxState: false },
    { position: 5, triState: 'EXCLUDE' },
    { position: 6, sortState: { index: 1, ascending: true } },
  ])
})

test('分组内多选和嵌套三态各自发送一条完整路径', () => {
  const values = { '7.1': true, '7.2.1': 'EXCLUDE', '7.2.2': true }
  const changes = [
    { position: 7, groupChange: { position: 1, checkBoxState: true } },
    { position: 7, groupChange: { position: 2, groupChange: { position: 1, triState: 'EXCLUDE' } } },
    { position: 7, groupChange: { position: 2, groupChange: { position: 2, checkBoxState: true } } },
  ]
  assert.deepEqual(filterChanges(filters, values), changes)
  assert.deepEqual(filterValues(filters, changes), values)
})

test('还原来源默认值省略变更，排序对象不受 Apollo 类型标记影响', () => {
  assert.deepEqual(defaultValue(filters[6]), { index: 0, ascending: false })
  assert.deepEqual(filterChanges(filters, { 1: '默认作者', 3: 1, 4: true, 5: 'IGNORE', 6: { index: 0, ascending: false }, '7.1': false }), [])
  assert.deepEqual(filterChanges(filters, {}), [])
})

test('没有默认排序时可设置排序，清空草稿不会发送服务端不接受的 null', () => {
  const list = [{ __typename: 'SortFilter', name: '排序', values: ['时间'], sortDefault: null }]
  assert.deepEqual(filterChanges(list, { 0: { index: 0, ascending: false } }), [{ position: 0, sortState: { index: 0, ascending: false } }])
  assert.deepEqual(filterChanges(list, { 0: null }), [])
})

test('已应用条件回到草稿，仍保留 false、空字符串和 0', () => {
  const values = { 1: '', 3: 0, 4: false, 5: 'INCLUDE', 6: { index: 0, ascending: true } }
  assert.deepEqual(filterValues(filters, filterChanges(filters, values)), values)
})

test('旧来源定义里已经不存在或越界的条件不会还原', () => {
  assert.deepEqual(filterValues(filters, [
    { position: 99, textState: '旧字段' },
    { position: 3, selectState: 9 },
    { position: 7, groupChange: { position: 9, checkBoxState: true } },
  ]), {})
  assert.deepEqual(filterChanges(filters, { 3: -1, 5: 'INVALID', 6: { index: 1.5, ascending: true } }), [])
})

test('默认三态可以被显式改为不限，升降序均保留', () => {
  assert.deepEqual(filterChanges(filters, { '7.2.1': 'IGNORE' }), [{ position: 7, groupChange: { position: 2, groupChange: { position: 1, triState: 'IGNORE' } } }])
  assert.deepEqual(filterChanges(filters, { 6: { index: 1, ascending: false } }), [{ position: 6, sortState: { index: 1, ascending: false } }])
})

test('未加载完整的分组可检测，空分组和空来源不会误报', () => {
  assert.equal(hasIncompleteFilters(filters), false)
  assert.equal(hasIncompleteFilters([]), false)
  assert.equal(hasIncompleteFilters([{ __typename: 'GroupFilter', name: '', filters: [] }]), false)
  assert.equal(hasIncompleteFilters([{ __typename: 'GroupFilter', name: '', filters: [{ __typename: 'GroupFilter', name: '过深' }] }]), true)
})

test('搜索缓存区分来源、关键词、方式、筛选；热门不受筛选草稿影响', () => {
  const a = [{ position: 4, checkBoxState: false }]
  const b = [{ position: 5, triState: 'INCLUDE' }]
  const key = sourceBrowseKey('1', 'SEARCH', '', a)
  assert.notEqual(key, sourceBrowseKey('1', 'SEARCH', '', b))
  assert.notEqual(key, sourceBrowseKey('2', 'SEARCH', '', a))
  assert.notEqual(key, sourceBrowseKey('1', 'SEARCH', '关键词|SEARCH|', a))
  assert.notEqual(key, sourceBrowseKey('1', 'POPULAR', '', a))
  assert.equal(sourceBrowseKey('1', 'POPULAR', '旧关键词', a), sourceBrowseKey('1', 'POPULAR', '', []))
})

test('筛选查询与搜索变更符合当前服务端 schema', () => {
  const schema = buildSchema(readFileSync(new URL('../src/api/schema.graphql', import.meta.url), 'utf8'))
  assert.deepEqual(validate(schema, SourceFiltersDocument), [])
  assert.deepEqual(validate(schema, FetchSourceMangaDocument), [])
})

test('实际查询展开四层分组，更深的分组可识别为未完整加载', async () => {
  const schema = buildSchema(readFileSync(new URL('../src/api/schema.graphql', import.meta.url), 'utf8'))
  const group = (child) => ({ __typename: 'GroupFilter', name: '分组', filters: [child] })
  const leaf = { __typename: 'TextFilter', name: '关键词', default: '' }
  const query = async (depth) => {
    let nested = leaf
    for (let level = 0; level < depth; level++) nested = group(nested)
    const result = await execute({ schema, document: SourceFiltersDocument, variableValues: { id: '1' }, rootValue: { source: { id: '1', filters: [nested] } } })
    assert.equal(result.errors, undefined)
    return result.data.source.filters
  }
  assert.equal(hasIncompleteFilters(await query(4)), false)
  assert.equal(hasIncompleteFilters(await query(5)), true)
})

test('搜索文档传递空关键词、第二页和多个嵌套分组条件', async () => {
  const schema = buildSchema(readFileSync(new URL('../src/api/schema.graphql', import.meta.url), 'utf8'))
  const changes = filterChanges(filters, { '7.1': true, '7.2.1': 'EXCLUDE', 4: false })
  let received
  const result = await execute({
    schema,
    document: FetchSourceMangaDocument,
    variableValues: { source: '1', type: 'SEARCH', page: 2, query: '', filters: changes },
    rootValue: { fetchSourceManga: ({ input }) => { received = input; return { mangas: [], hasNextPage: false } } },
  })
  assert.equal(result.errors, undefined)
  assert.equal(received.query, '')
  assert.equal(received.page, 2)
  assert.deepEqual(JSON.parse(JSON.stringify(received.filters)), changes)
})

test('正式 Apollo 缓存读写后保留联合类型选项与嵌套分组字段', () => {
  const cache = createCache()
  const list = [
    { __typename: 'SelectFilter', name: '状态', values: ['全部', '完结'], selectDefault: 0 },
    { __typename: 'GroupFilter', name: '分组', filters: [
      { __typename: 'CheckBoxFilter', name: '原创', checkBoxDefault: false },
      { __typename: 'SortFilter', name: '排序', values: ['时间'], sortDefault: { __typename: 'SortSelection', index: 0, ascending: false } },
    ] },
  ]
  const data = { source: { __typename: 'SourceType', id: '1', filters: list } }
  cache.writeQuery({ query: SourceFiltersDocument, variables: { id: '1' }, data })
  assert.deepEqual(cache.readQuery({ query: SourceFiltersDocument, variables: { id: '1' } }), data)
})

test('发现页全局搜索：排除本地源（id=0），区分成功与失败数量，仅重试失败或指定来源', () => {
  const all = [
    { id: '101', displayName: '虚构源 A' },
    { id: '102', displayName: '虚构源 B' },
    { id: '103', displayName: '虚构源 C' },
    { id: '0', displayName: 'Local source' },
  ]
  const online = onlineSources(all)
  assert.deepEqual(online.map((s) => s.id), ['101', '102', '103'])

  const results = {
    '101': { status: 'done', items: [{ id: 1, title: '虚构漫画', thumbnailUrl: '', author: null, inLibrary: false }] },
    '102': { status: 'error', items: [] },
    '103': { status: 'loading', items: [] },
  }
  assert.deepEqual(summarizeMultiSearch(online, results), {
    total: 3,
    done: 2,
    succeeded: 1,
    failed: 1,
    loading: 1,
  })

  // 批量重试：跳过已成功的 101，重跑失败的 102 与未完成的 103
  assert.deepEqual(sourcesToFetch(online, results).map((s) => s.id), ['102', '103'])

  // 全部结束后单源重试 102：只重跑 102，不动成功的 101 和另一失败源 103
  const settled = {
    '101': { status: 'done', items: [] },
    '102': { status: 'error', items: [] },
    '103': { status: 'error', items: [] },
  }
  assert.deepEqual(sourcesToFetch(online, settled, ['102']).map((s) => s.id), ['102'])
})
