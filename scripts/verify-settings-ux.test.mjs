import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const require = createRequire(import.meta.url)

// 使用正式 zustand 持久化，只替换浏览器存储和入口键，逐例隔离。
function glassFixture(theme = 'light', saved) {
  const data = new Map(saved ? [['suwayomi-web.glass.demo', JSON.stringify(saved)]] : [])
  const storage = {
    getItem: key => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    removeItem: key => data.delete(key),
  }
  const middleware = require('zustand/middleware')
  const exports = {}
  runInNewContext(ts.transpileModule(read('src/design/glassTuning.ts'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, {
    exports,
    require: name => {
      if (name === '@/lib/demo') return { preferenceKey: key => `${key}.demo` }
      if (name === 'zustand/middleware') return {
        ...middleware,
        persist: (config, options) => middleware.persist(config, { ...options, storage: middleware.createJSONStorage(() => storage) }),
      }
      return require(name)
    },
    document: { documentElement: { dataset: { theme } } },
  })
  return { store: exports.useGlassTuning, defaults: exports.GLASS_DEFAULTS, data }
}

test('玻璃参数：深浅模式分别保存预设和滑块，恢复默认只影响当前模式', () => {
  const { store, defaults } = glassFixture()
  const state = () => store.getState()
  state().set({ strength: 0.4 })
  state().switchPreset('veil')
  state().set({ blur: 9 })
  state().setTheme('dark')
  assert.equal(state().tone, 'tint')
  assert.equal(state().strength, defaults.strength)
  state().set({ tint: 65 })
  state().switchPreset('veil')
  state().set({ blur: 15 })
  state().setTheme('light')
  assert.equal(state().tone, 'veil')
  assert.equal(state().blur, 9)
  state().switchPreset('tint')
  assert.equal(state().strength, 0.4)
  state().reset()
  assert.equal(state().strength, defaults.strength)
  state().setTheme('dark')
  assert.equal(state().blur, 15)
  state().switchPreset('tint')
  assert.equal(state().tint, 65)
})

test('玻璃参数：旧存储迁移保留两个预设，刷新时选择当前生效主题', () => {
  const original = glassFixture()
  const legacy = { ...original.defaults, tone: 'veil', blur: 11, saved: { tint: { ...original.defaults, tint: 70 } } }
  const { store, data } = glassFixture('dark', { version: 1, state: legacy })
  assert.equal(store.getState().blur, 11)
  store.getState().setTheme('light')
  assert.equal(store.getState().blur, 11)
  store.getState().switchPreset('tint')
  assert.equal(store.getState().tint, 70)
  store.getState().set({ strength: 0.25 })
  const persisted = JSON.parse(data.get('suwayomi-web.glass.demo'))
  assert.equal(persisted.version, 2)
  assert.equal(data.size, 1)
  const reloaded = glassFixture('light', persisted).store
  assert.equal(reloaded.getState().strength, 0.25)
  reloaded.getState().setTheme('dark')
  assert.equal(reloaded.getState().tone, 'veil')
  assert.equal(reloaded.getState().blur, 11)
})

test('共用设置组件：帮助可访问、支持 Escape 关闭，保存失败常驻反馈', () => {
  const parts = read('src/features/settings/parts.tsx')
  // 按需帮助按钮具备无障碍属性与 Escape 关闭
  assert.match(parts, /aria-expanded=\{helpOpen\}/)
  assert.match(parts, /aria-controls=\{helpId\}/)
  assert.match(parts, /e\.key === 'Escape'/)
  // 保存失败常驻显示 alert，不仅靠短暂图标
  assert.match(parts, /status === 'error'/)
  assert.match(parts, /role="alert"/)
})

test('设置布局验收页覆盖全部 12 个分栏所需的虚构查询，且拒绝真实写入', () => {
  const lab = read('src/features/dev/SettingsLayoutLab.tsx')
  for (const op of [
    'MultiUserSettings',
    'UserSettings',
    'ServerSettings',
    'ReaderMetaIndex',
    'Categories',
    'CategoriesFull',
    'ExtensionStores',
    'LastSync',
    'KoSyncStatus',
    'Trackers',
    'Users',
    'UserCodes',
    'SettingsAbout',
  ]) {
    assert.ok(lab.includes(`case '${op}':`), `SettingsLayoutLab 处理虚构查询 ${op}`)
  }
  assert.match(lab, /default:\s*observer\.error\(new Error\(/)
})
