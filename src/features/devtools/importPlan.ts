/*
 * 开发者工具箱「批量导入」的纯逻辑：收集候选、预演去重、分批执行。
 * 不依赖 Apollo，请求由调用方传入，测试用虚构数据直接驱动（scripts/verify-devtools.test.mjs）。
 */
import { findSameTitle } from '../manga/migrate.ts'

export interface Candidate {
  id: number
  title: string
  inLibrary: boolean
}

export interface ImportSettings {
  /** 最多翻几页来源列表 */
  pages: number
  /** 最多加入几部 */
  limit: number
  /** 每次入库请求带几部 */
  batch: number
  /** 两次请求之间至少隔多久（毫秒），减轻来源和服务端压力 */
  delay: number
}

// 默认值偏保守；上限防止一次误操作往共用书库里塞太多、或把来源请求得太频繁
export const DEFAULT_SETTINGS: ImportSettings = { pages: 2, limit: 30, batch: 10, delay: 1500 }
export const MAX_SETTINGS: ImportSettings = { pages: 10, limit: 200, batch: 25, delay: 10000 }
const MIN_SETTINGS: ImportSettings = { pages: 1, limit: 1, batch: 1, delay: 500 }

export function clampSettings(s: Partial<ImportSettings>): ImportSettings {
  const out = { ...DEFAULT_SETTINGS }
  for (const k of Object.keys(out) as (keyof ImportSettings)[]) {
    const v = Math.round(Number(s[k] ?? out[k]))
    out[k] = Number.isFinite(v) ? Math.min(MAX_SETTINGS[k], Math.max(MIN_SETTINGS[k], v)) : DEFAULT_SETTINGS[k]
  }
  return out
}

export interface ImportPlan {
  /** 来源返回的条目总数（含跨页重复） */
  fetched: number
  /** 同一部在多页里重复出现的次数 */
  repeated: number
  inLibrary: Candidate[]
  /** 书库里已有同名作品（多半是别的来源的同一部），默认不加 */
  sameTitle: { candidate: Candidate; matches: { id: number; title: string }[] }[]
  /** 超出条数上限，这次不加 */
  overLimit: Candidate[]
  toAdd: Candidate[]
}

/** 预演：只算会发生什么，不发请求 */
export function planImport(fetched: readonly Candidate[], library: readonly { id: number; title: string }[], limit: number): ImportPlan {
  const seen = new Set<number>()
  const libIds = new Set(library.map((m) => m.id))
  const plan: ImportPlan = { fetched: fetched.length, repeated: 0, inLibrary: [], sameTitle: [], overLimit: [], toAdd: [] }
  // 这次要加的作品之间也会互相同名（来源列表重复上架），只留第一部
  const picked: { id: number; title: string }[] = []
  for (const c of fetched) {
    if (seen.has(c.id)) {
      plan.repeated++
      continue
    }
    seen.add(c.id)
    if (c.inLibrary || libIds.has(c.id)) {
      plan.inLibrary.push(c)
      continue
    }
    const matches = [...findSameTitle(library, c), ...findSameTitle(picked, c)]
    if (matches.length) {
      plan.sameTitle.push({ candidate: c, matches: matches.map(({ id, title }) => ({ id, title })) })
      continue
    }
    if (plan.toAdd.length >= limit) {
      plan.overLimit.push(c)
      continue
    }
    plan.toAdd.push(c)
    picked.push(c)
  }
  return plan
}

export function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += Math.max(1, size)) out.push(items.slice(i, i + Math.max(1, size)))
  return out
}

/** 可被取消的等待；取消时立即返回 false */
export function wait(ms: number, signal?: AbortSignal) {
  return new Promise<boolean>((resolve) => {
    if (signal?.aborted) return resolve(false)
    const t = setTimeout(() => {
      signal?.removeEventListener('abort', stop)
      resolve(true)
    }, ms)
    const stop = () => {
      clearTimeout(t)
      resolve(false)
    }
    signal?.addEventListener('abort', stop, { once: true })
  })
}

export interface CollectResult {
  items: Candidate[]
  pages: number
  /** 来源还有下一页但已到页数上限 */
  more: boolean
  cancelled: boolean
  error?: unknown
}

/**
 * 逐页取来源列表（不并发），每页之间留间隔；单页失败按退避重试两次，仍失败就停下并保留已取到的结果。
 * 取到的条目数够 limit 后提前停止，不多翻页。
 */
export async function collectCandidates(
  fetchPage: (page: number) => Promise<{ items: Candidate[]; hasNext: boolean }>,
  { pages, limit, delay, signal, onPage }: Pick<ImportSettings, 'pages' | 'limit' | 'delay'> & { signal?: AbortSignal; onPage?: (page: number, total: number) => void },
): Promise<CollectResult> {
  const items: Candidate[] = []
  let hasNext = true
  let page = 0
  while (hasNext && page < pages) {
    if (page > 0 && !(await wait(delay, signal))) return { items, pages: page, more: hasNext, cancelled: true }
    let tries = 0
    for (;;) {
      if (signal?.aborted) return { items, pages: page, more: hasNext, cancelled: true }
      try {
        const r = await fetchPage(page + 1)
        items.push(...r.items)
        hasNext = r.hasNext
        break
      } catch (error) {
        if (++tries > 2) return { items, pages: page, more: hasNext, cancelled: false, error }
        if (!(await wait(delay * 2 ** tries, signal))) return { items, pages: page, more: hasNext, cancelled: true }
      }
    }
    page++
    onPage?.(page, items.length)
    // 粗略按未入库的条数判断够不够；精确的去重在预演里做
    if (items.filter((c) => !c.inLibrary).length >= limit) break
  }
  return { items, pages: page, more: hasNext, cancelled: false }
}

export interface RunResult {
  done: number[]
  failed: number[]
  /** 取消或连续失败后没有提交的 */
  skipped: number[]
  stopped?: 'cancelled' | 'failures'
  lastError?: unknown
}

/**
 * 按批提交；每批之间留间隔。取消后不再提交新的批次（已发出的那一批会做完）。
 * 连续两批失败就中止，多半是权限或服务端出了问题，继续只会刷出更多失败。
 */
export async function runBatches(
  ids: readonly number[],
  submit: (batch: number[]) => Promise<void>,
  { batch, delay, signal, onProgress }: Pick<ImportSettings, 'batch' | 'delay'> & { signal?: AbortSignal; onProgress?: (r: RunResult) => void },
): Promise<RunResult> {
  const batches = chunk(ids, batch)
  const r: RunResult = { done: [], failed: [], skipped: [] }
  let streak = 0
  for (const [i, b] of batches.entries()) {
    if (i > 0 && !(await wait(delay, signal))) r.stopped = 'cancelled'
    else if (signal?.aborted) r.stopped = 'cancelled'
    if (r.stopped) {
      r.skipped = batches.slice(i).flat()
      break
    }
    try {
      await submit(b)
      r.done.push(...b)
      streak = 0
    } catch (e) {
      r.failed.push(...b)
      r.lastError = e
      if (++streak >= 2) {
        r.stopped = 'failures'
        r.skipped = batches.slice(i + 1).flat()
        onProgress?.({ ...r })
        break
      }
    }
    onProgress?.({ ...r })
  }
  return r
}
