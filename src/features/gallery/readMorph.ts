import { useEffect, useState } from 'react'
import { afterWindowWall, closeWindowWall, openWindowWall, windowWallBusy } from './windowScene'

/*
 * 「已读话数」在画廊首页和阅读档案之间飞来飞去。两页各有一个带 data-gallery-read 的数字，
 * 只在这一次换页期间给 html 挂上 data-gallery-morph，CSS 才给它们挂过渡名（见 gallery.css）：
 * 常驻的话，从档案页点进作品详情时这个数字也会单独飞一下。
 */
let timer = 0

/** 换页前调用（换页动画在调用 navigate 之后才拍旧页面的快照，这时挂上来得及） */
export function armReadMorph() {
  document.documentElement.dataset.galleryMorph = ''
  window.clearTimeout(timer)
  // 换页动画约 0.7 秒；不支持换页动画或被跳过时也按时摘掉
  timer = window.setTimeout(() => delete document.documentElement.dataset.galleryMorph, 1400)
}

let enterTimer = 0

/** 书库里一张封面在屏幕上的位置 */
export interface CoverRect {
  x: number
  y: number
  w: number
  h: number
  /** 书库里那张封面的图 */
  src: string | null
}

let libraryCovers: { at: number; rects: Map<number, CoverRect> } | null = null

/**
 * 从书库点「画廊」：记下书库里看得见的封面在屏幕上的位置和图，画廊首页的墙从这些位置开始，
 * 把同一批封面平着摆在原处，再整块飞到墙上、倾斜成墙（见 HeroWall）。同时挂上 data-gallery-enter：
 * 换页时书库的标题、工具栏和底色从上面淡出（index.css），底下画廊的封面已经在原位，看起来就是同一批封面飞走。
 */
export function enterGalleryFromLibrary() {
  const rects = new Map<number, CoverRect>()
  for (const a of document.querySelectorAll<HTMLAnchorElement>('main a[href*="/manga/"]')) {
    const id = Number(/\/manga\/(\d+)$/.exec(a.getAttribute('href') ?? '')?.[1])
    if (!id || rects.has(id)) continue
    const cv = a.matches('.cv') ? a : a.querySelector<HTMLElement>('.cv')
    if (!cv) continue
    const r = cv.getBoundingClientRect()
    if (r.width < 8 || r.bottom < 0 || r.top > window.innerHeight) continue
    rects.set(id, { x: r.left, y: r.top, w: r.width, h: r.height, src: cv.querySelector('img')?.getAttribute('src') ?? null })
  }
  libraryCovers = { at: performance.now(), rects }
  returnCovers = rects
  windowEntry = null
  armLibraryFade()
}

/** 首页来路只登记本次入口，墙本身由 windowScene 跨路由保留。 */
let windowEntry: { at: number } | null = null

export function enterGalleryFromHome(win: HTMLElement) {
  if (!openWindowWall(win)) return
  windowEntry = { at: performance.now() }
  libraryCovers = null
  returnCovers = null
}

export const windowEntryForEntry = () => (windowEntry && performance.now() - windowEntry.at < 2000 ? windowEntry : null)
export const armWindowBack = closeWindowWall

/** 书库 ⇄ 画廊换页时，旧页面在上面淡出、新页面直接在下面（index.css 的 data-gallery-enter） */
export function armLibraryFade() {
  document.documentElement.dataset.galleryEnter = ''
  window.clearTimeout(enterTimer)
  enterTimer = window.setTimeout(() => delete document.documentElement.dataset.galleryEnter, 1200)
}

/** 进画廊时记下的书库封面位置，回书库时封面照原位飞回去（从书库进来、后退回同一个书库页面时才对得上） */
let returnCovers: Map<number, CoverRect> | null = null
export const libraryCoversForReturn = () => returnCovers

/**
 * 书库里记下的封面图是原图。画廊里被 NSFW 过滤掉的作品没有格子，过场叠层会直接把书库的原图显示出来，
 * 书库页的模糊规则又管不到叠层：把不在 visible 里的封面去掉图，位置照常保留。
 */
export function withoutHiddenCovers(rects: ReadonlyMap<number, CoverRect>, visible: ReadonlySet<number>) {
  return new Map([...rects].map(([id, r]) => [id, visible.has(id) || !r.src ? r : { ...r, src: null }]))
}

/** 画廊首页挂上时取刚才记下的封面位置；过了一会儿的不算（开发模式的严格模式会挂两次，所以不在这里清掉） */
export const libraryCoversForEntry = () => (libraryCovers && performance.now() - libraryCovers.at < 2000 ? libraryCovers.rects : null)

let libraryExit: (() => void) | null = null

/** 画廊首页挂上时登记它的「回书库」动画；导航栏的「书库」按钮靠它也能播放飞回动画 */
export function setLibraryExit(fn: (() => void) | null) {
  libraryExit = fn
}

/** 导航栏点「书库」：画廊首页在的话由它播放飞回动画并换页，返回 true（调用方取消默认跳转） */
export function exitGalleryToLibrary(e: { button: number; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean; altKey: boolean }) {
  if (!libraryExit || !plainClick(e)) return false
  libraryExit()
  return true
}

/** 指到入口上先把画廊页的代码载进来：第一次点开时过场不用边飞边等下载和解析 */
export const prefetchGallery = () => void import('./GalleryPage')

/** 点击时按住修饰键（新标签页打开）不算换页 */
export const plainClick = (e: { button: number; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean; altKey: boolean }) =>
  e.button === 0 && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey

export const activeViewTransition = () => (document as Document & { activeViewTransition?: ViewTransition | null }).activeViewTransition ?? null

/** 正在进行的换页动画结束后（没有就立刻） */
export const afterViewTransition = () => (activeViewTransition()?.finished ?? Promise.resolve()).catch(() => {})

let canvasBackAt = -Infinity
let canvasBackTimer = 0

/** 画布已倒放到画廊的姿态，换页直接接上实时墙，不再叠一层静止快照淡化。 */
export function armCanvasBack() {
  canvasBackAt = performance.now()
  const at = canvasBackAt
  libraryCovers = null
  windowEntry = null
  document.documentElement.dataset.galleryCanvasBack = ''
  window.clearTimeout(canvasBackTimer)
  canvasBackTimer = window.setTimeout(() => finishCanvasBack(at), 8000)
}

export const canvasBackForEntry = () => performance.now() - canvasBackAt < 2000 ? canvasBackAt : null

export function finishCanvasBack(at: number) {
  // 上一次换页迟到的 finished 不能清掉下一次返回的样式。
  if (canvasBackAt !== at) return
  canvasBackAt = -Infinity
  window.clearTimeout(canvasBackTimer)
  delete document.documentElement.dataset.galleryCanvasBack
}

/**
 * 挂上时如果正在换页动画（已读话数在飞），返回 false，落地后变 true。
 * 用来把网络刷新推迟到落地以后：结果要解析（演示数据还要在本页现算），和飞行抢主线程会一顿一顿的。
 */
export function useLanded() {
  const [landed, setLanded] = useState(() => !activeViewTransition() && !windowWallBusy())
  useEffect(() => {
    if (landed) return
    let alive = true
    void Promise.all([afterViewTransition(), afterWindowWall()]).then(() => alive && setLanded(true))
    return () => {
      alive = false
    }
  }, [landed])
  return landed
}
