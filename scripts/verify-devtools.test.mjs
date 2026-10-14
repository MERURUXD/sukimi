import assert from 'node:assert/strict'
import test from 'node:test'
import { chunk, clampSettings, collectCandidates, DEFAULT_SETTINGS, MAX_SETTINGS, planImport, runBatches, sameRequest } from '../src/features/devtools/importPlan.ts'

// 全部是虚构作品
const c = (id, title = `虚构作品 ${id}`, inLibrary = false) => ({ id, title, inLibrary })

test('预演：跨页重复、已在书库、同名、超出上限分别归类', () => {
  const fetched = [c(1, '甲'), c(2, '乙', true), c(3, '丙'), c(1, '甲'), c(4, '丁 '), c(5, '戊'), c(6, '己'), c(7, '甲')]
  const library = [c(2, '乙'), c(90, '丁')]
  const plan = planImport(fetched, library, 2)
  assert.equal(plan.fetched, 8)
  assert.equal(plan.repeated, 1)
  assert.deepEqual(plan.inLibrary.map((m) => m.id), [2])
  // 4 和书库里的「丁」同名；7 和这次要加的 1 同名，只留先出现的
  assert.deepEqual(plan.sameTitle.map((s) => s.candidate.id), [4, 7])
  assert.deepEqual(plan.toAdd.map((m) => m.id), [1, 3])
  assert.deepEqual(plan.overLimit.map((m) => m.id), [5, 6])
})

test('来源标为未入库、但书库里已有同一 id 时也算已在书库', () => {
  const plan = planImport([c(9)], [c(9)], 10)
  assert.deepEqual(plan.inLibrary.map((m) => m.id), [9])
  assert.equal(plan.toAdd.length, 0)
})

test('设置按上下限收紧，非法值回到默认', () => {
  assert.deepEqual(clampSettings({}), DEFAULT_SETTINGS)
  assert.deepEqual(clampSettings({ pages: 999, limit: 0, batch: Number.NaN, delay: 1 }), {
    pages: MAX_SETTINGS.pages, limit: 1, batch: DEFAULT_SETTINGS.batch, delay: 500,
  })
})

test('分批切分', () => {
  assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]])
  assert.deepEqual(chunk([], 3), [])
})

test('逐页收集：够数提前停，翻页受上限约束', async () => {
  const calls = []
  const fetchPage = async (p) => (calls.push(p), { items: [c(p * 10 + 1), c(p * 10 + 2, 'x', true)], hasNext: true })
  const r = await collectCandidates(fetchPage, { pages: 5, limit: 2, delay: 0 })
  assert.deepEqual(calls, [1, 2])
  assert.equal(r.pages, 2)
  assert.equal(r.more, true)
  const r2 = await collectCandidates(fetchPage, { pages: 1, limit: 100, delay: 0 })
  assert.equal(r2.pages, 1)
})

test('单页失败退避重试，仍失败就停下并保留已取到的', async () => {
  let tries = 0
  const fetchPage = async (p) => {
    if (p === 2) {
      tries++
      throw new Error('虚构失败')
    }
    return { items: [c(p)], hasNext: true }
  }
  const r = await collectCandidates(fetchPage, { pages: 5, limit: 100, delay: 1 })
  assert.equal(tries, 3)
  assert.equal(r.pages, 1)
  assert.deepEqual(r.items.map((m) => m.id), [1])
  assert.ok(r.error)
})

test('取消后不再请求后面的页', async () => {
  const ctl = new AbortController()
  const calls = []
  const r = await collectCandidates(async (p) => {
    calls.push(p)
    ctl.abort()
    return { items: [c(p)], hasNext: true }
  }, { pages: 5, limit: 100, delay: 50, signal: ctl.signal })
  assert.deepEqual(calls, [1])
  assert.equal(r.cancelled, true)
})

test('分批执行：取消后剩下的批次不提交', async () => {
  const ctl = new AbortController()
  const sent = []
  const r = await runBatches([1, 2, 3, 4, 5], async (b) => {
    sent.push(b)
    ctl.abort()
  }, { batch: 2, delay: 50, signal: ctl.signal })
  assert.deepEqual(sent, [[1, 2]])
  assert.deepEqual(r.done, [1, 2])
  assert.deepEqual(r.skipped, [3, 4, 5])
  assert.equal(r.stopped, 'cancelled')
})

test('分批执行：单批失败继续，连续两批失败中止', async () => {
  const fails = new Set([3, 5, 7])
  const r = await runBatches([1, 2, 3, 4, 5, 6, 7, 8], async (b) => {
    if (fails.has(b[0])) throw new Error('虚构失败')
  }, { batch: 1, delay: 0 })
  assert.deepEqual(r.done, [1, 2, 4, 6, 8])
  assert.deepEqual(r.failed, [3, 5, 7])
  assert.equal(r.stopped, undefined)
  const r2 = await runBatches([1, 2, 3, 4, 5], async (b) => {
    if (b[0] >= 2) throw new Error('虚构失败')
  }, { batch: 1, delay: 0 })
  assert.deepEqual(r2.done, [1])
  assert.deepEqual(r2.failed, [2, 3])
  assert.deepEqual(r2.skipped, [4, 5])
  assert.equal(r2.stopped, 'failures')
})

test('工具箱只经由按构建渠道判断的路由加载，正式构建不打包', async () => {
  // 完整构建太慢，不放进日常测试；这里守住前提：只有 router.tsx 引用工具箱，且条件是可在构建时删掉的常量
  const { readdirSync, readFileSync } = await import('node:fs')
  const refs = []
  const scan = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const path = `${dir}/${e.name}`
      if (e.isDirectory()) scan(path)
      else if (/\.tsx?$/.test(path) && !path.startsWith('src/features/devtools/') && /features\/devtools\//.test(readFileSync(path, 'utf8'))) refs.push(path)
    }
  }
  scan('src')
  // 开发验收页本身只在 import.meta.env.DEV 的路由里注册
  assert.deepEqual(refs.sort(), ['src/app/router.tsx', 'src/features/dev/DevToolsLab.tsx'])
  const router = readFileSync('src/app/router.tsx', 'utf8')
  assert.match(router, /import\.meta\.env\.DEV \|\| __APP_CHANNEL__ === 'preview'\s*\n\s*\? \[\{ path: 'devtools', \.\.\.page\(\(\) => import\('@\/features\/devtools\/DevToolsPage'\)/)
})

test('预演后改了来源、方式或搜索词，旧预演即作废', () => {
  const req = { sourceId: '910', type: 'SEARCH', query: '虚构' }
  assert.equal(sameRequest(req, { ...req }), true)
  assert.equal(sameRequest(req, { ...req, sourceId: '911' }), false)
  assert.equal(sameRequest(req, { ...req, type: 'POPULAR', query: '' }), false)
  assert.equal(sameRequest(req, { ...req, query: '虚构 2' }), false)
})

test('虚构验收页和大书库参数只在开发与 Preview 构建开启，且路由与 isDevLab 条件一致', async () => {
  const { readFileSync } = await import('node:fs')
  const gate = "import.meta.env.DEV || __APP_CHANNEL__ === 'preview'"
  const router = readFileSync('src/app/router.tsx', 'utf8')
  // /dev/* 验收页在登录路由之外注册；/dev/glass 读真实书库，仍只在开发环境
  assert.ok(router.includes(`...(${gate}\n    ? [\n        { path: '/dev/source-filters'`))
  assert.match(router, /import\.meta\.env\.DEV\s*\n\s*\? \[\{ path: 'dev\/glass'/)
  // 路由开了而 isDevLab 没开，验收页会带着真实登录和快照打开
  assert.ok(readFileSync('src/lib/demo.ts', 'utf8').includes(`export const isDevLab = (${gate}) && /^\\/dev\\/(?!glass)/`))
  assert.ok(readFileSync('src/features/demo/client.ts', 'utf8').includes(`if (!(${gate})) return {}`))
  // 请求监视同样按构建常量接入，正式构建删掉；演示客户端会进正式构建，不接
  assert.ok(readFileSync('src/api/client.ts', 'utf8').includes(`...(${gate} ? [monitorLink()] : []),`))
  assert.doesNotMatch(readFileSync('src/features/demo/client.ts', 'utf8'), /monitor/)
  // 验收页里的站内链接跳进需要登录的页面时，整页重新加载走正常登录，而不是卡在没恢复的会话上
  const shell = readFileSync('src/app/AppShell.tsx', 'utf8')
  assert.match(shell, /if \(isDevLab\) window\.location\.assign\(href\)/)
  assert.match(shell, /if \(isDevLab\) return null\n\s*if \(status === 'checking'/)
})
