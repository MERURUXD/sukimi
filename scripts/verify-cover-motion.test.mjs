import assert from 'node:assert/strict'
import test from 'node:test'
import { trackCoverLoading } from '../src/lib/coverMotion.ts'

test('多张待加载封面共享暂停，滚动停止和全部卸载都恢复并清理', t => {
  const originalWindow = globalThis.window, originalDocument = globalThis.document
  const events = new EventTarget(), attributes = new Set()
  Object.assign(events, {
    setTimeout: (...args) => setTimeout(...args),
    clearTimeout: timer => clearTimeout(timer),
  })
  globalThis.window = events
  globalThis.document = { documentElement: {
    setAttribute: key => attributes.add(key), removeAttribute: key => attributes.delete(key),
  } }
  t.mock.timers.enable({ apis: ['setTimeout'] })
  let first, second, next
  try {
    assert.equal(trackCoverLoading(null), undefined)
    first = trackCoverLoading({})
    second = trackCoverLoading({})
    const paused = () => attributes.has('data-cover-scrolling')
    events.dispatchEvent(new Event('scroll'));assert.ok(paused())
    t.mock.timers.tick(100)
    events.dispatchEvent(new Event('scroll'))
    t.mock.timers.tick(149);assert.ok(paused(), '惯性滚动不应提前恢复')
    t.mock.timers.tick(1);assert.equal(paused(), false, '无 scrollend 时也恢复')
    events.dispatchEvent(new Event('scroll'))
    events.dispatchEvent(new Event('scrollend'));assert.equal(paused(), false)
    first();first()
    events.dispatchEvent(new Event('scroll'));assert.ok(paused(), '还有占位时继续监听')
    second();assert.equal(paused(), false)
    events.dispatchEvent(new Event('scroll'));assert.equal(paused(), false, '全部卸载后不继续监听')
    next = trackCoverLoading({})
    events.dispatchEvent(new Event('scroll'));assert.ok(paused(), '新占位能重新监听')
    next();assert.equal(paused(), false)
    t.mock.timers.tick(200);assert.equal(paused(), false)
  } finally {
    first?.();second?.();next?.()
    t.mock.timers.reset()
    if (originalWindow === undefined) delete globalThis.window
    else globalThis.window = originalWindow
    if (originalDocument === undefined) delete globalThis.document
    else globalThis.document = originalDocument
  }
})
