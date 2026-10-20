import assert from 'node:assert/strict'
import test from 'node:test'
import { createIntro } from '../src/features/gallery/statsIntro.ts'
import { createPager } from '../src/features/gallery/statsPager.ts'
import { defaultGlass } from '../src/design/defaultGlass.ts'

test('档案进场：中途重新挂载的数字与刻度立即接当前进度，旧订阅不再绘制', () => {
  const intro = createIntro(0)
  const old = [], next = []
  const off = intro.subscribe(() => old.push(intro.t))
  intro.paint(0.4)
  off()
  const remove = intro.subscribe(() => next.push(intro.t))
  intro.paint(1)
  // 退出时倒放仍交给当前订阅，不恢复已经卸载的节点。
  intro.paint(0.2)
  remove()
  assert.deepEqual(old, [0, 0.4])
  assert.deepEqual(next, [0.4, 1, 0.2])
})

test('档案切屏：动画开始/结束可订阅，重置取消未完成的切屏及冷却', () => {
  const previous = { window: globalThis.window, requestAnimationFrame: globalThis.requestAnimationFrame, cancelAnimationFrame: globalThis.cancelAnimationFrame }
  const frames = new Map()
  let id = 0
  globalThis.window = globalThis
  globalThis.requestAnimationFrame = fn => { frames.set(++id, fn); return id }
  globalThis.cancelAnimationFrame = n => frames.delete(n)
  const pager = createPager({ p: 0, cur: 0, count: 2, reduced: false })
  const changes = []
  pager.subscribe(() => changes.push([pager.p, pager.animating]))
  try {
    pager.limit(2, true)
    pager.go(1)
    assert.deepEqual(changes[0], [0, true], '首帧前提升图层并暂停折射')
    const step = [...frames.values()].at(-1)
    step(performance.now() + 5000)
    assert.deepEqual(changes.at(-1), [1, false], '结束时恢复材质、释放临时图层')
    assert.equal(pager.busy, true, '动画已结束，输入仍有冷却')
    pager.reset()
    assert.deepEqual([pager.p, pager.busy, pager.animating], [0, false, false])
    frames.clear()
    pager.go(2)
    assert.equal(frames.size, 1)
    pager.reset()
    assert.equal(frames.size, 0, '重置后旧帧不能把概览又推走')
    pager.limit(0, false)
    pager.go(1)
    assert.deepEqual([pager.p, pager.animating], [0, false], '无排行时不切到空屏')
  } finally {
    pager.dispose()
    Object.assign(globalThis, previous)
  }
})

test('低核设备仅降低默认玻璃，未知核数与常见设备保留折射默认值', () => {
  assert.equal(defaultGlass(1), 'frosted')
  assert.equal(defaultGlass(2), 'frosted')
  for (const cores of [undefined, 0, 4, 8, 16]) assert.equal(defaultGlass(cores), 'refract')
})
