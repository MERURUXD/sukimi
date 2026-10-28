/*
 * 分享海报的数据与排版计算。纯函数：不碰 DOM 和画布，测试直接导入。
 * 画法见 posterDraw.ts，面板见 PosterShare.tsx。
 */
import type { ReadingStats } from './stats.ts'
import { t } from '../../i18n/core.ts'

/** 海报固定 1080 × 1350（4:5），不按屏幕像素比放大 */
export const POSTER_W = 1080
export const POSTER_H = 1350

export type PosterKind = 'library' | 'stats' | 'work'

export const POSTER_LABEL: Record<PosterKind, string> = { library: t('gallery.poster.label.library'), stats: t('gallery.poster.label.stats'), work: t('gallery.poster.label.work') }

/** 一张封面：地址取不到或加载失败时画占位，占位上写书名 */
export interface PosterCover {
  url: string | null
  title: string
}

export interface LibraryPoster {
  kind: 'library'
  /** 封面墙，一行一组 */
  rows: PosterCover[][]
  read: number
  works: number
  chapters: number
  /** 已读页数估算，口径同阅读档案 */
  pages: number
  now: number
}

export interface StatsPoster {
  kind: 'stats'
  stats: ReadingStats
  works: number
  /** 读得最多的几部（已去掉 NSFW） */
  top: { cover: PosterCover; read: number }[]
  headline: { lead: string; strong?: string; tail: string } | null
  now: number
}

export interface WorkPoster {
  kind: 'work'
  cover: PosterCover
  author: string | null
  /** 已读话数；总话数还没取到时为 null */
  read: number | null
  total: number | null
  status: string | null
}

export type PosterModel = LibraryPoster | StatsPoster | WorkPoster

/** 文件名只用 ASCII：有的系统分享面板和网盘对中文文件名处理不好 */
export function posterFileName(kind: PosterKind, t: number) {
  const d = new Date(t)
  const p = (n: number) => String(n).padStart(2, '0')
  return `sukimi-${kind}-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}.png`
}

export const WALL_ROWS = 6
export const WALL_COLS = 13

/**
 * 海报上的封面墙。items 按收藏先后传入（和画廊的墙一致），已去掉 NSFW。
 * 书够多时从整个书库里等距取，每格一部不重复，新旧收藏都能上墙；
 * 书少时循环铺满，每行从半圈之后开始，同一列上下两格不是同一部
 */
export function wallRows<T>(items: readonly T[], rows = WALL_ROWS, cols = WALL_COLS): T[][] {
  const n = items.length
  if (!n) return []
  const total = rows * cols
  if (n >= total) return Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => items[Math.floor(((r * cols + c) * n) / total)]))
  const step = Math.max(1, Math.floor(n / 2))
  return Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => items[(r * step + c) % n]))
}

/** 不在句首的标点：行首遇到它们时把上一个字一起带下来 */
const NO_START = /^[，。、；：？！）》」』】,.;:?!)\]…]/

/** 拆成排版单位：中日文按字，西文按词（连同后面的空格） */
function tokens(text: string) {
  return text.match(/[A-Za-z0-9'’\-.]+\s*|\s+|./gu) ?? []
}

/**
 * 画布没有自动换行：按 measure 量出的宽度把 text 排成最多 maxLines 行，放不下的最后一行截断加「…」。
 * 中日文逐字断行，西文按词断，单个词比一行还长时逐字断开
 */
export function fitLines(text: string, maxWidth: number, maxLines: number, measure: (s: string) => number): string[] {
  const lines: string[] = []
  let line = ''
  const push = (tok: string) => {
    if (!line && !tok.trim()) return
    if (measure(line + tok) <= maxWidth || !line) {
      line += tok
      return
    }
    // 标点不放行首：把这一行最后一个字带到下一行
    if (NO_START.test(tok) && line.length > 1) {
      const last = [...line].pop()!
      lines.push(line.slice(0, -last.length).trimEnd())
      line = last + tok
      return
    }
    lines.push(line.trimEnd())
    line = tok.trimStart()
  }
  for (const tok of tokens(text)) {
    if (measure(tok) > maxWidth) for (const ch of tok) push(ch)
    else push(tok)
  }
  if (line.trim()) lines.push(line.trimEnd())
  if (lines.length <= maxLines) return lines
  const kept = lines.slice(0, maxLines)
  let last = kept[maxLines - 1]
  while (last && measure(`${last}…`) > maxWidth) last = [...last].slice(0, -1).join('')
  kept[maxLines - 1] = `${last.trimEnd()}…`
  return kept
}

/**
 * 读得最多的 n 部：按排行顺序，跳过 skip 为 true 的（NSFW）和已不在书库里的，再取前 n 部。
 * 先过滤再截取，海报上不会出现档案页那种 NSFW 占位
 */
export function posterTop<M>(ranking: readonly { id: number; read: number }[], byId: ReadonlyMap<number, M>, skip: (m: M) => boolean, n = 3) {
  const out: { manga: M; read: number }[] = []
  for (const r of ranking) {
    if (out.length >= n) break
    const m = byId.get(r.id)
    if (r.read > 0 && m && !skip(m)) out.push({ manga: m, read: r.read })
  }
  return out
}

/** 单部海报上的进度：已读 = 总话数 − 未读，与画廊其他地方的口径一致；总话数未知时为 null */
export function workProgress(total: number | null | undefined, unread: number) {
  if (total == null) return { read: null, total: null }
  return { read: Math.max(0, total - unread), total }
}

/** 单部海报左上角那一行：按进度说 */
export function workHeading(read: number | null, total: number | null) {
  if (read != null && total && read >= total) return t('gallery.poster.workFinished')
  if (read) return t('gallery.poster.workReading')
  return t('gallery.poster.workInLibrary')
}

/** 年轮刻度的角度（度）：从正下方开始顺时针一圈，和档案页的年轮一致 */
export const ringAngle = (i: number, n: number) => 180 + ((i + 0.5) / n) * 360
