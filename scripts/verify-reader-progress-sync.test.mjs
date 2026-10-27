import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { createElement } from 'react'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { ApolloClient, ApolloLink, Observable, gql } from '@apollo/client'
import { ApolloProvider } from '@apollo/client/react'
import { createCache } from '../src/api/cache.ts'
import { SaveProgressDocument } from '../src/api/gql/graphql.ts'
import * as progress from '../src/features/reader/progress.ts'

// 钩子要在 React 里跑，并挡住 Apollo 的响应顺序。纯函数用例仍在 verify-reader-progress.test.mjs。
// 这里单独成文件：运行环境要有文档节点和可控链路，和纯函数测试不一样。

const require = createRequire(import.meta.url)
const source = readFileSync(new URL('../src/features/reader/progressSync.ts', import.meta.url), 'utf8')
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2023 },
}).outputText
const tracks = []
const errors = []
const hookExports = {}
runInNewContext(code, {
  exports: hookExports,
  console,
  setTimeout,
  clearTimeout,
  queueMicrotask,
  require: (name) => {
    if (name === 'react' || name === '@apollo/client/react') return require(name)
    if (name === '@/api/userContext') return { captureUser: () => () => {} }
    if (name === '@/components/ui/toast') return { toastError: (prefix, error) => errors.push(`${prefix}:${error?.message ?? error}`) }
    if (name === '@/features/tracking/sync') return { syncTrackProgress: (_client, mangaId) => { tracks.push(mangaId) } }
    if (name === './progress') return progress
    if (name === './queries') return { SaveProgress: SaveProgressDocument }
    return require(name)
  },
}, { filename: 'progressSync.ts' })
const { useProgressSync } = hookExports

class Node {
  constructor(nodeType, nodeName) {
    this.nodeType = nodeType
    this.nodeName = nodeName
    this.childNodes = []
    this.parentNode = null
    this.style = {}
    this.ownerDocument = null
    this.nodeValue = null
  }
  appendChild(child) {
    if (child.parentNode) child.parentNode.removeChild(child)
    child.parentNode = this
    this.childNodes.push(child)
    return child
  }
  removeChild(child) {
    const index = this.childNodes.indexOf(child)
    if (index < 0) throw new Error('not a child')
    this.childNodes.splice(index, 1)
    child.parentNode = null
    return child
  }
  insertBefore(child, before) {
    if (child.parentNode) child.parentNode.removeChild(child)
    child.parentNode = this
    const index = before ? this.childNodes.indexOf(before) : this.childNodes.length
    this.childNodes.splice(index < 0 ? this.childNodes.length : index, 0, child)
    return child
  }
  get firstChild() { return this.childNodes[0] ?? null }
  get nextSibling() {
    if (!this.parentNode) return null
    const index = this.parentNode.childNodes.indexOf(this)
    return this.parentNode.childNodes[index + 1] ?? null
  }
  get textContent() { return this.nodeValue ?? this.childNodes.map((child) => child.textContent).join('') }
  set textContent(value) { this.childNodes = []; this.nodeValue = String(value ?? '') }
  contains(node) {
    let current = node
    while (current) {
      if (current === this) return true
      current = current.parentNode
    }
    return false
  }
  addEventListener() {}
  removeEventListener() {}
}
class Element extends Node {
  constructor(tag) {
    super(1, String(tag).toUpperCase())
    this.tagName = this.nodeName
    this.attributes = new Map()
    this.namespaceURI = 'http://www.w3.org/1999/xhtml'
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)) }
  getAttribute(name) { return this.attributes.has(name) ? this.attributes.get(name) : null }
  removeAttribute(name) { this.attributes.delete(name) }
  hasAttribute(name) { return this.attributes.has(name) }
  focus() {}
}
class IFrame extends Element {}

const document = new Node(9, '#document')
document.createElement = (tag) => {
  const element = new Element(tag)
  element.ownerDocument = document
  return element
}
document.createElementNS = (_namespace, tag) => document.createElement(tag)
document.createTextNode = (text) => {
  const node = new Node(3, '#text')
  node.nodeValue = String(text)
  node.ownerDocument = document
  return node
}
document.documentElement = document.createElement('html')
document.head = document.createElement('head')
document.body = document.createElement('body')
document.appendChild(document.documentElement)
document.documentElement.appendChild(document.head)
document.documentElement.appendChild(document.body)
document.activeElement = document.body
document.defaultView = globalThis
globalThis.document = document
globalThis.window = globalThis
globalThis.Node = Node
globalThis.Element = Element
globalThis.HTMLElement = Element
globalThis.HTMLIFrameElement = IFrame
globalThis.IS_REACT_ACT_ENVIRONMENT = true

const chapterFields = gql`
  fragment ChapterProgressProbe on ChapterType {
    id
    lastPageRead
    isRead
  }
`

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// 同一文件里的用例串行跑：React 的 act 队列是全局的。
let tail = Promise.resolve()
function check(name, fn) {
  test(name, () => {
    const run = tail.then(fn, fn)
    tail = run.then(() => {}, () => {})
    return run
  })
}

/**
 * 挂上正式的 useProgressSync。链路可按测试指定的顺序交还响应，服务端状态按交还顺序改。
 */
function mount({ chapter, page, end = false, last = 19, mangaId = 7, hold = false }) {
  const sent = []
  const waiting = []
  const server = { lastPageRead: chapter.lastPageRead, isRead: chapter.isRead }
  const client = new ApolloClient({
    cache: createCache(),
    link: new ApolloLink((operation) => new Observable((observer) => {
      let settled = false
      const apply = () => {
        if (settled) return
        settled = true
        const { id, lastPageRead, isRead } = operation.variables
        if (isRead != null) server.isRead = isRead
        server.lastPageRead = lastPageRead
        sent.push({ id, lastPageRead, isRead })
        observer.next({
          data: {
            updateChapter: {
              __typename: 'UpdateChapterPayload',
              chapter: {
                __typename: 'ChapterType',
                id,
                lastPageRead,
                isRead: server.isRead,
                lastReadAt: '100',
                manga: {
                  __typename: 'MangaType',
                  id: mangaId,
                  unreadCount: server.isRead ? 1 : 4,
                  lastReadChapter: { __typename: 'ChapterType', id, lastReadAt: '100' },
                },
              },
            },
          },
        })
        observer.complete()
      }
      if (hold) waiting.push(apply)
      else apply()
      return () => { settled = true }
    })),
  })
  const cacheId = client.cache.identify({ __typename: 'ChapterType', id: chapter.id })
  client.cache.writeFragment({
    id: cacheId,
    fragment: chapterFields,
    data: { __typename: 'ChapterType', id: chapter.id, lastPageRead: chapter.lastPageRead, isRead: chapter.isRead },
  })
  const state = { chapter, page, end, last, mangaId }
  const view = { current: null }
  function Probe() {
    view.current = useProgressSync(state.mangaId, state.chapter, state.page, state.end, state.last)
    return null
  }
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  return {
    sent,
    server,
    waiting,
    view,
    client,
    async render() {
      await act(async () => { root.render(createElement(ApolloProvider, { client }, createElement(Probe))) })
    },
    async setPage(next, nextEnd = end) {
      state.page = next
      state.end = nextEnd
      await this.render()
    },
    async leave(to) {
      await act(async () => { view.current.leave(to) })
      await act(async () => { await wait(0) })
    },
    async unmount() {
      await act(async () => { root.unmount() })
      host.parentNode?.removeChild(host)
      await act(async () => { await wait(0) })
    },
    async advance(ms) {
      await act(async () => { await wait(ms) })
    },
    async release(index) {
      const apply = waiting.splice(index, 1)[0]
      assert.ok(apply, '没有待返回的进度响应')
      await act(async () => {
        apply()
        await wait(0)
      })
    },
    cached() {
      return client.cache.readFragment({ id: cacheId, fragment: chapterFields })
    },
  }
}

const base = { id: 103, sourceOrder: 5, lastPageRead: 3, isRead: false }

check('600 毫秒内连续翻页只写出最后停下的那一页', async () => {
  const ui = mount({ chapter: base, page: 3 })
  try {
    await ui.render()
    await ui.setPage(6)
    await ui.advance(200)
    await ui.setPage(9)
    await ui.advance(500)
    assert.deepEqual(ui.sent, [], '被取消的中间页不应写出')
    await ui.advance(200)
    assert.deepEqual(ui.sent, [{ id: 103, lastPageRead: 9, isRead: undefined }])
    assert.equal(ui.view.current.synced, 9)
    assert.equal(ui.cached().lastPageRead, 9)
  } finally { await ui.unmount() }
})

check('回到服务端已记下的页后，离开阅读器或换到上一话不会把中间页写出去', async () => {
  const back = mount({ chapter: base, page: 3 })
  try {
    await back.render()
    await back.setPage(8)
    await back.advance(200)
    await back.setPage(3)
    await back.advance(700)
    await back.unmount()
    assert.deepEqual(back.sent, [])
    assert.equal(back.server.lastPageRead, 3)
    assert.equal(back.cached().lastPageRead, 3)
  } finally { /* 已卸载 */ }

  const previous = mount({ chapter: base, page: 3 })
  try {
    await previous.render()
    await previous.setPage(8)
    await previous.advance(200)
    await previous.setPage(3)
    await previous.leave({ sourceOrder: 4 })
    await previous.advance(700)
    assert.deepEqual(previous.sent, [])
    assert.equal(previous.server.lastPageRead, 3)
  } finally { await previous.unmount() }
})

check('还有待写入的页时，卸载会立刻把这一页写出去', async () => {
  const ui = mount({ chapter: base, page: 3 })
  try {
    await ui.render()
    await ui.setPage(8)
    await ui.advance(200)
    await ui.unmount()
    assert.deepEqual(ui.sent, [{ id: 103, lastPageRead: 8, isRead: undefined }])
    assert.equal(ui.server.lastPageRead, 8)
    assert.equal(ui.cached().lastPageRead, 8)
  } catch (error) {
    await ui.unmount()
    throw error
  }
})

check('往前换话时写出当前页，往后换话仍把这一话标为已读', async () => {
  const backward = mount({ chapter: base, page: 3 })
  try {
    await backward.render()
    await backward.setPage(6)
    await backward.leave({ sourceOrder: 4 })
    assert.deepEqual(backward.sent, [{ id: 103, lastPageRead: 6, isRead: undefined }])
    assert.equal(tracks.length, 0)
  } finally { await backward.unmount() }

  const forward = mount({ chapter: base, page: 4, last: 19 })
  const before = tracks.length
  try {
    await forward.render()
    await forward.leave({ sourceOrder: 6 })
    assert.deepEqual(forward.sent, [{ id: 103, lastPageRead: 19, isRead: true }])
    assert.deepEqual(tracks.slice(before), [7])
    assert.equal(forward.server.isRead, true)
    assert.equal(forward.cached().isRead, true)
    assert.equal(forward.cached().lastPageRead, 19)
  } finally { await forward.unmount() }
})

check('两次进度响应乱序返回时，较新的页码留在缓存里', async () => {
  const ui = mount({ chapter: base, page: 3, hold: true })
  try {
    await ui.render()
    await ui.setPage(5)
    await ui.advance(650)
    await ui.setPage(8)
    await ui.advance(650)
    assert.deepEqual(ui.sent, [])
    assert.equal(ui.waiting.length, 2)
    await ui.release(1)
    await ui.release(0)
    assert.equal(ui.view.current.synced, 8)
    assert.equal(ui.cached().lastPageRead, 8)
    assert.equal(ui.cached().isRead, false)
    // 旧响应后到时服务端可能停在更早的页，补写完成后应回到较新的那一页
    for (let n = 0; n < 3 && ui.waiting.length; n++) await ui.release(0)
    assert.equal(ui.waiting.length, 0)
    assert.deepEqual(ui.sent.map((item) => item.lastPageRead), [8, 5, 8])
    assert.equal(ui.server.lastPageRead, 8)
    assert.equal(ui.cached().lastPageRead, 8)
    assert.equal(ui.view.current.synced, 8)
  } finally { await ui.unmount() }
})

check('打开已读话停在起始页时不把上次的页码写成 0，翻页之后才写', async () => {
  const opened = mount({ chapter: { id: 101, sourceOrder: 1, lastPageRead: 10, isRead: true }, page: 0 })
  try {
    await opened.render()
    await opened.advance(700)
    await opened.unmount()
    assert.deepEqual(opened.sent, [])
    assert.equal(opened.server.lastPageRead, 10)
    assert.equal(opened.cached().lastPageRead, 10)
    assert.equal(opened.cached().isRead, true)
  } catch (error) {
    await opened.unmount()
    throw error
  }

  const turned = mount({ chapter: { id: 101, sourceOrder: 1, lastPageRead: 10, isRead: true }, page: 0 })
  try {
    await turned.render()
    await turned.setPage(2)
    await turned.advance(700)
    assert.deepEqual(turned.sent, [{ id: 101, lastPageRead: 2, isRead: undefined }])
    assert.equal(turned.cached().lastPageRead, 2)
    assert.equal(turned.cached().isRead, true)
    assert.equal(turned.view.current.synced, 2)
  } finally { await turned.unmount() }
})
