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
function cover({ isDemo = false, isDevLab = false, recentlyApplied = false } = {}) {
  let status = 'checking'
  const useAuth = selector => selector({ status })
  useAuth.getState = () => ({ status })
  const exports = {}
  runInNewContext(code, {
    exports,
    require: name => {
      if (name === '@/api/auth') return {
        useAuth,
        useAuthChecking: () => status === 'checking' && !isDemo && !isDevLab,
        tokenExpiring: () => false,
        tokenRecentlyApplied: () => recentlyApplied,
        refreshAccessToken: () => assert.fail('首屏渲染不应另行续期'),
      }
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

test('CoverFlow 与 coverPalette 在登录校验完成前不触发未鉴权图片请求，失败也不永久锁死缓存', async () => {
  const flowSource = readFileSync(new URL('../src/components/manga/CoverFlow.tsx', import.meta.url), 'utf8')
  const flowCode = ts.transpileModule(flowSource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2023 },
  }).outputText
  const colorSource = readFileSync(new URL('../src/lib/coverColor.ts', import.meta.url), 'utf8')
  const colorCode = ts.transpileModule(colorSource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2023 },
  }).outputText

  // 1. CoverFlow 在 checking 期间连 fallback（含静态背景 <img>）都不应提前挂载
  let checking = true
  const flowExports = {}
  runInNewContext(flowCode, {
    exports: flowExports,
    require: name => {
      if (name === '@/api/auth') return { useAuthChecking: () => checking }
      if (name === '@/lib/cn') return { cn: (...xs) => xs.filter(Boolean).join(' ') }
      if (name === '@/lib/coverColor') return { NEUTRAL_SWATCHES: [{ rgb: [0.2, 0.2, 0.22], weight: 1 }] }
      if (name === '@/lib/palette') return { extractPalette: () => [] }
      return require(name)
    },
  })
  const React = require('react')
  const flowWithFailedWebgl = () => {
    // 覆写 useState 让 [failed, setFailed] 初始化为 true（模拟不支持 WebGL 时直接走 fallback 分支）
    const origUseState = React.useState
    let first = true
    React.useState = (init) => {
      if (first) { first = false; return origUseState(true) }
      return origUseState(init)
    }
    try {
      return renderToStaticMarkup(createElement(flowExports.CoverFlow, {
        src: '/fictional-cover.jpg',
        fallback: createElement('img', { src: '/fictional-cover.jpg' }),
      }))
    } finally {
      React.useState = origUseState
    }
  }
  assert.doesNotMatch(flowWithFailedWebgl(), /<img|fictional-cover/, 'checking 期间 CoverFlow 回退层也不能偷跑图片')
  checking = false
  assert.match(flowWithFailedWebgl(), /fictional-cover/, '校验结束后才允许回退层挂载图片')

  // 2. coverPalette 必须等 waitUntilAuthChecked 返回后才建 Image，且 onerror 后允许下次重试
  let releaseAuth
  let authReady = false
  let imageCreated = 0
  let shouldFail = true
  const origImage = globalThis.Image
  const origDocument = globalThis.document
  globalThis.document = {
    createElement: () => ({ width: 0, height: 0, getContext: () => ({ drawImage() {}, getImageData: () => ({ data: new Uint8ClampedArray(24 * 24 * 4) }) }) }),
  }
  globalThis.Image = class {
    constructor() { imageCreated++ }
    set src(v) {
      queueMicrotask(() => {
        if (shouldFail) this.onerror?.()
        else this.onload?.()
      })
    }
  }
  try {
    const colorExports = {}
    runInNewContext(colorCode, {
      exports: colorExports,
      Image: globalThis.Image,
      document: globalThis.document,
      require: name => {
        if (name === '@/api/auth') return {
          waitUntilAuthChecked: () => authReady ? Promise.resolve(true) : new Promise(r => { releaseAuth = (ok) => { authReady = ok; r(ok) } }),
        }
        if (name === './palette') return { extractPalette: () => [{ rgb: [0.5, 0.4, 0.3], weight: 1 }] }
        return require(name)
      },
    })
    const pending = colorExports.coverPalette('/fictional-cover.jpg')
    await new Promise(r => setTimeout(r, 10))
    assert.equal(imageCreated, 0, 'waitUntilAuthChecked 未解决前不能发起 new Image()')
    releaseAuth(true)
    const first = await pending
    assert.equal(imageCreated, 1)
    assert.deepEqual([...first[0].rgb], [0.2, 0.2, 0.22], '第一次失败回退中性灰')

    // 第二次调用应清掉失败缓存并重新请求成功
    shouldFail = false
    const second = await colorExports.coverPalette('/fictional-cover.jpg')
    assert.equal(imageCreated, 2, 'onerror 不应把失败永久锁进 paletteCache')
    assert.deepEqual([...second[0].rgb], [0.5, 0.4, 0.3])
  } finally {
    if (origImage === undefined) delete globalThis.Image
    else globalThis.Image = origImage
    if (origDocument === undefined) delete globalThis.document
    else globalThis.document = origDocument
  }
})

test('CoverImg 刚写好 Cookie 时若仍收到迟到的 401/错误，重试一次且不重复续期', async () => {
  const { JSDOM } = await import('jsdom')
  const { createRoot } = await import('react-dom/client')
  const { act } = await import('react')
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost/' })
  const saved = {
    window: globalThis.window,
    document: globalThis.document,
    actEnv: globalThis.IS_REACT_ACT_ENVIRONMENT,
  }
  globalThis.window = dom.window
  globalThis.document = dom.window.document
  globalThis.IS_REACT_ACT_ENVIRONMENT = true

  let recentlyApplied = true
  let refreshCalled = 0
  const exports = {}
  runInNewContext(code, {
    exports,
    require: name => {
      if (name === '@/api/auth') return {
        useAuth: Object.assign(selector => selector({ status: 'signedIn' }), { getState: () => ({ status: 'signedIn' }) }),
        useAuthChecking: () => false,
        tokenExpiring: () => false,
        tokenRecentlyApplied: () => recentlyApplied,
        refreshAccessToken: () => { refreshCalled++; return Promise.resolve('unused') },
      }
      if (name === '@/lib/coverVisibility') return { onCoverVisibility() {} }
      if (name === './CoverSkeleton') return { CoverSkeleton: () => createElement('span', { 'data-placeholder': true }) }
      return require(name)
    },
  })

  const rootEl = dom.window.document.getElementById('root')
  const root = createRoot(rootEl)
  try {
    await act(async () => {
      root.render(createElement(exports.CoverImg, { src: '/fictional-cover.jpg' }))
    })
    const firstImg = rootEl.querySelector('img')
    assert.ok(firstImg)

    // 模拟刚完成登录但先前的在途请求返回了迟到的错误：应换新元素重试一次，不调 refreshAccessToken
    await act(async () => {
      firstImg.dispatchEvent(new dom.window.Event('error'))
    })
    const retryImg = rootEl.querySelector('img')
    assert.ok(retryImg, '首次错在刚写入令牌窗口内时应重试一次')
    assert.notEqual(retryImg, firstImg, '通过换 key 重建 <img> 重新发起请求')
    assert.equal(refreshCalled, 0)

    // 重试后再次失败则彻底进入占位图标，不无限循环
    await act(async () => {
      retryImg.dispatchEvent(new dom.window.Event('error'))
    })
    assert.equal(rootEl.querySelector('img'), null)
    assert.ok(rootEl.querySelector('svg'))
  } finally {
    await act(async () => { root.unmount() })
    dom.window.close()
    if (saved.window === undefined) delete globalThis.window
    else globalThis.window = saved.window
    if (saved.document === undefined) delete globalThis.document
    else globalThis.document = saved.document
    if (saved.actEnv === undefined) delete globalThis.IS_REACT_ACT_ENVIRONMENT
    else globalThis.IS_REACT_ACT_ENVIRONMENT = saved.actEnv
  }
})
