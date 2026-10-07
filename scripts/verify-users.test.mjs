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
