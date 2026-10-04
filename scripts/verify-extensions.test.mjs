import assert from 'node:assert/strict'
import test from 'node:test'
import { defaultLangs, langCounts, tabCounts, visibleExtensions } from '../src/features/browse/extensionList.ts'

// 虚构扩展，不读取服务端
const ext = (pkgName, name, lang, o = {}) => ({
  pkgName, name, lang, versionName: '1.0', iconUrl: '', isInstalled: false, hasUpdate: false, isObsolete: false,
  contentWarning: 'SAFE', extensionStore: null, ...o,
})
const list = [
  ext('a', '甲来源', 'zh', { isInstalled: true }),
  ext('b', '乙来源', 'zh', { isInstalled: true, hasUpdate: true }),
  ext('c', 'Alpha', 'en'),
  ext('d', 'Beta', 'en', { contentWarning: 'NSFW' }),
  ext('e', 'Gamma', 'all'),
  ext('f', 'Delta', 'ja', { isInstalled: true, contentWarning: 'NSFW' }),
  ext('g', '丙来源', 'zh-Hans'),
  ext('h', 'Epsilon', 'pt-BR'),
]

test('分栏计数：可更新只算已安装的', () => {
  assert.deepEqual(tabCounts([...list, ext('x', 'X', 'en', { hasUpdate: true })]), { installed: 3, updates: 1, available: 6 })
})

test('默认语言：已安装语言、多语言和浏览器语言，只保留存在的', () => {
  assert.deepEqual(defaultLangs(list, ['zh-CN', 'en-US']).sort(), ['all', 'en', 'ja', 'zh', 'zh-hans'])
  assert.deepEqual(defaultLangs(list, ['pt-BR']).sort(), ['all', 'ja', 'pt-br', 'zh'])
  assert.deepEqual(defaultLangs([], ['zh-CN']), [])
})

test('语言计数只算未安装，多的在前', () => {
  assert.deepEqual(langCounts(list), [['en', 2], ['all', 1], ['pt-br', 1], ['zh-hans', 1]])
})

test('未安装：按语言与成人开关筛选，分组按所选顺序', () => {
  const g = visibleExtensions(list, { tab: 'available', langs: ['all', 'en'], query: '', hideNsfw: false })
  assert.deepEqual(g.map((x) => [x.lang, x.items.map((e) => e.pkgName)]), [['all', ['e']], ['en', ['c', 'd']]])
  const safe = visibleExtensions(list, { tab: 'available', langs: ['en'], query: '', hideNsfw: true })
  assert.deepEqual(safe.flatMap((x) => x.items.map((e) => e.pkgName)), ['c'])
  // 空数组表示不限语言
  assert.equal(visibleExtensions(list, { tab: 'available', langs: [], query: '', hideNsfw: false }).flatMap((x) => x.items).length, 5)
})

test('已安装不受语言和成人开关影响；关键词匹配名称和包名', () => {
  const g = visibleExtensions(list, { tab: 'installed', langs: ['en'], query: '', hideNsfw: true })
  assert.deepEqual(g.flatMap((x) => x.items.map((e) => e.pkgName)).sort(), ['a', 'b', 'f'])
  assert.deepEqual(visibleExtensions(list, { tab: 'installed', langs: [], query: 'DEL', hideNsfw: false }).flatMap((x) => x.items.map((e) => e.pkgName)), ['f'])
  assert.deepEqual(visibleExtensions(list, { tab: 'updates', langs: [], query: '', hideNsfw: false }).flatMap((x) => x.items.map((e) => e.pkgName)), ['b'])
})
