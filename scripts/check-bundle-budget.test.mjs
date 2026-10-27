/**
 * 首屏体积检查的行为。和 verify-app-version 分开：那边只认入口脚本哈希，
 * 这里要连样式表引用的字体一起算，并拦住 noto-sans 文件名。
 */
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { budgetError, measureDist } from './check-bundle-budget.mjs'

function fakeDist() {
  const root = mkdtempSync(join(tmpdir(), 'sukimi-budget-'))
  mkdirSync(join(root, 'assets'))
  return root
}

test('只算首页链接的脚本和样式，以及这些样式引用的字体', () => {
  const root = fakeDist()
  try {
    writeFileSync(join(root, 'assets', 'index-a.js'), 'x'.repeat(2000))
    writeFileSync(join(root, 'assets', 'lazy-b.js'), 'y'.repeat(8000))
    writeFileSync(join(root, 'assets', 'index-a.css'), '@font-face{src:url(/assets/latin-a.woff2)} @font-face{src:url(data:font/woff2;base64,AAAA)}')
    writeFileSync(join(root, 'assets', 'latin-a.woff2'), 'z'.repeat(500))
    writeFileSync(join(root, 'assets', 'unused-c.woff2'), 'w'.repeat(9000))
    writeFileSync(
      join(root, 'index.html'),
      '<script>var a = 1</script><script type="module" src="/assets/index-a.js"></script><link rel="modulepreload" href="/assets/index-a.js"><link rel="stylesheet" href="/assets/index-a.css"><script src="/assets/lazy-b.js"></script>',
    )
    const result = measureDist(root)
    assert.deepEqual(
      result.files.map((file) => file.path).sort(),
      ['assets/index-a.css', 'assets/index-a.js', 'assets/latin-a.woff2'],
    )
    assert.equal(budgetError(result, 1024 * 1024), null)
    assert.ok(result.gzip < 2000 + 500)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('产物文件名里出现 noto-sans 就失败，即使没有被首页引用', () => {
  const root = fakeDist()
  try {
    writeFileSync(join(root, 'assets', 'index-a.js'), 'ok')
    writeFileSync(join(root, 'assets', 'noto-sans-sc.woff2'), 'font')
    writeFileSync(join(root, 'index.html'), '<script type="module" src="/assets/index-a.js"></script>')
    const reason = budgetError(measureDist(root), 1024 * 1024)
    assert.match(reason, /noto-sans/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('首屏 gzip 超过上限就失败', () => {
  const root = fakeDist()
  try {
    writeFileSync(join(root, 'assets', 'index-a.js'), 'x'.repeat(4000))
    writeFileSync(join(root, 'index.html'), '<script type="module" src="/assets/index-a.js"></script>')
    const result = measureDist(root)
    assert.match(budgetError(result, 20), /超过上限/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
