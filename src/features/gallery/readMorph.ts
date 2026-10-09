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

/** 点击时按住修饰键（新标签页打开）不算换页 */
export const plainClick = (e: { button: number; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean; altKey: boolean }) =>
  e.button === 0 && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey
