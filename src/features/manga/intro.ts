import type { CSSProperties } from 'react'

/** 详情从上到下进场；同一排轻微错开，后一块接在整排之后。 */
export const mangaIntro = {
  title: 120,
  byline: 170,
  /** 宽屏右栏（追踪与站内评分）第一行，之后每行晚 40ms */
  side: 170,
  meta: 200,
  description: 240,
  tags: 300,
  actions: 460,
  recent: 600,
  track: 640,
  chapterTitle: 700,
  chapterTools: 740,
  chapterRow: 800,
} as const

export const mangaIntroDelay = (ms: number): CSSProperties => ({ '--d': `${ms}ms` }) as CSSProperties

/** 给定延迟就加 .rise 进场，否则不动（窄屏、弹窗等不随详情页进场的地方） */
export const introRise = (ms: number | undefined): { className?: string; style?: CSSProperties } =>
  ms === undefined ? {} : { className: 'rise', style: mangaIntroDelay(ms) }
