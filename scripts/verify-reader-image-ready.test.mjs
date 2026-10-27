import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import * as tools from '../src/features/reader/pageTools.ts'

const tick = () => new Promise(resolve => setImmediate(resolve))

// 执行实际的图片处理缓存；只替换浏览器的图片、画布与订阅入口。
function imageCache({ failed: failedAtStart = false, unique = false } = {}) {
  let failed = failedAtStart
  const pixels = new Uint8ClampedArray(200 * 289 * 4).fill(255)
  for (let y = 30; y < 259; y++) for (let x = 20; x < 180; x++) pixels.fill(20, (y * 200 + x) * 4, (y * 200 + x) * 4 + 3)
  const exports = {}
  const shared = new Map()
  const loads = []
  const srcs = []
  const revoked = []
  const pending = []
  let blobN = 0
  const source = readFileSync(new URL('../src/features/reader/pageImage.ts', import.meta.url), 'utf8')
  class FakeImage {
    naturalWidth = 900
    naturalHeight = 1300
    listeners = { load: [], error: [] }
    set src(value) {
      this._src = value
      srcs.push(value)
      queueMicrotask(() => {
        const type = failed ? 'error' : 'load'
        for (const fn of this.listeners[type]) fn()
        if (type === 'load') this.onload?.()
        else this.onerror?.()
      })
    }
    get src() { return this._src }
    addEventListener(type, fn) { this.listeners[type].push(fn) }
  }
  const ctx = {
    exports,
    Image: FakeImage,
    require: name => {
      if (name === './pageTools') return tools
      if (name === './pageCache') return { rememberAspect() {}, forgetWarm(url) { shared.delete(url) } }
      if (name === './pageDecode') return { forgetDecoded() {} }
      if (name === './imageLoad') return {
        acquireImage(url) {
          let img = shared.get(url)
          if (!img) {
            img = new FakeImage()
            loads.push(url)
            img.src = url
            shared.set(url, img)
          }
          return img
        },
        forgetImage(url) { shared.delete(url) },
      }
      if (name === 'react') return { useSyncExternalStore() {} }
      throw new Error(name)
    },
    document: { createElement: () => ({
      getContext: () => ({ drawImage() {}, getImageData: () => ({ data: pixels }) }),
      toBlob: callback => { pending.push(callback) },
    }) },
    URL: {
      createObjectURL: () => unique ? `blob:processed-${++blobN}` : 'blob:processed',
      revokeObjectURL: url => { revoked.push(url) },
    },
  }
  runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 } }).outputText, ctx)
  const finishOne = () => {
    const cb = pending.shift()
    if (!cb) throw new Error('没有待完成的画布')
    cb(new Blob(['虚构图片']))
  }
  return {
    ...exports,
    srcs,
    revoked,
    loads: url => loads.filter(item => item === url).length,
    forgetShared: url => shared.delete(url),
    setFailed: value => { failed = value },
    finish: finishOne,
    finishAll: () => { while (pending.length) finishOne() },
  }
}

function decodeModule() {
  const source = readFileSync(new URL('../src/features/reader/pageDecode.ts', import.meta.url), 'utf8')
  const exports = {}
  let finish
  let images = 0
  const cache = new Map()
  // require 在沙箱外执行，必须用这个类，不能写沙箱里的 Image。
  class SharedImage {
    constructor() { images++ }
    decode() { return new Promise(resolve => { finish = resolve }) }
  }
  runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
    exports,
    Image: SharedImage,
    require(name) {
      if (name !== './imageLoad') throw new Error(name)
      return {
        acquireImage(url) {
          let img = cache.get(url)
          if (!img) {
            img = new SharedImage()
            img.src = url
            cache.set(url, img)
          }
          return img
        },
      }
    },
  })
  return { exports, finish: () => finish(), get images() { return images } }
}

test('首屏裁边：原图可用不代表处理完成，结束后才可显示', async () => {
  const cache = imageCache()
  const v = { crop: true, rtl: false }
  assert.equal(cache.pageSrc('page', v), 'page')
  assert.equal(cache.pageReady('page', v), false)
  await tick()
  assert.equal(cache.pageReady('page', v), false)
  cache.finish()
  await tick()
  assert.equal(cache.pageReady('page', v), true)
  assert.equal(cache.pageSrc('page', v), 'blob:processed')
})

test('首屏拆页：等待编码完成，不能把占位当作就绪', async () => {
  const cache = imageCache()
  const v = { crop: false, half: 0, rtl: true }
  assert.equal(cache.pageSrc('wide', v), undefined)
  await tick()
  assert.equal(cache.pageReady('wide', v), false)
  cache.finish()
  await tick()
  assert.equal(cache.pageReady('wide', v), true)
  assert.equal(cache.pageSrc('wide', v), 'blob:processed')
})

test('处理失败：退回原图后可显示，未开启处理的页直接就绪', async () => {
  const cache = imageCache({ failed: true })
  const v = { crop: true, rtl: false }
  assert.equal(cache.pageReady('raw', { crop: false, rtl: false }), true)
  cache.pageSrc('failed', v)
  await tick()
  assert.equal(cache.pageReady('failed', v), true)
  assert.equal(cache.pageSrc('failed', v), 'failed')
})

test('首屏与相邻屏共用解码，拿到地址后仍须等待解码完成', async () => {
  const decoded = decodeModule()
  const pending = decoded.exports.decodePage('blob:final')
  assert.equal(decoded.exports.decodePage('blob:final'), pending)
  assert.equal(decoded.images, 1)
  let ready = false
  void pending.then(() => { ready = true })
  await tick()
  assert.equal(ready, false)
  decoded.finish()
  await pending
  assert.equal(ready, true)
})

test('图片损坏：解码失败也结束等待，让阅读器显示失败页', async () => {
  const source = readFileSync(new URL('../src/features/reader/pageDecode.ts', import.meta.url), 'utf8')
  const exports = {}
  class BrokenImage { decode() { return Promise.reject(new Error('虚构坏图')) } }
  runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
    exports,
    Image: BrokenImage,
    require(name) {
      if (name !== './imageLoad') throw new Error(name)
      return { acquireImage: () => new BrokenImage() }
    },
  })
  await exports.decodePage('broken')
  await exports.decodePage(undefined)
})

test('正在显示的处理结果超出缓存上限也不回收，松开后才会释放', async () => {
  const cache = imageCache({ unique: true })
  const v = { crop: true, rtl: false }
  cache.pageSrc('p0', v)
  await tick()
  cache.finish()
  await tick()
  const first = cache.pageSrc('p0', v)
  assert.match(first, /^blob:/)
  cache.retainShown(first)
  for (let i = 1; i <= 70; i++) cache.pageSrc(`p${i}`, v)
  await tick()
  cache.finishAll()
  await tick()
  assert.equal(cache.revoked.includes(first), false)
  assert.equal(cache.pageSrc('p0', v), first)
  cache.releaseShown(first)
  cache.pageSrc('p71', v)
  await tick()
  cache.finish()
  await tick()
  assert.equal(cache.revoked.includes(first), true)
})

test('还在处理的原图不会被缓存淘汰后再解码一次', async () => {
  const cache = imageCache({ unique: true })
  cache.pageSrc('kept', { crop: true, rtl: false })
  await tick()
  cache.forgetShared('kept')
  for (let i = 0; i < 20; i++) cache.pageSrc(`other-${i}`, { crop: true, rtl: false })
  await tick()
  cache.pageSrc('kept', { crop: false, half: 0, rtl: true })
  assert.equal(cache.loads('kept'), 1)
})

function warmModule() {
  const source = readFileSync(new URL('../src/features/reader/pageCache.ts', import.meta.url), 'utf8')
  const exports = {}
  const shared = new Map()
  class SyncImage {
    complete = false
    naturalWidth = 0
    naturalHeight = 0
    set src(_) {
      this.complete = true
      this.naturalWidth = 900
      this.naturalHeight = 1300
    }
    addEventListener() {}
  }
  runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 } }).outputText, {
    exports,
    require(name) {
      if (name !== './imageLoad' && name !== './queries') throw new Error(name)
      if (name === './queries') return {}
      return {
        acquireImage(url) {
          let img = shared.get(url)
          if (!img) {
            img = new SyncImage()
            img.src = url
            shared.set(url, img)
          }
          return img
        },
        forgetImage(url) { shared.delete(url) },
      }
    },
  })
  return exports
}

test('已经预加载过的图不再重复通知宽高比，忘掉之后才会再通知', () => {
  const { warm, forgetWarm, aspectOf } = warmModule()
  const url = 'http://demo.local/warm-once.svg'
  let notices = 0
  const notify = () => { notices++ }
  warm(url, notify)
  warm(url, notify)
  assert.equal(notices, 1)
  assert.equal(aspectOf(url), 900 / 1300)
  forgetWarm(url)
  warm(url, notify)
  assert.equal(notices, 2)
})

test('处理失败后重试重新请求原图，成功后再给出新的结果', async () => {
  const cache = imageCache({ failed: true, unique: true })
  const v = { crop: true, rtl: false }
  const url = 'http://demo.local/page'
  cache.pageSrc(url, v)
  await tick()
  assert.equal(cache.pageSrc(url, v), url)
  cache.setFailed(false)
  assert.equal(await cache.retryOriginal(url, 1), true)
  assert.equal(cache.srcs.some(src => src === `${url}?reload=1`), true)
  assert.equal(cache.srcs.some(src => String(src).startsWith('blob:')), false)
  cache.pageSrc(url, v)
  await tick()
  cache.finish()
  await tick()
  assert.match(cache.pageSrc(url, v), /^blob:/)
})
