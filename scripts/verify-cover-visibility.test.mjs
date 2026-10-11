import assert from 'node:assert/strict'
import test from 'node:test'
import { onCoverVisibility } from '../src/lib/coverVisibility.ts'

test('封面可见性只判断一次，支持取消、复用和不支持观察器的浏览器', () => {
  const original = globalThis.IntersectionObserver
  let created = 0, notify
  const observing = new Set()
  globalThis.IntersectionObserver = class {
    constructor(callback) { created++; notify = callback }
    observe(image) { observing.add(image) }
    unobserve(image) { observing.delete(image) }
  }
  try {
    const visible = {}, offscreen = {}, result = []
    onCoverVisibility(visible, value => result.push(['屏内', value]))
    onCoverVisibility(offscreen, value => result.push(['屏外', value]))
    assert.equal(created, 1, '多张封面共用观察器')
    notify([{ target: visible, isIntersecting: true }, { target: offscreen, isIntersecting: false }])
    assert.deepEqual(result, [['屏内', true], ['屏外', false]])
    assert.equal(observing.size, 0, '载入后不继续追踪滚动')
    notify([{ target: visible, isIntersecting: false }])
    assert.equal(result.length, 2, '后续滚动不重播或撤销载入状态')

    const removed = {}, cancel = onCoverVisibility(removed, () => assert.fail('卸载后不应更新'))
    cancel(); cancel()
    notify([{ target: removed, isIntersecting: true }])
    assert.equal(observing.size, 0)

    const reused = {}, cancelOld = onCoverVisibility(reused, () => assert.fail('旧请求不应更新'))
    cancelOld()
    onCoverVisibility(reused, value => result.push(['新地址', value]))
    cancelOld()
    assert.ok(observing.has(reused), '旧清理不取消新请求')
    notify([{ target: reused, isIntersecting: true }])
    assert.deepEqual(result.at(-1), ['新地址', true])
    assert.equal(observing.size, 0)

    delete globalThis.IntersectionObserver
    const cancelFallback = onCoverVisibility({}, value => result.push(['兼容', value]))
    cancelFallback()
    assert.deepEqual(result.at(-1), ['兼容', true], '旧浏览器沿用渐显')
  } finally {
    if (original === undefined) delete globalThis.IntersectionObserver
    else globalThis.IntersectionObserver = original
  }
})
