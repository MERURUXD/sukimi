import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

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
