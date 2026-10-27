import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { openComicsFile } from '../scripts/open-comics-path.ts'

test('漫画缓存只读目录内的文件，越界和畸形编码都不读', () => {
  const parent = mkdtempSync(join(tmpdir(), 'sukimi-comics-'))
  const root = join(parent, 'open-comics')
  const evil = join(parent, 'open-comics-evil')
  mkdirSync(root)
  mkdirSync(evil)
  mkdirSync(join(root, 'dir'))
  writeFileSync(join(root, 'ok.json'), '{}')
  writeFileSync(join(evil, 'secret'), 'nope')
  try {
    assert.equal(openComicsFile(root, '/ok.json'), join(root, 'ok.json'))
    assert.equal(openComicsFile(root, '/ok.json?cache=1'), join(root, 'ok.json'))
    assert.equal(openComicsFile(root, '/../open-comics-evil/secret'), null)
    assert.equal(openComicsFile(root, '/%2e%2e/open-comics-evil/secret'), null)
    assert.equal(openComicsFile(root, '/%2e%2e%2fopen-comics-evil%2fsecret'), null)
    assert.equal(openComicsFile(root, '/%'), null)
    assert.equal(openComicsFile(root, '/%2'), null)
    assert.equal(openComicsFile(root, '/'), null)
    assert.equal(openComicsFile(root, '/dir'), null)
    assert.equal(openComicsFile(root, '/missing.json'), null)
  } finally {
    rmSync(parent, { recursive: true, force: true })
  }
})
