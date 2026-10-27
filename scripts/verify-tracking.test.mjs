import assert from 'node:assert/strict'
import test from 'node:test'
import { httpUrl } from '../src/lib/url.ts'
import { consumeOAuthNonce, fromDateInput, oauthUrl, parseOAuthState, scoreString, scoreValue, isRated, readProgress, starScale, toDateInput } from '../src/features/tracking/tracking.ts'

function useSession() {
  const data = new Map()
  globalThis.sessionStorage = {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  }
}

test('授权地址带上可解析的 state，回调时能取回追踪服务', () => {
  useSession()
  const url = oauthUrl({ id: 2, name: 'AniList', authUrl: 'https://example.invalid/oauth?client_id=1&response_type=token' }, 'http://localhost:4567')
  assert.ok(url.startsWith('https://example.invalid/oauth?client_id=1&response_type=token&state='))
  const state = JSON.parse(new URL(url).searchParams.get('state'))
  assert.equal(state.redirectUrl, 'http://localhost:4567/tracker/login/oauth')
  assert.equal(typeof state.nonce, 'string')
  assert.ok(state.nonce.length > 0)
  // 中转页把 state 原样带回到回调地址
  const back = `http://localhost:4567/tracker/login/oauth?state=${encodeURIComponent(JSON.stringify(state))}#access_token=x`
  const parsed = parseOAuthState(back)
  assert.equal(parsed.trackerId, 2)
  assert.equal(parsed.trackerName, 'AniList')
  assert.equal(parsed.nonce, state.nonce)
  assert.equal(consumeOAuthNonce(parsed.nonce), true)
  assert.equal(consumeOAuthNonce(parsed.nonce), false)
})

test('别人构造的回调对不上这次存下的随机数', () => {
  useSession()
  const url = oauthUrl({ id: 2, name: 'AniList', authUrl: 'https://example.invalid/oauth?client_id=1' }, 'http://localhost')
  const state = JSON.parse(new URL(url).searchParams.get('state'))
  const forged = `http://localhost/tracker/login/oauth?state=${encodeURIComponent(JSON.stringify({ ...state, nonce: 'forged' }))}`
  assert.equal(consumeOAuthNonce(parseOAuthState(forged).nonce), false)
  assert.equal(consumeOAuthNonce(state.nonce), true)
})

test('非 http(s) 或没有查询串的授权地址不会生成跳转', () => {
  useSession()
  assert.equal(oauthUrl({ id: 1, name: 'x', authUrl: 'javascript:alert(1)?x=1' }, 'http://localhost'), null)
  assert.equal(oauthUrl({ id: 1, name: 'x', authUrl: 'data:text/html,hi?x=1' }, 'http://localhost'), null)
  assert.equal(oauthUrl({ id: 1, name: 'x', authUrl: 'https://example.invalid/oauth' }, 'http://localhost'), null)
  assert.equal(sessionStorage.getItem('sukimi.oauth.nonce'), null)
  const hash = oauthUrl({ id: 2, name: 'B', authUrl: '#oauth-b?x=1' }, 'http://localhost')
  assert.ok(hash.startsWith('#oauth-b?x=1&state='))
})

test('外链只接受 http 和 https', () => {
  assert.equal(httpUrl('https://example.invalid/a'), 'https://example.invalid/a')
  assert.equal(httpUrl('http://example.invalid/a'), 'http://example.invalid/a')
  assert.equal(httpUrl('#'), '#')
  assert.equal(httpUrl('javascript:alert(1)'), null)
  assert.equal(httpUrl(' javascript:alert(1)'), null)
  assert.equal(httpUrl('data:text/html,hi'), null)
  assert.equal(httpUrl('//evil.example'), null)
  assert.equal(httpUrl(''), null)
})

test('回调地址里的 state 缺失或损坏', () => {
  assert.equal(parseOAuthState('http://h/tracker/login/oauth'), null)
  assert.equal(parseOAuthState('http://h/tracker/login/oauth?state=%7Bbad'), null)
  assert.equal(parseOAuthState('http://h/tracker/login/oauth?state=%7B%7D'), null)
})

test('日期输入框与毫秒互换，0 表示没有', () => {
  assert.equal(toDateInput('0'), '')
  const ms = fromDateInput('2026-03-09')
  assert.equal(toDateInput(ms), '2026-03-09')
  assert.equal(fromDateInput(''), '0')
})

test('评分档位画成星星，其余仍用下拉框', () => {
  // Bangumi：0–10；验收页：'' + 1–10
  assert.equal(starScale(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10']), 10)
  assert.equal(starScale(['', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10']), 10)
  assert.equal(starScale(['0', '1', '2', '3', '4', '5']), 5)
  assert.equal(starScale(Array.from({ length: 101 }, (_, i) => String(i))), null)
  assert.equal(starScale(['', '0.5', '1.0', '10.0']), null)
  assert.equal(starScale(['', ':(', ':|', ':)']), null)
  assert.equal(starScale([]), null)
})

test('星星数字与服务端分数互换', () => {
  const bgm = Array.from({ length: 11 }, (_, i) => String(i))
  assert.equal(scoreValue('8'), 8)
  assert.equal(scoreValue(''), 0)
  assert.equal(scoreValue('-'), 0)
  assert.equal(scoreString(bgm, 7), '7')
  assert.equal(scoreString(bgm, 0), '0')
  assert.equal(scoreString(['', '1', '2'], 0), '')
})

const chapters = (nums, read = () => true) => nums.map((n, i) => ({ chapterNumber: n, sourceOrder: i + 1, isRead: read(n, i) }))

test('同步进度跳过贺图等异常编号', () => {
  // 第 45 话之后插了一张「2026 新年贺图」
  assert.equal(readProgress(chapters([...Array.from({ length: 45 }, (_, i) => i + 1), 2026, 46, 47, 48, 49, 50, 51, 52, 53])), 53)
  // 贺图是最新一话
  assert.equal(readProgress(chapters([1, 2, 3, 53, 54, 55, 2026])), 55)
  assert.equal(readProgress(chapters([50, 51, 52, 53, 54, 55, 2026])), 55)
  // 只算已读的
  assert.equal(readProgress(chapters([1, 2, 3, 4, 5], (n) => n <= 3)), 3)
  // 小数话、番外（0 与负数）不影响
  assert.equal(readProgress(chapters([0, 1, 1.5, 2, -1, 3])), 3)
  // 来源顺序略有错乱时照常取最大
  assert.equal(readProgress(chapters([1, 2, 4, 3, 5, 7, 6])), 7)
  // 连着几张年份贺图（审核反馈），以及贺图后面还有更高的异常编号
  assert.equal(readProgress(chapters([1, 2, 3, 2025, 2026])), 3)
  assert.equal(readProgress(chapters([1, 2, 3, 2024, 2025, 2026])), 3)
  assert.equal(readProgress(chapters([1, 2, 3, ...Array.from({ length: 12 }, (_, i) => 2015 + i)])), 3)
  // 来源只保留第 1 话和最新一百话
  assert.equal(readProgress(chapters([1, ...Array.from({ length: 101 }, (_, i) => i + 500)])), 600)
  assert.equal(readProgress(chapters([...Array.from({ length: 55 }, (_, i) => i + 1), 2024, 2025, 2026])), 55)
  // 来源只保留第 1 话和最新几话：短段照常算（审核反馈）
  assert.equal(readProgress(chapters([1, 50, 51])), 51)
  assert.equal(readProgress(chapters([1, 500, 501, 502, 503, 504, 505])), 505)
  // 长篇正好连续编到两千多话时不算年份贺图
  assert.equal(readProgress(chapters(Array.from({ length: 2030 }, (_, i) => i + 1))), 2030)
  // 来源缺了中间几十话，后面的正常章节照常算
  assert.equal(readProgress(chapters([...Array.from({ length: 9 }, (_, i) => i + 1), ...Array.from({ length: 25 }, (_, i) => i + 31)])), 55)
  // 同一话有多个汉化组时不重复计数
  assert.equal(readProgress(chapters([1, 1, 2, 2, 3, 3, 2026, 2026, 2026])), 3)
  // 长篇正常推进
  assert.equal(readProgress(chapters(Array.from({ length: 1200 }, (_, i) => i + 1))), 1200)
  assert.equal(readProgress(chapters([])), 0)
  assert.equal(readProgress(chapters([12])), 12)
})

test('表情等非数字评分也算已评分', () => {
  const emoji = ['', ':(', ':|', ':)']
  const bgm = Array.from({ length: 11 }, (_, i) => String(i))
  assert.equal(isRated(':)', emoji), true)
  assert.equal(isRated('', emoji), false)
  assert.equal(isRated('8', bgm), true)
  assert.equal(isRated('0', bgm), false)
  assert.equal(isRated('', bgm), false)
})
