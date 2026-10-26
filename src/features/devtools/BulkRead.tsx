import { useApolloClient, useQuery } from '@apollo/client/react'
import { BookCheck, BookOpen, Search, Square } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { UpdateChapters } from '@/api/chapters'
import { useAuth } from '@/api/auth'
import { captureUser, StaleSessionError } from '@/api/userContext'
import { Glass } from '@/components/glass/Glass'
import { confirm } from '@/components/ui/Confirm'
import { Seg } from '@/components/ui/Seg'
import { toast, toastError } from '@/components/ui/toast'
import { Categories, LibraryMangas } from '@/features/library/queries'
import { Row, Section, Select } from '@/features/settings/parts'
import { isDevLab } from '@/lib/demo'
import { runBatches, type RunResult } from './importPlan'
import { DevToolsPing, DevToolsReadTargets } from './queries'
import { planRead, READ_BATCH, READ_DELAY, READ_LIMIT, readPatch, readTargetFilter, type ReadPlan, type ReadScope } from './readPlan'

/** 预演结果连同当时的条件；确认和写入都以它为准，不读之后改过的选项 */
type Planned = ReadPlan & { isRead: boolean; scope: ReadScope; scopeName: string }

type Phase =
  | { k: 'idle' }
  | { k: 'planning' }
  | { k: 'planned'; plan: Planned }
  | { k: 'running'; plan: Planned; progress: RunResult }
  | { k: 'done'; plan: Planned; result: RunResult }

const verb = (isRead: boolean) => (isRead ? '已读' : '未读')

/**
 * 批量已读 / 未读：会一次改掉整个书库的阅读状态，只在声明连独立测试服务端的构建（SUKIMI_TEST_INSTANCE=1）
 * 和本机虚构验收页里提供；连日用书库的 Preview 和本地开发只显示说明，见 DevToolsPage。
 * 不同步追踪网站：测试服务端上绑定的追踪也只是测试数据，批量写过去只会污染真实账号。
 */
export function BulkRead() {
  const client = useApolloClient()
  const { data: cats } = useQuery(Categories)
  const { data: about } = useQuery(DevToolsPing)
  const [isRead, setIsRead] = useState(true)
  const [scope, setScope] = useState<ReadScope>('all')
  const [phase, setPhase] = useState<Phase>({ k: 'idle' })
  const abort = useRef<AbortController | null>(null)
  // 和批量导入一样：离开页面或换账号就停下，剩下的批次不再用新账号的令牌提交
  useEffect(() => {
    const off = useAuth.subscribe((s, prev) => {
      if (s.user?.id !== prev.user?.id) abort.current?.abort()
    })
    return () => {
      off()
      abort.current?.abort()
    }
  }, [])
  const categories = cats?.categories.nodes ?? []
  const scopeName = scope === 'all' ? '整个书库' : (categories.find((c) => c.id === scope)?.name ?? `分类 ${scope}`)
  const busy = phase.k === 'planning' || phase.k === 'running'
  // 改了操作或范围，旧预演和上次的结果都作废，免得把旧数字当成新条件的结果
  const stale = (phase.k === 'planned' || phase.k === 'done') && (phase.plan.isRead !== isRead || phase.plan.scope !== scope)
  useEffect(() => {
    if (stale) setPhase({ k: 'idle' })
  }, [stale])

  const dryRun = async () => {
    setPhase({ k: 'planning' })
    const still = captureUser()
    try {
      const { data } = await client.query({ query: DevToolsReadTargets, variables: { filter: readTargetFilter(isRead) }, fetchPolicy: 'network-only' })
      still()
      const mangas = (data?.mangas.nodes ?? []).map((m) => ({ id: m.id, title: m.title, categoryIds: m.categories.nodes.map((c) => c.id) }))
      setPhase({ k: 'planned', plan: { ...planRead(mangas, data?.chapters.nodes ?? [], scope, { defaultId: categories.find((c) => c.default)?.id }), isRead, scope, scopeName } })
    } catch (e) {
      if (!(e instanceof StaleSessionError)) toastError('预演失败', e)
      setPhase({ k: 'idle' })
    }
  }

  const run = async (plan: Planned) => {
    const a = about?.aboutServer
    const user = useAuth.getState().user
    const ok = await confirm({
      title: `把 ${plan.ids.length} 话标为${verb(plan.isRead)}？`,
      // 服务端和账号写在确认框里，最后再让人看一眼连的是不是测试服务端
      body: `范围：${plan.scopeName}，涉及 ${plan.touched.length} 部。服务端：${a ? `${a.name} ${a.version}` : '未知'}${user?.username ? `，账号：${user.username}` : ''}。每批 ${READ_BATCH} 话，不会自动撤销，也不同步到追踪网站。`,
      ok: `标为${verb(plan.isRead)}`,
    })
    if (!ok) return
    const ctl = new AbortController()
    abort.current = ctl
    const userId = user?.id
    setPhase({ k: 'running', plan, progress: { done: [], failed: [], skipped: [] } })
    const result = await runBatches(
      plan.ids,
      async (ids) => {
        await client.mutate({ mutation: UpdateChapters, variables: { ids, patch: readPatch(plan.isRead) } })
      },
      { batch: READ_BATCH, delay: READ_DELAY, signal: ctl.signal, onProgress: (progress) => setPhase({ k: 'running', plan, progress }) },
    )
    abort.current = null
    // 未读数随返回的漫画字段进了缓存；书库列表和「继续阅读」等再向服务端取一次，换了账号就不取
    if (result.done.length && useAuth.getState().user?.id === userId)
      void client.query({ query: LibraryMangas, fetchPolicy: 'network-only' }).catch(() => {})
    setPhase({ k: 'done', plan, result })
    if (result.failed.length) toastError(`${result.failed.length} 话没有改成`, result.lastError)
    else toast(`已将 ${result.done.length} 话标为${verb(plan.isRead)}`)
  }

  return (
    <Section
      title={isDevLab ? '批量已读 / 未读（虚构书库）' : '批量已读 / 未读'}
      desc={`先预演：列出范围内哪些作品、多少话会改；确认后分批写入，可随时停止。一次最多 ${READ_LIMIT.toLocaleString()} 话，不能自动撤销。`}
    >
      <Row label="操作">
        <Seg
          label="操作"
          glass={false}
          value={isRead ? 'read' : 'unread'}
          onChange={(v) => setIsRead(v === 'read')}
          items={[
            { value: 'read', label: '标为已读' },
            { value: 'unread', label: '标为未读' },
          ]}
        />
      </Row>
      <Row label="范围" hint="按分类挑作品；「默认」是没有手动分过类的作品">
        <Select
          label="范围"
          value={String(scope)}
          options={[{ value: 'all', label: '整个书库' }, ...categories.map((c) => ({ value: String(c.id), label: c.name }))]}
          onChange={(v) => setScope(v === 'all' ? 'all' : Number(v))}
          className="w-[260px] max-sm:w-full"
        />
      </Row>
      <div className="flex flex-wrap gap-2.5">
        {phase.k === 'running' ? (
          <Glass flat as="button" type="button" className="gbtn rounded-full" onClick={() => abort.current?.abort()}>
            <Square className="size-[16px]" strokeWidth={2} />
            停止
          </Glass>
        ) : (
          <Glass flat as="button" type="button" className="gbtn rounded-full" disabled={busy} onClick={() => void dryRun()}>
            <Search className="size-[18px]" strokeWidth={1.8} />
            预演
          </Glass>
        )}
      </div>
      <ReadStatus phase={phase} onRun={(plan) => void run(plan)} />
    </Section>
  )
}

function ReadStatus({ phase, onRun }: { phase: Phase; onRun: (plan: Planned) => void }) {
  if (phase.k === 'idle') return null
  if (phase.k === 'planning')
    return (
      <p className="m-0 text-sm text-muted" role="status">
        正在比对书库…
      </p>
    )
  const { plan } = phase
  const Icon = plan.isRead ? BookCheck : BookOpen
  const summary = (
    <div className="flex flex-col gap-2 text-sm" role="status">
      <div className="flex flex-wrap gap-x-5 gap-y-1">
        <Stat label="范围内作品" value={plan.mangas} />
        <Stat label="要改的作品" value={plan.touched.length} />
        <Stat label={`标为${verb(plan.isRead)}`} value={plan.ids.length} strong />
        {plan.overLimit > 0 && <Stat label="超出上限" value={plan.overLimit} />}
      </div>
      {plan.touched.length > 0 ? (
        <details open={phase.k === 'planned'} className="text-[13px]">
          <summary className="cursor-pointer text-muted">涉及作品（{plan.touched.length}）</summary>
          <ul className="mt-1.5 mb-0 max-h-60 list-none overflow-y-auto pl-0 leading-relaxed text-muted">
            {plan.touched.map((m) => (
              <li key={m.id} className="truncate">
                {m.title} <span className="num text-faint">· {m.chapters} 话</span>
              </li>
            ))}
          </ul>
        </details>
      ) : (
        <p className="m-0 text-[13px] text-faint">范围内没有需要改的章节，都已经是{verb(plan.isRead)}。</p>
      )}
    </div>
  )
  if (phase.k === 'planned')
    return (
      <>
        {summary}
        <div>
          <Glass flat as="button" type="button" className="gbtn rounded-full" disabled={!plan.ids.length} onClick={() => onRun(plan)}>
            <Icon className="size-[18px]" strokeWidth={1.8} />
            标为{verb(plan.isRead)}（{plan.ids.length} 话）
          </Glass>
        </div>
      </>
    )
  const r = phase.k === 'running' ? phase.progress : phase.result
  return (
    <>
      {summary}
      <div className="flex flex-col gap-2" role="status">
        <div className="h-1.5 overflow-hidden rounded-full bg-accent-soft">
          <div
            className="h-full bg-text transition-[width] duration-300"
            style={{ width: `${((r.done.length + r.failed.length) / Math.max(1, plan.ids.length)) * 100}%` }}
          />
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
          <Stat label="成功" value={r.done.length} strong />
          <Stat label="失败" value={r.failed.length} />
          {phase.k === 'done' && <Stat label="未提交" value={r.skipped.length} />}
        </div>
        {phase.k === 'running' && <p className="m-0 text-[13px] text-faint">正在分批写入…停止后不再提交新的批次，已发出的那一批会完成。</p>}
        {phase.k === 'done' && r.stopped && (
          <p className="m-0 text-[13px] text-faint">{r.stopped === 'cancelled' ? '已停止，剩下的没有提交。' : '连续两批失败，已中止，剩下的没有提交。'}</p>
        )}
        {phase.k === 'done' && <p className="m-0 text-[13px] text-faint">要继续或重试，重新预演一次：只会列出还没改成的章节。</p>}
      </div>
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
