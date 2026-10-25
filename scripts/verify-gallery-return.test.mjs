import assert from 'node:assert/strict'
import test from 'node:test'
import { libraryRewind, withoutHiddenCovers } from '../src/features/gallery/coverLayout.ts'
import { lockGalleryReturnScroll } from '../src/features/gallery/returnScroll.ts'

const capture = () => new Map([
  [1, { x: 40, y: 120, w: 160, h: 240, src: '/fictional/one.svg' }],
  [2, { x: 220, y: 120, w: 160, h: 240, src: '/fictional/two.svg' }],
])

test('画廊返回：进出场分别过滤封面后，仍倒回原落点并沿用原格子', () => {
  const raw = capture()
  const entry = withoutHiddenCovers(raw, new Set([1]))
  const keys = new Map([...entry].map(([id, r], i) => [`${i}:0`, { ...r, id }]))
  const landing = { cx: -100, cy: -180, keys, from: entry }
  // 背景漂移和手动拖动画布都只改变墙的位置，不改变书库入口。
  for (const [cx, cy] of [[-1600, -180], [2400, -900]]) {
    const returned = withoutHiddenCovers(raw, new Set([1]))
    assert.notEqual(entry, returned)
    const rewind = libraryRewind(landing, returned, cx, cy)
    assert.ok(rewind, '隐私过滤创建新映射不能导致丢失落点')
    assert.deepEqual(rewind.from, [cx, cy])
    assert.deepEqual(rewind.to, [-100, -180])
    assert.deepEqual([...rewind.keys.keys()], [...keys.keys()])
    assert.equal(rewind.keys.get('1:0').src, null, '隐藏封面不能重现')
  }
})

test('画廊返回：沿用落点时刷新图片，不能恢复进场时尚未隐藏的封面', () => {
  const raw = capture()
  const keys = new Map([...raw].map(([id, r], i) => [`${i}:0`, { ...r, id }]))
  const landing = { cx: -100, cy: -180, keys, from: raw }
  const returned = withoutHiddenCovers(raw, new Set([1]))
  const rewind = libraryRewind(landing, returned, -1600, -900)
  assert.equal(rewind.keys.get('1:0').src, null)
  assert.equal(keys.get('1:0').src, '/fictional/two.svg', '不修改原始捕获')
  assert.deepEqual(rewind.keys.get('0:0'), raw.get(1))
})

test('画廊返回：没有落点或书库位置已改变时才使用当前位置飞回', () => {
  const raw = capture()
  const landing = { cx: -100, cy: -180, keys: new Map(), from: raw }
  assert.equal(libraryRewind(null, raw, 0, 0), null)
  for (const field of ['x', 'y', 'w', 'h']) {
    const changed = capture()
    changed.set(1, { ...changed.get(1), [field]: changed.get(1)[field] + 1 })
    assert.equal(libraryRewind(landing, changed, 0, 0), null)
  }
  const removed = capture()
  removed.delete(2)
  assert.equal(libraryRewind(landing, removed, 0, 0), null)
  const replaced = capture()
  replaced.set(3, replaced.get(2))
  replaced.delete(2)
  assert.equal(libraryRewind(landing, replaced, 0, 0), null)
})

test('画廊返回：拦截滚动与翻页输入，保留路由恢复位置并完整释放', () => {
  const previous = { window: globalThis.window, document: globalThis.document }
  const listeners = new Map()
  const style = { overflow: 'auto' }
  globalThis.document = { documentElement: { style } }
  globalThis.window = {
    scrollY: 0,
    addEventListener(type, fn, options) {
      assert.ok(options === true || options.capture, '必须先于画廊翻页处理器捕获输入')
      if (type !== 'keydown') assert.equal(options.passive, false)
      listeners.set(type, fn)
    },
    removeEventListener(type, fn, capture) {
      assert.equal(capture, true)
      assert.equal(listeners.get(type), fn)
      listeners.delete(type)
    },
  }
  try {
    const unlock = lockGalleryReturnScroll()
    assert.equal(style.overflow, 'hidden', '拖动滚动条也不能改变页面位置')
    for (const [type, key] of [['wheel'], ['touchmove'], ...['ArrowDown', 'PageUp', 'Home', 'End', ' '].map(key => ['keydown', key])]) {
      let prevented = false, stopped = false
      listeners.get(type)({ key, preventDefault: () => { prevented = true }, stopImmediatePropagation: () => { stopped = true } })
      assert.ok(prevented && stopped, `${type} ${key ?? ''} 不能交给原生滚动或画廊翻页`)
    }
    listeners.get('keydown')({ key: 'Escape', preventDefault: () => assert.fail('保留非滚动按键') })
    window.scrollY = 800
    unlock()
    assert.equal(window.scrollY, 800, '释放不能覆盖路由已恢复的位置')
    assert.equal(style.overflow, 'auto')
    assert.equal(listeners.size, 0)
    unlock()
  } finally {
    Object.assign(globalThis, previous)
  }
})
