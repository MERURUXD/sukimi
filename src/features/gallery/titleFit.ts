/*
 * 大标题排版。纯函数：按字符估算宽度，不量 DOM，测试直接导入。
 * 汉字、假名按 1 个字宽；西文字母、数字和半角符号按 0.6 个字宽。
 */

const isWide = (ch: string) => ch.codePointAt(0)! >= 0x2e80
export const textWidth = (text: string) => {
  let w = 0
  for (const ch of text) w += isWide(ch) ? 1 : 0.6
  return w
}

/**
 * 按可用宽度挑字号：先试一行，字号太小就换两行、三行……
 * 返回字号（像素），夹在 min 与 max 之间。
 */
export function fit(text: string, width: number, max: number, min: number, maxLines: number) {
  const w = Math.max(1, textWidth(text))
  for (let l = 1; l <= maxLines; l++) {
    const s = Math.floor(((width * l) / w) * 0.9)
    if (s >= max * (l === 1 ? 0.6 : 0.42) || l === maxLines) return Math.max(min, Math.min(max, s))
  }
  return min
}

/** 以西文为主的书名（西文字符过半）竖排不好看，改横排 */
export function mostlyLatin(text: string) {
  let latin = 0
  let all = 0
  for (const ch of text) {
    if (/\s/.test(ch)) continue
    all++
    if (!isWide(ch)) latin++
  }
  return all > 0 && latin / all > 0.5
}

export interface VerticalFit {
  /** 每列的文字（从右往左排） */
  columns: string[]
  /** 字号（像素） */
  size: number
  /** 是否截断过 */
  cut: boolean
}

/**
 * 竖排书名：放进 height 高、width 宽、最多 maxCols 列（1～4）的区域（列距按字号的 1.18 倍算）。
 * 先用一列，字号太小或太宽就多分一列；放不下时截断，末尾加省略号。
 */
export function vfit(text: string, height: number, { max = 120, min = 40, maxCols = 4, width = Infinity } = {}): VerticalFit {
  const chars = [...text.replace(/\s+/g, '')]
  if (!chars.length) return { columns: [], size: max, cut: false }
  const cols = Math.max(1, Math.min(4, maxCols))
  for (let n = 1; n <= cols; n++) {
    const per = Math.ceil(chars.length / n)
    const size = Math.min(Math.floor(height / per), Math.floor(width / (n * 1.18)))
    if (size >= min || n === cols) {
      const fitted = Math.max(min, Math.min(max, size))
      // 最小字号也放不下：每列能放多少放多少，最后一个字换成省略号
      const cap = Math.max(1, Math.floor(height / fitted))
      const cut = per > cap
      const take = cut ? chars.slice(0, cap * n - 1).concat('…') : chars
      const columns = Array.from({ length: n }, (_, i) => take.slice(i * (cut ? cap : per), (i + 1) * (cut ? cap : per)).join('')).filter(Boolean)
      return { columns, size: fitted, cut }
    }
  }
  return { columns: [chars.join('')], size: min, cut: false }
}

/** 横排书名（以西文为主时）：最多 maxLines 行，返回字号 */
export const hfit = (text: string, width: number, { max = 120, min = 36, maxLines = 3 } = {}) => fit(text, width, max, min, maxLines)
