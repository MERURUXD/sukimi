import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { JSDOM } from 'jsdom'
import ts from 'typescript'

// 执行正式尺寸订阅，只替换浏览器的布局、画布和帧调度。
function fixture(dispersion = 0, options = {}) {
  const frames = new Map(), timers = new Map()
  let sequence = 0, resize, cleanup, mapSize, draws = 0
  const {
    width = 360, height = 480, radius = 22, bezel = 0, falloff = 2,
  } = options
  const host = { offsetWidth: width, offsetHeight: height, dataset: {} }
  let pixels
  const shifts = (dispersion > 0 ? [-dispersion, 0, dispersion] : [0]).map(extra => ({
    dataset: { extra }, scale: 0,
    setAttribute(name, value) { if (name === 'scale') this.scale = Number(value) },
  }))
  const image = {
    width: '100%', height: '100%',
    setAttribute(name, value) {
      if (name === 'width' || name === 'height') this[name] = value
      if (name === 'href') { mapSize = value; draws++ }
    },
    parentElement: { querySelectorAll: () => shifts },
  }
  const canvas = {
    getContext: () => ({
      createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
      putImageData: image => { pixels = image.data },
    }),
    toDataURL: () => `${canvas.width}x${canvas.height}`,
  }
  const exports = {}
  const source = readFileSync(new URL('../src/components/glass/refract.tsx', import.meta.url), 'utf8')
  runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, {
    exports,
    require: () => ({ useRef: () => ({ current: image }), useLayoutEffect: effect => { cleanup = effect() } }),
    document: { createElement: () => canvas },
    getComputedStyle: () => ({ borderTopLeftRadius: `${radius}px` }),
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
  exports.useLensMap({ current: host }, true, { bezel, strength: 1, falloff, dispersion })
  const flushFrames = () => { const pending = [...frames.values()]; frames.clear(); pending.forEach(f => f()) }
  return {
    host, resize: () => resize(), flushFrames,
    cleanup: () => cleanup(),
    pixel: (x, y) => {
      const i = (y * width + x) * 4
      return { r: pixels[i], g: pixels[i + 1] }
    },
    get mapSize() { return mapSize },
    get imageSize() { return `${image.width}x${image.height}` },
    get draws() { return draws },
    get pending() { return frames.size + timers.size },
    get scales() { return shifts.map(fe => fe.scale) },
  }
}

test('玻璃折射：小圆角沿内缩轮廓连续转向，直边与中区保持原样', () => {
  const f = fixture(0, { width: 32, height: 32, radius: 4, bezel: 8 })
  const upper = f.pixel(3, 4)
  const lower = f.pixel(4, 3)
  assert.notEqual(upper.r, 128, '小圆角不能在对角线一侧退化为水平位移')
  assert.notEqual(upper.g, 128, '小圆角不能在对角线一侧退化为水平位移')
  assert.ok(Math.abs(upper.r - lower.g) <= 1, '对角两侧应沿轮廓对称转向')
  assert.ok(Math.abs(upper.g - lower.r) <= 1, '对角两侧应沿轮廓对称转向')
  assert.deepEqual(f.pixel(16, 1), { r: 128, g: 212 }, '直边仍只沿单轴折射')
  assert.deepEqual(f.pixel(16, 16), { r: 128, g: 128 }, '中区仍不位移')
  f.cleanup()
})

test('玻璃缩放：每次布局交付前位移图匹配当前尺寸，结束后没有延迟跳变', () => {
  const f = fixture()
  assert.equal(f.mapSize, '360x480')
  assert.equal(f.imageSize, '360x480', '首帧图范围必须与位移图使用同一布局尺寸')
  for (const [width, height] of [[360, 440], [320, 360], [280, 280], [320, 240], [360, 300], [360, 480]]) {
    f.host.offsetWidth = width
    f.host.offsetHeight = height
    f.resize()
    assert.equal(f.mapSize, `${width}x${height}`, '不能先拉伸旧位移图，停下后再换图')
    assert.equal(f.imageSize, f.mapSize, 'resize 必须同步更新图范围，避免百分比范围导致边缘色散伪色')
  }
  assert.equal(f.pending, 0, '尺寸稳定后不能还有延迟换图')
})

test('玻璃色散：重绘尺寸时三个通道保留各自位移差，关闭色散只更新单通道', () => {
  const f = fixture(2)
  assert.deepEqual(f.scales, [42, 44, 46])
  f.host.offsetHeight = 20
  f.resize()
  assert.deepEqual(f.scales, [10, 12, 14])
  f.cleanup()
  const plain = fixture()
  assert.deepEqual(plain.scales, [44])
  plain.cleanup()
})

test('玻璃滤镜：色散开关生成有效的 SVG 输入链，滤镜原语直接属于 filter', () => {
  const exports = {}
  const source = readFileSync(new URL('../src/components/glass/refract.tsx', import.meta.url), 'utf8')
  runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, {
    exports, require: createRequire(import.meta.url),
  })
  for (const dispersion of [0, 2, 8]) {
    const markup = renderToStaticMarkup(createElement(exports.LensFilter, { id: 'test-lens', feImage: { current: null }, dispersion }))
    const dom = new JSDOM(markup)
    try {
      const filter = dom.window.document.querySelector('filter')
      const available = new Set(['SourceGraphic', 'SourceAlpha'])
      for (const primitive of filter.children) {
        assert.ok(primitive.tagName.startsWith('fe'), '分组不能阻断滤镜原语的处理')
        for (const input of ['in', 'in2']) {
          const name = primitive.getAttribute(input)
          if (name) assert.ok(available.has(name), `输入 ${name} 必须先生成`)
        }
        if (primitive.hasAttribute('result')) available.add(primitive.getAttribute('result'))
      }
      const displacements = [...filter.querySelectorAll('feDisplacementMap')]
      assert.equal(displacements.length, dispersion > 0 ? 3 : 1)
      assert.deepEqual(displacements.map(fe => Number(fe.dataset.extra)), dispersion > 0 ? [-dispersion, 0, dispersion] : [0])
    } finally { dom.window.close() }
  }
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
