import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { buildSchema, executeSync } from 'graphql'
import * as docs from '../src/api/gql/graphql.ts'
import { createDemoData } from '../src/features/demo/data.ts'
import {
  contentBox,
  filterCss,
  formatPageBookmarks,
  halfBox,
  pageBookmarkKey,
  parsePageBookmarks,
  togglePageBookmark,
} from '../src/features/reader/pageTools.ts'
import { aroundSlot, padRange, prefetchIndexes, slotsInView } from '../src/features/reader/scrollWindow.ts'

const schema = buildSchema(readFileSync(new URL('../src/api/schema.graphql', import.meta.url), 'utf8'))
function ok(rootValue, document, variableValues) {
  const result = executeSync({ schema, rootValue, document, variableValues })
  assert.equal(result.errors, undefined, result.errors?.map((e) => e.message).join('\n'))
  return result.data
}

/** 虚构页面：底色 bg，[x0, x1) × [y0, y1) 范围内画上深色内容 */
function page(w, h, bg, [x0, y0, x1, y1], ink = 20) {
  const px = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const inside = x >= x0 && x < x1 && y >= y0 && y < y1
      // 内容区里画条纹，像真实的线稿而不是纯色块
      const v = inside ? ((x + y) % 3 === 0 ? ink : 230) : bg
      px.set([v, v, v, 255], (y * w + x) * 4)
    }
  return px
}

const near = (a, b, eps = 0.02) => Math.abs(a - b) <= eps

test('裁白边：四周留白的页裁到内容，留一点边', () => {
  const box = contentBox(page(200, 300, 255, [20, 30, 180, 270]), 200, 300)
  assert.ok(box)
  assert.ok(near(box.left, 0.1) && near(box.right, 0.9), JSON.stringify(box))
  assert.ok(near(box.top, 0.1) && near(box.bottom, 0.9), JSON.stringify(box))
  // 往外留了边：不会正好贴着内容
  assert.ok(box.left < 0.1 && box.right > 0.9)
})

test('裁白边：黑边也能裁，没有白边的页不裁', () => {
  const black = contentBox(page(200, 300, 0, [0, 40, 200, 260], 240), 200, 300)
  assert.ok(black)
  assert.equal(black.left, 0)
  assert.equal(black.right, 1)
  assert.ok(near(black.top, 40 / 300) && near(black.bottom, 260 / 300), JSON.stringify(black))
  assert.equal(contentBox(page(200, 300, 255, [0, 0, 200, 300]), 200, 300), null)
})

test('裁白边：彩色边框、纯色页和几乎空白的页不裁', () => {
  const px = page(100, 100, 128, [10, 10, 90, 90])
  assert.equal(contentBox(px, 100, 100), null)
  assert.equal(contentBox(page(100, 100, 255, [0, 0, 0, 0]), 100, 100), null)
  // 只有中间一小块内容：裁完会不到一半，那个方向保持原样
  const tiny = contentBox(page(200, 200, 255, [90, 90, 110, 110]), 200, 200)
  assert.equal(tiny, null)
})

test('裁白边：只差一两个像素的边不裁', () => {
  assert.equal(contentBox(page(200, 300, 255, [1, 1, 199, 299]), 200, 300), null)
})

test('拆分宽页：按阅读方向取先读的一半，并在裁好的范围里拆', () => {
  const full = { left: 0, top: 0, right: 1, bottom: 1 }
  assert.deepEqual(halfBox(full, 0, false), { left: 0, top: 0, right: 0.5, bottom: 1 })
  assert.deepEqual(halfBox(full, 1, false), { left: 0.5, top: 0, right: 1, bottom: 1 })
  // 从右往左读：先读右半
  assert.deepEqual(halfBox(full, 0, true), { left: 0.5, top: 0, right: 1, bottom: 1 })
  assert.deepEqual(halfBox(full, 1, true), { left: 0, top: 0, right: 0.5, bottom: 1 })
  const cropped = { left: 0.1, top: 0.05, right: 0.9, bottom: 0.95 }
  assert.deepEqual(halfBox(cropped, 0, false), { left: 0.1, top: 0.05, right: 0.5, bottom: 0.95 })
})

test('图像滤镜：默认不加 filter，各项按顺序拼接并限制范围', () => {
  const base = { brightness: 100, warmth: 0, grayscale: false, invert: false }
  assert.equal(filterCss(base), 'none')
  assert.equal(filterCss({ ...base, brightness: 70 }), 'brightness(0.7)')
  assert.equal(filterCss({ ...base, brightness: 10 }), 'brightness(0.3)')
  assert.equal(filterCss({ brightness: 80, warmth: 30, grayscale: true, invert: true }), 'invert(1) grayscale(1) sepia(0.3) brightness(0.8)')
  assert.equal(filterCss({ ...base, warmth: 90 }), 'sepia(0.6)')
})

test('纵向窗口只挂视口附近的页，页码线落在窗口里', () => {
  const height = 1000
  const boxes = Array.from({ length: 180 }, (_, i) => ({ top: i * height, bottom: (i + 1) * height }))
  const viewport = 800
  const scrollTop = 90 * height
  const visible = slotsInView(boxes, scrollTop, viewport, viewport)
  assert.ok(visible)
  const padded = padRange(visible, 3, boxes.length)
  assert.ok(padded.end - padded.start < 30)
  assert.ok(padded.start > 70 && padded.end < 110)
  const line = scrollTop + viewport * 0.45
  const at = boxes.findIndex(box => box.top <= line && box.bottom > line)
  assert.ok(at >= padded.start && at <= padded.end)
  assert.equal(slotsInView([], 0, viewport, viewport), null)
})

test('打开时长话先挂当前页附近，预取包含上一屏', () => {
  const first = aroundSlot(0, 180, 4)
  assert.equal(first.start, 0)
  assert.ok(first.end < 20)
  const mid = aroundSlot(90, 180, 4)
  assert.ok(mid.start < 90 && mid.end > 90)
  assert.deepEqual(prefetchIndexes([10], 100, 3), [7, 8, 9, 10, 11, 12, 13])
  assert.deepEqual(prefetchIndexes([0], 100, 3), [0, 1, 2, 3])
  assert.deepEqual(prefetchIndexes([5, 6], 8, 3), [2, 3, 4, 5, 6, 7])
  assert.deepEqual(prefetchIndexes([], 8, 3), [])
})

test('页面书签：按账号分开，解析容错、去重排序，切换加上或去掉', () => {
  assert.deepEqual(parsePageBookmarks([], 1), [])
  assert.deepEqual(parsePageBookmarks([{ key: pageBookmarkKey(1), value: '12,3, x,3,,-1,7' }], 1), [3, 7, 12])
  // 别的账号的书签读不到，未登录时什么都不显示
  const meta = [
    { key: pageBookmarkKey(1), value: '1,2' },
    { key: pageBookmarkKey(2), value: '9' },
  ]
  assert.deepEqual(parsePageBookmarks(meta, 2), [9])
  assert.deepEqual(parsePageBookmarks(meta, 3), [])
  assert.deepEqual(parsePageBookmarks(meta, undefined), [])
  assert.deepEqual(togglePageBookmark([3, 7], 5), [3, 5, 7])
  assert.deepEqual(togglePageBookmark([3, 5, 7], 5), [3, 7])
  assert.equal(formatPageBookmarks([7, 3, 7]), '3,7')
  assert.equal(formatPageBookmarks([]), '')
})

test('页面书签：演示数据里写入后，章节列表查询能读到，另一个账号读不到，清空后为空', () => {
  const root = createDemoData()
  const before = ok(root, docs.MangaChaptersDocument, { mangaId: 1 }).chapters.nodes
  const id = before[0].id
  const key = pageBookmarkKey(1)
  assert.deepEqual(parsePageBookmarks(before[0].meta, 1), [])
  const saved = ok(root, docs.SetPageBookmarksDocument, { id, key, value: '2,5' })
  assert.deepEqual(JSON.parse(JSON.stringify(saved.setChapterMetas.metas)), [{ chapterId: id, key, value: '2,5' }])
  const after = ok(root, docs.MangaChaptersDocument, { mangaId: 1 }).chapters.nodes.find((c) => c.id === id)
  assert.deepEqual(parsePageBookmarks(after.meta, 1), [2, 5])
  assert.deepEqual(parsePageBookmarks(after.meta, 2), [])
  ok(root, docs.SetPageBookmarksDocument, { id, key, value: '' })
  const cleared = ok(root, docs.MangaChaptersDocument, { mangaId: 1 }).chapters.nodes.find((c) => c.id === id)
  assert.deepEqual(parsePageBookmarks(cleared.meta, 1), [])
})
