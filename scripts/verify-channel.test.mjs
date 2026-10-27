import assert from 'node:assert/strict'
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { build } from 'vite'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const WARNING = '此操作会写入与日用版共用的真实服务端数据'

function loadChannel({ channel, pathname, dev, testInstance }) {
  const options = { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 } }
  const demoJs = ts.transpileModule(read('src/lib/demo.ts'), options).outputText
    .replaceAll('import.meta.env.DEV', dev ? 'true' : 'false')
  const channelJs = ts.transpileModule(read('src/lib/channel.ts'), options).outputText
  const demoExports = {}
  const channelExports = {}
  runInNewContext(demoJs, {
    exports: demoExports,
    window: { location: { pathname } },
    __APP_CHANNEL__: channel,
    __TEST_INSTANCE__: testInstance,
  })
  runInNewContext(channelJs, {
    exports: channelExports,
    require: (name) => {
      if (name === './demo') return demoExports
      throw new Error(`未预期的依赖 ${name}`)
    },
    __APP_CHANNEL__: channel,
    __TEST_INSTANCE__: testInstance,
  })
  return channelExports.writesSharedServer
}

test('Preview 的虚构验收页不显示写入日用数据的警告', () => {
  assert.equal(loadChannel({ channel: 'preview', pathname: '/dev/history', dev: false, testInstance: false }), false)
  assert.equal(loadChannel({ channel: 'preview', pathname: '/library', dev: false, testInstance: false }), true)
  assert.equal(loadChannel({ channel: 'preview', pathname: '/demo/library', dev: false, testInstance: false }), false)
  // /dev/glass 会读真实书库，警告仍要出现
  assert.equal(loadChannel({ channel: 'preview', pathname: '/dev/glass', dev: false, testInstance: false }), true)
  assert.equal(loadChannel({ channel: 'production', pathname: '/library', dev: false, testInstance: false }), false)
  assert.equal(loadChannel({ channel: 'preview', pathname: '/library', dev: false, testInstance: true }), false)
  assert.equal(loadChannel({ channel: 'preview', pathname: '/dev/downloads', dev: true, testInstance: false }), false)
})

test('正式构建产物不含 Preview 写入警告', { timeout: 180_000 }, async () => {
  const outDir = mkdtempSync(join(tmpdir(), 'sukimi-prod-'))
  const previous = process.env.SUKIMI_CHANNEL
  process.env.SUKIMI_CHANNEL = 'production'
  try {
    await build({
      root: new URL('..', import.meta.url).pathname,
      configFile: new URL('../vite.config.ts', import.meta.url).pathname,
      build: { outDir, emptyOutDir: true, sourcemap: false },
      logLevel: 'warn',
    })
    const files = []
    const walk = (dir) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name)
        if (entry.isDirectory()) walk(path)
        else if (/\.(js|css|html|svg)$/.test(entry.name)) files.push(path)
      }
    }
    walk(outDir)
    assert.ok(files.some((file) => file.endsWith('index.html')), '构建没有产出页面')
    for (const file of files) assert.equal(readFileSync(file, 'utf8').includes(WARNING), false, file)
  } finally {
    if (previous === undefined) delete process.env.SUKIMI_CHANNEL
    else process.env.SUKIMI_CHANNEL = previous
    rmSync(outDir, { recursive: true, force: true })
  }
})
