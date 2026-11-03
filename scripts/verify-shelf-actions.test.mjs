import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import { buildSchema, concatAST, executeSync, parse, validate } from 'graphql'
import { ApolloClient, ApolloLink, Observable } from '@apollo/client'
import { ApolloProvider } from '@apollo/client/react'
import { act, createElement, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { JSDOM } from 'jsdom'
import ts from 'typescript'
import { createCache } from '../src/api/cache.ts'
import * as docs from '../src/api/gql/graphql.ts'
import * as shelf from '../src/features/shelf/shelf.ts'
import { i18n, t } from '../src/i18n/core.ts'
import { errorText } from '../src/lib/errorText.ts'

// 正式 hook + Apollo + schema；请求只在虚构内存中执行，响应顺序由闸门控制。
const require = createRequire(import.meta.url)
const schema = buildSchema(readFileSync(new URL('../src/api/schema.graphql', import.meta.url), 'utf8'))
const dom = new JSDOM('<div id="shelf"></div>')
globalThis.window = dom.window
globalThis.document = dom.window.document
globalThis.IS_REACT_ACT_ENVIRONMENT = true
let identity = 1
function load(file, dependencies) {
  const exports = {}
  const code = ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 },
  }).outputText
  runInNewContext(code, {
    exports, Error, AggregateError,
    require: (name) => {
      if (Object.hasOwn(dependencies, name)) return dependencies[name]
      if (name === 'react' || name === '@apollo/client/react') return require(name)
      throw new Error(`未模拟的依赖：${name}`)
    },
  }, { filename: file })
  return exports
}
const userContext = load('../src/api/userContext.ts', {
  './auth': { useAuth: { getState: () => ({ user: { id: identity } }) } },
  '../i18n/core.ts': { t },
})
const { StaleSessionError } = userContext
const switchUser = (id) => { identity = id; userContext.resetUserContext() }
// 直接解析源码文档，新增查询尚未 codegen 时也能先验证真实执行路径。
const queries = load('../src/features/shelf/queries.ts', { '@/api/gql': { graphql: parse } })
test('shelf 全部文档符合本地 schema，回滚查询只读漫画总数', () => {
  assert.deepEqual(validate(schema, concatAST(Object.values(queries))), [])
})
const { useShelfActions } = load('../src/features/shelf/useShelf.ts', {
  '@/api/userContext': userContext,
  '@/api/persist': { withSnapshot: (_key, data) => data },
  '@/features/library/queries': { Categories: docs.CategoriesDocument, SetMangasCategories: docs.SetMangasCategoriesDocument },
  './shelf': shelf,
  './queries': queries,
  '@/i18n': { t },
  '@/lib/errorText': { errorText },
})

function gate() {
  let resolve
  const promise = new Promise((done) => { resolve = done })
  return { promise, resolve }
}

async function mount({ before = () => {}, after = () => {} } = {}) {
  await i18n.changeLanguage('zh-CN')
  switchUser(1)
  const categories = [
    { id: 1, name: '虚构分类', order: 0, default: false, meta: [] },
    { id: 2, name: '搁置', order: 1, default: false, meta: [] },
  ]
  const mangas = new Map([[11, new Set([1])], [12, new Set([1])]])
  const calls = []
  let nextId = 3
  const state = { categories, mangas, calls }
  const category = (id) => {
    const found = categories.find((item) => item.id === id)
    if (!found) throw new Error('虚构分类不存在')
    return { ...found, mangas: () => ({ totalCount: [...mangas.values()].filter((ids) => ids.has(id)).length }) }
  }
  const rootValue = {
    categories: () => ({ nodes: categories.map((item) => category(item.id)) }),
    category: ({ id }) => category(id),
    createCategory: ({ input }) => {
      const created = { id: nextId++, ...input, order: categories.length, default: false, meta: [] }
      categories.push(created)
      return { category: created }
    },
    setCategoryMeta: ({ input: { meta } }) => {
      categories.find((item) => item.id === meta.categoryId).meta = [{ key: meta.key, value: meta.value }]
      return { meta }
    },
    deleteCategory: ({ input: { categoryId } }) => {
      const index = categories.findIndex((item) => item.id === categoryId)
      assert.ok(index >= 0)
      const [removed] = categories.splice(index, 1)
      return { category: removed, mangas: [] }
    },
    updateMangasCategories: ({ input: { ids, patch } }) => ({
      mangas: ids.map((id) => {
        const current = mangas.get(id)
        for (const add of patch.addToCategories ?? []) current.add(add)
        for (const remove of patch.removeFromCategories ?? []) current.delete(remove)
        return { id, categories: { nodes: [...current].map((id) => ({ id })) } }
      }),
    }),
  }
  const client = new ApolloClient({
    cache: createCache(),
    queryDeduplication: false,
    link: new ApolloLink((operation) => new Observable((observer) => {
      calls.push({ name: operation.operationName, user: identity, variables: operation.variables })
      Promise.resolve().then(async () => {
        await before(operation, state)
        const result = executeSync({ schema, rootValue, document: operation.query, variableValues: operation.variables })
        await after(operation, state)
        observer.next(result)
        observer.complete()
      }).catch((error) => observer.error(error))
    })),
  })
  const views = []
  function Probe({ index }) {
    const actions = useShelfActions()
    useEffect(() => { views[index] = actions })
    return null
  }
  const root = createRoot(document.getElementById('shelf'))
  await act(async () => root.render(createElement(ApolloProvider, { client },
    createElement(Probe, { index: 0 }), createElement(Probe, { index: 1 }))))
  return {
    ...state, client, views,
    count: (name) => calls.filter((call) => call.name === name).length,
    async close() { await act(async () => root.unmount()); client.stop() },
  }
}

test('首次搁置：打标两次失败后只删除本次新建空分类，保留原有同名分类', async () => {
  const env = await mount({ before: (op) => {
    if (op.operationName === 'TagShelf') throw new Error('虚构打标失败')
  } })
  try {
    await assert.rejects(env.views[0].setShelved([11], true), /虚构打标失败/)
    assert.equal(env.count('TagShelf'), 2)
    assert.deepEqual(env.categories.map((item) => item.id), [1, 2], '不得残留普通搁置分类')
    assert.equal(env.count('DeleteShelf'), 1)
    assert.equal(env.count('SetMangasCategories'), 0)
    assert.deepEqual([...env.mangas.get(11)], [1])
  } finally { await env.close() }
})

test('首次搁置：两个组件同时执行只建一个分类，两个漫画都成功加入', async () => {
  const entered = gate(), release = gate()
  let creates = 0
  const env = await mount({ before: async (op) => {
    if (op.operationName === 'CreateShelf' && ++creates === 1) {
      entered.resolve()
      await release.promise
    }
  } })
  try {
    const first = env.views[0].setShelved([11], true)
    await entered.promise
    const second = env.views[1].setShelved([12], true)
    release.resolve()
    await Promise.all([first, second])
    assert.equal(env.count('CreateShelf'), 1, '跨组件必须共用首次创建队列')
    const ids = [...shelf.shelfIds(env.categories)]
    assert.equal(ids.length, 1)
    for (const id of [11, 12]) assert.equal(env.mangas.get(id).has(ids[0]), true)
  } finally { release.resolve(); await env.close() }
})

test('打标重试成功就继续放入漫画，不删除分类', async () => {
  let attempts = 0
  const env = await mount({ before: (op) => {
    if (op.operationName === 'TagShelf' && ++attempts === 1) throw new Error('虚构首次打标失败')
  } })
  try {
    await env.views[0].setShelved([11], true)
    assert.equal(env.count('TagShelf'), 2)
    assert.equal(env.count('DeleteShelf'), 0)
    assert.equal(env.mangas.get(11).has(3), true)
  } finally { await env.close() }
})

test('清理失败同时保留两次打标和删除错误，提示分类 ID，且下一项仍能运行', async () => {
  const errors = [new Error('虚构打标故障一'), new Error('虚构打标故障二'), new Error('虚构删除故障')]
  let tags = 0
  const env = await mount({ before: (op) => {
    if (op.operationName === 'TagShelf' && tags < 2) throw errors[tags++]
    if (op.operationName === 'DeleteShelf') throw errors[2]
  } })
  try {
    await assert.rejects(env.views[0].setShelved([11], true), (error) => {
      assert.ok(error instanceof AggregateError)
      assert.deepEqual(error.errors[0].errors, errors.slice(0, 2))
      assert.equal(error.errors[1], errors[2])
      for (const reason of errors) assert.ok(error.message.includes(reason.message))
      assert.match(error.message, /ID 3.*可能仍然保留/)
      return true
    })
    assert.equal(env.categories.some((item) => item.id === 3), true)
    await env.views[1].setShelved([12], true)
    assert.equal(env.mangas.get(12).has(4), true, '失败不会堵住下一次操作')
    assert.equal(env.mangas.get(11).has(3), false)
  } finally { await env.close() }
})

test('前一项失败后，已经排队的另一组件仍可成功搁置', async () => {
  const entered = gate(), release = gate()
  let attempts = 0
  const env = await mount({ before: async (op) => {
    if (op.operationName === 'TagShelf' && attempts < 2) {
      if (++attempts === 1) { entered.resolve(); await release.promise }
      throw new Error('虚构打标失败')
    }
  } })
  try {
    const first = assert.rejects(env.views[0].setShelved([11], true), /虚构打标失败/)
    await entered.promise
    const second = env.views[1].setShelved([12], true)
    release.resolve()
    await Promise.all([first, second])
    assert.equal(env.count('CreateShelf'), 2)
    assert.equal(env.count('DeleteShelf'), 1)
    assert.equal(env.mangas.get(12).has(4), true)
  } finally { release.resolve(); await env.close() }
})

test('清理前发现新分类已被放入漫画时保留分类，同时报告打标与清理原因', async () => {
  const env = await mount({ before: (op, state) => {
    if (op.operationName === 'TagShelf') throw new Error('虚构打标失败')
    if (op.operationName === 'ShelfRollbackState') state.mangas.get(12).add(3)
  } })
  try {
    await assert.rejects(env.views[0].setShelved([11], true), /虚构打标失败.*已有漫画/)
    assert.equal(env.count('DeleteShelf'), 0)
    assert.equal(env.mangas.get(12).has(3), true)
    assert.equal(env.categories.some((item) => item.id === 3), true)
  } finally { await env.close() }
})

test('打标实际成功但响应丢失时保留已有标记的分类，不冒险清理', async () => {
  const env = await mount({ after: (op) => {
    if (op.operationName === 'TagShelf') throw new Error('虚构响应丢失')
  } })
  try {
    await assert.rejects(env.views[0].setShelved([11], true), /虚构响应丢失.*已有搁置标记/)
    assert.equal(env.count('DeleteShelf'), 0)
    assert.deepEqual([...shelf.shelfIds(env.categories)], [3])
  } finally { await env.close() }
})

test('已有搁置分类：放入漫画失败不删除现存分类，取消时移出所有搁置分类', async () => {
  let fail = true
  const env = await mount({ before: (op) => {
    if (op.operationName === 'SetMangasCategories' && fail) throw new Error('虚构放入失败')
  } })
  try {
    env.categories[1].meta = [{ key: shelf.SHELF_META, value: '1' }]
    env.categories.push({ id: 5, name: '虚构另一个搁置分类', order: 2, default: false, meta: [{ key: shelf.SHELF_META, value: '1' }] })
    await assert.rejects(env.views[0].setShelved([11], true), /虚构放入失败/)
    assert.equal(env.count('CreateShelf'), 0)
    assert.equal(env.count('DeleteShelf'), 0)
    fail = false
    env.mangas.get(11).add(2).add(5)
    await env.views[1].setShelved([11], false)
    assert.deepEqual([...env.mangas.get(11)], [1])
    assert.equal(env.count('DeleteShelf'), 0)
  } finally { await env.close() }
})

for (const back of [false, true]) {
  test(`排队期间切换账号${back ? '再切回' : ''}：旧请求不再发出，新账号仍能继续`, async () => {
    const entered = gate(), release = gate()
    let queries = 0
    const env = await mount({ before: async (op) => {
      if (op.operationName === 'Categories' && ++queries === 1) {
        entered.resolve()
        await release.promise
      }
    } })
    try {
      const first = assert.rejects(env.views[0].setShelved([11], true), StaleSessionError)
      await entered.promise
      const second = assert.rejects(env.views[1].setShelved([12], true), StaleSessionError)
      switchUser(2)
      if (back) switchUser(1)
      release.resolve()
      await Promise.all([first, second])
      assert.deepEqual(env.calls.map((call) => call.name), ['Categories'])
      await env.views[1].setShelved([12], true)
      assert.equal(env.mangas.get(12).has(3), true)
      for (const call of env.calls.slice(1)) assert.equal(call.user, back ? 1 : 2)
    } finally { release.resolve(); await env.close() }
  })
}

test('新建响应返回时换账号：不打标或回滚到新账号，保持旧会话静默取消', async () => {
  const env = await mount({ after: (op) => {
    if (op.operationName === 'CreateShelf') switchUser(2)
  } })
  try {
    await assert.rejects(env.views[0].setShelved([11], true), StaleSessionError)
    assert.deepEqual(env.calls.map((call) => call.name), ['Categories', 'CreateShelf'])
  } finally { await env.close() }
})

test('打标失败时切换账号：不在新账号重试或删除，并保留原始失败原因', async () => {
  const env = await mount({ before: (op) => {
    if (op.operationName === 'TagShelf') { switchUser(2); throw new Error('虚构打标失败后换账号') }
  } })
  try {
    await assert.rejects(env.views[0].setShelved([11], true), (error) => {
      assert.ok(error instanceof StaleSessionError, '调用方依靠原类型静默取消')
      assert.match(error.cause.message, /虚构打标失败后换账号/)
      return true
    })
    assert.deepEqual(env.calls.map((call) => call.name), ['Categories', 'CreateShelf', 'TagShelf'])
    assert.ok(env.calls.every((call) => call.user === 1))
  } finally { await env.close() }
})

test('清理状态返回时切换账号：不向新账号删除分类', async () => {
  const env = await mount({
    before: (op) => { if (op.operationName === 'TagShelf') throw new Error('虚构打标失败') },
    after: (op) => { if (op.operationName === 'ShelfRollbackState') switchUser(2) },
  })
  try {
    await assert.rejects(env.views[0].setShelved([11], true), (error) => {
      assert.ok(error instanceof StaleSessionError)
      assert.match(error.cause.message, /虚构打标失败/)
      return true
    })
    assert.equal(env.count('DeleteShelf'), 0)
    assert.ok(env.calls.every((call) => call.user === 1))
  } finally { await env.close() }
})

test('清理失败提示随语言切换，英文也包含打标、清理原因和分类 ID', async () => {
  const env = await mount({ before: (op) => {
    if (op.operationName === 'TagShelf') throw new Error('fictional tag failure')
    if (op.operationName === 'DeleteShelf') throw new Error('fictional cleanup failure')
  } })
  try {
    await i18n.changeLanguage('en')
    await assert.rejects(env.views[0].setShelved([11], true), (error) => {
      assert.match(error.message, /Could not tag the shelf.*fictional tag failure.*ID 3.*fictional cleanup failure/)
      assert.doesNotMatch(error.message, /[\u4e00-\u9fff]|\{\{|misc\.shelf/)
      return true
    })
  } finally { await i18n.changeLanguage('zh-CN'); await env.close() }
})

test('清理状态查询失败时不删除分类，同时保留打标和查询两个原因', async () => {
  const env = await mount({ before: (op) => {
    if (op.operationName === 'TagShelf') throw new Error('虚构打标失败')
    if (op.operationName === 'ShelfRollbackState') throw new Error('虚构状态查询失败')
  } })
  try {
    await assert.rejects(env.views[0].setShelved([11], true), /虚构打标失败.*虚构状态查询失败/)
    assert.equal(env.count('DeleteShelf'), 0)
    assert.equal(env.categories.some((item) => item.id === 3), true)
  } finally { await env.close() }
})

test('清理请求失败且账号已切换：保持静默取消，cause 保留打标及清理错误', async () => {
  const env = await mount({ before: (op) => {
    if (op.operationName === 'TagShelf') throw new Error('虚构打标失败')
    if (op.operationName === 'DeleteShelf') { switchUser(2); throw new Error('虚构删除失败后换账号') }
  } })
  try {
    await assert.rejects(env.views[0].setShelved([11], true), (error) => {
      assert.ok(error instanceof StaleSessionError)
      assert.ok(error.cause instanceof AggregateError)
      assert.match(error.cause.message, /虚构打标失败.*虚构删除失败后换账号/)
      return true
    })
    assert.ok(env.calls.every((call) => call.user === 1))
  } finally { await env.close() }
})

test('其他组件已看到新分类时，回滚会清掉缓存并刷新正在观察的分类列表', async () => {
  let attempts = 0
  const env = await mount({ before: async (op) => {
    if (op.operationName !== 'TagShelf') return
    if (++attempts === 2) await env.client.query({ query: docs.CategoriesDocument, fetchPolicy: 'network-only' })
    throw new Error('虚构打标失败')
  } })
  let subscription
  try {
    let latest
    await new Promise((resolve, reject) => {
      subscription = env.client.watchQuery({ query: docs.CategoriesDocument }).subscribe({
        next: (result) => { if (result.data) { latest = result.data.categories.nodes; resolve() } },
        error: reject,
      })
    })
    await assert.rejects(env.views[0].setShelved([11], true), /虚构打标失败/)
    assert.deepEqual(latest.map((item) => item.id), [1, 2])
    assert.equal(env.client.cache.extract()['CategoryType:3'], undefined)
    assert.ok(env.count('Categories') >= 4, '包括其他组件的刷新和删除后的重新取数')
  } finally { subscription?.unsubscribe(); await env.close() }
})
