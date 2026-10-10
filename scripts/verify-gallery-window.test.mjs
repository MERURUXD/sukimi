import assert from 'node:assert/strict'
import test from 'node:test'
import { DESKTOP_GRID, MOBILE_GRID, cellIndex } from '../src/features/gallery/canvasMath.ts'
import { WINDOW_K, WINDOW_K_ON, ensureWall, wallItem, wallRange, wallScale, wallState, windowCells, windowOrder } from '../src/features/gallery/wall.ts'

test('橱窗：墙比画廊里更斜更小，指上去往画廊的姿态靠', () => {
  assert.equal(wallScale(1), 0.72)
  assert.ok(wallScale(WINDOW_K) < wallScale(WINDOW_K_ON) && wallScale(WINDOW_K_ON) < 1)
  // 倾斜越大，要生成的范围越大
  const a = wallRange(1000, 380, WINDOW_K)
  const b = wallRange(1000, 380, WINDOW_K_ON)
  assert.ok(a.extraY >= b.extraY && a.extraX >= 0)
})

test('橱窗：看得见的格子是窗里的，离中心近的在前', () => {
  wallState.grid = null
  wallState.cx = Number.NaN
  for (const [w, h, g] of [[1100, 380, DESKTOP_GRID], [358, 480, MOBILE_GRID]]) {
    ensureWall(w, h, g)
    const cells = windowCells(w, h, g)
    assert.ok(cells.length > 3, `${w}x${h} 至少有几格`)
    assert.ok(cells.length < 80, '只画窗里看得见的格子，不随书库规模增长')
    const d = (c) => (c.x + g.cw / 2 - w / 2) ** 2 + (c.y + g.ch / 2 - h / 2) ** 2
    // 大致按离中心的远近排（旋转后顺序不严格等于未旋转的距离，只看首尾）
    assert.ok(d(cells[0]) < d(cells.at(-1)))
    wallState.grid = null
  }
})

test('橱窗：看得见的格子换成最近读过的，其余保持原排列', () => {
  const n = 40
  const cells = [{ c: 0, r: 0 }, { c: 1, r: 0 }, { c: 2, r: 0 }, { c: 0, r: 1 }]
  const picks = [30, 31, 5]
  const order = windowOrder(n, cells, picks)
  assert.equal(order.length, n)
  assert.deepEqual([...order].sort((a, b) => a - b), Array.from({ length: n }, (_, i) => i), '仍是一个排列')
  // 前三格拿到前三个，第四格没有可放的，保持（或被换走的）排列
  for (let i = 0; i < 3; i++) assert.equal(order[cellIndex(cells[i].c, cells[i].r, n)], picks[i])
  // 相邻格子照样不会是同一部
  for (let c = -4; c <= 4; c++) for (let r = -4; r <= 4; r++) assert.notEqual(order[cellIndex(c, r, n)], order[cellIndex(c, r + 1, n)])
})

test('橱窗：书太少、格子重复时同一个位置只用一次', () => {
  const order = windowOrder(2, [{ c: 0, r: 0 }, { c: 2, r: 0 }, { c: 4, r: 0 }], [1, 0])
  assert.deepEqual([...order].sort(), [0, 1])
  assert.deepEqual(windowOrder(5, [], [1, 2]), [0, 1, 2, 3, 4])
  assert.deepEqual(windowOrder(5, [{ c: 0, r: 0 }], []), [0, 1, 2, 3, 4])
})

test('橱窗：按排列取封面，排列长度对不上时退回默认', () => {
  wallState.order = null
  assert.equal(wallItem(1, 2, 10), cellIndex(1, 2, 10))
  wallState.order = Array.from({ length: 10 }, (_, i) => 9 - i)
  assert.equal(wallItem(1, 2, 10), 9 - cellIndex(1, 2, 10))
  assert.equal(wallItem(1, 2, 11), cellIndex(1, 2, 11))
  wallState.order = null
})

test('橱窗：屏幕取景框保留负边距，部分在屏外仍能连续裁切', async () => {
  const { windowClip, galleryPose, shadeTransform } = await import('../src/features/gallery/windowMotion.ts')
  assert.equal(windowClip({ left: 32, top: 640, width: 1216, height: 380 }, 28, 1280, 900), 'inset(640px 32px -120px 32px round 28px)')
  const pose = galleryPose({ left: 64, top: 0, width: 1216, height: 1000 }, 1280, 900)
  assert.equal(windowClip(pose.box, pose.radius, 1280, 900), 'inset(0px 0px 0px 0px round 0px)')
  assert.deepEqual([pose.x, pose.y], [32, 50], '画廊主体偏离视口时仍保留墙中心')
  assert.equal(shadeTransform({ left: 32, top: 450, width: 1216, height: 450 }, 1280, 900), 'translate(30px, 448px) scale(0.953125, 0.5044444444444445)')
})

test('橱窗：遮罩在往返每个进度都超出裁切边缘，避免缩放抗锯齿露底', async () => {
  const { shadeTransform } = await import('../src/features/gallery/windowMotion.ts')
  for (const [w, h, box] of [
    [1280, 900, { left: 48.2, top: 440.3, width: 1168.8, height: 380 }],
    [390, 844, { left: 16, top: 550.6, width: 358, height: 480 }],
  ]) {
    const full = { left: 0, top: 0, width: w, height: h }
    for (const [from, to] of [[full, box], [box, full]]) {
      const matrix = b => shadeTransform(b, w, h).match(/-?\d+(?:\.\d+)?/g).map(Number)
      const a = matrix(from), b = matrix(to)
      for (const p of [0, 0.01, 0.25, 0.5, 0.9, 0.99, 1]) {
        // CSS 同名 translate/scale 函数按进度插值；独立计算真实覆盖矩形。
        const mix = (x, y) => x + (y - x) * p
        const x = mix(a[0], b[0]), y = mix(a[1], b[1])
        const right = x + mix(a[2], b[2]) * w
        const bottom = y + mix(a[3], b[3]) * h
        const leftEdge = mix(from.left, to.left), topEdge = mix(from.top, to.top)
        const rightEdge = leftEdge + mix(from.width, to.width)
        const bottomEdge = topEdge + mix(from.height, to.height)
        assert.ok(leftEdge - x >= 1.999 && topEdge - y >= 1.999)
        assert.ok(right - rightEdge >= 1.999 && bottom - bottomEdge >= 1.999)
      }
    }
  }
})

test('橱窗：只在完整换页结束后清理，跳过或失败也会清理', async () => {
  const { onWindowFinished } = await import('../src/features/gallery/windowMotion.ts')
  for (const fail of [false, true]) {
    let settle
    const finished = new Promise((resolve, reject) => { settle = fail ? reject : resolve })
    let cleaned = 0
    onWindowFinished({ finished }, () => cleaned++)
    await Promise.resolve()
    assert.equal(cleaned, 0, '墙动画提前落定不能清理换页样式')
    settle()
    await Promise.resolve()
    assert.equal(cleaned, 1)
  }
})

test('橱窗：已取消的过渡不能在迟到的结束事件里清理下一次', async () => {
  const { onWindowFinished } = await import('../src/features/gallery/windowMotion.ts')
  let settle
  const finished = new Promise(resolve => { settle = resolve })
  let cleaned = 0
  const cancel = onWindowFinished({ finished }, () => cleaned++)
  cancel(); settle()
  await Promise.resolve()
  assert.equal(cleaned, 0)
})
