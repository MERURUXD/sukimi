import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import * as tools from '../src/features/reader/pageTools.ts'

// 执行实际的图片处理缓存；只替换浏览器的图片、画布与订阅入口。
function imageCache({ failed = false } = {}) {
  let finish
  const pixels = new Uint8ClampedArray(200 * 289 * 4).fill(255)
  for (let y = 30; y < 259; y++) for (let x = 20; x < 180; x++) pixels.fill(20, (y * 200 + x) * 4, (y * 200 + x) * 4 + 3)
  const exports = {}
  const source = readFileSync(new URL('../src/features/reader/pageImage.ts', import.meta.url), 'utf8')
  const ctx = {
    exports,
    require: name => name === './pageTools' ? tools : name === './pageCache' ? { rememberAspect() {} } : { useSyncExternalStore() {} },
    Image: class {
      naturalWidth = 900
      naturalHeight = 1300
      set src(_) { queueMicrotask(() => failed ? this.onerror() : this.onload()) }
    },
    document: { createElement: () => ({
      getContext: () => ({ drawImage() {}, getImageData: () => ({ data: pixels }) }),
      toBlob: callback => { finish = callback },
    }) },
    URL: { createObjectURL: () => 'blob:processed', revokeObjectURL() {} },
  }
  runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 } }).outputText, ctx)
  return { ...exports, finish: () => finish(new Blob(['虚构图片'])) }
}

test('首屏裁边：原图可用不代表处理完成，结束后才可显示', async () => {
  const cache = imageCache()
  const v = { crop: true, rtl: false }
  assert.equal(typeof cache.pageReady, 'function')
  assert.equal(cache.pageSrc('page', v), 'page')
  assert.equal(cache.pageReady('page', v), false)
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(cache.pageReady('page', v), false)
  cache.finish()
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(cache.pageReady('page', v), true)
  assert.equal(cache.pageSrc('page', v), 'blob:processed')
})

test('首屏拆页：等待编码完成，不能把占位当作就绪', async () => {
  const cache = imageCache()
  const v = { crop: false, half: 0, rtl: true }
  assert.equal(typeof cache.pageReady, 'function')
  assert.equal(cache.pageSrc('wide', v), undefined)
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(cache.pageReady('wide', v), false)
  cache.finish()
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(cache.pageReady('wide', v), true)
  assert.equal(cache.pageSrc('wide', v), 'blob:processed')
})

test('处理失败：退回原图后可显示，未开启处理的页直接就绪', async () => {
  const cache = imageCache({ failed: true })
  const v = { crop: true, rtl: false }
  assert.equal(typeof cache.pageReady, 'function')
  assert.equal(cache.pageReady('raw', { crop: false, rtl: false }), true)
  cache.pageSrc('failed', v)
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(cache.pageReady('failed', v), true)
  assert.equal(cache.pageSrc('failed', v), 'failed')
})

test('首屏与相邻屏共用解码，拿到地址后仍须等待解码完成', async () => {
  const source = readFileSync(new URL('../src/features/reader/pageDecode.ts', import.meta.url), 'utf8')
  const exports = {}
  let finish, images = 0
  runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
    exports,
    Image: class {
      constructor() { images++ }
      decode() { return new Promise(resolve => { finish = resolve }) }
    },
  })
  const pending = exports.decodePage('blob:final')
  assert.equal(exports.decodePage('blob:final'), pending)
  assert.equal(images, 1)
  let ready = false
  void pending.then(() => { ready = true })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(ready, false)
  finish()
  await pending
  assert.equal(ready, true)
})

test('图片损坏：解码失败也结束等待，让阅读器显示失败页', async () => {
  const source = readFileSync(new URL('../src/features/reader/pageDecode.ts', import.meta.url), 'utf8')
  const exports = {}
  runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
    exports,
    Image: class { decode() { return Promise.reject(new Error('虚构坏图')) } },
  })
  await exports.decodePage('broken')
  await exports.decodePage(undefined)
})
