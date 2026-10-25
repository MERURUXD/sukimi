import assert from 'node:assert/strict'
import test from 'node:test'
import { lockGalleryReturnScroll } from '../src/features/gallery/returnScroll.ts'

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
