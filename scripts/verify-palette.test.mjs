import assert from 'node:assert/strict'
import test from 'node:test'
import { extractPalette } from '../src/lib/palette.ts'

// 用纯色块拼出的虚构「封面」像素：[[r, g, b, 像素数], ...]
const pixels = (blocks, alpha = 255) => blocks.flatMap(([r, g, b, n]) => Array.from({ length: n }, () => [r, g, b, alpha]).flat())
const luma = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

function checkShape(p, n = 4) {
  assert.equal(p.length, n)
  assert.ok(Math.abs(p.reduce((a, s) => a + s.weight, 0) - 1) < 1e-9, '面积之和为 1')
  for (let i = 1; i < p.length; i++) assert.ok(luma(p[i - 1].rgb) <= luma(p[i].rgb), '按亮度从暗到亮')
  for (const s of p) for (const v of s.rgb) assert.ok(v >= 0 && v <= 1)
}

test('取到封面的主色与点缀色，主色面积更大', () => {
  const p = extractPalette(pixels([[200, 40, 60, 700], [40, 70, 200, 250], [240, 200, 40, 50]]))
  checkShape(p)
  const red = p.find((s) => dist(s.rgb, [200 / 255, 40 / 255, 60 / 255]) < 0.1)
  const blue = p.find((s) => dist(s.rgb, [40 / 255, 70 / 255, 200 / 255]) < 0.1)
  const yellow = p.find((s) => dist(s.rgb, [240 / 255, 200 / 255, 40 / 255]) < 0.1)
  assert.ok(red && blue && yellow)
  assert.ok(red.weight > blue.weight && blue.weight > yellow.weight)
})

test('只有一种颜色时补出有明暗差异的变体，不会四块一样', () => {
  const p = extractPalette(pixels([[90, 120, 160, 400]]))
  checkShape(p)
  for (let i = 0; i < p.length; i++) for (let j = i + 1; j < p.length; j++) assert.ok(dist(p[i].rgb, p[j].rgb) > 0.05)
})

test('纯黑或纯白封面也补出互不相同的变体', () => {
  for (const color of [[0, 0, 0], [8, 8, 10], [255, 255, 255]]) {
    const p = extractPalette(pixels([[...color, 400]]))
    checkShape(p)
    for (let i = 0; i < p.length; i++) for (let j = i + 1; j < p.length; j++) assert.ok(dist(p[i].rgb, p[j].rgb) > 0.05, `${color} 第 ${i} 和第 ${j} 块太接近`)
  }
})

test('相近的颜色只算一种，鲜艳的小面积颜色优先于灰色', () => {
  // 大片近似的米白、少量灰线稿、一小块鲜艳的粉色
  const p = extractPalette(pixels([[236, 230, 220, 500], [228, 224, 214, 300], [120, 120, 120, 120], [230, 80, 160, 80]]), 3)
  checkShape(p, 3)
  assert.ok(p.some((s) => dist(s.rgb, [230 / 255, 80 / 255, 160 / 255]) < 0.1), '保留粉色')
  const whites = p.filter((s) => dist(s.rgb, [232 / 255, 227 / 255, 217 / 255]) < 0.2)
  assert.ok(whites.length <= 1, '两种米白合并')
})

test('颜色明暗太接近时拉开亮度差，色块流动才看得出', () => {
  const p = extractPalette(pixels([[100, 110, 120, 500], [110, 118, 126, 300], [96, 104, 116, 200]]))
  checkShape(p)
  assert.ok(luma(p[3].rgb) - luma(p[0].rgb) >= 0.29)
})

test('大片留白的亮度封顶，避免把背景冲成灰白', () => {
  const p = extractPalette(pixels([[255, 255, 255, 900], [30, 30, 30, 100]]))
  checkShape(p)
  for (const s of p) assert.ok(luma(s.rgb) <= 0.7201)
})

test('全透明或空像素回退为深色', () => {
  for (const p of [extractPalette([]), extractPalette(pixels([[255, 0, 0, 10]], 0))]) {
    checkShape(p)
    for (const s of p) assert.ok(luma(s.rgb) < 0.1)
  }
})
