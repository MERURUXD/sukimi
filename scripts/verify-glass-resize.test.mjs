import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

// 执行正式尺寸订阅，只替换浏览器的布局、画布和帧调度。
function fixture() {
  const frames = new Map(), timers = new Map()
  let sequence = 0, resize, cleanup, mapSize, draws = 0
  const host = { offsetWidth: 360, offsetHeight: 480 }
  const image = {
    setAttribute(name, value) { if (name === 'href') { mapSize = value; draws++ } },
    parentElement: { querySelectorAll: () => [] },
  }
  const canvas = {
    getContext: () => ({ createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }),
    toDataURL: () => `${canvas.width}x${canvas.height}`,
  }
  const exports = {}
  const source = readFileSync(new URL('../src/components/glass/refract.tsx', import.meta.url), 'utf8')
  runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, {
    exports,
    require: () => ({ useRef: () => ({ current: image }), useLayoutEffect: effect => { cleanup = effect() } }),
    document: { createElement: () => canvas },
    getComputedStyle: () => ({ borderTopLeftRadius: '22px' }),
    requestAnimationFrame: callback => { frames.set(++sequence, callback); return sequence },
    cancelAnimationFrame: id => frames.delete(id),
    window: {
      setTimeout: callback => { timers.set(++sequence, callback); return sequence },
      clearTimeout: id => timers.delete(id),
    },
    ResizeObserver: class {
      constructor(callback) { resize = callback }
      observe() {}
      disconnect() { resize = () => {} }
    },
  })
  exports.useLensMap({ current: host }, true, { bezel: 0, strength: 1, falloff: 2, dispersion: 0 })
  const flushFrames = () => { const pending = [...frames.values()]; frames.clear(); pending.forEach(f => f()) }
  flushFrames()
  return {
    host, resize: () => resize(), flushFrames,
    cleanup: () => cleanup(),
    get mapSize() { return mapSize },
    get draws() { return draws },
    get pending() { return frames.size + timers.size },
  }
}

test('玻璃缩放：每次布局交付前位移图匹配当前尺寸，结束后没有延迟跳变', () => {
  const f = fixture()
  assert.equal(f.mapSize, '360x480')
  for (const height of [440, 360, 280, 240, 300, 480]) {
    f.host.offsetHeight = height
    f.resize()
    assert.equal(f.mapSize, `360x${height}`, '不能先拉伸旧位移图，停下后再换图')
  }
  assert.equal(f.pending, 0, '尺寸稳定后不能还有延迟换图')
})

test('玻璃缩放：相同尺寸与隐藏元素不重复编码，卸载后停止更新', () => {
  const f = fixture()
  f.resize()
  assert.equal(f.draws, 1)
  f.host.offsetHeight = 0
  f.resize()
  assert.equal(f.draws, 1)
  f.cleanup()
  f.host.offsetHeight = 240
  f.resize()
  f.flushFrames()
  assert.equal(f.draws, 1)
  assert.equal(f.pending, 0)
})
