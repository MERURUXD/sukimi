import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('外观与动画设置：精简默认说明，去掉重复的「关闭后直接显示/切换」，提供按需帮助', () => {
  const appearance = read('src/features/settings/tabs/AppearanceTab.tsx')
  assert.doesNotMatch(appearance, /关闭后直接(显示|切换)/)
  for (const label of ['首页入场', '详情页转场', '阅读器展开', '动态背景']) {
    assert.ok(appearance.includes(`label="${label}"`), `包含短标题「${label}」`)
  }
  assert.match(appearance, /help=/)
  assert.match(appearance, /warn=/)
})

test('共用设置组件：支持按需帮助、风险提醒、阅读宽度限制与保存失败常驻反馈', () => {
  const parts = read('src/features/settings/parts.tsx')
  // 按需帮助按钮具备无障碍属性与 Escape 关闭
  assert.match(parts, /aria-expanded=\{helpOpen\}/)
  assert.match(parts, /aria-controls=\{helpId\}/)
  assert.match(parts, /e\.key === 'Escape'/)
  // 保存失败常驻显示 alert，不仅靠短暂图标
  assert.match(parts, /status === 'error'/)
  assert.match(parts, /role="alert"/)
  assert.match(parts, /保存失败/)
  // 内容列默认限制阅读宽度，wide 时放开；不做框住的帮助卡片
  assert.match(parts, /!wide && 'max-w-\[660px\]'/)
  assert.doesNotMatch(parts, /border-t|border-b|divide-/)
})

test('低频与复杂配置默认折叠（fold），高风险项保留明确提醒', () => {
  const appearance = read('src/features/settings/tabs/AppearanceTab.tsx')
  const downloads = read('src/features/settings/tabs/DownloadsTab.tsx')
  const browse = read('src/features/settings/tabs/BrowseTab.tsx')
  const backup = read('src/features/settings/tabs/BackupTab.tsx')
  const server = read('src/features/settings/tabs/ServerTab.tsx')

  assert.match(appearance, /<Section[\s\S]{0,40}?fold[\s\S]{0,40}?title="液态玻璃质感"/)
  assert.match(downloads, /<Section fold title="图片格式转换"/)
  assert.match(browse, /<Section[\s\S]{0,30}?fold[\s\S]{0,40}?title="Cloudflare 验证（FlareSolverr）"/)
  assert.match(backup, /<Section fold title="自动备份包含"/)
  for (const title of ['网络', '代理', '日志', 'OPDS', '数据库']) {
    assert.match(server, new RegExp(`<Section fold title="${title}"`), `服务端「${title}」默认收起`)
  }
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
  assert.match(lab, /布局验收页不保存设置，也不连接服务端/)
})
