import { useApolloClient, useQuery } from '@apollo/client/react'
import { Activity, Download, ExternalLink, FlaskConical, LibraryBig, RotateCcw, Search, Square, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { useAuth } from '@/api/auth'
import { captureUser, StaleSessionError } from '@/api/userContext'
import { useLive } from '@/api/live'
import { getMonitor, MONITOR_LIMIT, summarize, type MonitorEntry, type OpKind, type OpStatus } from '@/api/monitor'
import { clearSnapshots } from '@/api/persist'
import { Glass } from '@/components/glass/Glass'
import { confirm } from '@/components/ui/Confirm'
import { Seg } from '@/components/ui/Seg'
import { toast, toastError } from '@/components/ui/toast'
import { FetchSourceManga, Sources } from '@/features/browse/queries'
import { LibraryMangas, SetInLibrary } from '@/features/library/queries'
import { Row, Section, Select, Switch, TextInput } from '@/features/settings/parts'
import { isPreview } from '@/lib/channel'
import { isDevLab } from '@/lib/demo'
import { clock, formatDate } from '@/lib/format'
import {
  clampSettings,
  collectCandidates,
  DEFAULT_SETTINGS,
  MAX_SETTINGS,
  planImport,
  runBatches,
  sameRequest,
  type Candidate,
  type ImportPlan,
  type ImportRequest,
  type ImportSettings,
  type RunResult,
} from './importPlan'
import { DevToolsLibraryTitles, DevToolsPing } from './queries'
import { clearRecords, downloadJson, loadRecords, saveRecord, type ImportRecord } from './records'

type Mode = 'POPULAR' | 'LATEST' | 'SEARCH'
const MODE_LABEL: Record<Mode, string> = { POPULAR: '热门', LATEST: '最新', SEARCH: '搜索' }

/**
 * 开发者工具箱：只在 Preview 构建和本地开发里注册路由，正式构建不包含这个页面。
 * Preview 和日用版共用同一个 Suwayomi，这里的写入都是真实数据；访问由 Preview 的访问密码和登录把关。
 */
export function DevToolsPage() {
  return (
    <div className="wrap pb-20">
      <div className="pt-9 pb-8">
        <h1 className="m-0 font-cjk text-[40px] font-black max-sm:text-[32px]">开发者工具箱</h1>
        <p className="mt-1 mb-0 max-w-[62ch] text-sm text-muted">
          {isPreview ? 'Preview 环境' : '本地开发环境'} · {isDevLab ? '虚构验收页' : <>后端 <span className="num">{location.origin}/api</span></>} · 构建{' '}
          <span className="num">{__APP_COMMIT__}</span>
        </p>
        <p className="mt-1 mb-0 max-w-[62ch] text-[13px] text-faint">
          {/* 验收页复用这个页面，但来源、版本和写入结果都是本机生成的，不能沿用真实后端的风险提示 */}
          {isDevLab
            ? '这是虚构验收页：服务端版本、来源、书库和加入结果都在本机生成，不连接 Suwayomi，任何操作都不会写到真实书库。'
            : '这里连的是和日用版同一个 Suwayomi：加入书库等写入都是真实数据，其他设备和账号也会看到。批量删除、换源、恢复备份等高风险操作不在这里提供，需要时用独立的测试服务端。'}
        </p>
      </div>
      <Diagnostics />
      <RequestMonitor />
      <MockData />
      <BulkImport />
      <LocalCache />
    </div>
  )
}

function Diagnostics() {
  const client = useApolloClient()
  const { data, error } = useQuery(DevToolsPing)
  const connected = useLive((s) => s.connected)
  const [latency, setLatency] = useState<string | null>(null)
  const [testing, setTesting] = useState(false)
  const a = data?.aboutServer

  // 连测 5 次取中位数，单次结果受偶发抖动影响太大
  const measure = async () => {
    setTesting(true)
    const times: number[] = []
    try {
      for (let i = 0; i < 5; i++) {
        const t = performance.now()
        await client.query({ query: DevToolsPing, fetchPolicy: 'network-only' })
        times.push(performance.now() - t)
      }
      times.sort((x, y) => x - y)
      setLatency(`中位 ${Math.round(times[2])} ms · 最快 ${Math.round(times[0])} ms · 最慢 ${Math.round(times[4])} ms`)
    } catch (e) {
      setLatency(null)
      toastError('请求失败', e)
    } finally {
      setTesting(false)
    }
  }

  return (
    <Section title="环境诊断" desc="只显示版本和连接情况，不显示令牌、Cookie 或书库内容。">
      <Row label="前端">
        <span className="text-muted num">
          {isPreview ? 'Preview' : '开发'} · {__APP_COMMIT__} · {formatDate(Date.parse(__APP_BUILT_AT__))}
        </span>
      </Row>
      <Row label="Suwayomi 服务端">
        <span className="text-muted num">{a ? `${a.name} ${a.version} · ${a.buildType}` : error ? '连接失败' : '…'}</span>
      </Row>
      <Row label="实时连接" hint="下载、更新等实时推送用的 WebSocket">
        <span className="text-muted">{connected ? '已连接' : '未连接'}</span>
      </Row>
      <Row label="请求延迟" hint={latency ?? '连续请求 5 次服务端版本，统计往返耗时'}>
        <button type="button" className="gbtn plain rounded-full" onClick={() => void measure()} disabled={testing}>
          <Activity className="size-[18px]" strokeWidth={1.8} />
          {testing ? '测量中…' : '测一次'}
        </button>
      </Row>
    </Section>
  )
}

const KIND_LABEL: Record<OpKind, string> = { query: '查询', mutation: '修改', subscription: '订阅' }
const STATUS_LABEL: Record<OpStatus, string> = { pending: '进行中', ok: '成功', error: '失败', cancelled: '已取消' }
const RECENT = 50
const hms = (t: number) => new Date(t).toLocaleTimeString('zh-CN', { hour12: false })

/** 记录这个页面发出的 GraphQL 请求；记录本身见 api/monitor.ts，只有名字、耗时和结果 */
function RequestMonitor() {
  const m = getMonitor()
  const entries = useSyncExternalStore(m.subscribe, m.snapshot)
  const on = useSyncExternalStore(m.subscribe, () => m.enabled)
  const stats = useMemo(() => summarize(entries), [entries])
  const recent = useMemo(() => entries.slice(-RECENT).reverse(), [entries])
  const failed = stats.reduce((n, s) => n + s.errors, 0)
  const pending = stats.reduce((n, s) => n + s.pending, 0)
  return (
    <Section
      title="请求监视"
      desc={`记录这个页面发出的 GraphQL 请求：操作名、类型、耗时、结果和变量名，不记变量值、请求头和返回内容。只存在内存里，最多 ${MONITOR_LIMIT} 条，刷新即清空；命中缓存的查询不经过网络，不会出现在这里。`}
      action={
        entries.length > 0 && (
          <button type="button" className="gbtn plain rounded-full" onClick={m.clear}>
            <Trash2 className="size-[18px]" strokeWidth={1.8} />
            清空
          </button>
        )
      }
    >
      <Row
        label="记录请求"
        hint={on || entries.length ? `已记录 ${entries.length} 次 · 失败 ${failed} · 进行中 ${pending}` : '默认关闭；打开后在站内切到其他页面也会继续记录，回到这里查看'}
      >
        <Switch on={on} onChange={m.setEnabled} label="记录请求" />
      </Row>
      {stats.length > 0 && (
        <details open className="text-[13px]">
          <summary className="cursor-pointer text-muted">按操作汇总（{stats.length}）</summary>
          <ul className="mt-2 mb-0 flex list-none flex-col gap-1.5 pl-0">
            {stats.map((s) => (
              <li key={`${s.kind}:${s.name}`} className="flex flex-wrap items-baseline gap-x-3">
                <span className="min-w-0 truncate font-semibold">{s.name}</span>
                {s.kind !== 'query' && <span className="text-faint">{KIND_LABEL[s.kind]}</span>}
                <span className="num text-muted">
                  {s.count} 次{s.errors > 0 && <span className="text-danger"> · 失败 {s.errors}</span>}
                  {s.avgMs != null && ` · 平均 ${s.avgMs} ms · P95 ${s.p95Ms} ms · 最长 ${s.maxMs} ms`}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
      {recent.length > 0 && (
        <details className="text-[13px]">
          <summary className="cursor-pointer text-muted">最近 {recent.length} 次</summary>
          <ul className="mt-2 mb-0 flex max-h-96 list-none flex-col gap-1.5 overflow-y-auto pl-0">
            {recent.map((e) => (
              <RequestLine key={e.id} e={e} />
            ))}
          </ul>
        </details>
      )}
    </Section>
  )
}

function RequestLine({ e }: { e: MonitorEntry }) {
  return (
    <li className="flex flex-wrap items-baseline gap-x-3">
      <span className="num text-faint">{hms(e.at)}</span>
      <span className="min-w-0 truncate font-medium">{e.name}</span>
      <span className={e.status === 'error' ? 'text-danger' : 'text-muted'}>
        {e.kind !== 'query' && `${KIND_LABEL[e.kind]} · `}
        {STATUS_LABEL[e.status]}
        {e.ms != null && <span className="num"> · {e.ms} ms</span>}
        {e.kind === 'subscription' && e.events > 0 && <span className="num"> · {e.events} 条推送</span>}
      </span>
      {e.vars.length > 0 && <span className="min-w-0 truncate text-faint">变量 {e.vars.join('、')}</span>}
      {e.error && <span className="basis-full break-all text-muted">{e.error}</span>}
    </li>
  )
}

const SCALES = [100, 1000, 10_000] as const

/** 虚构验收页：各自用本机生成的数据，不登录、不请求服务端 */
const LABS = [
  { path: '/dev/devtools', label: '开发者工具箱', hint: '预演、分批、停止、失败中止与导入记录' },
  { path: '/dev/source-filters', label: '来源筛选', hint: '各类筛选控件与搜索' },
  { path: '/dev/extensions', label: '扩展管理', hint: '安装、更新、卸载的各种状态' },
  { path: '/dev/migrate', label: '换源迁移', hint: '候选匹配与迁移选项' },
  { path: '/dev/history', label: '阅读历史', hint: '分组、隐藏与长列表' },
  { path: '/dev/downloads', label: '下载队列', hint: '排队、进度、失败与重排' },
  { path: '/dev/tracking', label: '追踪', hint: '登录、绑定、进度与评分' },
  { path: '/dev/reader-gestures', label: '阅读器手势', hint: '翻页、缩放与边缘点击' },
  { path: '/dev/settings-layout', label: '设置布局', hint: '设置分栏与阅读器设置面板' },
]

/**
 * 虚构数据入口：都是整页跳转。演示和验收页在页面加载时决定用哪个客户端、哪套存储，
 * 用站内路由切过去会沿用当前的真实登录和缓存
 */
function MockData() {
  const [scale, setScale] = useState<(typeof SCALES)[number]>(1000)
  const [edge, setEdge] = useState(true)
  const demo = `/demo/library?scale=${scale}${edge ? '&edge=1' : ''}`
  return (
    <Section
      title="虚构数据"
      desc="在本机生成虚构书库，不登录、不连接服务端，也读不到真实书库；断网或服务端停机时同样能用。改动只存在这次打开的页面里，刷新即恢复。"
    >
      <Row label="大书库演示" hint="在演示书库上再生成指定数量的作品；一万部时每部话数会减少，总共约十万话，打开要几秒、内存占用较高">
        <Seg
          label="作品数量"
          glass={false}
          value={scale}
          onChange={setScale}
          items={SCALES.map((n) => ({ value: n, label: n.toLocaleString() }))}
        />
      </Row>
      <Row label="边界作品" hint="超长标题、无封面、封面失效、5000 话、零话、混排文字，以及无分类 / 多分类组合">
        <Switch on={edge} onChange={setEdge} label="边界作品" />
      </Row>
      <div className="flex flex-wrap gap-2.5">
        <Glass as="a" href={demo} className="gbtn rounded-full no-underline">
          <FlaskConical className="size-[18px]" strokeWidth={1.8} />
          打开虚构书库
        </Glass>
      </div>
      {LABS.map((lab) => (
        <Row key={lab.path} label={lab.label} hint={lab.hint}>
          <a href={lab.path} className="gbtn plain rounded-full no-underline">
            <ExternalLink className="size-[18px]" strokeWidth={1.8} />
            打开
          </a>
        </Row>
      ))}
    </Section>
  )
}

/** 预演结果连同当时的导入条件 */
type Planned = ImportPlan & { req: ImportRequest }

type Phase =
  | { k: 'idle' }
  | { k: 'collecting'; page: number; total: number }
  | { k: 'planned'; plan: Planned; note?: string }
  | { k: 'running'; plan: Planned; progress: RunResult }
  | { k: 'done'; plan: Planned; result: RunResult; record: ImportRecord }

function BulkImport() {
  const client = useApolloClient()
  const { data: sourcesData } = useQuery(Sources)
  // 本地来源（id 0）读的是服务器上的文件，批量导入没有意义
  const sources = useMemo(() => (sourcesData?.sources.nodes ?? []).filter((s) => s.id !== '0'), [sourcesData])
  const [sourceId, setSourceId] = useState('')
  const source = sources.find((s) => s.id === sourceId) ?? sources[0]
  const [mode, setMode] = useState<Mode>('POPULAR')
  const [query, setQuery] = useState('')
  const [raw, setRaw] = useState<Record<keyof ImportSettings, string>>(() => ({
    pages: String(DEFAULT_SETTINGS.pages),
    limit: String(DEFAULT_SETTINGS.limit),
    batch: String(DEFAULT_SETTINGS.batch),
    delay: String(DEFAULT_SETTINGS.delay),
  }))
  const settings = clampSettings(Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, v === '' ? undefined : Number(v)])))
  const [phase, setPhase] = useState<Phase>({ k: 'idle' })
  const [records, setRecords] = useState(() => loadRecords())
  const abort = useRef<AbortController | null>(null)
  // 离开页面或换账号时停下：卸载不会结束已在跑的循环，不停的话剩下的批次会在后台继续写，换人后还会带着新账号的令牌
  useEffect(() => {
    const off = useAuth.subscribe((s, prev) => {
      if (s.user?.id !== prev.user?.id) abort.current?.abort()
    })
    return () => {
      off()
      abort.current?.abort()
    }
  }, [])
  const effectiveMode: Mode = mode === 'LATEST' && source && !source.supportsLatest ? 'POPULAR' : mode
  const busy = phase.k === 'collecting' || phase.k === 'running'
  const current = { sourceId: source?.id ?? '', type: effectiveMode, query: effectiveMode === 'SEARCH' ? query.trim() : '' }
  // 预演后改了来源、方式或搜索词：旧预演作废，必须重新预演才能加入
  const stale = phase.k === 'planned' && !sameRequest(phase.plan.req, current)
  useEffect(() => {
    if (stale) setPhase({ k: 'idle' })
  }, [stale])

  const dryRun = async () => {
    if (!source) return
    if (effectiveMode === 'SEARCH' && !query.trim()) return toast('先输入搜索词', 'error')
    const req: ImportRequest = { ...current, sourceName: source.displayName }
    const ctl = new AbortController()
    abort.current = ctl
    setPhase({ k: 'collecting', page: 0, total: 0 })
    const still = captureUser()
    try {
      const got = await collectCandidates(
        async (page) => {
          const { data } = await client.mutate({
            mutation: FetchSourceManga,
            variables: { source: req.sourceId, type: req.type, page, query: req.type === 'SEARCH' ? req.query : null },
          })
          const r = data?.fetchSourceManga
          return { items: (r?.mangas ?? []).map((m): Candidate => ({ id: m.id, title: m.title, inLibrary: m.inLibrary })), hasNext: !!r?.hasNextPage }
        },
        { ...settings, signal: ctl.signal, onPage: (page, total) => setPhase({ k: 'collecting', page, total }) },
      )
      still()
      if (got.cancelled && !got.items.length) return setPhase({ k: 'idle' })
      const lib = await client.query({ query: DevToolsLibraryTitles, fetchPolicy: 'network-only' })
      still()
      const plan: Planned = { ...planImport(got.items, lib.data?.mangas.nodes ?? [], settings.limit), req }
      const notes = [
        `翻了 ${got.pages} 页${got.more ? '，来源还有更多' : ''}`,
        got.cancelled && '已停止，后面的页没有再请求',
        got.error != null && `第 ${got.pages + 1} 页重试后仍失败：${got.error instanceof Error ? got.error.message : String(got.error)}`,
      ].filter(Boolean)
      setPhase({ k: 'planned', plan, note: notes.join('；') })
    } catch (e) {
      if (!(e instanceof StaleSessionError)) toastError('预演失败', e)
      setPhase({ k: 'idle' })
    } finally {
      abort.current = null
    }
  }

  const run = async (plan: Planned, ids: number[]) => {
    const { req } = plan
    const ok = await confirm({
      title: `把 ${ids.length} 部加入书库？`,
      body: `来自「${req.sourceName}」，每批 ${settings.batch} 部、间隔 ${settings.delay / 1000} 秒。加入后不会自动撤销；需要时到导入记录里导出清单，再人工移出。`,
      ok: '加入书库',
    })
    if (!ok) return
    const ctl = new AbortController()
    abort.current = ctl
    const userId = useAuth.getState().user?.id
    const empty: RunResult = { done: [], failed: [], skipped: [] }
    setPhase({ k: 'running', plan, progress: empty })
    const result = await runBatches(
      ids,
      async (batch) => {
        await client.mutate({ mutation: SetInLibrary, variables: { ids: batch, inLibrary: true } })
      },
      { ...settings, signal: ctl.signal, onProgress: (progress) => setPhase({ k: 'running', plan, progress }) },
    )
    abort.current = null
    // 入库结果只更新漫画本身，不会插进已缓存的书库列表；此时书库、首页都已卸载，按名字 refetch 刷不到，
    // 直接向服务端重取一次写回缓存（换了账号就不取，免得用新令牌查）
    if (result.done.length && useAuth.getState().user?.id === userId)
      void client.query({ query: LibraryMangas, fetchPolicy: 'network-only' }).catch(() => {})
    const title = new Map(plan.toAdd.map((c) => [c.id, c.title]))
    const pick = (list: number[]) => list.map((id) => ({ id, title: title.get(id) ?? '' }))
    const record: ImportRecord = {
      at: Date.now(),
      source: req.sourceName,
      mode: MODE_LABEL[req.type] + (req.type === 'SEARCH' ? `「${req.query}」` : ''),
      added: pick(result.done),
      failed: pick(result.failed),
      skipped: result.skipped.length,
      stopped: result.stopped,
    }
    const saved = saveRecord(record, userId)
    if (useAuth.getState().user?.id === userId) setRecords(saved)
    setPhase({ k: 'done', plan, result, record })
    if (result.failed.length) toastError(`${result.failed.length} 部加入失败`, result.lastError)
    else toast(`已加入 ${result.done.length} 部`)
  }

  const num = (k: keyof ImportSettings, label: string, suffix: string, hint: string) => (
    <Row label={label} hint={`${hint}；上限 ${MAX_SETTINGS[k]} ${suffix}`}>
      <TextInput
        type="number"
        inputMode="numeric"
        min={1}
        max={MAX_SETTINGS[k]}
        value={raw[k]}
        disabled={busy}
        onChange={(e) => setRaw((r) => ({ ...r, [k]: e.target.value }))}
        onBlur={() => setRaw((r) => ({ ...r, [k]: String(settings[k]) }))}
        suffix={suffix}
        aria-label={label}
        className="w-[150px]"
      />
    </Row>
  )

  return (
    <>
      <Section
        title={isDevLab ? '批量导入（虚构来源）' : '批量导入真实漫画'}
        desc="先预演：从来源取候选、和书库比对，列出会加入哪些；确认后才分批加入书库。预演会真实请求漫画来源，Suwayomi 也会把取到的作品记进自己的数据库（和在「发现」里浏览一样），但不会加入书库。"
      >
        <Row label="来源">
          <Select
            label="来源"
            value={source?.id ?? ''}
            options={sources.length ? sources.map((s) => ({ value: s.id, label: s.displayName })) : [{ value: '', label: '没有已安装的来源' }]}
            onChange={(v) => setSourceId(v)}
            className="w-[260px] max-sm:w-full"
          />
        </Row>
        <Row label="获取方式" hint={source && !source.supportsLatest ? '这个来源不支持「最新」' : undefined}>
          <Seg
            label="获取方式"
            glass={false}
            value={effectiveMode}
            onChange={setMode}
            items={(['POPULAR', 'LATEST', 'SEARCH'] as Mode[])
              .filter((m) => m !== 'LATEST' || source?.supportsLatest !== false)
              .map((m) => ({ value: m, label: MODE_LABEL[m] }))}
          />
        </Row>
        {effectiveMode === 'SEARCH' && (
          <Row label="搜索词">
            <TextInput value={query} onChange={(e) => setQuery(e.target.value)} disabled={busy} aria-label="搜索词" className="w-[260px] max-sm:w-full" />
          </Row>
        )}
        {num('pages', '最多翻页', '页', '一页一页取，不并发')}
        {num('limit', '最多加入', '部', '超出的这次不加')}
        {num('batch', '每批', '部', '每次入库请求包含的数量')}
        {num('delay', '请求间隔', 'ms', '每页、每批之间至少等这么久；失败时加倍退避')}
        <div className="flex flex-wrap gap-2.5">
          {busy ? (
            <Glass as="button" type="button" className="gbtn rounded-full" onClick={() => abort.current?.abort()}>
              <Square className="size-[16px]" strokeWidth={2} />
              停止
            </Glass>
          ) : (
            <Glass as="button" type="button" className="gbtn rounded-full" disabled={!source} onClick={() => void dryRun()}>
              <Search className="size-[18px]" strokeWidth={1.8} />
              预演
            </Glass>
          )}
        </div>
        <ImportStatus phase={phase} onRun={run} />
      </Section>
      <Records records={records} onClear={() => (clearRecords(), setRecords([]))} />
    </>
  )
}

function ImportStatus({ phase, onRun }: { phase: Phase; onRun: (plan: Planned, ids: number[]) => void }) {
  if (phase.k === 'idle') return null
  if (phase.k === 'collecting')
    return (
      <p className="m-0 text-sm text-muted" role="status">
        正在取第 {phase.page + 1} 页…已取到 {phase.total} 条
      </p>
    )
  const { plan } = phase
  const summary = (
    <div className="flex flex-col gap-2 text-sm" role="status">
      <div className="flex flex-wrap gap-x-5 gap-y-1">
        <Stat label="候选" value={plan.fetched} />
        <Stat label="待加入" value={plan.toAdd.length} strong />
        <Stat label="已在书库" value={plan.inLibrary.length} />
        <Stat label="同名跳过" value={plan.sameTitle.length} />
        <Stat label="跨页重复" value={plan.repeated} />
        <Stat label="超出上限" value={plan.overLimit.length} />
      </div>
      {phase.k === 'planned' && phase.note && <p className="m-0 text-[13px] text-faint">{phase.note}</p>}
      <TitleList label="待加入" items={plan.toAdd.map((c) => c.title)} open={phase.k === 'planned'} />
      <TitleList
        label="同名跳过"
        items={plan.sameTitle.map((s) => `${s.candidate.title}（书库已有：${s.matches.map((m) => m.title).join('、')}）`)}
      />
      <TitleList label="已在书库" items={plan.inLibrary.map((c) => c.title)} />
    </div>
  )
  if (phase.k === 'planned')
    return (
      <>
        {summary}
        <div>
          <Glass
            as="button"
            type="button"
            className="gbtn rounded-full"
            disabled={!plan.toAdd.length}
            onClick={() => onRun(plan, plan.toAdd.map((c) => c.id))}
          >
            <LibraryBig className="size-[18px]" strokeWidth={1.8} />
            加入书库（{plan.toAdd.length} 部）
          </Glass>
        </div>
      </>
    )
  const r = phase.k === 'running' ? phase.progress : phase.result
  const total = plan.toAdd.length
  return (
    <>
      {summary}
      <div className="flex flex-col gap-2" role="status">
        <div className="h-1.5 overflow-hidden rounded-full bg-accent-soft">
          <div className="h-full bg-text transition-[width] duration-300" style={{ width: `${((r.done.length + r.failed.length) / Math.max(1, total)) * 100}%` }} />
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
          <Stat label="成功" value={r.done.length} strong />
          <Stat label="失败" value={r.failed.length} />
          {phase.k === 'done' && <Stat label="未提交" value={r.skipped.length} />}
        </div>
        {phase.k === 'running' && <p className="m-0 text-[13px] text-faint">正在分批加入…停止后不再提交新的批次，已发出的那一批会完成。</p>}
        {phase.k === 'done' && r.stopped && (
          <p className="m-0 text-[13px] text-faint">{r.stopped === 'cancelled' ? '已停止，剩下的没有提交。' : '连续两批失败，已中止，剩下的没有提交。'}</p>
        )}
      </div>
      {phase.k === 'done' && (
        <div className="flex flex-wrap gap-2.5">
          {r.failed.length + r.skipped.length > 0 && (
            <Glass as="button" type="button" className="gbtn rounded-full" onClick={() => onRun(plan, [...r.failed, ...r.skipped])}>
              <RotateCcw className="size-[18px]" strokeWidth={1.8} />
              重试失败和未提交（{r.failed.length + r.skipped.length}）
            </Glass>
          )}
          <button type="button" className="gbtn plain rounded-full" onClick={() => exportRecord(phase.record)}>
            <Download className="size-[18px]" strokeWidth={1.8} />
            导出结果
          </button>
        </div>
      )}
    </>
  )
}

function Stat({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <span className={strong ? 'font-semibold' : 'text-muted'}>
      {label} <span className="num">{value}</span>
    </span>
  )
}

function TitleList({ label, items, open }: { label: string; items: string[]; open?: boolean }) {
  if (!items.length) return null
  return (
    <details open={open} className="text-[13px]">
      <summary className="cursor-pointer text-muted">
        {label}（{items.length}）
      </summary>
      <ul className="mt-1.5 mb-0 max-h-60 list-none overflow-y-auto pl-0 leading-relaxed text-muted">
        {items.map((t, i) => (
          <li key={i} className="truncate">
            {t}
          </li>
        ))}
      </ul>
    </details>
  )
}

const exportRecord = (r: ImportRecord) => downloadJson(`sukimi-import-${new Date(r.at).toISOString().replace(/[:.]/g, '-')}.json`, r)

function Records({ records, onClear }: { records: ImportRecord[]; onClear: () => void }) {
  return (
    <Section
      title="导入记录"
      desc="保存在本浏览器，最近 20 次。记录只用来事后定位加了哪些作品，不能自动撤销：加入后可能已经有阅读进度、分类等其他改动。"
      action={
        records.length > 0 && (
          <button type="button" className="gbtn plain rounded-full" onClick={onClear}>
            <Trash2 className="size-[18px]" strokeWidth={1.8} />
            清空记录
          </button>
        )
      }
    >
      {records.length ? (
        records.map((r) => (
          <Row
            key={r.at}
            label={<span className="num">{formatDate(r.at)} {clock(r.at)}</span>}
            hint={`${r.source} · ${r.mode} · 加入 ${r.added.length} 部${r.failed.length ? ` · 失败 ${r.failed.length}` : ''}${r.skipped ? ` · 未提交 ${r.skipped}` : ''}`}
          >
            <button type="button" className="gbtn plain rounded-full" onClick={() => exportRecord(r)}>
              <Download className="size-[18px]" strokeWidth={1.8} />
              导出
            </button>
          </Row>
        ))
      ) : (
        <p className="m-0 text-sm text-faint">还没有导入过</p>
      )}
    </Section>
  )
}

function LocalCache() {
  const client = useApolloClient()
  const [busy, setBusy] = useState(false)
  const clear = async () => {
    const ok = await confirm({
      title: '清空本地数据缓存？',
      body: '清掉本浏览器里的书库快照和内存缓存，然后重新向服务端请求。登录状态、偏好设置和导入记录保留。',
      ok: '清空',
      local: true,
    })
    if (!ok) return
    setBusy(true)
    try {
      // 虚构验收页不碰本机真实登录留下的快照，只清它自己的模拟缓存
      if (!isDevLab) await clearSnapshots()
      await client.resetStore()
      toast('本地缓存已清空')
    } catch (e) {
      toastError('清空失败', e)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Section title="本地缓存" desc={<LocalCacheNote />}>
      <Row label="清空数据缓存" hint="IndexedDB 书库快照 + Apollo 内存缓存">
        <button type="button" className="gbtn plain rounded-full" onClick={() => void clear()} disabled={busy}>
          <Trash2 className="size-[18px]" strokeWidth={1.8} />
          清空
        </button>
      </Row>
    </Section>
  )
}

function LocalCacheNote(): ReactNode {
  return (
    <>
      只影响当前这个浏览器、当前域名{isPreview && '（Preview 与日用版的本地存储互不相通）'}。这不是服务端回滚，也不会清理服务端的图片或来源缓存。
    </>
  )
}
