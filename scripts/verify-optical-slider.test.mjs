/**
 * 光学放大镜滑块与按住拖拽行为校验：
 * 1. 纯数学/物理辅助函数单元测试；
 * 2. JSDOM 下验证 Seg、TopNav、MobileTabBar、SideNav 的轻点、按住拖拽、取消、无障碍隔离与减少动态降级。
 */
import assert from 'node:assert/strict'
import { after, describe, test } from 'node:test'
import { JSDOM } from 'jsdom'
import { act, createElement, useState } from 'react'
import { createMemoryRouter, MemoryRouter, RouterProvider, useLocation } from 'react-router'

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'http://localhost/',
  pretendToBeVisual: true,
})
const { window } = dom
let reduced = false

const medias = []
window.matchMedia = (query) => {
  const set = new Set()
  const media = {
    get matches() {
      return query.includes('prefers-reduced-motion') ? reduced : false
    },
    media: query,
    onchange: null,
    addEventListener(type, fn) { if (type === 'change') set.add(fn) },
    removeEventListener(type, fn) { set.delete(fn) },
    addListener(fn) { set.add(fn) },
    removeListener(fn) { set.delete(fn) },
    dispatchEvent() {
      for (const fn of set) fn({ matches: media.matches, media: query })
      return true
    },
  }
  medias.push(media)
  return media
}
const setReduced = async (next) => {
  reduced = next
  await act(async () => {
    for (const m of medias) if (m.media.includes('prefers-reduced-motion')) m.dispatchEvent()
  })
}

const g = globalThis
g.window = window
g.document = window.document
g.HTMLElement = window.HTMLElement
g.Element = window.Element
g.SVGElement = window.SVGElement
g.Node = window.Node
g.DocumentFragment = window.DocumentFragment
g.MutationObserver = window.MutationObserver
g.NodeFilter = window.NodeFilter
g.getComputedStyle = window.getComputedStyle.bind(window)
g.requestAnimationFrame = window.requestAnimationFrame.bind(window)
g.cancelAnimationFrame = window.cancelAnimationFrame.bind(window)
g.history = window.history
g.location = window.location
g.matchMedia = window.matchMedia
g.localStorage = window.localStorage
window.localStorage.setItem('suwayomi-web.locale', 'zh-CN')
if (typeof window.document.elementFromPoint !== 'function') window.document.elementFromPoint = () => null
try {
  g.navigator = window.navigator
} catch {
  Object.defineProperty(g, 'navigator', { configurable: true, get: () => window.navigator })
}
const css = { supports: () => false }
window.CSS = css
g.CSS = css

const resizeObservers = new Set()
class ResizeObserver {
  constructor(cb) {
    this.cb = cb
    resizeObservers.add(this)
  }
  observe() {}
  unobserve() {}
  disconnect() { resizeObservers.delete(this) }
}
const triggerResizeObservers = () => {
  for (const ro of [...resizeObservers]) ro.cb([], ro)
}
window.ResizeObserver = ResizeObserver
g.ResizeObserver = ResizeObserver
window.Element.prototype.scrollTo = () => {}
window.Element.prototype.scrollIntoView = () => {}
window.scrollTo = () => {}
window.innerWidth = 1280
window.innerHeight = 800
try {
  Object.defineProperty(window.history, 'scrollRestoration', { configurable: true, writable: true, value: 'auto' })
} catch { /* jsdom 已可写 */ }
g.IS_REACT_ACT_ENVIRONMENT = true

const { createRoot } = await import('react-dom/client')
const { createServer } = await import('vite')
const vite = await createServer({
  resolve: { preserveSymlinks: true },
  server: { middlewareMode: true, hmr: false, watch: null },
  appType: 'custom',
  logLevel: 'error',
})
const cache = new Map()
const mod = async (id) => {
  if (!cache.has(id)) cache.set(id, await vite.ssrLoadModule(id))
  return cache.get(id)
}

let root
const host = () => document.getElementById('root')
async function render(node) {
  root = createRoot(host())
  await act(async () => { root.render(node) })
}
async function cleanup() {
  if (root) {
    await act(async () => { root.unmount() })
    root = undefined
  }
  for (const node of [...document.body.children]) if (node.id !== 'root') node.remove()
}

function makePointer(type, props = {}) {
  const ev = new window.MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: props.clientX ?? 0,
    clientY: props.clientY ?? 0,
    button: props.button ?? 0,
  })
  Object.defineProperty(ev, 'pointerId', { value: props.pointerId ?? 1 })
  Object.defineProperty(ev, 'pointerType', { value: props.pointerType ?? 'mouse' })
  return ev
}

function mockBox(el, box) {
  el.getBoundingClientRect = () => ({
    left: box.x,
    top: box.y,
    width: box.width,
    height: box.height,
    right: box.x + box.width,
    bottom: box.y + box.height,
    x: box.x,
    y: box.y,
    toJSON() { return this },
  })
  Object.defineProperty(el, 'offsetLeft', { configurable: true, value: box.x })
  Object.defineProperty(el, 'offsetTop', { configurable: true, value: box.y })
  Object.defineProperty(el, 'offsetWidth', { configurable: true, value: box.width })
  Object.defineProperty(el, 'offsetHeight', { configurable: true, value: box.height })
}

async function settleFrames(ms = 90) {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms))
  })
}

after(async () => {
  await cleanup()
  await vite.close()
  dom.window.close()
})

describe('光学滑块纯函数', () => {
  test('sanitizeMaskId 清除非法 ID 字符', async () => {
    const { sanitizeMaskId } = await mod('/src/components/ui/opticalSlider.ts')
    assert.equal(sanitizeMaskId('seg-cutout-:r1a:'), 'seg-cutout-r1a')
    assert.equal(sanitizeMaskId(':::'), 'mask')
  })

  test('rubberBand 在区间内原样返回，超界呈渐近阻尼', async () => {
    const { rubberBand, RUBBER_MAX } = await mod('/src/components/ui/opticalSlider.ts')
    assert.equal(rubberBand(50, 10, 100), 50)
    const left = rubberBand(-40, 10, 100)
    const farLeft = rubberBand(-500, 10, 100)
    assert.ok(left < 10 && left > 10 - (Math.PI / 2) * RUBBER_MAX)
    assert.ok(farLeft < left && farLeft > 10 - (Math.PI / 2) * RUBBER_MAX)
    const right = rubberBand(180, 10, 100)
    assert.ok(right > 100 && right < 100 + (Math.PI / 2) * RUBBER_MAX)
  })

  test('interpSpanAt 按滑块中心线性插值相邻选项尺寸', async () => {
    const { interpSpanAt } = await mod('/src/components/ui/opticalSlider.ts')
    const boxes = [
      { x: 0, y: 0, width: 60, height: 36 },
      { x: 60, y: 0, width: 100, height: 36 },
    ]
    assert.equal(interpSpanAt([], 10, 'horizontal'), 0)
    assert.equal(interpSpanAt(boxes, 30, 'horizontal'), 60)
    assert.equal(interpSpanAt(boxes, 110, 'horizontal'), 100)
    assert.equal(interpSpanAt(boxes, 70, 'horizontal'), 80)
  })

  test('nearestBoxIndex 找出主轴中心最近项', async () => {
    const { nearestBoxIndex } = await mod('/src/components/ui/opticalSlider.ts')
    const hBoxes = [
      { x: 0, y: 0, width: 60, height: 36 },
      { x: 64, y: 0, width: 60, height: 36 },
      { x: 128, y: 0, width: 80, height: 36 },
    ]
    assert.equal(nearestBoxIndex([], 10, 'horizontal'), -1)
    assert.equal(nearestBoxIndex(hBoxes, 20, 'horizontal'), 0)
    assert.equal(nearestBoxIndex(hBoxes, 92, 'horizontal'), 1)
    assert.equal(nearestBoxIndex(hBoxes, 200, 'horizontal'), 2)

    const vBoxes = [
      { x: 6, y: 6, width: 60, height: 58 },
      { x: 6, y: 68, width: 60, height: 58 },
    ]
    assert.equal(nearestBoxIndex(vBoxes, 95, 'vertical'), 1)
  })

  test('computeLensTransform 在 mag=1 时零偏差且围绕滑块中心径向放大', async () => {
    const { computeLensTransform } = await mod('/src/components/ui/opticalSlider.ts')
    const pill = { x: 80, y: 5, width: 60, height: 36 }
    const baseOffset = { x: 5, y: 5 }
    const aligned = computeLensTransform(pill, baseOffset, 1, 0, 0)
    assert.deepEqual(aligned, { tx: -75, ty: 0 })

    const zoomed = computeLensTransform(pill, baseOffset, 1.1, 3, -2)
    // 滑块中心对应 base 内 lx = (80 + 30) - 5 = 105，缩放后仍在滑块本地中心 (width/2 = 30) 加上 shift
    const pillLocalCenterAfter = zoomed.tx + (pill.x + pill.width / 2 - baseOffset.x) * 1.1
    assert.ok(Math.abs(pillLocalCenterAfter - (pill.width / 2 + 3)) < 1e-9)
  })

  test('computePillStretch 与 stepSpring 物理量符合钳位与收敛', async () => {
    const { computePillStretch, MAX_STRETCH, LIFT_SCALE, stepSpring } = await mod('/src/components/ui/opticalSlider.ts')
    assert.deepEqual(computePillStretch(0, 0, 0), { scaleX: 1, scaleY: 1 })
    const fast = computePillStretch(20000, 0, 1)
    assert.ok(Math.abs(fast.scaleX - (1 + MAX_STRETCH) * (1 + LIFT_SCALE)) < 1e-9)
    assert.ok(Math.abs(fast.scaleY - (1 - MAX_STRETCH / 2) * (1 + LIFT_SCALE)) < 1e-9)

    let v = 0
    let vel = 0
    for (let i = 0; i < 60; i++) [v, vel] = stepSpring(v, vel, 120, 1 / 60, 340, 26)
    assert.ok(Math.abs(v - 120) < 0.5)
  })

  test('stepSpring 在低帧率下无条件稳定、帧率无关并覆盖临界/过阻尼区间', async () => {
    const { stepSpring } = await mod('/src/components/ui/opticalSlider.ts')

    // Codex P2 场景：拖拽参数 (680, 38) 在 25 FPS (dt=0.04) 下跑 50 帧不发散且收敛到 100
    let v = 0
    let vel = 0
    for (let i = 0; i < 50; i++) {
      ;[v, vel] = stepSpring(v, vel, 100, 0.04, 680, 38)
      assert.ok(Number.isFinite(v) && Number.isFinite(vel))
      assert.ok(v >= -20 && v <= 125, `第 ${i} 帧越界：v=${v}`)
    }
    assert.ok(Math.abs(v - 100) < 0.01 && Math.abs(vel) < 0.05)

    // 极低帧率 (10 FPS, dt=0.1) 同样稳定收敛
    let lowV = 0
    let lowVel = 0
    for (let i = 0; i < 20; i++) {
      ;[lowV, lowVel] = stepSpring(lowV, lowVel, 100, 0.1, 680, 38)
      assert.ok(lowV >= -20 && lowV <= 125)
    }
    assert.ok(Math.abs(lowV - 100) < 0.01 && Math.abs(lowVel) < 0.05)

    // 帧率无关性：1 步 dt=0.04 与 4 步 dt=0.01 一致
    const [oneV, oneVel] = stepSpring(12, -35, 100, 0.04, 680, 38)
    let subV = 12
    let subVel = -35
    for (let i = 0; i < 4; i++) [subV, subVel] = stepSpring(subV, subVel, 100, 0.01, 680, 38)
    assert.ok(Math.abs(oneV - subV) < 1e-9)
    assert.ok(Math.abs(oneVel - subVel) < 1e-9)

    // 临界阻尼 (disc=0: alpha=20, stiffness=400) 与过阻尼 (damping=60, stiffness=400) 不过冲
    for (const damping of [40, 60]) {
      let cv = 0
      let cvel = 0
      for (let i = 0; i < 40; i++) {
        ;[cv, cvel] = stepSpring(cv, cvel, 100, 0.04, 400, damping)
        assert.ok(cv >= 0 && cv <= 100 + 1e-9, `阻尼 ${damping} 出现过冲: ${cv}`)
      }
      assert.ok(Math.abs(cv - 100) < 0.01)
    }
  })
})

describe('光学滑块组件与交互行为', () => {
  test('Seg：轻点切换、克隆层隔离、按住拖拽跨选项切换且抑制尾随 click', async () => {
    await setReduced(false)
    const { Seg } = await mod('/src/components/ui/Seg.tsx')
    const changes = []
    function Harness() {
      const [value, setValue] = useState('a')
      return createElement(Seg, {
        glass: false,
        label: '分段测试',
        value,
        onChange: (next) => {
          changes.push(next)
          setValue(next)
        },
        items: [
          { value: 'a', label: '甲' },
          { value: 'b', label: '乙' },
          { value: 'c', label: '丙' },
        ],
      })
    }

    try {
      await render(createElement(Harness))
      const track = document.querySelector('[role="group"]')
      const buttons = [...track.querySelectorAll('button')]
      assert.equal(buttons.length, 3)
      const lensWin = track.querySelector('.seg-lens-window')
      assert.ok(lensWin)
      assert.equal(lensWin.getAttribute('aria-hidden'), 'true')
      assert.equal(lensWin.querySelectorAll('button').length, 0)

      // 注入几何布局并通知重新测量
      mockBox(track, { x: 0, y: 0, width: 220, height: 44 })
      mockBox(buttons[0], { x: 4, y: 4, width: 68, height: 36 })
      mockBox(buttons[1], { x: 74, y: 4, width: 68, height: 36 })
      mockBox(buttons[2], { x: 144, y: 4, width: 72, height: 36 })
      await act(async () => { triggerResizeObservers() })

      assert.match(buttons[0].style.mask || buttons[0].style.webkitMask || '', /^url\(["']?#seg-cutout-/)
      assert.equal(buttons[2].style.mask || '', '')

      // 1. 轻点切换到 b
      await act(async () => { buttons[1].click() })
      assert.deepEqual(changes, ['b'])
      assert.equal(buttons[1].getAttribute('aria-pressed'), 'true')

      // 2. 按住从 b 拖拽到 c 并松手
      await settleFrames(40)
      await act(async () => {
        buttons[1].dispatchEvent(makePointer('pointerdown', { clientX: 108, clientY: 22, pointerId: 7 }))
      })
      await act(async () => {
        window.dispatchEvent(makePointer('pointermove', { clientX: 180, clientY: 22, pointerId: 7 }))
      })
      assert.equal(track.dataset.dragging, 'true')
      await settleFrames(90)
      await act(async () => {
        window.dispatchEvent(makePointer('pointerup', { clientX: 180, clientY: 22, pointerId: 7 }))
      })
      assert.equal(track.dataset.dragging, undefined)
      assert.deepEqual(changes, ['b', 'c'])
      assert.equal(buttons[2].getAttribute('aria-pressed'), 'true')

      // 拖拽松手后紧随的合成 click（例如落在起始按钮上）必须被拦截
      await act(async () => {
        buttons[1].dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }))
      })
      assert.deepEqual(changes, ['b', 'c'])

      // 3. pointercancel 取消拖拽不应提交切换
      await act(async () => {
        buttons[2].dispatchEvent(makePointer('pointerdown', { clientX: 180, clientY: 22, pointerId: 8 }))
        window.dispatchEvent(makePointer('pointermove', { clientX: 40, clientY: 22, pointerId: 8 }))
      })
      await settleFrames(60)
      await act(async () => {
        window.dispatchEvent(makePointer('pointercancel', { clientX: 40, clientY: 22, pointerId: 8 }))
      })
      assert.deepEqual(changes, ['b', 'c'])
    } finally {
      await cleanup()
    }
  })

  test('TopNav：克隆层不增删链接，按住横向拖拽可切页，非主标签路由隐藏滑块', async () => {
    await setReduced(false)
    const { TopNav } = await mod('/src/app/TopNav.tsx')
    function PathDisplay() {
      return createElement('div', { 'data-testid': 'path' }, useLocation().pathname)
    }
    const router = createMemoryRouter(
      [{ path: '*', element: createElement('div', null, createElement(TopNav), createElement(PathDisplay)) }],
      { initialEntries: ['/'] },
    )

    try {
      await render(createElement(RouterProvider, { router }))
      const nav = document.querySelector('[data-vt-glass="topnav-tabs"]')
      const track = nav.querySelector('.optical-track')
      const links = [...track.querySelectorAll('a')]
      assert.equal(links.length, 5)
      assert.equal(track.querySelector('.nav-lens-window')?.getAttribute('aria-hidden'), 'true')
      assert.equal(track.querySelectorAll('.nav-lens-clone a').length, 0)

      const base = links[0].parentElement
      mockBox(track, { x: 0, y: 0, width: 340, height: 50 })
      mockBox(base, { x: 5, y: 5, width: 330, height: 40 })
      links.forEach((a, i) => mockBox(a, { x: 5 + i * 66, y: 5, width: 64, height: 40 }))
      await act(async () => { triggerResizeObservers() })

      // 拖拽从「首页(37)」到「历史(169)」
      await act(async () => {
        links[0].dispatchEvent(makePointer('pointerdown', { clientX: 37, clientY: 25, pointerId: 21 }))
        window.dispatchEvent(makePointer('pointermove', { clientX: 169, clientY: 25, pointerId: 21 }))
      })
      await settleFrames(100)
      await act(async () => {
        window.dispatchEvent(makePointer('pointerup', { clientX: 169, clientY: 25, pointerId: 21 }))
      })
      assert.equal(document.querySelector('[data-testid="path"]').textContent, '/history')

      // 进入非主标签路由 /settings 时隐藏滑块与遮罩
      await act(async () => { await router.navigate('/settings') })
      assert.equal(track.querySelector('.nav-pill').style.display, 'none')
      assert.equal(track.querySelector('.nav-lens-window').style.display, 'none')
      assert.equal(base.style.mask || '', '')
    } finally {
      await cleanup()
    }
  })

  test('MobileTabBar 横向拖拽与 SideNav 纵向拖拽均切换路由', async () => {
    await setReduced(false)
    const { MobileTabBar } = await mod('/src/app/MobileTabBar.tsx')
    const { SideNav } = await mod('/src/app/SideNav.tsx')
    function PathDisplay() {
      return createElement('div', { 'data-testid': 'path' }, useLocation().pathname)
    }
    const router = createMemoryRouter(
      [{ path: '*', element: createElement('div', null, createElement(MobileTabBar), createElement(SideNav), createElement(PathDisplay)) }],
      { initialEntries: ['/'] },
    )

    try {
      await render(createElement(RouterProvider, { router }))

      // MobileTabBar 横向拖拽到第 2 项（/library）
      const mobTrack = document.querySelector('[data-vt-glass="tabbar-tabs"] .optical-track')
      const mobLinks = [...mobTrack.querySelectorAll('a')]
      assert.equal(mobLinks.length, 5)
      mockBox(mobTrack, { x: 0, y: 0, width: 360, height: 64 })
      mockBox(mobLinks[0].parentElement, { x: 6, y: 6, width: 348, height: 52 })
      mobLinks.forEach((a, i) => mockBox(a, { x: 6 + i * 70, y: 6, width: 68, height: 52 }))
      await act(async () => { triggerResizeObservers() })

      await act(async () => {
        mobLinks[0].dispatchEvent(makePointer('pointerdown', { clientX: 40, clientY: 30, pointerId: 31 }))
        window.dispatchEvent(makePointer('pointermove', { clientX: 110, clientY: 30, pointerId: 31 }))
      })
      await settleFrames(100)
      await act(async () => {
        window.dispatchEvent(makePointer('pointerup', { clientX: 110, clientY: 30, pointerId: 31 }))
      })
      assert.equal(document.querySelector('[data-testid="path"]').textContent, '/library')

      // SideNav 纵向拖拽到第 4 项（/updates）
      const sideTrack = document.querySelector('[data-vt-glass="sidenav-tabs"] .optical-track')
      const sideLinks = [...sideTrack.querySelectorAll('a')]
      assert.equal(sideLinks.length, 5)
      mockBox(sideTrack, { x: 0, y: 0, width: 72, height: 320 })
      mockBox(sideLinks[0].parentElement, { x: 6, y: 6, width: 60, height: 308 })
      sideLinks.forEach((a, i) => mockBox(a, { x: 6, y: 6 + i * 62, width: 60, height: 58 }))
      await act(async () => { triggerResizeObservers() })

      await act(async () => {
        sideLinks[1].dispatchEvent(makePointer('pointerdown', { clientX: 36, clientY: 97, pointerId: 32 }))
        window.dispatchEvent(makePointer('pointermove', { clientX: 36, clientY: 221, pointerId: 32 }))
      })
      await settleFrames(100)
      await act(async () => {
        window.dispatchEvent(makePointer('pointerup', { clientX: 36, clientY: 221, pointerId: 32 }))
      })
      assert.equal(document.querySelector('[data-testid="path"]').textContent, '/updates')
    } finally {
      await cleanup()
    }
  })

  test('prefers-reduced-motion 开启时隐藏透镜且退化为静止高亮', async () => {
    await setReduced(true)
    const { TopNav } = await mod('/src/app/TopNav.tsx')
    const { Seg } = await mod('/src/components/ui/Seg.tsx')
    try {
      await render(
        createElement(MemoryRouter, { initialEntries: ['/'] },
          createElement('div', null,
            createElement(TopNav),
            createElement(Seg, {
              glass: false,
              label: '减少动态',
              value: 'a',
              onChange: () => {},
              items: [{ value: 'a', label: '甲' }, { value: 'b', label: '乙' }],
            }),
          ),
        ),
      )
      assert.equal(document.querySelector('.nav-lens-window'), null)
      assert.equal(document.querySelector('.seg-lens-window'), null)
      assert.equal(document.querySelector('.seg-pill-bg'), null)
      assert.ok(document.querySelector('.seg .seg-on'))
    } finally {
      await setReduced(false)
      await cleanup()
    }
  })
})
