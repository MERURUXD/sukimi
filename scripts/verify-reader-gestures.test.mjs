import assert from 'node:assert/strict'
import test from 'node:test'
import { blocksWheelTurn, clampPan, flipStillCurrent, invalidateFlip, NO_ZOOM, panBounds, settle, swipeResult, zoomAround } from '../src/features/reader/gestures.ts'

test('平移边界：放大后超出视口的一半；没超出就不能移', () => {
  assert.deepEqual(panBounds({ w: 400, h: 600 }, { w: 400, h: 800 }, 1), { x: 0, y: 0 })
  assert.deepEqual(panBounds({ w: 400, h: 600 }, { w: 400, h: 800 }, 2), { x: 200, y: 200 })
  // 适应宽度的长页：本来就比视口高
  assert.deepEqual(panBounds({ w: 400, h: 2000 }, { w: 400, h: 800 }, 2), { x: 200, y: 1600 })
  assert.deepEqual(clampPan({ s: 2, x: 500, y: -500 }, { x: 200, y: 100 }), { s: 2, x: 200, y: -100 })
})

test('以手指位置为中心缩放：那一点留在原地', () => {
  const at = (z, p) => ({ x: (p.x - z.x) / z.s, y: (p.y - z.y) / z.s }) // 屏幕点对应的内容坐标
  const p = { x: 120, y: -80 }
  const z1 = zoomAround(NO_ZOOM, p, 2.5)
  assert.deepEqual(at(z1, p), at(NO_ZOOM, p))
  // 已放大、已平移的状态继续缩放
  const z2 = zoomAround({ s: 2, x: 30, y: 40 }, p, 3)
  const a = at({ s: 2, x: 30, y: 40 }, p)
  const b = at(z2, p)
  assert.ok(Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.y - b.y) < 1e-9)
})

test('接近原大时复位', () => {
  assert.deepEqual(settle({ s: 1.03, x: 10, y: 5 }), NO_ZOOM)
  assert.deepEqual(settle({ s: 1.5, x: 10, y: 5 }), { s: 1.5, x: 10, y: 5 })
})

test('Ctrl+滚轮停在 1.02 倍时不算放大，滚轮仍可翻页', () => {
  assert.equal(blocksWheelTurn(1), false)
  assert.equal(blocksWheelTurn(1.02), false)
  assert.equal(blocksWheelTurn(1.04), false)
  assert.equal(blocksWheelTurn(1.05), true)
  assert.equal(blocksWheelTurn(2), true)
})

test('新的翻页让上一次轻扫的定时器失效，不会再翻一页', () => {
  let generation = 0
  const scheduled = (generation = invalidateFlip(generation))
  assert.equal(flipStillCurrent(generation, scheduled), true)
  generation = invalidateFlip(generation)
  assert.equal(flipStillCurrent(generation, scheduled), false)
  const again = (generation = invalidateFlip(generation))
  assert.equal(flipStillCurrent(generation, again), true)
})

test('松手是否翻页：轻扫或拖过 22%', () => {
  assert.equal(swipeResult(20, -1, 400), -1)
  assert.equal(swipeResult(100, 0, 400), 1)
  assert.equal(swipeResult(-80, 0, 400), 0)
  assert.equal(swipeResult(-90, 0, 400), -1)
})
