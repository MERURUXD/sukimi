import assert from 'node:assert/strict'
import test from 'node:test'
import { entryScript } from '../src/lib/appVersion.ts'

const page = (head) => `<!doctype html><html><head><script>try { var a = 1 } catch (e) {}</script>${head}</head><body><div id="root"></div></body></html>`

test('取打包后的入口脚本，忽略内联脚本与预加载', () => {
  const html = page('<script type="module" crossorigin src="/assets/index-AbC123.js"></script><link rel="modulepreload" crossorigin href="/assets/react-x1.js">')
  assert.equal(entryScript(html), '/assets/index-AbC123.js')
})

test('属性顺序与引号不同也能取到', () => {
  assert.equal(entryScript(page("<script crossorigin src='/assets/index-9.js' type='module'></script>")), '/assets/index-9.js')
  assert.equal(entryScript(page('<SCRIPT src=/assets/index-7.js type=module></SCRIPT>')), '/assets/index-7.js')
})

test('不是本前端的页面（没有模块入口）时返回空，不误报新版本', () => {
  assert.equal(entryScript(page('<script src="/legacy.js"></script>')), undefined)
  assert.equal(entryScript('<html><body>502 Bad Gateway</body></html>'), undefined)
})

test('入口哈希变化即视为新版本', () => {
  const a = entryScript(page('<script type="module" src="/assets/index-old.js"></script>'))
  const b = entryScript(page('<script type="module" src="/assets/index-new.js"></script>'))
  assert.notEqual(a, b)
})
