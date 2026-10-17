import assert from 'node:assert/strict'
import test from 'node:test'
import { resolve } from 'node:path'
import { build } from 'vite'
import { ApolloClient, ApolloLink, InMemoryCache, Observable } from '@apollo/client/core'

const result = await build({
  configFile: false, logLevel: 'silent',
  resolve: { alias: { '@': resolve('src') } },
  build: { write: false, minify: false, lib: { entry: resolve('src/features/tracking/bindBgmSubject.ts'), formats: ['es'] } },
})
const chunk = (Array.isArray(result) ? result : [result]).flatMap(x => x.output).find(item => item.type === 'chunk' && item.isEntry)
const { bindBgmSubject } = await import(`data:text/javascript;base64,${Buffer.from(chunk.code + '\n//# sourceURL=bangumi-binding-probe.js').toString('base64')}`)
const subject = { id: 601, name: '虚构原名', nameCn: '虚构译名' }

function server(search = () => ['601']) {
  const saved = new Set(), calls = []
  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new ApolloLink(op => new Observable(observer => {
      calls.push({ name: op.operationName, ...op.variables })
      if (op.operationName === 'SearchTracker') {
        try {
          const ids = search(op.variables.query)
          ids.forEach(id => saved.add(id))
          observer.next({ data: { searchTracker: { trackSearches: ids.map(remoteId => ({
            __typename: 'TrackSearchType', id: Number(remoteId), remoteId, title: '虚构结果', coverUrl: '', summary: '',
            publishingStatus: '', publishingType: '', startDate: '', totalChapters: 0, trackingUrl: '',
          })) } } })
        } catch (e) { observer.error(e); return }
      } else if (!saved.has(op.variables.remoteId)) {
        observer.error(new Error('Exception while fetching data (/bindTrack) : Collection is empty.'))
        return
      } else observer.next({ data: { bindTrack: { trackRecord: null } } })
      observer.complete()
    })),
  })
  return { client, calls, saved }
}

test('首次快捷绑定先在服务端登记搜索结果，再绑定选定条目', async () => {
  const { client, calls } = server()
  await bindBgmSubject(client, 10, 3, subject, () => {})
  assert.deepEqual(calls.map(x => x.name), ['SearchTracker', 'BindTrack'])
  assert.equal(calls[1].remoteId, '601')
  assert.equal(calls[1].mangaId, 10)
  assert.equal(calls[1].trackerId, 3)
  client.stop()
})

test('原名搜索未命中时尝试译名，跳过同名但 ID 不同的结果', async () => {
  const { client, calls } = server(query => query === subject.name ? ['999'] : ['999', '601'])
  await bindBgmSubject(client, 10, 3, subject, () => {})
  assert.deepEqual(calls.map(x => x.query ?? x.remoteId), [subject.name, subject.nameCn, '601'])
  client.stop()
})

test('空结果或只有其他条目时不绑定，并提示手动搜索', async () => {
  for (const ids of [[], ['999']]) {
    const { client, calls } = server(() => ids)
    await assert.rejects(bindBgmSubject(client, 10, 3, subject, () => {}), /手动搜索绑定/)
    assert.ok(calls.every(x => x.name === 'SearchTracker'))
    client.stop()
  }
})

test('搜索失败时不绑定', async () => {
  const { client, calls } = server(() => { throw new Error('虚构网络失败') })
  await assert.rejects(bindBgmSubject(client, 10, 3, subject, () => {}), /虚构网络失败/)
  assert.equal(calls.length, 1)
  client.stop()
})

test('搜索期间换账号时中止后续绑定', async () => {
  let switched = false
  const { client, calls } = server(() => { switched = true; return ['601'] })
  await assert.rejects(bindBgmSubject(client, 10, 3, subject, () => {
    if (switched) throw new Error('账号已切换')
  }), /账号已切换/)
  assert.equal(calls.length, 1)
  client.stop()
})

test('本地有缓存但服务端记录已清空时仍重新搜索', async () => {
  const { client, calls, saved } = server()
  await bindBgmSubject(client, 10, 3, subject, () => {})
  saved.clear()
  await bindBgmSubject(client, 11, 3, subject, () => {})
  assert.deepEqual(calls.map(x => x.name), ['SearchTracker', 'BindTrack', 'SearchTracker', 'BindTrack'])
  client.stop()
})
