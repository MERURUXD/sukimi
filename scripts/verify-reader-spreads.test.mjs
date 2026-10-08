import assert from 'node:assert/strict'
import test from 'node:test'
import { buildSpreads, nextOf, pickSpread, prevOf, spreadOf } from '../src/features/reader/spreads.ts'

const P = 0.7 // 竖页
const W = 1.5 // 横向跨页

/** 可复现的伪随机，测试失败时能原样重跑 */
function rng(seed) {
  let s = seed
  return () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296
}

test('双页：两两成对，横页独占，首页可单独显示', () => {
  assert.deepEqual(buildSpreads(5, true, false, []), [[0, 1], [2, 3], [4]])
  assert.deepEqual(buildSpreads(5, true, true, []), [[0], [1, 2], [3, 4]])
  assert.deepEqual(buildSpreads(6, true, true, [P, P, P, W, P, P]), [[0], [1, 2], [3], [4, 5]])
  // 横页前面落单的页自己一屏，横页之后重新两两成对
  assert.deepEqual(buildSpreads(6, true, false, [P, P, P, W, P, P]), [[0, 1], [2], [3], [4, 5]])
  assert.deepEqual(buildSpreads(3, false, true, []), [[0], [1], [2]])
  assert.deepEqual(buildSpreads(0, true, true, []), [])
})

test('尚未加载的页按竖页处理', () => {
  assert.deepEqual(buildSpreads(4, true, false, [undefined, undefined, W]), [[0, 1], [2], [3]])
})

test('拼版总是不重不漏、顺序排列，横页从不和别的页同屏', () => {
  const rand = rng(7)
  for (let n = 0; n < 300; n++) {
    const count = Math.floor(rand() * 30)
    const aspects = Array.from({ length: count }, () => (rand() < 0.15 ? W : rand() < 0.2 ? undefined : P))
    for (const offsetFirst of [true, false]) {
      const spreads = buildSpreads(count, true, offsetFirst, aspects)
      assert.deepEqual(spreads.flat(), [...Array(count).keys()])
      for (const s of spreads) {
        assert.ok(s.length === 1 || s.length === 2)
        if (s.length === 2) assert.ok(aspects[s[0]] !== W && aspects[s[1]] !== W)
      }
    }
  }
})

test('前面的页后加载出横页，正在看的这一屏不会变', () => {
  // 从第 20 页续读：此时前面各页都没加载，全按竖页算，第 20 页在 [19, 20] 里
  const known = Array(30).fill(undefined)
  const before = buildSpreads(30, true, true, known)
  const shown = before[spreadOf(before, 20)]
  assert.deepEqual(shown, [19, 20])

  // 然后前面的图加载出来，第 17 页其实是横页：整本重新配对，从第 18 页起错一位
  const later = [...known]
  later[17] = W
  const after = buildSpreads(30, true, true, later)
  // 没有钉住就会换屏：正在看的 [19, 20] 变成 [20, 21]，第 19 页凭空消失
  assert.notDeepEqual(after[spreadOf(after, 20)], shown)

  // 钉住已显示的拼版后，页面保持不变
  assert.deepEqual(pickSpread(after, 20, shown, later, 30), shown)
  // 钉住的拼版不再成立（横页混进来）时才回到重新计算的结果
  later[20] = W
  const wide = buildSpreads(30, true, true, later)
  assert.deepEqual(pickSpread(wide, 20, shown, later, 30), [20])
})

test('钉住的拼版：必须包含当前页，且不能含横页', () => {
  const spreads = buildSpreads(6, true, false, [])
  assert.deepEqual(pickSpread(spreads, 3, [2, 3], [], 6), [2, 3])
  // 钉的是别的页：忽略
  assert.deepEqual(pickSpread(spreads, 4, [2, 3], [], 6), [4, 5])
  // 不连续 / 超出页数的钉子无效
  assert.deepEqual(pickSpread(spreads, 1, [1, 3], [], 6), [0, 1])
  assert.deepEqual(pickSpread(spreads, 5, [5, 6], [], 6), [4, 5])
  // 没有钉子
  assert.deepEqual(pickSpread(spreads, 2, null, [], 6), [2, 3])
})

test('翻页：往后顺着当前页接着配对，往前回到刚才看过的那几屏', () => {
  const aspects = [P, P, P, W, P, P, P]
  const spreads = buildSpreads(7, true, true, aspects)
  assert.deepEqual(spreads, [[0], [1, 2], [3], [4, 5], [6]])
  assert.deepEqual(nextOf(7, true, [2], aspects), [3])
  assert.deepEqual(nextOf(7, true, [3], aspects), [4, 5])
  assert.equal(nextOf(7, true, [6], aspects), undefined)
  assert.deepEqual(prevOf(spreads, [4, 5]), [3])
  assert.equal(prevOf(spreads, [0]), undefined)
  // 单页模式
  assert.deepEqual(nextOf(7, false, [2], aspects), [3])
})

test('随机翻页：往后翻一遍每页恰好出现一次，再往前翻回到原样', () => {
  const rand = rng(42)
  for (let n = 0; n < 300; n++) {
    const count = 1 + Math.floor(rand() * 25)
    const aspects = Array.from({ length: count }, () => (rand() < 0.15 ? W : P))
    const double = rand() < 0.8
    const offsetFirst = rand() < 0.5
    const spreads = buildSpreads(count, double, offsetFirst, aspects)

    // 从随机一页起：用「钉住」之后的逻辑往后翻到底
    const start = Math.floor(rand() * count)
    let cur = pickSpread(spreads, start, null, aspects, count)
    const forward = [cur]
    for (let nx = nextOf(count, double, cur, aspects); nx; nx = nextOf(count, double, cur, aspects)) {
      cur = nx
      forward.push(cur)
    }
    assert.deepEqual(forward.flat(), [...Array(count - forward[0][0]).keys()].map((i) => i + forward[0][0]))
    for (const s of forward) if (s.length === 2) assert.ok(aspects[s[0]] !== W && aspects[s[1]] !== W)

    // 往前翻：不重不漏地接到第 0 页
    const back = [forward[0]]
    for (let pv = prevOf(spreads, back[0]); pv; pv = prevOf(spreads, back[0])) back.unshift(pv)
    assert.deepEqual(back.flat(), [...Array(forward[0][forward[0].length - 1] + 1).keys()])
  }
})
