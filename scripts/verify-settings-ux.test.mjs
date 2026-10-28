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
      if (name === '@/i18n') return { t: key => key }
      if (name === 'zustand/middleware') return {
        ...middleware,
        persist: (config, options) => middleware.persist(config, { ...options, storage: middleware.createJSONStorage(() => storage) }),
      }
      return require(name)
    },
    document: { documentElement: { dataset: { theme } } },
  })
  return { store: exports.useGlassTuning, defaults: exports.GLASS_DEFAULTS, data, module: exports }
}

// 执行正式页面主题钩子，保留真实玻璃 store；逐次挂载/卸载布局副作用。
function pageThemeFixture(theme = 'light') {
  const glass = glassFixture(theme)
  const cleanups = []
  const document = { documentElement: { dataset: { theme } } }
  const media = { matches: false }
  const exports = {}
  runInNewContext(ts.transpileModule(read('src/design/settings.ts'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, {
    exports, document, navigator: { hardwareConcurrency: 8 }, window: { matchMedia: () => media },
    require: name => {
      if (name === 'react') return { useLayoutEffect: effect => cleanups.push(effect()) }
      if (name === './glassTuning') return glass.module
      if (name === '@/lib/demo') return { preferenceKey: key => `${key}.demo` }
      if (name === './defaultGlass') return { defaultGlass: () => 'refract' }
      if (name === '@/features/home/preferences') return { normalizeHomePreferences: () => ({}) }
      if (name === 'zustand/middleware') return { persist: config => config }
      return require(name)
    },
  })
  exports.useAppearance.getState().setTheme(theme)
  return { ...exports, glass: glass.store, document, media, cleanups }
}

test('阅读器主题：深色背景使用深色玻璃参数，切白底与退出时恢复对应参数', () => {
  const f = pageThemeFixture()
  f.glass.getState().set({ denseTint: 95, denseBlur: 20 })
  f.glass.getState().setTheme('dark')
  f.glass.getState().set({ denseTint: 25, denseBlur: 2 })
  f.glass.getState().setTheme('light')
  const profiles = JSON.stringify(f.glass.getState().profiles)
  f.useForceTheme('dark')
  assert.equal(f.document.documentElement.dataset.theme, 'dark')
  assert.equal(f.glass.getState().denseTint, 25)
  assert.equal(f.glass.getState().denseBlur, 2)
  assert.equal(f.useAppearance.getState().theme, 'light', '阅读器不能改写全站偏好')
  f.cleanups.pop()()
  f.useForceTheme('light')
  assert.equal(f.glass.getState().denseTint, 95)
  f.cleanups.pop()()
  assert.equal(f.themeForced(), false)
  assert.equal(f.document.documentElement.dataset.theme, 'light')
  assert.equal(JSON.stringify(f.glass.getState().profiles), profiles, '进出阅读器不改写两套参数')
})

test('页面主题：画廊深色保持兼容，重叠页面按挂载顺序生效，卸载恢复系统主题', () => {
  const f = pageThemeFixture('system')
  f.useForceDark()
  const darkCleanup = f.cleanups.pop()
  f.useForceTheme('light')
  const lightCleanup = f.cleanups.pop()
  assert.equal(f.document.documentElement.dataset.theme, 'light')
  darkCleanup()
  assert.equal(f.themeForced(), true)
  assert.equal(f.document.documentElement.dataset.theme, 'light')
  f.media.matches = true
  lightCleanup()
  assert.equal(f.document.documentElement.dataset.theme, 'dark')
  assert.equal(f.glass.getState().theme, 'dark')
  assert.equal(f.themeForced(), false)
})

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
