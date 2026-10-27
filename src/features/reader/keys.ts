/**
 * 方向键、空格在当前阅读模式和阅读方向下对应的翻页动作。
 * 分页模式的 ← → 和左右点击热区一致；纵向 / Webtoon 不随阅读方向对调。
 */

export type TurnMode = 'single' | 'double' | 'vertical' | 'webtoon'
export type TurnDir = 'ltr' | 'rtl'

export interface KeyTarget {
  tagName: string
  isContentEditable?: boolean
}

/** 一屏前进或后退、纵向跳一页，或纵向滚动一屏 */
export type Turn =
  | { kind: 'screen'; delta: 1 | -1 }
  | { kind: 'page'; delta: 1 | -1 }
  | { kind: 'scroll'; delta: 1 | -1 }

const paged = (mode: TurnMode) => mode === 'single' || mode === 'double'

/** 滑块、输入框、下拉框和可编辑区域自己处理方向键，阅读器不要抢走 */
export function keyGoesToControl(target: KeyTarget | null): boolean {
  if (!target) return false
  if (target.isContentEditable) return true
  const tag = target.tagName.toLowerCase()
  return tag === 'input' || tag === 'textarea' || tag === 'select'
}

/**
 * 把按键映射成翻页动作。不是方向键 / 空格，或焦点在输入控件上时返回 null，
 * 调用方不要 preventDefault。
 * 单页、双页、从右往左：← 是下一屏。纵向和 Webtoon：← 是上一页，两种阅读方向一样。
 */
export function pageTurn(key: string, mode: TurnMode, dir: TurnDir, shift: boolean, target: KeyTarget | null): Turn | null {
  if (keyGoesToControl(target)) return null
  if (key === 'ArrowLeft' || key === 'ArrowRight') {
    const forwardKey = key === 'ArrowRight'
    if (!paged(mode)) return { kind: 'page', delta: forwardKey ? 1 : -1 }
    const next = dir === 'rtl' ? !forwardKey : forwardKey
    return { kind: 'screen', delta: next ? 1 : -1 }
  }
  if (key === ' ') {
    const delta: 1 | -1 = shift ? -1 : 1
    return paged(mode) ? { kind: 'screen', delta } : { kind: 'scroll', delta }
  }
  return null
}
