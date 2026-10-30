import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { CACHE_MS, isFresh, parseSubject, pickMatch, shortCount } from '../src/features/bangumi/rating.ts'
import { resolve } from 'node:path'
import { build } from 'vite'
import { ApolloClient, ApolloLink, InMemoryCache, Observable } from '@apollo/client/core'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { JSDOM } from 'jsdom'
import { act, createElement, Fragment } from 'react'
import { createRoot } from 'react-dom/client'
import { introRise, mangaIntro } from '../src/features/manga/intro.ts'

/** 和公开接口同形的虚构条目 */
const raw = (id, o = {}) => ({
  id, name: `虚构条目 ${id}`, name_cn: '', platform: '漫画', series: true,
  rating: { rank: 12, total: 30, score: 7.4, count: { 1: 1, 7: 20, 8: 9 } },
  collection: { wish: 5, doing: 4, collect: 3, on_hold: 2, dropped: 1 },
  tags: [{ name: '奇幻', count: 9, total_count: 99 }],
  ...o,
})

test('条目换成界面用的形状，分布按 1–10 分排好，缺的分数记 0', () => {
  const s = parseSubject(raw(7))
  assert.equal(s.id, 7)
  assert.equal(s.score, 7.4)
  assert.deepEqual(s.counts, [1, 0, 0, 0, 0, 0, 20, 9, 0, 0])
  assert.deepEqual(s.collection, { wish: 5, doing: 4, collect: 3, onHold: 2, dropped: 1 })
  assert.deepEqual(s.tags, [{ name: '奇幻', count: 9 }])
})

test('缺评分、缺收藏的条目不报错，全部按 0 处理；排名 0 表示暂无排名', () => {
  const s = parseSubject({ id: 3, name: '虚构' })
  assert.equal(s.score, 0)
  assert.equal(s.rank, 0)
  assert.equal(s.counts.length, 10)
  assert.ok(s.counts.every((n) => n === 0))
  assert.equal(s.collection.dropped, 0)
  assert.deepEqual(s.tags, [])
})

test('按标题挑条目：漫画系列优先，跳过同名小说和单行本', () => {
  const list = [
    raw(1, { platform: '小说', series: true }),
    raw(2, { platform: '漫画', series: false }),
    raw(3, { platform: '漫画', series: true }),
  ].map(parseSubject)
  assert.equal(pickMatch(list)?.id, 3)
  // 没有漫画系列时退而求其次
  assert.equal(pickMatch(list.slice(0, 2))?.id, 2)
  assert.equal(pickMatch([parseSubject(raw(4, { platform: '画集', series: false }))]), null)
  assert.equal(pickMatch([]), null)
})

test('缓存一天内有效，时间倒退或没有时间都算过期', () => {
  const now = 1_800_000_000_000
  assert.ok(isFresh(now - CACHE_MS + 1, now))
  assert.ok(!isFresh(now - CACHE_MS, now))
  assert.ok(!isFresh(0, now))
  assert.ok(!isFresh(now + 1000, now))
})

test('人数缩写：一万以上写「万」，以下加千分位', () => {
  assert.equal(shortCount(950), '950')
  assert.equal(shortCount(2415), '2,415')
  assert.equal(shortCount(12000), '1.2万')
  assert.equal(shortCount(30000), '3万')
})

test('演示与 /dev/* 验收页走虚构数据，不请求 api.bgm.tv、不写本地存储', () => {
  const src = readFileSync(new URL('../src/features/bangumi/api.ts', import.meta.url), 'utf8')
  assert.match(src, /const fake = isDemo \|\| isDevLab/)
  // 两处外部请求都先判断 fake
  assert.match(src, /if \(fake\) return fakeSubject\(id\)/)
  assert.match(src, /fake\s*\?\s*await fakeSearch\(keyword\)/)
  assert.match(src, /if \(persist && !fake\)/)
  assert.match(src, /if \(!fake\) \{\s*try \{\s*const raw = localStorage/)
})

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

test('详情进场结束后，已绑定和自动匹配的 Bangumi 评分都不会再次从零计数', async (t) => {
  const require = createRequire(import.meta.url)
  const dom = new JSDOM('<div id="rating"></div>')
  const globals = { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true }
  const previous = Object.fromEntries(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, value })
  const host = dom.window.document.getElementById('rating')
  let now = 0, nextId = 0, reduced = false
  const frames = new Map(), timers = new Map()
  let currentSubject = parseSubject(raw(701))
  const view = () => ({ subject: currentSubject, state: 'ok', at: 1, match: { id: 701, sure: false }, refresh() {} })
  const exports = {}
  const source = readFileSync(new URL('../src/features/bangumi/CommunityRating.tsx', import.meta.url), 'utf8')
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2023 },
  }).outputText
  runInNewContext(code, {
    exports,
    performance: { now: () => now },
    matchMedia: () => ({ matches: reduced }),
    requestAnimationFrame: callback => { frames.set(++nextId, callback); return nextId },
    cancelAnimationFrame: id => frames.delete(id),
    setTimeout: (callback, ms) => { timers.set(++nextId, { callback, at: now + ms }); return nextId },
    clearTimeout: id => timers.delete(id),
    require: name => {
      if (name === 'react' || name === 'react/jsx-runtime') return require(name)
      if (name === './api') return { useBgmSubject: view, useBgmGuess: view }
      if (name === './rating') return { shortCount, subjectUrl: id => `https://example.invalid/${id}` }
      if (name === '@/features/manga/intro') return { introRise }
      if (name === '@/features/tracking/tracking') return { scoreWord: () => '良好' }
      if (name === '@/lib/cn') return { cn: (...values) => values.filter(Boolean).join(' ') }
      if (name === '@/i18n') return { t: key => key }
      if (name === 'motion/react') return { AnimatePresence: Fragment }
      if (name === '@/components/ui/Dialog') return { usePopMotion: () => ({}) }
      if (name === 'lucide-react') return { ChevronRight: () => null }
      if (['@/components/glass/Glass', '@/features/tags/TagTarget', '@/lib/format', './CommunityRating.css'].includes(name)) return {}
      throw new Error(`未模拟的依赖：${name}`)
    },
  }, { filename: 'CommunityRating.tsx' })
  const advance = async ms => {
    now += ms
    await act(async () => {
      const pending = [...frames.values()]
      frames.clear()
      pending.forEach(callback => callback(now))
      for (const [id, timer] of timers) {
        if (timer.at <= now) { timers.delete(id); timer.callback() }
      }
    })
  }
  const score = () => host.querySelector('.font-bold.num')?.textContent
  try {
    for (const [name, Component, props, delay] of [
      ['已绑定', exports.BgmBlock, { id: 701, mine: 0 }, mangaIntro.side + 120],
      ['自动匹配', exports.BgmGuess, { mangaId: 71, title: '虚构漫画', placement: 'side' }, mangaIntro.side],
    ]) {
      await t.test(name, async () => {
        const root = createRoot(host)
        try {
          currentSubject = parseSubject(raw(701))
          await act(async () => root.render(createElement(Component, { ...props, delay })))
          await advance(1400)
          assert.equal(score(), '7.4')
          // useIntro 到时关闭，MangaHero 不再传进场延迟，组件保持挂载。
          await act(async () => root.render(createElement(Component, props)))
          await advance(16)
          assert.equal(score(), '7.4', '进场结束不应重播评分动画')
          assert.equal(frames.size, 0, '同一个分数不再启动逐帧计数')
          // 刷新后分数确实变化时仍要能更新。
          currentSubject = parseSubject(raw(701, { rating: { score: 8.2 } }))
          await act(async () => root.render(createElement(Component, props)))
          await advance(1400)
          assert.equal(score(), '8.2')
        } finally {
          await act(async () => root.unmount())
        }
      })
    }
    await t.test('减少动态效果时直接显示分数', async () => {
      reduced = true
      currentSubject = parseSubject(raw(701, { rating: { score: 8.2 } }))
      const root = createRoot(host)
      try {
        await act(async () => root.render(createElement(exports.BgmBlock, { id: 701, mine: 0, delay: 290 })))
        assert.equal(score(), '8.2')
        assert.equal(frames.size, 0)
        assert.equal(timers.size, 0)
      } finally {
        await act(async () => root.unmount())
      }
    })
  } finally {
    dom.window.close()
    for (const [key, descriptor] of Object.entries(previous)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else delete globalThis[key]
    }
  }
})
