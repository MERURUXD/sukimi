import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DESKTOP_GRID, MOBILE_GRID, assignSlots, cellIndex, centerOn, columnStep, decay, domePose, introPhases, nearestCell, nearestCellOf, snapTarget, visibleCells,
} from '../src/features/gallery/canvasMath.ts'
import { fit, hfit, mostlyLatin, textWidth, vfit } from '../src/features/gallery/titleFit.ts'

test('画布：相邻格子不放同一部，整张网格用上每一部', () => {
  for (const n of [2, 3, 5, 10, 12, 24, 600]) {
    const step = columnStep(n)
    const seen = new Set()
    for (let c = -6; c <= 6; c++) {
      for (let r = -6; r <= 6; r++) {
        const i = cellIndex(c, r, n)
        assert.ok(i >= 0 && i < n)
        assert.notEqual(i, cellIndex(c, r + 1, n), `n=${n} 竖向相邻`)
        assert.notEqual(i, cellIndex(c + 1, r, n), `n=${n} 横向相邻（步长 ${step}）`)
        seen.add(i)
      }
    }
    if (n <= 24) assert.equal(seen.size, n)
  }
  assert.equal(cellIndex(3, 4, 1), 0)
  assert.equal(cellIndex(0, 0, 0), -1)
})

test('画布：可见格子覆盖视口，最近的一格在中心', () => {
  const w = 1440
  const h = 900
  const g = DESKTOP_GRID
  const o = centerOn(2, -3, w, h, g)
  const cells = visibleCells(o.x, o.y, w, h, g)
  const center = nearestCell(cells)
  assert.deepEqual([center.c, center.r], [2, -3])
  assert.ok(Math.abs(center.nx) < 1e-9 && Math.abs(center.ny) < 1e-9)
  // 四个角都有格子盖住
  for (const [x, y] of [[0, 0], [w, 0], [0, h], [w, h]]) {
    assert.ok(cells.some((c) => c.x <= x && x <= c.x + g.px && c.y <= y && y <= c.y + g.py), `角 ${x},${y}`)
  }
  // 缩小时要多生成格子
  assert.ok(visibleCells(o.x, o.y, w, h, g, { scale: 0.72 }).length > cells.length)
  assert.ok(visibleCells(0, 0, 390, 844, MOBILE_GRID).length < 80)
})

test('画布：吸附把最近的一格摆到中心，球面越靠外越往后退', () => {
  const w = 1280
  const h = 720
  const g = DESKTOP_GRID
  const o = centerOn(5, 1, w, h, g)
  assert.deepEqual(snapTarget(o.x + 40, o.y - 30, w, h, g), o)
  // 奇数列下移半格，吸附也要算上
  const odd = centerOn(-3, 2, w, h, g)
  assert.deepEqual(snapTarget(odd.x - 20, odd.y + 25, w, h, g), odd)
  const mid = domePose(0, 0, 1, true)
  const edge = domePose(0.8, 0.5, 1, false)
  assert.ok(mid.z > edge.z)
  assert.equal(mid.opacity, 1)
  assert.ok(edge.opacity < 1 && edge.opacity >= 0.12)
  assert.ok(edge.ry > 0 && edge.rx < 0)
  // 球面程度为 0 时（过渡开始）完全平
  assert.deepEqual(domePose(0.8, 0.5, 0, false), { z: 0, rx: -0, ry: 0, opacity: 1 })
})

test('画布：找最近放着某一部的格子；惯性逐帧衰减；过渡分段', () => {
  const n = 24
  const at = nearestCellOf(7, n, { c: 0, r: 0 })
  assert.equal(cellIndex(at.c, at.r, n), 7)
  assert.ok(Math.abs(decay(2, 16) - 1.88) < 1e-9)
  assert.ok(decay(2, 160) < 1.1)
  assert.deepEqual(introPhases(0), { panel: 0, wall: 0, dome: 0, hud: 0 })
  assert.deepEqual(introPhases(1), { panel: 1, wall: 1, dome: 1, hud: 1 })
  const mid = introPhases(0.5)
  assert.equal(mid.panel, 1)
  assert.ok(mid.wall > 0.5 && mid.dome < 0.2 && mid.hud === 0)
})

test('标题：字号按宽度挑，长了换行变小，夹在上下限之间', () => {
  assert.equal(textWidth('ABC 漫画'), 0.6 * 4 + 2)
  assert.equal(fit('星河旅人', 1300, 184, 56, 3), 184)
  const long = fit('关于我在便利店打工时捡到一只会说话的猫这件事', 1300, 184, 56, 3)
  assert.ok(long < 184 && long >= 56)
  assert.equal(fit('一'.repeat(200), 300, 184, 56, 3), 56)
  assert.equal(hfit('BLUE SLOPE', 800), 120)
})

test('标题：竖排最多四列，太长截断；西文为主改横排', () => {
  const short = vfit('云海邮局', 600)
  assert.deepEqual(short.columns, ['云海邮局'])
  assert.equal(short.size, 120)
  const two = vfit('在世界尽头的图书馆等你回来的那个夏天', 600, { min: 40 })
  assert.ok(two.columns.length >= 1 && two.columns.length <= 4)
  assert.equal(two.columns.join(''), '在世界尽头的图书馆等你回来的那个夏天')
  assert.ok(two.size >= 40)
  const cut = vfit('一'.repeat(200), 400, { min: 40, maxCols: 4 })
  assert.equal(cut.columns.length, 4)
  assert.ok(cut.cut)
  assert.ok(cut.columns.at(-1).endsWith('…'))
  assert.ok(cut.columns.every((c) => [...c].length * cut.size <= 400))
  assert.equal(mostlyLatin('Moonlight Express 午夜特快'), true)
  assert.equal(mostlyLatin('きみと見た北の雪'), false)
  assert.equal(mostlyLatin('BLUE SLOPE'), true)
})

test('格子池：留下的格子沿用原来的元素，新格子填空位，池子不够时不画', () => {
  const a = assignSlots(new Map(), ['0:0', '0:1', '1:0'], 5)
  assert.deepEqual([...a.entries()], [['0:0', 0], ['0:1', 1], ['1:0', 2]])
  const b = assignSlots(a, ['0:1', '1:0', '1:1', '2:0'], 5)
  assert.equal(b.get('0:1'), 1)
  assert.equal(b.get('1:0'), 2)
  assert.deepEqual([b.get('1:1'), b.get('2:0')], [0, 3])
  const c = assignSlots(b, ['x', 'y', 'z', '0:1', '1:0'], 3)
  assert.equal(c.size, 3)
  assert.equal(c.get('0:1'), 1)
})
