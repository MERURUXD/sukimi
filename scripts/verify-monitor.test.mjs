import assert from 'node:assert/strict'
import test from 'node:test'
import { createMonitor, errorText, summarize } from '../src/api/monitor.ts'

// 计时和通知都换成手动的，结果可预期
const setup = (opts = {}) => {
  let t = 0
  const pending = []
  const m = createMonitor({ now: () => 1_000 + t, clock: () => t, schedule: (fn) => pending.push(fn), ...opts })
  return { m, tick: (ms) => (t += ms), flush: () => pending.splice(0).forEach((fn) => fn()), pending }
}
const op = (name, kind = 'query', vars = []) => ({ name, kind, vars })

test('默认关闭：不记录，调用方直接放行', () => {
  const { m, flush } = setup()
  assert.equal(m.enabled, false)
  assert.equal(m.begin(op('Ping')), null)
  flush()
  assert.deepEqual(m.snapshot(), [])
})

test('记录耗时、结果和变量名；GraphQL 错误照常返回也算失败', () => {
  const { m, tick, flush } = setup()
  m.setEnabled(true)
  const a = m.begin(op('LibraryMangas', 'query', ['first', 'offset']))
  const b = m.begin(op('SetInLibrary', 'mutation', ['ids']))
  tick(120)
  a.event()
  a.end('ok')
  b.event('Unauthorized')
  b.end('ok')
  flush()
  const [ea, eb] = m.snapshot()
  assert.deepEqual([ea.name, ea.status, ea.ms, ea.vars, ea.at], ['LibraryMangas', 'ok', 120, ['first', 'offset'], 1_000])
  assert.deepEqual([eb.kind, eb.status, eb.error], ['mutation', 'error', 'Unauthorized'])
  // 重复结束不改写
  a.end('error', 'x')
  flush()
  assert.equal(m.snapshot()[0].status, 'ok')
})

test('快照是副本，且只在通知后才换新', () => {
  const { m, flush } = setup()
  m.setEnabled(true)
  const h = m.begin(op('Q'))
  const before = m.snapshot()
  h.end('ok')
  assert.equal(m.snapshot(), before)
  flush()
  const after = m.snapshot()
  assert.notEqual(after, before)
  assert.equal(after[0].status, 'ok')
  after[0].vars.push('x')
  after[0].status = 'error'
  // 改动快照不会影响内部记录：下次变化后的快照仍是原样
  m.begin(op('R'))
  flush()
  assert.deepEqual([m.snapshot()[0].status, m.snapshot()[0].vars], ['ok', []])
})

test('同一时段的多次变化只通知一次', () => {
  const { m, pending } = setup()
  let calls = 0
  m.subscribe(() => calls++)
  // 开关立即通知
  m.setEnabled(true)
  assert.deepEqual([calls, pending.length], [1, 0])
  for (let i = 0; i < 30; i++) m.begin(op(`Q${i}`)).end('ok')
  assert.equal(pending.length, 1)
  pending.splice(0).forEach((fn) => fn())
  assert.equal(calls, 2)
  m.clear()
  assert.deepEqual([calls, m.snapshot().length], [3, 0])
})

test('超过上限只留最近的', () => {
  const { m, flush } = setup({ limit: 5 })
  m.setEnabled(true)
  for (let i = 0; i < 12; i++) m.begin(op(`Q${i}`))
  flush()
  assert.deepEqual(m.snapshot().map((e) => e.name), ['Q7', 'Q8', 'Q9', 'Q10', 'Q11'])
  m.clear()
  flush()
  assert.deepEqual(m.snapshot(), [])
})

test('错误只留状态码或类型名，不留提示文字和响应正文', () => {
  const server = { name: 'ServerError', statusCode: 502, message: 'Bad Gateway', bodyText: '<html>虚构正文</html>', response: {} }
  assert.equal(errorText(server), 'HTTP 502')
  assert.equal(errorText(new TypeError('Failed to fetch 虚构书名')), 'TypeError')
  // 服务端给的错误消息（可能含书名）一律不留
  assert.equal(errorText({ name: 'CombinedGraphQLErrors', message: '虚构作品《甲》不存在' }), 'CombinedGraphQLErrors')
  assert.equal(errorText({ name: '虚构 名字', message: 'x' }), '请求失败')
  assert.equal(errorText(null), '请求失败')
  assert.equal(errorText({}), '请求失败')
})

test('汇总：按操作名分组，订阅和取消的不计耗时', () => {
  const { m, tick, flush } = setup()
  m.setEnabled(true)
  for (const ms of [10, 20, 30, 40, 200]) {
    const h = m.begin(op('Mangas'))
    tick(ms)
    h.end('ok')
  }
  const fail = m.begin(op('Mangas'))
  tick(5)
  fail.end('error', '虚构失败')
  m.begin(op('Mangas')).end('cancelled')
  m.begin(op('Mangas'))
  const sub = m.begin(op('DownloadChanged', 'subscription'))
  sub.event()
  sub.event()
  tick(60_000)
  sub.end('cancelled')
  m.begin(op('SetInLibrary', 'mutation')).end('ok')
  flush()
  const [mangas, ...rest] = summarize(m.snapshot())
  assert.deepEqual(mangas, { name: 'Mangas', kind: 'query', count: 8, errors: 1, pending: 1, avgMs: 51, p95Ms: 200, maxMs: 200 })
  const s = rest.find((x) => x.name === 'DownloadChanged')
  assert.equal(s.avgMs, undefined)
  assert.equal(m.snapshot().find((e) => e.name === 'DownloadChanged').events, 2)
  assert.deepEqual(rest.map((x) => x.name), ['DownloadChanged', 'SetInLibrary'])
})

test('订阅在打开监视前建立：打开时补记，清空后仍列出，结束后不再补', () => {
  const { m, tick, flush } = setup()
  const sub = m.begin(op('DownloadsChanged', 'subscription', []))
  assert.ok(sub)
  sub.event()
  tick(5_000)
  m.setEnabled(true)
  sub.event()
  tick(100)
  let [e] = m.snapshot()
  assert.deepEqual([e.name, e.status, e.joined, e.events], ['DownloadsChanged', 'pending', true, 0])
  flush()
  assert.equal(m.snapshot()[0].events, 1)
  m.clear()
  assert.deepEqual(m.snapshot().map((x) => x.name), ['DownloadsChanged'])
  sub.end('cancelled')
  m.clear()
  m.setEnabled(false)
  m.setEnabled(true)
  assert.deepEqual(m.snapshot(), [])
  // 关闭时的查询仍然不登记
  m.setEnabled(false)
  assert.equal(m.begin(op('Q')), null)
})

// 链路接线：用假的 forward 模拟 Apollo 的几种结束方式
test('链路：GraphQL 错误后直接退订记为失败，没等到结果就退订记为取消', async () => {
  const { Observable } = await import('rxjs')
  const { getMonitor } = await import('../src/api/monitor.ts')
  const { monitorLink } = await import('../src/api/monitorLink.ts')
  const m = getMonitor()
  m.setEnabled(true)
  const link = monitorLink()
  const run = (name, kind, emit) => {
    const forward = () => new Observable((o) => emit(o))
    return link.request({ operationName: name, operationType: kind, variables: { id: 987654321 } }, forward)
  }
  // 带 errors 的结果，然后像 Apollo 那样立即退订、不等 complete
  run('MangaDetail', 'query', (o) => o.next({ errors: [{ message: '虚构作品《甲》不存在' }] })).subscribe().unsubscribe()
  run('Ok', 'query', (o) => o.next({ data: {} })).subscribe().unsubscribe()
  run('Net', 'mutation', (o) => o.error(new TypeError('Failed to fetch'))).subscribe({ error() {} })
  run('Slow', 'query', () => {}).subscribe().unsubscribe()
  const sub = run('Live', 'subscription', (o) => { o.next({ data: {} }); o.next({ data: {} }) }).subscribe()
  await new Promise((r) => setTimeout(r, 300))
  const by = Object.fromEntries(m.snapshot().map((e) => [e.name, e]))
  assert.deepEqual([by.MangaDetail.status, by.MangaDetail.error], ['error', 'GraphQL 错误'])
  assert.deepEqual(by.MangaDetail.vars, ['id'])
  assert.equal(JSON.stringify(m.snapshot()).includes('987654321'), false)
  assert.equal(JSON.stringify(m.snapshot()).includes('虚构作品'), false)
  assert.equal(by.Ok.status, 'ok')
  assert.deepEqual([by.Net.status, by.Net.error], ['error', 'TypeError'])
  assert.equal(by.Slow.status, 'cancelled')
  assert.deepEqual([by.Live.status, by.Live.events], ['pending', 2])
  sub.unsubscribe()
  m.setEnabled(false)
  m.clear()
})
