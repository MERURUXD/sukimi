import { locale } from '../../i18n/core.ts'
/*
 * Bangumi 站内评分：公开接口 api.bgm.tv 的条目数据换成界面用的形状，以及按标题挑条目、缓存过期判断。
 * 这里只放纯逻辑，不发请求、不碰存储，测试直接引用
 */

export interface BgmSubject {
  id: number
  name: string
  nameCn: string
  platform: string
  series: boolean
  score: number
  /** 0 表示没有排名（评分人数不够） */
  rank: number
  total: number
  /** 1–10 分各有多少人，下标 0 是 1 分 */
  counts: number[]
  collection: { wish: number; doing: number; collect: number; onHold: number; dropped: number }
  tags: { name: string; count: number }[]
}

type Raw = Record<string, unknown>
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
const str = (v: unknown) => (typeof v === 'string' ? v : '')

/** 接口返回的条目（详情和搜索结果同形）换成 BgmSubject；缺字段的按 0 / 空处理 */
export function parseSubject(raw: Raw): BgmSubject {
  const rating = (raw.rating ?? {}) as Raw
  const count = (rating.count ?? {}) as Raw
  const col = (raw.collection ?? {}) as Raw
  return {
    id: num(raw.id),
    name: str(raw.name),
    nameCn: str(raw.name_cn),
    platform: str(raw.platform),
    series: raw.series === true,
    score: num(rating.score),
    rank: num(rating.rank),
    total: num(rating.total),
    counts: Array.from({ length: 10 }, (_, i) => num(count[String(i + 1)])),
    collection: { wish: num(col.wish), doing: num(col.doing), collect: num(col.collect), onHold: num(col.on_hold), dropped: num(col.dropped) },
    tags: (Array.isArray(raw.tags) ? (raw.tags as Raw[]) : []).slice(0, 8).map((t) => ({ name: str(t.name), count: num(t.count) })).filter((t) => t.name),
  }
}

/**
 * 按标题搜出来的条目里挑最可能的一部。搜索结果同时有漫画、小说和单行本（「xx (1)」），
 * 漫画系列优先，其次任意漫画，再其次任意系列；都不是就不猜，交给手动搜索
 */
export function pickMatch(results: readonly BgmSubject[]): BgmSubject | null {
  return results.find((s) => s.platform === '漫画' && s.series)
    ?? results.find((s) => s.platform === '漫画')
    ?? results.find((s) => s.series)
    ?? null
}

/** 缓存一天：站内评分变化很慢，过期后打开详情再重新查 */
export const CACHE_MS = 24 * 60 * 60 * 1000
export const isFresh = (at: number, now: number) => at > 0 && now - at >= 0 && now - at < CACHE_MS

/** 人数缩写：一万以上写成「1.2万」，以下照原样加千分位 */
export const shortCount = (n: number) => {
  // 中文按「万」，英文按「k」
  if (locale === 'en') return n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k` : String(n)
  return n >= 10000 ? `${(n / 10000).toFixed(1).replace(/\.0$/, '')}万` : n.toLocaleString('en-US')
}

/** 条目网页地址 */
export const subjectUrl = (id: number) => `https://bgm.tv/subject/${id}`
