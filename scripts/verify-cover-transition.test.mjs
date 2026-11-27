import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { runInContext } from 'node:vm'
import ts from 'typescript'

const transpile = (path) => ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 },
}).outputText
const code = transpile('../src/lib/coverTransition.ts')
// 画布复制也用正式代码，放进同一个 jsdom 窗口里执行
const snapshotCode = transpile('../src/lib/canvasSnapshot.ts')

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * 在独立的 jsdom 窗口里执行正式的 coverTransition，只替换浏览器缺的部分：
 * 动画按时长自动结束、可提前 finish；元素尺寸取 data-rect；图片视为已载入；画布只记下被读的源。全部是虚构地址。
 */
async function setup() {
  const { JSDOM } = await import('jsdom')
  const dom = new JSDOM('<!doctype html><html><body><div class="app-shell"><main></main></div></body></html>', {
    url: 'http://localhost/library',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  })
  const w = dom.window
  const timers = new Set()
  w.Element.prototype.animate = function (_frames, opts) {
    let done
    const anim = {
      playState: 'running',
      finished: new Promise((resolve) => { done = resolve }),
      finish() {
        if (anim.playState === 'finished') return
        anim.playState = 'finished'
        clearTimeout(timer)
        timers.delete(timer)
        done(anim)
      },
    }
    const timer = setTimeout(() => anim.finish(), opts?.duration ?? 0)
    timers.add(timer)
    return anim
  }
  w.Element.prototype.getBoundingClientRect = function () {
    const [left, top, width, height] = (this.getAttribute('data-rect') ?? '0,0,0,0').split(',').map(Number)
    return { left, top, width, height, right: left + width, bottom: top + height, x: left, y: top }
  }
  w.Element.prototype.getAnimations = () => []
  const drawn = []
  w.HTMLCanvasElement.prototype.getContext = function () { return { drawImage: (src) => drawn.push(src) } }
  Object.defineProperty(w.HTMLImageElement.prototype, 'complete', { get: () => true })
  Object.defineProperty(w.HTMLImageElement.prototype, 'currentSrc', { get() { return this.getAttribute('src') ?? '' } })
  w.getComputedStyle = () => ({ filter: 'none', borderTopLeftRadius: '8px', boxShadow: 'none' })
  w.matchMedia = () => ({ matches: false })
  w.CSS = { escape: (s) => s }
  let native = 0
  w.document.startViewTransition = () => { native++ }

  const load = (source) => {
    const mod = { exports: {} }
    runInContext(`(function (exports, require) {${source}\n})`, dom.getInternalVMContext())(mod.exports, w.require)
    return mod.exports
  }
  w.require = (name) => {
    if (name === '@/design/motion') return { fade: { fast: { duration: 0.15, ease: [0.2, 0, 0, 1] }, default: { duration: 0.2, ease: [0.2, 0, 0, 1] }, slow: { duration: 0.3, ease: [0.2, 0, 0, 1] } } }
    if (name === '@/design/settings') return { useAppearance: { getState: () => ({ mangaDetailMotion: true }) } }
    if (name === './readerTransition') return { READER_VT_ATTR: 'data-reader-vt' }
    if (name === './canvasSnapshot') return load(snapshotCode)
    throw new Error(`未替换的依赖：${name}`)
  }
  load(code).installCoverTransition('')
  // jsdom 不实现链接跳转，拦下默认行为免得报错；全局点击监听在捕获阶段，已先记下被点的封面
  w.addEventListener('click', (e) => e.preventDefault())

  const main = w.document.querySelector('main')
  const library = () => {
    main.setAttribute('data-page-path', '/library')
    main.innerHTML = '<a href="/manga/1" class="cv" data-rect="100,200,120,180"><img src="/fictional/1.jpg"></a><a href="/manga/2" class="cv" data-rect="300,200,120,180"><img src="/fictional/2.jpg"></a>'
  }
  // backdropTop：取色背景的顶边，页面往下滚过了就是负数
  const detail = (id, backdropTop = 0) => {
    main.setAttribute('data-page-path', `/manga/${id}`)
    main.innerHTML = `<div class="manga-backdrop" data-rect="0,${backdropTop},1280,700"><canvas></canvas></div>`
      + `<div class="manga-hero-cover" data-rect="40,100,240,360"><img src="/fictional/${id}.jpg"></div>`
  }
  // 和 React Router 一样：先改地址，再调 startViewTransition，回调里换页面
  const navigate = (path, render) => {
    w.history.pushState(null, '', path)
    let calls = 0
    const vt = w.document.startViewTransition(() => { calls++; render() })
    return { vt, calls: () => calls }
  }
  const wheelBlocked = () => {
    const e = new w.WheelEvent('wheel', { cancelable: true, bubbles: true, deltaY: 100 })
    main.dispatchEvent(e)
    return e.defaultPrevented
  }
  const count = (sel) => w.document.querySelectorAll(sel).length
  const leftovers = () => count('.cover-veil, .cover-flight, .cover-ghost')
  const click = (href) => w.document.querySelector(`a[href="${href}"]`).dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }))
  const close = () => {
    for (const t of timers) clearTimeout(t)
    dom.window.close()
  }
  return { w, library, detail, navigate, wheelBlocked, count, leftovers, click, close, drawn, native: () => native }
}

test('进出详情页：封面飞行期间拦下滚轮，结束后清理遮罩、替身与克隆并解锁', async () => {
  const t = await setup()
  try {
    t.library()
    t.click('/manga/1')
    const enter = t.navigate('/manga/1', () => t.detail(1))
    assert.equal(t.native(), 0, '进详情不走浏览器转场')
    assert.equal(t.wheelBlocked(), true, '克隆起飞后滚轮被拦')
    await enter.vt.finished
    assert.equal(enter.calls(), 1)
    assert.equal(t.leftovers(), 0)
    assert.equal(t.wheelBlocked(), false, '结束后解锁')

    const back = t.navigate('/library', () => t.library())
    assert.equal(t.count('.cover-ghost'), 1, '换页前就垫好详情页背景的替身')
    assert.equal(t.count('.cover-veil'), 0, '返回时不用底色盖住页面')
    assert.equal(t.wheelBlocked(), true)
    await back.vt.updateCallbackDone
    assert.equal(back.calls(), 1, '不等渐入，立即换页')
    assert.equal(t.count('.cover-ghost'), 1, '换页后替身还在，之后再淡出')
    await back.vt.finished
    assert.equal(back.calls(), 1)
    assert.equal(t.leftovers(), 0)
    assert.equal(t.wheelBlocked(), false)
  } finally {
    t.close()
  }
})

test('返回时被跳过：只换一次页，替身、克隆和滚动锁都撤掉', async () => {
  const t = await setup()
  try {
    t.library()
    t.click('/manga/1')
    await t.navigate('/manga/1', () => t.detail(1)).vt.finished

    const back = t.navigate('/library', () => t.library())
    assert.equal(back.calls(), 0)
    back.vt.skipTransition()
    await back.vt.updateCallbackDone
    assert.equal(back.calls(), 1, '跳过也要换页')
    assert.equal(t.leftovers(), 0)
    assert.equal(t.wheelBlocked(), false)
    // 后面的等待和动画到点后不能再换一次
    await wait(300)
    assert.equal(back.calls(), 1)
  } finally {
    t.close()
  }
})

test('返回途中又换页：前一次照常换页一次，最后不留遮罩、替身、克隆和滚动锁', async () => {
  const t = await setup()
  try {
    t.library()
    t.click('/manga/1')
    await t.navigate('/manga/1', () => t.detail(1)).vt.finished

    const back = t.navigate('/library', () => t.library())
    await wait(20)
    // 背景还在淡出时就去了另一部
    const next = t.navigate('/manga/2', () => t.detail(2))
    await back.vt.updateCallbackDone
    assert.equal(back.calls(), 1, '被打断的那次也换页')
    await next.vt.finished
    assert.equal(next.calls(), 1)
    await wait(300)
    assert.equal(back.calls(), 1, '不会迟到再换一次')
    assert.equal(t.leftovers(), 0)
    assert.equal(t.wheelBlocked(), false)
  } finally {
    t.close()
  }
})

test('返回时背景替身摆在原位、画布按当前画面复制；背景已滚出屏时不垫替身', async () => {
  const t = await setup()
  try {
    t.library()
    t.click('/manga/1')
    await t.navigate('/manga/1', () => t.detail(1, -40)).vt.finished
    const original = t.w.document.querySelector('.manga-backdrop canvas')
    const back = t.navigate('/library', () => t.library())
    const ghost = t.w.document.querySelector('.cover-ghost')
    assert.equal(ghost.style.top, '-40px')
    assert.equal(ghost.style.width, '1280px')
    assert.ok(ghost.inert, '替身不接收焦点和点击')
    const copy = ghost.querySelector('canvas')
    assert.ok(copy && copy !== original, '换成复制出的新画布')
    assert.deepEqual(t.drawn, [original], '从原画布读出当前画面')
    await back.vt.finished
    assert.equal(t.leftovers(), 0)

    t.click('/manga/1')
    await t.navigate('/manga/1', () => t.detail(1, -800)).vt.finished
    const far = t.navigate('/library', () => t.library())
    assert.equal(t.count('.cover-ghost'), 0)
    assert.equal(t.count('.cover-veil'), 0)
    await far.vt.finished
    assert.equal(far.calls(), 1)
    assert.equal(t.leftovers(), 0)
  } finally {
    t.close()
  }
})
