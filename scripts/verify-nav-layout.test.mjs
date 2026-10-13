import assert from 'node:assert/strict'
import test from 'node:test'
import { installTouchNavigation, prefersTouchNavigation } from '../src/app/navLayout.ts'

const signals = (userAgent, overrides = {}) => ({ userAgent, maxTouchPoints: 0, coarsePointer: false, hover: true, ...overrides })

test('导航：桌面 UA 在缩放或触屏条件下仍使用顶栏', () => {
  for (const ua of ['Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Mozilla/5.0 (X11; Linux x86_64)', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)']) {
    assert.equal(prefersTouchNavigation(signals(ua)), false)
  }
  assert.equal(prefersTouchNavigation(signals('Windows NT 10.0', { maxTouchPoints: 10, coarsePointer: true, hover: false })), false)
  assert.equal(prefersTouchNavigation(signals('X11; Linux x86_64', { maxTouchPoints: 10, coarsePointer: true, hover: false })), false)
})

test('导航：移动设备 UA 和 iPad 桌面 UA 支持触控导航，连接鼠标不改变判定', () => {
  for (const ua of ['Linux; Android 14; Demo Tablet', 'iPad; CPU OS 18_0', 'iPhone; CPU iPhone OS 18_0', 'iPod; CPU iPhone OS 18_0']) {
    assert.equal(prefersTouchNavigation(signals(ua)), true)
  }
  assert.equal(prefersTouchNavigation(signals('Macintosh; Intel Mac OS X 10_15_7', { maxTouchPoints: 5 })), true)
  assert.equal(prefersTouchNavigation(signals('Macintosh; Intel Mac OS X 10_15_7', { maxTouchPoints: 1 })), false)
})

test('导航：未知 UA 按主指针与悬停能力回退，不把触点数单独当作平板', () => {
  assert.equal(prefersTouchNavigation(signals('DemoBrowser', { coarsePointer: true, hover: false })), true)
  assert.equal(prefersTouchNavigation(signals('DemoBrowser', { coarsePointer: true, hover: true })), false)
  assert.equal(prefersTouchNavigation(signals('DemoBrowser', { maxTouchPoints: 5 })), false)
})

test('导航：初始化在渲染前设置设备信号，输入能力变化时更新并支持移除监听', () => {
  const original = Object.fromEntries(['window', 'document', 'navigator'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
  const queries = new Map(['(pointer: coarse)', '(hover: hover)'].map(query => [query, {
    matches: query.includes('hover'), listeners: new Set(),
    addEventListener(_, listener) { this.listeners.add(listener) },
    removeEventListener(_, listener) { this.listeners.delete(listener) },
  }]))
  const dataset = {}
  try {
    Object.defineProperty(globalThis, 'window', { configurable: true, value: { matchMedia: query => queries.get(query) } })
    Object.defineProperty(globalThis, 'document', { configurable: true, value: { documentElement: { dataset } } })
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { userAgent: 'DemoBrowser', maxTouchPoints: 5 } })
    const cleanup = installTouchNavigation()
    assert.equal(dataset.touchNavigation, 'false')
    queries.get('(pointer: coarse)').matches = true
    queries.get('(hover: hover)').matches = false
    for (const listener of queries.get('(hover: hover)').listeners) listener()
    assert.equal(dataset.touchNavigation, 'true')
    cleanup()
    assert.ok([...queries.values()].every(query => query.listeners.size === 0))
  } finally {
    for (const [key, descriptor] of Object.entries(original)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else delete globalThis[key]
    }
  }
})
