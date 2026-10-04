import assert from 'node:assert/strict'
import test from 'node:test'
import { fromDateInput, oauthUrl, parseOAuthState, statusLabel, toDateInput } from '../src/features/tracking/tracking.ts'

test('授权地址带上可解析的 state，回调时能取回追踪服务', () => {
  const url = oauthUrl({ id: 2, name: 'AniList', authUrl: 'https://example.invalid/oauth?client_id=1&response_type=token' }, 'http://localhost:4567')
  assert.ok(url.startsWith('https://example.invalid/oauth?client_id=1&response_type=token&state='))
  const state = JSON.parse(new URL(url).searchParams.get('state'))
  assert.equal(state.redirectUrl, 'http://localhost:4567/tracker/login/oauth')
  // 中转页把 state 原样带回到回调地址
  const back = `http://localhost:4567/tracker/login/oauth?state=${encodeURIComponent(JSON.stringify(state))}#access_token=x`
  assert.deepEqual(parseOAuthState(back), { trackerId: 2, trackerName: 'AniList' })
})

test('回调地址里的 state 缺失或损坏', () => {
  assert.equal(parseOAuthState('http://h/tracker/login/oauth'), null)
  assert.equal(parseOAuthState('http://h/tracker/login/oauth?state=%7Bbad'), null)
  assert.equal(parseOAuthState('http://h/tracker/login/oauth?state=%7B%7D'), null)
})

test('常见状态名换成中文', () => {
  assert.deepEqual(
    ['Reading', 'Currently Reading', 'Completed', 'On Hold', 'Paused', 'Dropped', 'Plan to Read', 'Planning', 'Rereading', 'Repeating', 'Other'].map(statusLabel),
    ['在读', '在读', '读完', '搁置', '搁置', '弃坑', '想读', '想读', '重读', '重读', 'Other'],
  )
})

test('日期输入框与毫秒互换，0 表示没有', () => {
  assert.equal(toDateInput('0'), '')
  const ms = fromDateInput('2026-03-09')
  assert.equal(toDateInput(ms), '2026-03-09')
  assert.equal(fromDateInput(''), '0')
})
