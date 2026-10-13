/**
 * GraphQL 请求监视的记录与统计（开发和 Preview 构建用，正式构建整段删掉）。
 * 只记操作名、类型、耗时、结果和变量名；不留变量值、请求头、返回内容，也不持有请求或错误对象本身。
 * 只在内存里，默认关闭，刷新即清空。这个文件不引用别的模块，Node 测试可以直接加载
 */

export type OpKind = 'query' | 'mutation' | 'subscription'
export type OpStatus = 'pending' | 'ok' | 'error' | 'cancelled'

export interface MonitorEntry {
  id: number
  name: string
  kind: OpKind
  /** 只有变量名 */
  vars: string[]
  at: number
  /** 结束时才有；订阅是连接打开的时长 */
  ms?: number
  status: OpStatus
  error?: string
  /** 收到的结果数，订阅会有很多条 */
  events: number
}

export interface MonitorHandle {
  event(error?: string): void
  end(status: Exclude<OpStatus, 'pending'>, error?: string): void
}

export interface Monitor {
  readonly enabled: boolean
  setEnabled(on: boolean): void
  /** 关闭时返回 null，调用方直接放行请求 */
  begin(op: { name: string; kind: OpKind; vars: string[] }): MonitorHandle | null
  clear(): void
  /** 给 useSyncExternalStore 用：内容变化后才换新数组 */
  snapshot(): readonly MonitorEntry[]
  subscribe(fn: () => void): () => void
}

export const MONITOR_LIMIT = 200

interface Options {
  limit?: number
  now?: () => number
  /** 高精度计时，算耗时用 */
  clock?: () => number
  /** 合并通知：批量导入时每秒几十个请求，逐条重绘整页太费 */
  schedule?: (fn: () => void) => void
}

export function createMonitor({
  limit = MONITOR_LIMIT,
  now = Date.now,
  clock = () => performance.now(),
  schedule = (fn) => setTimeout(fn, 250),
}: Options = {}): Monitor {
  let enabled = false
  let seq = 0
  let entries: MonitorEntry[] = []
  let snap: readonly MonitorEntry[] = []
  let queued = false
  const listeners = new Set<() => void>()

  const flush = () => {
    queued = false
    snap = entries.map((e) => ({ ...e, vars: [...e.vars] }))
    for (const fn of listeners) fn()
  }
  const changed = () => {
    if (queued) return
    queued = true
    schedule(flush)
  }

  return {
    get enabled() {
      return enabled
    },
    // 开关和清空是用户点的，立即刷新，免得开关慢半拍被连点两次
    setEnabled(on) {
      if (on === enabled) return
      enabled = on
      flush()
    },
    begin({ name, kind, vars }) {
      if (!enabled) return null
      const entry: MonitorEntry = { id: ++seq, name, kind, vars: [...vars], at: now(), status: 'pending', events: 0 }
      const start = clock()
      entries.push(entry)
      if (entries.length > limit) entries = entries.slice(-limit)
      changed()
      return {
        event(error) {
          entry.events++
          if (error && !entry.error) entry.error = error
          // 查询的结果不用逐条刷新，结束时统一刷；订阅一直开着，要看得到条数在涨
          if (kind === 'subscription') changed()
        },
        end(status, error) {
          if (entry.status !== 'pending') return
          entry.ms = Math.max(0, Math.round(clock() - start))
          if (error && !entry.error) entry.error = error
          // 返回里带了 GraphQL 错误（服务端照常回 200）也算失败
          entry.status = status === 'ok' && entry.error ? 'error' : status
          changed()
        },
      }
    },
    clear() {
      entries = []
      flush()
    },
    snapshot: () => snap,
    subscribe(fn) {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
  }
}

/** 返回里带 GraphQL 错误时只记这一句：错误消息是服务端返回的内容，可能带书名等信息，不留 */
export const GRAPHQL_ERROR = 'GraphQL 错误'

/**
 * 错误只留分类：HTTP 状态码或错误类型名（如 TypeError），不留提示文字和响应正文。
 * 类型名是前端代码里的类名，不是服务端返回的内容
 */
export function errorText(error: unknown): string {
  if (!error || typeof error !== 'object') return '请求失败'
  const e = error as { statusCode?: unknown; name?: unknown }
  if (typeof e.statusCode === 'number') return `HTTP ${e.statusCode}`
  return typeof e.name === 'string' && /^[A-Za-z]{1,40}$/.test(e.name) ? e.name : '请求失败'
}

export interface OpStats {
  name: string
  kind: OpKind
  count: number
  errors: number
  pending: number
  /** 只算已结束的查询与修改；订阅的时长是连接时长，不放进来 */
  avgMs?: number
  p95Ms?: number
  maxMs?: number
}

/** 按操作名汇总，次数多的在前 */
export function summarize(entries: readonly MonitorEntry[]): OpStats[] {
  const groups = new Map<string, { kind: OpKind; count: number; errors: number; pending: number; times: number[] }>()
  for (const e of entries) {
    const key = `${e.kind}:${e.name}`
    let g = groups.get(key)
    if (!g) groups.set(key, (g = { kind: e.kind, count: 0, errors: 0, pending: 0, times: [] }))
    g.count++
    if (e.status === 'error') g.errors++
    if (e.status === 'pending') g.pending++
    if (e.kind !== 'subscription' && e.ms != null && e.status !== 'cancelled') g.times.push(e.ms)
  }
  return [...groups].map(([key, g]) => {
    const t = g.times.sort((a, b) => a - b)
    return {
      name: key.slice(g.kind.length + 1),
      kind: g.kind,
      count: g.count,
      errors: g.errors,
      pending: g.pending,
      ...(t.length > 0 && {
        avgMs: Math.round(t.reduce((s, x) => s + x, 0) / t.length),
        // 最近邻取法：样本少时就是最大值附近，够用
        p95Ms: t[Math.min(t.length - 1, Math.ceil(t.length * 0.95) - 1)],
        maxMs: t[t.length - 1],
      }),
    }
  }).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
}

let shared: Monitor | undefined
/** 正式客户端、验收页客户端和工具箱页面共用一份；用到时才创建，没引用就能整段删掉 */
export const getMonitor = () => (shared ??= createMonitor())
