import assert from 'node:assert/strict'
import test from 'node:test'
import { pageTurn } from '../src/features/reader/keys.ts'
import { observedAfterJump, pageAfterTopAlign } from '../src/features/reader/scrollBand.ts'

const none = null

test('单页从右往左：← 前进、→ 后退，和左侧点击热区一致', () => {
  assert.deepEqual(pageTurn('ArrowLeft', 'single', 'rtl', false, none), { kind: 'screen', delta: 1 })
  assert.deepEqual(pageTurn('ArrowRight', 'single', 'rtl', false, none), { kind: 'screen', delta: -1 })
  // 双页和单页用同一套左右
  assert.deepEqual(pageTurn('ArrowLeft', 'double', 'rtl', false, none), { kind: 'screen', delta: 1 })
})

test('单页从左往右：← 后退、→ 前进', () => {
  assert.deepEqual(pageTurn('ArrowLeft', 'single', 'ltr', false, none), { kind: 'screen', delta: -1 })
  assert.deepEqual(pageTurn('ArrowRight', 'single', 'ltr', false, none), { kind: 'screen', delta: 1 })
  // 空格不看阅读方向：下一屏，Shift 上一屏
  assert.deepEqual(pageTurn(' ', 'single', 'ltr', false, none), { kind: 'screen', delta: 1 })
  assert.deepEqual(pageTurn(' ', 'single', 'rtl', true, none), { kind: 'screen', delta: -1 })
})

test('纵向和 Webtoon：← 上一页、→ 下一页，不随阅读方向对调', () => {
  for (const mode of ['vertical', 'webtoon']) {
    for (const dir of ['rtl', 'ltr']) {
      assert.deepEqual(pageTurn('ArrowLeft', mode, dir, false, none), { kind: 'page', delta: -1 })
      assert.deepEqual(pageTurn('ArrowRight', mode, dir, false, none), { kind: 'page', delta: 1 })
    }
  }
  assert.deepEqual(pageTurn(' ', 'vertical', 'rtl', false, none), { kind: 'scroll', delta: 1 })
  assert.deepEqual(pageTurn(' ', 'webtoon', 'ltr', true, none), { kind: 'scroll', delta: -1 })
})

test('焦点在滑块或输入控件上时，方向键不翻页', () => {
  const input = { tagName: 'INPUT', isContentEditable: false }
  const area = { tagName: 'TEXTAREA', isContentEditable: false }
  const select = { tagName: 'SELECT', isContentEditable: false }
  const editable = { tagName: 'DIV', isContentEditable: true }
  for (const target of [input, area, select, editable]) {
    assert.equal(pageTurn('ArrowLeft', 'single', 'rtl', false, target), null)
    assert.equal(pageTurn('ArrowRight', 'vertical', 'ltr', false, target), null)
    assert.equal(pageTurn(' ', 'single', 'ltr', false, target), null)
  }
  // 普通页面和按钮仍翻页
  assert.deepEqual(pageTurn('ArrowLeft', 'single', 'rtl', false, { tagName: 'DIV', isContentEditable: false }), { kind: 'screen', delta: 1 })
  assert.deepEqual(pageTurn('ArrowLeft', 'single', 'rtl', false, { tagName: 'BUTTON', isContentEditable: false }), { kind: 'screen', delta: 1 })
})

test('纵向短页顶对齐后，观察带仍落在这一页上', () => {
  // 宽页、拆开的半页：比视口 45% 更矮。旧的 0 高度线在 45% 处，顶对齐后落在后面的页上。
  const short = [
    { index: 0, height: 200 },
    { index: 1, height: 200 },
    { index: 2, height: 900 },
  ]
  const oldLine = { start: 0.45, end: 0.45 }
  assert.equal(pageAfterTopAlign(short, 0, 800, 16, oldLine), 1)
  assert.equal(pageAfterTopAlign(short, 1, 800, 16, oldLine), 2)
  // 顶部窄条：按 ← / → 跳到的短页会停住
  assert.equal(pageAfterTopAlign(short, 0, 800, 16), 0)
  assert.equal(pageAfterTopAlign(short, 1, 800, 16), 1)
  // 普通长页两种算法都停在目标页（演示书的肖像页属于这种）
  const tall = [
    { index: 0, height: 1200 },
    { index: 1, height: 1200 },
  ]
  assert.equal(pageAfterTopAlign(tall, 0, 800, 16, oldLine), 0)
  assert.equal(pageAfterTopAlign(tall, 1, 800, 16), 1)
})

test('跳页后，观察器在落到目标页之前不能把页码拉回去', () => {
  assert.equal(observedAfterJump(2, 3), null)
  assert.equal(observedAfterJump(2, 2), 2)
  assert.equal(observedAfterJump(null, 4), 4)
})
