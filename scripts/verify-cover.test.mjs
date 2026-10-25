import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'
import { trackCoverLoading } from '../src/lib/coverMotion.ts'
import { onCoverVisibility } from '../src/lib/coverVisibility.ts'

const require = createRequire(import.meta.url)
const source = readFileSync(new URL('../src/components/manga/CoverImg.tsx', import.meta.url), 'utf8')
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2023 },
}).outputText

// 执行正式组件与 React 渲染，只替换登录状态和占位组件；全部使用虚构地址。
function cover({ isDemo = false, isDevLab = false } = {}) {
  let status = 'checking'
  const useAuth = selector => selector({ status })
  useAuth.getState = () => ({ status })
  const exports = {}
  runInNewContext(code, {
    exports,
    require: name => {
      if (name === '@/api/auth') return {
        useAuth,
        tokenExpiring: () => false,
        refreshAccessToken: () => assert.fail('首屏渲染不应另行续期'),
      }
      if (name === '@/lib/demo') return { isDemo, isDevLab }
      if (name === '@/lib/coverVisibility') return { onCoverVisibility() {} }
      if (name === './CoverSkeleton') return { CoverSkeleton: () => createElement('span', { 'data-placeholder': true }) }
      return require(name)
    },
  })
  return {
    status: value => { status = value },
    render: (src = '/fictional-cover.jpg') => renderToStaticMarkup(createElement(exports.CoverImg, { src, loading: 'lazy' })),
  }
}

test('冷启动先显示占位，写好登录 Cookie 后才给浏览器封面地址', () => {
  const view = cover()
  const waiting = view.render()
  assert.match(waiting, /data-placeholder/)
  assert.doesNotMatch(waiting, /<img|fictional-cover/, '不能留下验证前发出、验证后才报错的图片请求')

  view.status('signedIn')
  const ready = view.render()
  assert.match(ready, /<img/)
  assert.match(ready, /src="\/fictional-cover.jpg"/)
  assert.match(ready, /loading="lazy"/, '保留浏览器懒加载与原地址缓存')
})

test('演示和虚构验收页不等待登录，也不续期', () => {
  for (const mode of [{ isDemo: true }, { isDevLab: true }]) {
    const view = cover(mode)
    assert.match(view.render('data:image/svg+xml,fictional'), /<img/)
  }
})

test('缺封面仍显示占位图标，不伪装成一直加载', () => {
  const view = cover()
  for (const status of ['checking', 'signedIn']) {
    view.status(status)
    const empty = view.render(null)
    assert.match(empty, /<svg/)
    assert.doesNotMatch(empty, /<img|data-placeholder/)
  }
})

test('多张待加载封面共享暂停，滚动停止和全部卸载都恢复并清理', t => {
  const originalWindow = globalThis.window, originalDocument = globalThis.document
  const events = new EventTarget(), attributes = new Set()
  Object.assign(events, {
    setTimeout: (...args) => setTimeout(...args),
    clearTimeout: timer => clearTimeout(timer),
  })
  globalThis.window = events
  globalThis.document = { documentElement: {
    setAttribute: key => attributes.add(key), removeAttribute: key => attributes.delete(key),
  } }
  t.mock.timers.enable({ apis: ['setTimeout'] })
  let first, second, next
  try {
    assert.equal(trackCoverLoading(null), undefined)
    first = trackCoverLoading({})
    second = trackCoverLoading({})
    const paused = () => attributes.has('data-cover-scrolling')
    events.dispatchEvent(new Event('scroll'));assert.ok(paused())
    t.mock.timers.tick(100)
    events.dispatchEvent(new Event('scroll'))
    t.mock.timers.tick(149);assert.ok(paused(), '惯性滚动不应提前恢复')
    t.mock.timers.tick(1);assert.equal(paused(), false, '无 scrollend 时也恢复')
    events.dispatchEvent(new Event('scroll'))
    events.dispatchEvent(new Event('scrollend'));assert.equal(paused(), false)
    first();first()
    events.dispatchEvent(new Event('scroll'));assert.ok(paused(), '还有占位时继续监听')
    second();assert.equal(paused(), false)
    events.dispatchEvent(new Event('scroll'));assert.equal(paused(), false, '全部卸载后不继续监听')
    next = trackCoverLoading({})
    events.dispatchEvent(new Event('scroll'));assert.ok(paused(), '新占位能重新监听')
    next();assert.equal(paused(), false)
    t.mock.timers.tick(200);assert.equal(paused(), false)
  } finally {
    first?.();second?.();next?.()
    t.mock.timers.reset()
    if (originalWindow === undefined) delete globalThis.window
    else globalThis.window = originalWindow
    if (originalDocument === undefined) delete globalThis.document
    else globalThis.document = originalDocument
  }
})

test('封面可见性只判断一次，支持取消、复用和不支持观察器的浏览器', () => {
  const original = globalThis.IntersectionObserver
  let created = 0, notify
  const observing = new Set()
  globalThis.IntersectionObserver = class {
    constructor(callback) { created++; notify = callback }
    observe(image) { observing.add(image) }
    unobserve(image) { observing.delete(image) }
  }
  try {
    const visible = {}, offscreen = {}, result = []
    onCoverVisibility(visible, value => result.push(['屏内', value]))
    onCoverVisibility(offscreen, value => result.push(['屏外', value]))
    assert.equal(created, 1, '多张封面共用观察器')
    notify([{ target: visible, isIntersecting: true }, { target: offscreen, isIntersecting: false }])
    assert.deepEqual(result, [['屏内', true], ['屏外', false]])
    assert.equal(observing.size, 0, '载入后不继续追踪滚动')
    notify([{ target: visible, isIntersecting: false }])
    assert.equal(result.length, 2, '后续滚动不重播或撤销载入状态')

    const removed = {}, cancel = onCoverVisibility(removed, () => assert.fail('卸载后不应更新'))
    cancel(); cancel()
    notify([{ target: removed, isIntersecting: true }])
    assert.equal(observing.size, 0)

    const reused = {}, cancelOld = onCoverVisibility(reused, () => assert.fail('旧请求不应更新'))
    cancelOld()
    onCoverVisibility(reused, value => result.push(['新地址', value]))
    cancelOld()
    assert.ok(observing.has(reused), '旧清理不取消新请求')
    notify([{ target: reused, isIntersecting: true }])
    assert.deepEqual(result.at(-1), ['新地址', true])
    assert.equal(observing.size, 0)

    delete globalThis.IntersectionObserver
    const cancelFallback = onCoverVisibility({}, value => result.push(['兼容', value]))
    cancelFallback()
    assert.deepEqual(result.at(-1), ['兼容', true], '旧浏览器沿用渐显')
  } finally {
    if (original === undefined) delete globalThis.IntersectionObserver
    else globalThis.IntersectionObserver = original
  }
})
