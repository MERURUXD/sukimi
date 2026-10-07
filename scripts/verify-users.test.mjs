import assert from 'node:assert/strict'
import test from 'node:test'
import { can } from '../src/features/auth/permissions.ts'

// 虚构用户
const admin = { roles: ['ADMIN'], permissions: [] }
const member = { roles: ['USER'], permissions: ['DOWNLOAD_CHAPTERS'] }

test('管理员拥有全部权限，普通用户只有被授予的权限', () => {
  assert.equal(can(admin, 'MANAGE_USERS'), true)
  assert.equal(can(member, 'DOWNLOAD_CHAPTERS'), true)
  assert.equal(can(member, 'MANAGE_USERS'), false)
})

test('没有用户时没有任何权限', () => {
  assert.equal(can(null, 'DOWNLOAD_CHAPTERS'), false)
})

test('本地偏好键：演示不分用户，旧服务端单用户沿用原键，未登录没有键', async () => {
  const { scopedKey } = await import('../src/features/auth/userScope.ts')
  assert.equal(scopedKey('suwayomi-web.library', 2), 'suwayomi-web.library.u2')
  assert.equal(scopedKey('suwayomi-web.library', 0), 'suwayomi-web.library')
  assert.equal(scopedKey('suwayomi-web.library', 2, true), 'suwayomi-web.library.demo')
  assert.equal(scopedKey('suwayomi-web.library', null), null)
  assert.equal(scopedKey('suwayomi-web.library', undefined), null)
})

// 内存版 Storage
const memory = (init = {}) => {
  const m = new Map(Object.entries(init))
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), all: () => Object.fromEntries(m) }
}

test('第一个真实账号认领旧偏好，之后的账号不再继承，旧键保留', async () => {
  const { claimLegacyData, LEGACY_CLAIMED_KEY } = await import('../src/features/auth/userScope.ts')
  const s = memory({ 'suwayomi-web.library': '{"a":1}', 'suwayomi-web.reader': '{"b":2}' })
  claimLegacyData(s, 1, ['suwayomi-web.library', 'suwayomi-web.reader', 'suwayomi-web.chapters'])
  assert.equal(s.getItem('suwayomi-web.library.u1'), '{"a":1}')
  assert.equal(s.getItem('suwayomi-web.reader.u1'), '{"b":2}')
  assert.equal(s.getItem('suwayomi-web.chapters.u1'), null)
  assert.equal(s.getItem('suwayomi-web.library'), '{"a":1}')
  assert.equal(s.getItem(LEGACY_CLAIMED_KEY), '1')

  claimLegacyData(s, 2, ['suwayomi-web.library'])
  assert.equal(s.getItem('suwayomi-web.library.u2'), null)
})

test('旧服务端的单用户（id 0）不认领，升级后第一个真实账号才认领', async () => {
  const { claimLegacyData, LEGACY_CLAIMED_KEY } = await import('../src/features/auth/userScope.ts')
  const s = memory({ 'suwayomi-web.library': '{"a":1}' })
  claimLegacyData(s, 0, ['suwayomi-web.library'])
  assert.equal(s.getItem(LEGACY_CLAIMED_KEY), null)
  claimLegacyData(s, 1, ['suwayomi-web.library'])
  assert.equal(s.getItem('suwayomi-web.library.u1'), '{"a":1}')
})

test('认领不会覆盖账号已有的偏好', async () => {
  const { claimLegacyData } = await import('../src/features/auth/userScope.ts')
  const s = memory({ 'suwayomi-web.library': 'old', 'suwayomi-web.library.u1': 'mine' })
  claimLegacyData(s, 1, ['suwayomi-web.library'])
  assert.equal(s.getItem('suwayomi-web.library.u1'), 'mine')
})

test('快照只给保存它的用户用，版本不符或不知道是谁都丢弃', async () => {
  const { snapshotUsable } = await import('../src/features/auth/userScope.ts')
  assert.equal(snapshotUsable({ v: 4, userId: 1 }, 4, 1), true)
  assert.equal(snapshotUsable({ v: 4, userId: 1 }, 4, 2), false)
  assert.equal(snapshotUsable({ v: 3, userId: 1 }, 4, 1), false)
  assert.equal(snapshotUsable({ v: 4, userId: 1 }, 4, undefined), false)
  assert.equal(snapshotUsable(undefined, 4, 1), false)
})

test('默认分类 id 不是 0 时，没有分类的漫画归在默认分类', async () => {
  const { inCategory } = await import('../src/features/library/category.ts')
  const none = { categories: { nodes: [] } }
  const inOne = { categories: { nodes: [{ id: 5 }] } }
  // 第二个用户的默认分类 id 是 1
  assert.equal(inCategory(none, 1, 1), true)
  assert.equal(inCategory(none, 5, 1), false)
  assert.equal(inCategory(inOne, 1, 1), false)
  assert.equal(inCategory(inOne, 5, 1), true)
  assert.equal(inCategory(inOne, 'all', 1), true)
  // 管理员默认分类仍是 0
  assert.equal(inCategory(none, 0), true)
})

test('注册码有效期：expiresAt 是秒，不是毫秒', async () => {
  const { codeExpiryText, registerLink } = await import('../src/features/settings/userCodes.ts')
  const now = Date.UTC(2026, 9, 7)
  const at = (ms) => String((now + ms) / 1000)
  assert.equal(codeExpiryText(at(7 * 24 * 3600_000 - 5000), now), '7 天后过期')
  assert.equal(codeExpiryText(at(5 * 3600_000 - 5000), now), '5 小时后过期')
  assert.equal(codeExpiryText(at(10 * 60_000), now), '不到 1 小时后过期')
  assert.equal(codeExpiryText(at(-1000), now), '已过期')
  assert.equal(registerLink('https://x.test', 'a b'), 'https://x.test/register?code=a%20b')
})

test('没有权限的报错改成清楚的提示，其他报错只取第一行', async () => {
  const { errorText, FORBIDDEN_TEXT } = await import('../src/lib/errorText.ts')
  assert.equal(errorText(new Error('Forbidden: missing permission DOWNLOAD_CHAPTERS')), FORBIDDEN_TEXT)
  assert.equal(errorText(new Error('出错了\n堆栈')), '出错了')
  assert.equal(errorText('纯文本'), '纯文本')
})
