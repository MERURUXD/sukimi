import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const source = readFileSync(new URL('../src/components/manga/CoverImg.tsx', import.meta.url), 'utf8')
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2023 },
}).outputText

// 执行正式组件与 React 渲染，只替换登录状态和占位组件；全部使用虚构地址。
function cover({ isDemo = false, isDevLab = false } = {}) {
  let status = 'checking'
  const useAuth = selector => selector({ status })
  useAuth.getState = () => ({ status })
  const exports = {}
  runInNewContext(code, {
    exports,
    require: name => {
      if (name === '@/api/auth') return {
        useAuth,
        tokenExpiring: () => false,
        refreshAccessToken: () => assert.fail('首屏渲染不应另行续期'),
      }
      if (name === '@/lib/demo') return { isDemo, isDevLab }
      if (name === '@/lib/coverVisibility') return { onCoverVisibility() {} }
      if (name === './CoverSkeleton') return { CoverSkeleton: () => createElement('span', { 'data-placeholder': true }) }
      return require(name)
    },
  })
  return {
    status: value => { status = value },
    render: (src = '/fictional-cover.jpg') => renderToStaticMarkup(createElement(exports.CoverImg, { src, loading: 'lazy' })),
  }
}

test('冷启动先显示占位，写好登录 Cookie 后才给浏览器封面地址', () => {
  const view = cover()
  const waiting = view.render()
  assert.match(waiting, /data-placeholder/)
  assert.doesNotMatch(waiting, /<img|fictional-cover/, '不能留下验证前发出、验证后才报错的图片请求')

  view.status('signedIn')
  const ready = view.render()
  assert.match(ready, /<img/)
  assert.match(ready, /src="\/fictional-cover.jpg"/)
  assert.match(ready, /loading="lazy"/, '保留浏览器懒加载与原地址缓存')
})

test('演示和虚构验收页不等待登录，也不续期', () => {
  for (const mode of [{ isDemo: true }, { isDevLab: true }]) {
    const view = cover(mode)
    assert.match(view.render('data:image/svg+xml,fictional'), /<img/)
  }
})

test('缺封面仍显示占位图标，不伪装成一直加载', () => {
  const view = cover()
  for (const status of ['checking', 'signedIn']) {
    view.status(status)
    const empty = view.render(null)
    assert.match(empty, /<svg/)
    assert.doesNotMatch(empty, /<img|data-placeholder/)
  }
})
