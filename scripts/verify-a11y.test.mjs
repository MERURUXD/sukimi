/**
 * 键盘、焦点和读屏这些行为要在 jsdom 里点出来，并且得在加载应用之前装好 document。
 * 现有脚本是纯函数或静态标记，合进同一个文件会让它们依赖这套浏览器替身，所以单独放。
 * 整组用例把 prefers-reduced-motion 设为开启：退出动画时长为 0，焦点才会在关闭后马上回来；
 * 同时也用来确认减少动态时不再停在半路的位移上。
 */
import assert from 'node:assert/strict'
import { after, describe, test } from 'node:test'
import { JSDOM } from 'jsdom'
import { ApolloClient, ApolloLink, InMemoryCache, Observable } from '@apollo/client'
import { ApolloProvider } from '@apollo/client/react'
import { act, createElement, Fragment, StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { createMemoryRouter, MemoryRouter, RouterProvider } from 'react-router'

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'http://localhost/',
  pretendToBeVisual: true,
})
const { window } = dom
let reduced = true

const medias = []
window.matchMedia = (query) => {
  const set = new Set()
  const media = {
    get matches() {
      return query.includes('prefers-reduced-motion') ? reduced : false
    },
    media: query,
    onchange: null,
    addEventListener(type, fn) { if (type === 'change') set.add(fn) },
    removeEventListener(type, fn) { set.delete(fn) },
    addListener(fn) { set.add(fn) },
    removeListener(fn) { set.delete(fn) },
    dispatchEvent() {
      for (const fn of set) fn({ matches: media.matches, media: query })
      return true
    },
  }
  medias.push(media)
  return media
}

const g = globalThis
g.window = window
g.document = window.document
g.HTMLElement = window.HTMLElement
g.Element = window.Element
g.SVGElement = window.SVGElement
g.Node = window.Node
g.DocumentFragment = window.DocumentFragment
g.MutationObserver = window.MutationObserver
g.NodeFilter = window.NodeFilter
g.getComputedStyle = window.getComputedStyle.bind(window)
g.history = window.history
g.location = window.location
g.matchMedia = window.matchMedia
// 断言按简体中文写；jsdom 的浏览器语言是 en-US，要显式固定界面语言
g.localStorage = window.localStorage
window.localStorage.setItem('suwayomi-web.locale', 'zh-CN')
if (typeof window.document.elementFromPoint !== 'function') window.document.elementFromPoint = () => null
try {
  g.navigator = window.navigator
} catch {
  Object.defineProperty(g, 'navigator', { configurable: true, get: () => window.navigator })
}
const css = { supports: () => false }
window.CSS = css
g.CSS = css
class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.ResizeObserver = ResizeObserver
g.ResizeObserver = ResizeObserver
window.Element.prototype.scrollTo = () => {}
window.Element.prototype.scrollIntoView = () => {}
window.scrollTo = () => {}
window.innerWidth = 390
window.innerHeight = 800
try {
  Object.defineProperty(window.history, 'scrollRestoration', { configurable: true, writable: true, value: 'auto' })
} catch { /* jsdom 已可写 */ }
g.IS_REACT_ACT_ENVIRONMENT = true

const { createServer } = await import('vite')
const vite = await createServer({
  server: { middlewareMode: true, hmr: false, watch: null },
  appType: 'custom',
  logLevel: 'error',
})
const cache = new Map()
const mod = async (id) => {
  if (!cache.has(id)) cache.set(id, await vite.ssrLoadModule(id))
  return cache.get(id)
}

let root
const host = () => document.getElementById('root')
async function render(node) {
  root = createRoot(host())
  await act(async () => { root.render(node) })
}
async function unmount() {
  if (!root) return
  await act(async () => { root.unmount() })
  root = undefined
  for (const node of [...document.body.children]) if (node.id !== 'root') node.remove()
}
async function cleanup() {
  await act(async () => {
    cache.get('/src/components/ui/Confirm.tsx')?.resetConfirm()
    cache.get('/src/components/ui/toast.tsx')?.clearToasts()
    cache.get('/src/api/live.ts')?.useLive.setState({ queue: [] })
    await new Promise((r) => setTimeout(r, 20))
  })
  await unmount()
}

const named = (el) => (el?.getAttribute?.('aria-label') || el?.textContent || '').replace(/\s+/g, ' ').trim()
const focused = (el) => assert.ok(document.activeElement === el, `焦点在 ${document.activeElement?.tagName || '无'}「${named(document.activeElement).slice(0, 40)}」`)
const press = (key, target = document, init = {}) => {
  target.dispatchEvent(new window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }))
}
async function until(pred) {
  for (let i = 0; i < 40; i++) {
    if (pred()) return
    await act(async () => { await new Promise((r) => setTimeout(r, 20)) })
  }
  assert.ok(pred(), '界面没有在预期时间内稳定')
}
function quietClient() {
  let calls = 0
  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new ApolloLink(() => {
      calls += 1
      return new Observable((observer) => { observer.error(new Error('虚构测试不应请求服务端')) })
    }),
  })
  return { client, calls: () => calls }
}
const dialogs = () => document.querySelector('[role="dialog"], [role="alertdialog"]')

test('纵向跳页在图片尺寸变化后保持物理落点，用户滚动后解除', async () => {
  const { ScrollView } = await mod('/src/features/reader/ScrollView.tsx')
  const scroller = { current: null }, jumpTarget = { current: 30 }
  const heights = Array(180).fill(1200)
  const frames = new Map(), resize = []
  let frameId = 0
  const original = {
    rect: window.HTMLElement.prototype.getBoundingClientRect,
    into: window.HTMLElement.prototype.scrollIntoView,
    height: Object.getOwnPropertyDescriptor(window.HTMLElement.prototype, 'clientHeight'),
    ro: g.ResizeObserver, io: g.IntersectionObserver,
    raf: g.requestAnimationFrame, caf: g.cancelAnimationFrame,
  }
  const topOf = (i) => heights.slice(0, i).reduce((sum, h) => sum + h, 0)
  window.HTMLElement.prototype.getBoundingClientRect = function () {
    const i = this.dataset.i
    const top = i === undefined ? 0 : topOf(Number(i)) - (scroller.current?.scrollTop ?? 0)
    const height = i === undefined ? 800 : heights[Number(i)]
    return { top, bottom: top + height, left: 0, right: 900, width: 900, height }
  }
  window.HTMLElement.prototype.scrollIntoView = function () {
    if (this.dataset.i !== undefined) scroller.current.scrollTop = topOf(Number(this.dataset.i))
  }
  Object.defineProperty(window.HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 800 })
  g.ResizeObserver = class { constructor(fn) { resize.push(fn) } observe() {} disconnect() {} }
  g.IntersectionObserver = class { observe() {} disconnect() {} }
  g.requestAnimationFrame = (fn) => { frames.set(++frameId, fn); return frameId }
  g.cancelAnimationFrame = (id) => frames.delete(id)
  const pages = Array.from({ length: 180 }, (_, i) => `https://example.invalid/jump-${i}.png`)
  const props = {
    pages, src: (i) => pages[i], splits: () => false, startPage: 30,
    settings: { mode: 'vertical', fit: 'original', preload: 2 },
    scrollerRef: scroller, jumpTarget, footer: null,
    onPage() {}, onAspect() {}, onCenter() {}, onScroll() {}, onScrolling() {},
    onInteract() { jumpTarget.current = null },
  }
  const resizeNow = async () => {
    await act(async () => {
      for (const fn of resize) fn()
      const queued = [...frames.values()]
      frames.clear()
      for (const fn of queued) fn()
    })
  }
  try {
    await render(createElement(ScrollView, props))
    assert.equal(scroller.current.scrollTop, 36_000)
    heights.fill(800)
    await act(async () => root.render(createElement(ScrollView, props)))
    assert.equal(scroller.current.scrollTop, 24_000, '裁边后目标前的占位变矮，画面也要重新对齐')
    heights.fill(700)
    await resizeNow()
    assert.equal(scroller.current.scrollTop, 21_000, 'ResizeObserver 捕获的布局变化也要重新对齐')
    const inputs = [
      () => scroller.current.dispatchEvent(new window.WheelEvent('wheel', { bubbles: true })),
      () => scroller.current.dispatchEvent(new window.MouseEvent('pointerdown', { bubbles: true })),
      ...['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'].map(key => () => press(key, scroller.current)),
    ]
    for (const input of inputs) {
      jumpTarget.current = 30
      await act(async () => root.render(createElement(ScrollView, props)))
      await act(async () => input())
      assert.equal(jumpTarget.current, null, '主动滚动解除程序目标')
      scroller.current.scrollTop = 21_400
      await resizeNow()
      assert.equal(scroller.current.scrollTop, 21_400, '用户滚动后不再拉回旧目标')
    }
  } finally {
    await cleanup()
    window.HTMLElement.prototype.getBoundingClientRect = original.rect
    window.HTMLElement.prototype.scrollIntoView = original.into
    if (original.height) Object.defineProperty(window.HTMLElement.prototype, 'clientHeight', original.height)
    else delete window.HTMLElement.prototype.clientHeight
    g.ResizeObserver = original.ro
    g.IntersectionObserver = original.io
    g.requestAnimationFrame = original.raf
    g.cancelAnimationFrame = original.caf
  }
})

after(async () => { await vite.close() })

describe('键盘与读屏', { concurrency: 1, timeout: 120_000 }, () => {
  test('危险确认打开时聚焦取消，Tab 留在框内，关闭后焦点回到触发按钮', async () => {
    const { confirm, ConfirmHost } = await mod('/src/components/ui/Confirm.tsx')
    let answer
    function Harness() {
      return createElement(StrictMode, null,
        createElement('button', { onClick: () => { answer = confirm({ title: '撤销这个码？', ok: '撤销', danger: true }) } }, '撤销这个码'),
        createElement(ConfirmHost),
      )
    }
    try {
      await render(createElement(Harness))
      const trigger = [...document.querySelectorAll('button')].find((b) => named(b) === '撤销这个码')
      trigger.focus()
      await act(async () => { trigger.click() })
      assert.equal(named(document.activeElement), '取消')
      assert.equal(host().inert, true)
      assert.equal(document.querySelector('[role="alertdialog"]').getAttribute('aria-label'), '撤销这个码？')
      const buttons = [...document.querySelectorAll('[role="alertdialog"] button')]
      buttons.at(-1).focus()
      press('Tab')
      assert.equal(named(document.activeElement), '取消')
      buttons[0].focus()
      press('Tab', document, { shiftKey: true })
      assert.equal(named(document.activeElement), '撤销')
      const outside = document.createElement('button')
      outside.textContent = '外面'
      document.body.appendChild(outside)
      outside.focus()
      assert.ok(document.querySelector('[role="alertdialog"]').contains(document.activeElement))
      press('Escape')
      await until(() => !dialogs())
      assert.equal(host().inert, false)
      focused(trigger)
      assert.equal(await answer, false)
    } finally {
      await cleanup()
    }
  })

  test('普通确认聚焦确定，点确定才算同意', async () => {
    const { confirm, ConfirmHost } = await mod('/src/components/ui/Confirm.tsx')
    let answer
    function Harness() {
      return createElement(StrictMode, null,
        createElement('button', { onClick: () => { answer = confirm({ title: '标记已读？' }) } }, '标记已读'),
        createElement(ConfirmHost),
      )
    }
    try {
      await render(createElement(Harness))
      const trigger = [...document.querySelectorAll('button')].find((b) => named(b) === '标记已读')
      trigger.focus()
      await act(async () => { trigger.click() })
      const ok = [...document.querySelectorAll('[role="alertdialog"] button')].find((b) => named(b) === '确定')
      // 关掉时的退出动画若放进不让出时间的 act，动画帧会在同一时刻里无限排下去
      ok.click()
      await until(() => !dialogs())
      assert.equal(await answer, true)
      focused(trigger)
    } finally {
      await cleanup()
    }
  })

  test('叠着的对话框只有最上面一层接键盘，关掉后焦点回到下一层', async () => {
    const { confirm, ConfirmHost } = await mod('/src/components/ui/Confirm.tsx')
    const { Dialog } = await mod('/src/components/ui/Dialog.tsx')
    function Harness() {
      const [open, setOpen] = useState(false)
      return createElement(StrictMode, null,
        createElement('button', { onClick: () => setOpen(true) }, '打开追踪'),
        open && createElement(Dialog, { label: '追踪', onClose: () => setOpen(false) },
          createElement('button', { type: 'button', 'aria-label': '关闭', onClick: () => setOpen(false) }, '关闭'),
          createElement('button', { type: 'button', onClick: () => { void confirm({ title: '解除绑定？', ok: '解除', danger: true }) } }, '解除绑定'),
        ),
        createElement(ConfirmHost),
      )
    }
    try {
      await render(createElement(Harness))
      const trigger = [...document.querySelectorAll('button')].find((b) => named(b) === '打开追踪')
      trigger.focus()
      await act(async () => { trigger.click() })
      assert.equal(named(document.activeElement), '关闭')
      assert.equal(host().inert, true)
      const unbind = [...document.querySelectorAll('button')].find((b) => named(b) === '解除绑定')
      unbind.focus()
      await act(async () => { unbind.click() })
      assert.equal(named(document.activeElement), '取消')
      const layers = [...document.querySelectorAll('[role="presentation"]')]
      assert.equal(layers.length, 2)
      assert.equal(layers[0].inert, true)
      assert.equal(layers[1].inert, false)
      press('Escape')
      await until(() => !document.querySelector('[role="alertdialog"]'))
      assert.equal(named(document.activeElement), '解除绑定')
      assert.ok(document.querySelector('[role="dialog"]'))
      assert.equal(host().inert, true)
      press('Escape')
      await until(() => !dialogs())
      focused(trigger)
      assert.equal(host().inert, false)
    } finally {
      await cleanup()
    }
  })

  test('封面放大打开时焦点在关闭上，背后页面不再可点', async () => {
    const { CoverZoomHost } = await mod('/src/features/manga/CoverZoom.tsx')
    function Harness() {
      const [open, setOpen] = useState(false)
      return createElement(Fragment, null,
        createElement('button', { onClick: () => setOpen(true) }, '看封面'),
        createElement(CoverZoomHost, {
          src: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
          title: '虚构封面',
          open,
          onClose: () => setOpen(false),
        }),
      )
    }
    try {
      await render(createElement(Harness))
      const trigger = [...document.querySelectorAll('button')].find((b) => named(b) === '看封面')
      trigger.focus()
      await act(async () => { trigger.click() })
      const dialog = document.querySelector('[role="dialog"]')
      assert.equal(dialog.getAttribute('aria-label'), '虚构封面 的封面')
      assert.equal(named(document.activeElement), '关闭')
      assert.equal(host().inert, true)
      const outside = document.createElement('button')
      outside.textContent = '外面'
      document.body.appendChild(outside)
      outside.focus()
      assert.ok(dialog.contains(document.activeElement))
      press('Escape')
      await until(() => !dialogs())
      focused(trigger)
      assert.equal(host().inert, false)
    } finally {
      await cleanup()
    }
  })

  test('减少动态时确认框、菜单、批量栏和提示不再停在位移途中', async () => {
    const { confirm, ConfirmHost } = await mod('/src/components/ui/Confirm.tsx')
    const { ContextMenu } = await mod('/src/components/ui/ContextMenu.tsx')
    const { BatchBar } = await mod('/src/components/ui/BatchBar.tsx')
    const { Toaster, toast } = await mod('/src/components/ui/toast.tsx')
    function Harness() {
      return createElement(Fragment, null,
        createElement('button', { onClick: () => { void confirm({ title: '减少动态？', danger: true }) } }, '打开'),
        createElement(ConfirmHost),
        createElement(ContextMenu, { at: { x: 8, y: 8 }, onClose() {}, label: '菜单' },
          createElement('button', { type: 'button', role: 'menuitem' }, '一项'),
        ),
        createElement(BatchBar, { open: true, count: 1, unit: '部', onSelectAll() {}, onCancel() {} },
          createElement('button', { type: 'button' }, '标记'),
        ),
        createElement(Toaster),
      )
    }
    try {
      await render(createElement(Harness))
      const trigger = [...document.querySelectorAll('button')].find((b) => named(b) === '打开')
      await act(async () => {
        trigger.click()
        toast('没网', 'error')
      })
      await act(async () => { await new Promise((r) => setTimeout(r, 50)) })
      const glasses = [...document.querySelectorAll('.glass')]
      assert.ok(glasses.length >= 3)
      for (const el of glasses) {
        const style = el.getAttribute('style') || ''
        assert.doesNotMatch(style, /translateY\([^0]/, style)
        assert.doesNotMatch(style, /scale\(0\./, style)
      }
    } finally {
      await cleanup()
    }
  })

  test('减少动态时段控件用静止的选中块，点选会换过去', async () => {
    const { Seg } = await mod('/src/components/ui/Seg.tsx')
    function Harness() {
      const [value, setValue] = useState('a')
      return createElement(Seg, {
        glass: false,
        label: '分段',
        value,
        onChange: setValue,
        items: [{ value: 'a', label: '甲' }, { value: 'b', label: '乙' }],
      })
    }
    try {
      await render(createElement(Harness))
      const buttons = [...document.querySelectorAll('[role="group"] button')]
      assert.equal(buttons[0].getAttribute('aria-pressed'), 'true')
      await act(async () => { buttons[1].click() })
      const pressed = document.querySelector('[aria-pressed="true"]')
      assert.ok(pressed === buttons[1])
      const mark = pressed.querySelector('.seg-on')
      assert.ok(mark)
      assert.equal(mark.getAttribute('style'), null)
      assert.equal(buttons[0].querySelector('.seg-on') == null, true)
    } finally {
      await cleanup()
    }
  })

  test('右键菜单用方向键移动，Tab 留在菜单里，关闭后焦点回到触发处', async () => {
    const { ContextMenu, useContextMenu } = await mod('/src/components/ui/ContextMenu.tsx')
    function Harness() {
      const menu = useContextMenu()
      return createElement(Fragment, null,
        createElement('button', { onClick: () => menu.open(20, 20, '虚构') }, '封面'),
        createElement(ContextMenu, { at: menu.menu, onClose: menu.close, label: '漫画操作' },
          createElement('button', { type: 'button', role: 'menuitem' }, '加入书库'),
          createElement('button', { type: 'button', role: 'menuitem' }, '标记已读'),
        ),
      )
    }
    try {
      await render(createElement(Harness))
      const trigger = [...document.querySelectorAll('button')].find((b) => named(b) === '封面')
      trigger.focus()
      await act(async () => { trigger.click() })
      const items = () => [...document.querySelectorAll('[role="menuitem"]')]
      focused(items()[0])
      press('ArrowDown')
      focused(items()[1])
      press('ArrowDown')
      focused(items()[0])
      press('End')
      focused(items()[1])
      press('Home')
      focused(items()[0])
      press('Tab')
      focused(items()[1])
      press('Tab', document, { shiftKey: true })
      focused(items()[0])
      press('Escape')
      await act(async () => {})
      focused(trigger)
    } finally {
      await cleanup()
    }
  })

  test('错误提示是警告并可关掉，普通提示不是警告', async () => {
    const { Toaster, toast } = await mod('/src/components/ui/toast.tsx')
    try {
      await render(createElement(Toaster))
      await act(async () => { toast('已保存') })
      const info = document.querySelector('[role="status"]')
      assert.equal(named(info), '已保存')
      assert.equal(document.querySelector('[role="alert"]') == null, true)
      await act(async () => { toast('保存失败', 'error') })
      const alert = document.querySelector('[role="alert"]')
      assert.match(named(alert), /保存失败/)
      const close = [...alert.querySelectorAll('button')].find((b) => named(b) === '关闭')
      assert.ok(close)
      close.click()
      await until(() => !document.querySelector('[role="alert"]'))
      assert.ok(document.querySelector('[role="status"]'))
    } finally {
      await cleanup()
    }
  })

  test('更新标签的读屏名称同时包含更新和下载队列', async () => {
    const { useLive } = await mod('/src/api/live.ts')
    const { MobileTabBar } = await mod('/src/app/MobileTabBar.tsx')
    const { SideNav } = await mod('/src/app/SideNav.tsx')
    useLive.setState({ queue: [{}, {}, {}] })
    try {
      await render(createElement(MemoryRouter, null,
        createElement(Fragment, null, createElement(MobileTabBar), createElement(SideNav)),
      ))
      const links = [...document.querySelectorAll('a[href="/updates"]')]
      assert.equal(links.length, 2)
      for (const link of links) {
        assert.equal(link.getAttribute('aria-label'), '更新，下载队列 3 话')
        assert.match(link.textContent, /更新/)
        const badge = link.querySelector('span[aria-hidden]')
        assert.equal(badge.textContent.trim(), '3')
      }
      await act(async () => { useLive.setState({ queue: [] }) })
      for (const link of document.querySelectorAll('a[href="/updates"]')) {
        assert.equal(link.getAttribute('aria-label'), null)
        assert.match(link.textContent, /更新/)
        assert.equal(link.querySelector('span[aria-hidden]') == null, true)
      }
    } finally {
      await cleanup()
    }
  })

  test('窄屏周历用方向键换日期，面板跟着当前标签走', async () => {
    const { WeekSection } = await mod('/src/features/home/WeekSection.tsx')
    const { client, calls } = quietClient()
    const chapter = {
      id: 1,
      name: '第 1 话',
      chapterNumber: 1,
      sourceOrder: 1,
      fetchedAt: String(Math.floor(Date.now() / 1000)),
      uploadDate: '0',
      isRead: false,
      isDownloaded: false,
      isBookmarked: false,
      lastPageRead: 0,
      pageCount: 0,
      mangaId: 7,
      manga: {
        id: 7,
        title: '虚构周更',
        thumbnailUrl: null,
        source: { id: 'fictional', displayName: '虚构来源' },
        categories: { nodes: [] },
      },
    }
    try {
      await render(createElement(ApolloProvider, { client },
        createElement(MemoryRouter, null,
          createElement(WeekSection, { updates: [chapter], partial: false, reads: [], onRetry() {} }),
        ),
      ))
      const tabs = [...document.querySelectorAll('[role="tab"]')]
      assert.equal(tabs.length, 7)
      const panel = document.querySelector('[role="tabpanel"]')
      assert.equal(tabs[0].getAttribute('aria-selected'), 'true')
      assert.equal(tabs[0].tabIndex, 0)
      assert.equal(tabs[1].tabIndex, -1)
      assert.equal(tabs[0].getAttribute('aria-controls'), panel.id)
      assert.equal(panel.getAttribute('aria-labelledby'), tabs[0].id)
      assert.match(panel.textContent, /虚构周更/)
      tabs[0].focus()
      press('ArrowRight', tabs[0])
      await act(async () => { await new Promise((r) => setTimeout(r, 20)) })
      focused(tabs[1])
      assert.equal(tabs[1].getAttribute('aria-selected'), 'true')
      assert.equal(tabs[1].tabIndex, 0)
      assert.equal(tabs[0].tabIndex, -1)
      assert.equal(panel.getAttribute('aria-labelledby'), tabs[1].id)
      assert.doesNotMatch(panel.textContent, /虚构周更/)
      press('ArrowLeft', tabs[1])
      await act(async () => { await new Promise((r) => setTimeout(r, 20)) })
      focused(tabs[0])
      assert.match(panel.textContent, /虚构周更/)
      press('End', tabs[0])
      await act(async () => { await new Promise((r) => setTimeout(r, 20)) })
      focused(tabs[6])
      press('Home', tabs[6])
      await act(async () => { await new Promise((r) => setTimeout(r, 20)) })
      focused(tabs[0])
      assert.equal(calls(), 0)
      assert.equal(document.querySelector('img') == null, true)
    } finally {
      await cleanup()
    }
  })

  test('跳到内容会把焦点移进主区域，不改网址哈希', async () => {
    const { AppShell } = await mod('/src/app/AppShell.tsx')
    const { client, calls } = quietClient()
    const router = createMemoryRouter([{
      path: '/',
      Component: AppShell,
      children: [{ index: true, Component: () => createElement('p', null, '正文') }],
    }])
    try {
      await render(createElement(ApolloProvider, { client }, createElement(RouterProvider, { router })))
      const link = [...document.querySelectorAll('a')].find((a) => named(a) === '跳到内容')
      const main = document.getElementById('main')
      assert.equal(link.getAttribute('href'), '#main')
      assert.equal(main.tabIndex, -1)
      await act(async () => { link.click() })
      focused(main)
      assert.equal(window.location.hash, '')
      assert.equal(calls(), 0)
    } finally {
      await cleanup()
    }
  })

  test('页面出错的标题会被读屏立刻读出来', async () => {
    const { RouteError } = await mod('/src/app/RouteError.tsx')
    function Boom() { throw new Error('虚构故障') }
    const router = createMemoryRouter([{ path: '/', Component: Boom, errorElement: createElement(RouteError) }])
    const errors = []
    const orig = console.error
    console.error = (...args) => { errors.push(args) }
    try {
      await render(createElement(RouterProvider, { router }))
      assert.equal(named(document.querySelector('[role="alert"]')), '页面出错了')
      assert.match(document.body.textContent, /虚构故障/)
    } finally {
      console.error = orig
      await cleanup()
    }
  })

  test('鼠标停在错误提示上时倒计时暂停，移开才消失', async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] })
    try {
      const { Toaster, toast } = await mod('/src/components/ui/toast.tsx')
      await render(createElement(Toaster))
      await act(async () => { toast('先别关', 'error') })
      const alert = document.querySelector('[role="alert"]')
      assert.match(named(alert), /先别关/)
      alert.dispatchEvent(new window.MouseEvent('mouseover', { bubbles: true }))
      t.mock.timers.tick(20_000)
      await act(async () => {})
      assert.ok(document.querySelector('[role="alert"]'), '停在提示上时不应自己消失')
      const close = [...document.querySelectorAll('button')].find((b) => named(b) === '关闭')
      close.focus()
      t.mock.timers.tick(20_000)
      await act(async () => {})
      assert.ok(document.querySelector('[role="alert"]'), '焦点在提示上时不应自己消失')
      close.blur()
      alert.dispatchEvent(new window.MouseEvent('mouseout', { bubbles: true }))
      t.mock.timers.tick(20_000)
      t.mock.timers.reset()
      await act(async () => { await new Promise((r) => setTimeout(r, 20)) })
      assert.equal(document.querySelector('[role="alert"]') == null, true)
    } finally {
      t.mock.timers.reset()
      await cleanup()
    }
  })
})
