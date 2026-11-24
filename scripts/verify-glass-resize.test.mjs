import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import { inflateSync } from 'node:zlib'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import * as core from '@sessile/core'
import * as dom from '@sessile/dom'
import { JSDOM } from 'jsdom'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const refractSource = readFileSync(new URL('../src/components/glass/refract.tsx', import.meta.url), 'utf8')
const compiledRefract = ts.transpileModule(refractSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText

function decodeStoredRgbaPng(dataUrl) {
  const prefix = 'data:image/png;base64,'
  assert.ok(dataUrl.startsWith(prefix), 'expected PNG data URL')
  const bytes = Buffer.from(dataUrl.slice(prefix.length), 'base64')
  assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], 'valid PNG signature')
  let offset = 8
  let width = 0
  let height = 0
  const idatParts = []
  while (offset < bytes.length) {
    const len = bytes.readUInt32BE(offset)
    const type = bytes.subarray(offset + 4, offset + 8).toString('ascii')
    const dataStart = offset + 8
    const dataEnd = dataStart + len
    if (type === 'IHDR') {
      width = bytes.readUInt32BE(dataStart)
      height = bytes.readUInt32BE(dataStart + 4)
    } else if (type === 'IDAT') {
      idatParts.push(bytes.subarray(dataStart, dataEnd))
    } else if (type === 'IEND') {
      break
    }
    offset = dataEnd + 4
  }
  const raw = inflateSync(Buffer.concat(idatParts))
  const stride = 1 + width * 4
  return {
    width,
    height,
    pixelAt(x, y) {
      const idx = y * stride + 1 + x * 4
      return { r: raw[idx], g: raw[idx + 1], b: raw[idx + 2], a: raw[idx + 3] }
    },
  }
}

function loadRefractModule(reactShim = require('react')) {
  const exports = {}
  runInNewContext(compiledRefract, {
    exports,
    require: (name) => {
      if (name === 'react') return reactShim
      if (name === 'react/jsx-runtime') return require('react/jsx-runtime')
      if (name === '@sessile/core') return core
      if (name === '@sessile/dom') return dom
      return require(name)
    },
  })
  return exports
}

// 执行正式尺寸订阅与真实 SVG filter DOM 节点操作，只替换浏览器布局测量与 ResizeObserver。
function fixture(dispersion = 0, options = {}) {
  const frames = new Map()
  const timers = new Map()
  let sequence = 0
  let resize
  let cleanup = () => {}
  let hrefWrites = 0
  const {
    width = 360,
    height = 480,
    radius = 22,
    bezel = 0,
    strength = 1.32,
    scaleMultiplier,
    ior = 1.5,
    profile = 'squircle',
    caustics = false,
    computedStyle = {},
  } = options

  const host = { offsetWidth: width, offsetHeight: height, dataset: {} }
  const ssrExports = loadRefractModule()
  const markup = renderToStaticMarkup(
    createElement(ssrExports.LensFilter, { id: 'test-lens', filterRef: { current: null }, dispersion }),
  )
  const jsdom = new JSDOM(`<!doctype html><body>${markup}</body>`)
  const doc = jsdom.window.document
  const origCreateElementNS = doc.createElementNS.bind(doc)
  doc.createElementNS = (ns, tag) => {
    const el = origCreateElementNS(ns, tag)
    if (tag === 'feImage') {
      const origSetAttr = el.setAttribute.bind(el)
      el.setAttribute = (name, value) => {
        if (name === 'href') hrefWrites++
        return origSetAttr(name, value)
      }
    }
    return el
  }

  const filterEl = doc.querySelector('#test-lens')
  assert.ok(filterEl, 'LensFilter 必须渲染 filter 节点')
  const filterRef = { current: filterEl }

  const exports = {}
  runInNewContext(compiledRefract, {
    exports,
    require: (name) => {
      if (name === 'react') {
        return {
          Fragment: require('react').Fragment,
          useRef: () => filterRef,
          useLayoutEffect: (effect) => {
            cleanup = effect() ?? (() => {})
          },
        }
      }
      if (name === 'react/jsx-runtime') return require('react/jsx-runtime')
      if (name === '@sessile/core') return core
      if (name === '@sessile/dom') return dom
      return require(name)
    },
    document: doc,
    getComputedStyle: () => ({ borderTopLeftRadius: `${radius}px`, ...computedStyle }),
    requestAnimationFrame: (callback) => {
      frames.set(++sequence, callback)
      return sequence
    },
    cancelAnimationFrame: (id) => frames.delete(id),
    window: {
      setTimeout: (callback) => {
        timers.set(++sequence, callback)
        return sequence
      },
      clearTimeout: (id) => timers.delete(id),
    },
    ResizeObserver: class {
      constructor(callback) {
        resize = callback
      }
      observe() {}
      disconnect() {
        resize = () => {}
      }
    },
  })

  exports.useLensMap(
    { current: host },
    true,
    { bezel, strength, dispersion, scaleMultiplier, ior, profile, caustics },
  )

  const flushFrames = () => {
    const pending = [...frames.values()]
    frames.clear()
    pending.forEach((fn) => fn())
  }

  const tileByName = (name) => filterEl.querySelector(`[data-tile="${name}"]`)
  const tileBox = (name) => {
    const el = tileByName(name)
    if (!el) return null
    return {
      x: Number(el.getAttribute('x')),
      y: Number(el.getAttribute('y')),
      width: Number(el.getAttribute('width')),
      height: Number(el.getAttribute('height')),
      href: el.getAttribute('href'),
    }
  }
  const extentSize = () => {
    const full = tileBox('full')
    if (full) return `${full.width}x${full.height}`
    const tl = tileBox('tl')
    const br = tileBox('br')
    assert.ok(tl && br, '9-slice 必须挂载四角切片')
    assert.equal(tl.x, 0)
    assert.equal(tl.y, 0)
    return `${br.x + br.width}x${br.y + br.height}`
  }

  return {
    host,
    filterEl,
    doc,
    resize: (entries) => resize(entries),
    flushFrames,
    cleanup: () => {
      cleanup()
    },
    close: () => jsdom.window.close(),
    tileByName,
    tileBox,
    extentSize,
    get tiles() {
      return [...filterEl.querySelectorAll('[data-tile]')]
    },
    get hrefWrites() {
      return hrefWrites
    },
    get pending() {
      return frames.size + timers.size
    },
    get scales() {
      return [...filterEl.querySelectorAll('[data-extra]')].map((fe) => Number(fe.getAttribute('scale')))
    },
  }
}

test('玻璃折射：Snell 9-slice 小圆角沿内缩轮廓对称转向，直边仅沿法向位移', () => {
  const f = fixture(0, { width: 32, height: 32, radius: 4, bezel: 8 })
  try {
    const tl = decodeStoredRgbaPng(f.tileBox('tl').href)
    const upper = tl.pixelAt(3, 4)
    const lower = tl.pixelAt(4, 3)
    assert.notEqual(upper.r, 128, '小圆角不能在对角线一侧退化为水平位移')
    assert.notEqual(upper.g, 128, '小圆角不能在对角线一侧退化为水平位移')
    assert.ok(Math.abs(upper.r - lower.g) <= 1, '对角两侧应沿轮廓对称转向')
    assert.ok(Math.abs(upper.g - lower.r) <= 1, '对角两侧应沿轮廓对称转向')

    const topStrip = decodeStoredRgbaPng(f.tileBox('top').href)
    const edgePx = topStrip.pixelAt(0, 1)
    assert.equal(edgePx.r, 128, '直边 X 方向不位移')
    assert.ok(edgePx.g > 128, '顶部直边应向下（内侧）偏移取样')
    const interiorPx = topStrip.pixelAt(0, topStrip.height - 1)
    assert.deepEqual({ r: interiorPx.r, g: interiorPx.g }, { r: 128, g: 128 }, '透镜带外侧保持中性灰零位移')
  } finally {
    f.cleanup()
    f.close()
  }
})

test('玻璃缩放：每次布局交付前切片矩形同步匹配当前尺寸，且同参数缩放不重复改写 tile href', () => {
  const f = fixture(0, { width: 360, height: 480, radius: 22, bezel: 22 })
  try {
    assert.equal(f.extentSize(), '360x480')
    const initialHrefWrites = f.hrefWrites
    assert.equal(initialHrefWrites, 8, '首帧应写入 8 块 9-slice 切片 href')

    for (const [width, height] of [[360, 440], [320, 360], [280, 280], [320, 240], [360, 300], [360, 480]]) {
      f.host.offsetWidth = width
      f.host.offsetHeight = height
      f.resize()
      assert.equal(f.extentSize(), `${width}x${height}`, '不能先拉伸旧切片，停下后再同步')
    }
    assert.equal(f.hrefWrites, initialHrefWrites, '固定圆角与 bezel 下仅改变宿主宽高不应重写 tile href')
    assert.equal(f.pending, 0, '尺寸稳定后不能还有延迟换图')
  } finally {
    f.cleanup()
    f.close()
  }
})

test('玻璃色散：按 Snell 最大位移计算 scale，零强度时色散钳位为 0', () => {
  const lut = core.resolveRefractionProfileLut({ profile: 'squircle', ior: 1.5, thicknessRatio: 1.32 })
  const f = fixture(2, { width: 360, height: 480, radius: 22, bezel: 0, strength: 1.32, ior: 1.5 })
  try {
    const baseInitial = 2 * 22 * lut.maxDisplacementRatio
    assert.deepEqual(f.scales, [baseInitial - 2, baseInitial, baseInitial + 2])

    f.host.offsetHeight = 20
    f.resize()
    const baseSmall = 2 * 6 * lut.maxDisplacementRatio
    assert.deepEqual(f.scales, [baseSmall - 2, baseSmall, baseSmall + 2])
  } finally {
    f.cleanup()
    f.close()
  }

  const plain = fixture(0, { width: 360, height: 480, radius: 22, bezel: 0, strength: 1.32, ior: 1.5 })
  try {
    const baseInitial = 2 * 22 * lut.maxDisplacementRatio
    assert.deepEqual(plain.scales, [baseInitial])
  } finally {
    plain.cleanup()
    plain.close()
  }

  const zeroStrength = fixture(6, { width: 120, height: 80, radius: 16, bezel: 16, strength: 0 })
  try {
    assert.deepEqual(zeroStrength.scales, [0, 0, 0], 'strength=0 时色散差必须钳位为 0，不能引入纯色边位移')
  } finally {
    zeroStrength.cleanup()
    zeroStrength.close()
  }
})

test('玻璃滤镜：色散开关生成有效的 SVG 输入链，含中性灰兜底与 feMerge', () => {
  const exports = loadRefractModule()
  for (const dispersion of [0, 2, 8]) {
    const markup = renderToStaticMarkup(
      createElement(exports.LensFilter, { id: 'test-lens', filterRef: { current: null }, dispersion }),
    )
    const jsdom = new JSDOM(markup)
    try {
      const filter = jsdom.window.document.querySelector('filter')
      const available = new Set(['SourceGraphic', 'SourceAlpha'])
      for (const primitive of filter.children) {
        assert.ok(primitive.tagName.toLowerCase().startsWith('fe'), '分组不能阻断滤镜原语的处理')
        for (const input of ['in', 'in2']) {
          const name = primitive.getAttribute(input)
          if (name) assert.ok(available.has(name), `输入 ${name} 必须先生成`)
        }
        for (const mergeNode of primitive.children) {
          const name = mergeNode.getAttribute('in')
          if (name) assert.ok(available.has(name), `feMergeNode 输入 ${name} 必须先生成`)
        }
        if (primitive.hasAttribute('result')) available.add(primitive.getAttribute('result'))
      }
      const displacements = [...filter.querySelectorAll('[data-extra]')]
      assert.equal(displacements.length, dispersion > 0 ? 3 : 1)
      assert.deepEqual(
        displacements.map((fe) => Number(fe.getAttribute('data-extra'))),
        dispersion > 0 ? [-dispersion, 0, dispersion] : [0],
      )
      const flood = filter.querySelector('feFlood')
      assert.equal(flood?.getAttribute('flood-color'), 'rgb(128,128,128)', '位移图外必须以中性灰兜底')
      const merge = filter.querySelector('feMerge[result="map"]')
      assert.ok(merge, '静态滤镜必须提供 result="map" 的 feMerge 以汇总切片')
    } finally {
      jsdom.window.close()
    }
  }
})

test('玻璃缩放：小数宽度向上取整覆盖整个边框盒，奇数胶囊正常退回完整图', () => {
  const f = fixture(8, {
    width: 180,
    height: 138,
    computedStyle: { boxSizing: 'border-box', width: '180.45px', height: '137.6px' },
  })
  try {
    assert.equal(f.extentSize(), '181x138', '首帧应基于真实小数尺寸向上取整，而非向下取整的 offsetWidth')

    f.host.offsetWidth = 160
    f.host.offsetHeight = 138
    f.resize([{ borderBoxSize: [{ inlineSize: 160.00001, blockSize: 138 }] }])
    assert.equal(f.extentSize(), '160x138', '极小浮点误差不应导致整像素误进位')

    f.host.offsetWidth = 180
    f.host.offsetHeight = 138
    f.resize([{ borderBoxSize: [{ inlineSize: 180.25, blockSize: 137.4 }] }])
    assert.equal(f.extentSize(), '181x138')
  } finally {
    f.cleanup()
    f.close()
  }

  const contentBox = fixture(0, {
    width: 180,
    height: 138,
    computedStyle: {
      boxSizing: 'content-box',
      width: '166.45px',
      height: '123.6px',
      paddingLeft: '6px',
      paddingRight: '6px',
      paddingTop: '6px',
      paddingBottom: '6px',
      borderLeftWidth: '1px',
      borderRightWidth: '1px',
      borderTopWidth: '1px',
      borderBottomWidth: '1px',
    },
  })
  try {
    assert.equal(contentBox.extentSize(), '181x138')
  } finally {
    contentBox.cleanup()
    contentBox.close()
  }

  // 奇数尺寸正圆胶囊（slice = 20.5, span = 0, !isNearInt(20.5)）安全走完整 Stored-PNG 分支
  const oddCapsule = fixture(0, { width: 41, height: 41, radius: 999, bezel: 20 })
  try {
    const full = oddCapsule.tileBox('full')
    assert.ok(full && full.href.startsWith('data:image/png;base64,'), '非整数中缝胶囊应自动退回整张 Stored-PNG')
    assert.equal(oddCapsule.extentSize(), '41x41')
  } finally {
    oddCapsule.cleanup()
    oddCapsule.close()
  }
})

test('玻璃缩放：相同尺寸与隐藏元素不重复编码，卸载后清理动态切片并停止更新', () => {
  const f = fixture()
  try {
    const initialWrites = f.hrefWrites
    f.resize()
    assert.equal(f.hrefWrites, initialWrites)
    f.host.offsetHeight = 0
    f.resize()
    assert.equal(f.hrefWrites, initialWrites)
    assert.equal(f.tiles.length, 8)
    f.cleanup()
    assert.equal(f.tiles.length, 0, '卸载时必须清理命令式挂入的 feImage 切片')
    assert.equal(f.filterEl.querySelectorAll('[data-lens-merge] > *').length, 1, '卸载时仅保留中性灰 feMergeNode')
    f.host.offsetHeight = 240
    f.resize()
    f.flushFrames()
    assert.equal(f.hrefWrites, initialWrites)
    assert.equal(f.pending, 0)
  } finally {
    f.close()
  }
})

test('静动态玻璃一致性：静态 Glass 与 MorphRefractFilter 生成完全相同的 9-slice 切片与 scale', () => {
  const f = fixture(4, {
    width: 240,
    height: 180,
    radius: 22,
    bezel: 20,
    strength: 1.32,
    scaleMultiplier: 2.7,
    ior: 1.5,
    profile: 'squircle',
  })
  const morphJsdom = new JSDOM('<!doctype html><body></body>')
  const controller = dom.createRefractFilterController({
    id: 'morph-parity',
    document: morphJsdom.window.document,
    bezel: 20,
    strength: 1.32,
    dispersion: 4,
    scaleMultiplier: 2.7,
    profile: 'squircle',
    ior: 1.5,
  })
  try {
    controller.mount()
    controller.updateFrame({
      bounds: { x: 0, y: 0, width: 240, height: 180 },
      field: {
        blendK: 0,
        primitives: [{ id: 'p', center: { x: 120, y: 90 }, size: { width: 240, height: 180 }, radius: 22 }],
      },
      blurSigma: 2,
      saturate: 1.6,
      brightness: 1,
      contrast: 1,
    })
    const morphFilter = morphJsdom.window.document.querySelector('#morph-parity')
    const morphScales = [...morphFilter.querySelectorAll('feDisplacementMap')].map((el) => Number(el.getAttribute('scale')))
    assert.deepEqual(f.scales, morphScales, '静态与动态滤镜三通道 scale 必须完全一致')

    for (const tileName of ['top', 'bottom', 'left', 'right', 'tl', 'tr', 'bl', 'br']) {
      const morphTile = morphFilter.querySelector(`feImage[result="ns-${tileName}"]`)
      assert.equal(
        f.tileBox(tileName)?.href,
        morphTile?.getAttribute('href'),
        `切片 ${tileName} 的 Stored-PNG data URL 必须完全一致`,
      )
    }
  } finally {
    controller.dispose()
    morphJsdom.window.close()
    f.cleanup()
    f.close()
  }
})
