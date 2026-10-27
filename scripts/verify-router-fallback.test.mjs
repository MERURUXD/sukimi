import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { ApolloClient, ApolloLink, InMemoryCache } from '@apollo/client'
import { ApolloProvider } from '@apollo/client/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { createServer } from 'vite'

function installBrowser(pathname) {
  const memory = () => {
    const data = new Map()
    return {
      getItem: (key) => data.get(key) ?? null,
      setItem: (key, value) => data.set(key, String(value)),
      removeItem: (key) => data.delete(key),
      clear: () => data.clear(),
      key: () => null,
      get length() { return data.size },
    }
  }
  const documentElement = { dataset: {}, style: {}, classList: { add() {}, remove() {}, contains: () => false } }
  const document = {
    documentElement,
    // react-router 用 document.defaultView 当 window
    defaultView: null,
    body: { style: {}, appendChild() {}, removeChild() {} },
    cookie: '',
    visibilityState: 'visible',
    fonts: { ready: Promise.resolve(), addEventListener() {}, removeEventListener() {} },
    addEventListener() {},
    removeEventListener() {},
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: () => ({ style: {}, setAttribute() {}, appendChild() {}, classList: { add() {}, remove() {} } }),
    createElementNS: () => ({ style: {}, setAttribute() {}, appendChild() {} }),
  }
  const location = {
    pathname,
    search: '',
    hash: '',
    href: `http://localhost${pathname}`,
    origin: 'http://localhost',
    protocol: 'http:',
    host: 'localhost',
    hostname: 'localhost',
  }
  const window = {
    location,
    history: { pushState() {}, replaceState() {}, state: { idx: 0 }, length: 1, scrollRestoration: 'auto', go() {}, back() {}, forward() {} },
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => false,
    matchMedia: () => ({ matches: false, media: '', addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false }),
    navigator: { hardwareConcurrency: 8, userAgent: 'test', language: 'zh-CN', maxTouchPoints: 0 },
    document,
    localStorage: memory(),
    sessionStorage: memory(),
    innerWidth: 1280,
    innerHeight: 800,
    scrollY: 0,
    pageYOffset: 0,
    devicePixelRatio: 1,
    requestAnimationFrame: (cb) => setTimeout(cb, 16),
    cancelAnimationFrame: (id) => clearTimeout(id),
    getComputedStyle: () => ({ getPropertyValue: () => '', transform: 'none' }),
  }
  window.window = window
  document.defaultView = window
  class Observer { observe() {} unobserve() {} disconnect() {} }
  const globals = {
    window, document, location, navigator: window.navigator,
    localStorage: window.localStorage, sessionStorage: window.sessionStorage,
    matchMedia: window.matchMedia, getComputedStyle: window.getComputedStyle,
    requestAnimationFrame: window.requestAnimationFrame, cancelAnimationFrame: window.cancelAnimationFrame,
    ResizeObserver: Observer, IntersectionObserver: Observer,
    CSS: { supports: () => false, escape: (value) => value },
  }
  // Node 自带不可写的 navigator 等全局；写不上就用 window 上的那一份
  for (const [name, value] of Object.entries(globals)) {
    try {
      Object.defineProperty(globalThis, name, { value, configurable: true, writable: true })
    } catch {
      // 已有且不可配置
    }
  }
}

function walk(routes, visit) {
  for (const route of routes ?? []) {
    visit(route)
    if (route.children) walk(route.children, visit)
  }
}

function withFailedChunk(routes, path) {
  return routes.map((route) => ({
    ...route,
    ...(route.path === path ? { lazy: () => Promise.reject(new Error('分包没加载到')) } : {}),
    ...(route.children ? { children: withFailedChunk(route.children, path) } : {}),
  }))
}

const client = new ApolloClient({ cache: new InMemoryCache(), link: ApolloLink.empty() })

function render(router) {
  return renderToString(createElement(ApolloProvider, { client }, createElement(RouterProvider, { router })))
}

function warningsDuring(run) {
  const found = []
  const original = console.warn
  console.warn = (...args) => {
    found.push(args.map(String).join(' '))
    original.apply(console, args)
  }
  try {
    return { html: run(), found }
  } finally {
    console.warn = original
  }
}

test('直接打开懒加载页面先看到占位，分包失败时导航还在', { timeout: 120_000 }, async () => {
  installBrowser('/')
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: 'custom',
    logLevel: 'error',
  })
  try {
    const mod = await vite.ssrLoadModule('/src/app/router.tsx')
    for (const [name, routes] of [['正式', mod.appRoutes], ['演示', mod.demoRoutes]]) {
      const lazy = []
      walk(routes, (route) => { if (route.lazy) lazy.push(route) })
      assert.ok(lazy.length > 0, `${name}路由应该有懒加载页面`)
      for (const route of lazy) {
        assert.match(renderToString(route.hydrateFallbackElement), /正在打开/, `${name} ${route.path ?? '(布局)'} 没有占位`)
        assert.ok(route.errorElement, `${name} ${route.path ?? '(布局)'} 没有自己的错误页`)
      }
    }

    const pending = warningsDuring(() => render(createMemoryRouter(mod.demoRoutes, {
      basename: '/demo',
      initialEntries: ['/demo/settings'],
    })))
    assert.equal(pending.found.some((line) => line.includes('HydrateFallback')), false)
    assert.match(pending.html, /正在打开/)
    assert.match(pending.html, /书库/)

    const broken = createMemoryRouter(withFailedChunk(mod.demoRoutes, 'settings/:tab?'), {
      basename: '/demo',
      initialEntries: ['/demo/settings'],
    })
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('分包失败后没有进入错误状态')), 8000)
      const done = (state) => {
        if (!state.errors) return
        clearTimeout(timer)
        unsub()
        resolve()
      }
      const unsub = broken.subscribe(done)
      done(broken.state)
    })
    const failed = warningsDuring(() => render(broken))
    assert.match(failed.html, /页面出错了/)
    assert.match(failed.html, /分包没加载到/)
    assert.match(failed.html, /书库/)
  } finally {
    await vite.close()
  }
})
