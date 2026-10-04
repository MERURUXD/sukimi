import { useMutation, useQuery } from '@apollo/client/react'
import { RefreshCw } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { graphql } from '@/api/gql'
import type { KoreaderSyncConflictStrategy, SyncState } from '@/api/gql/graphql'
import { Glass } from '@/components/glass/Glass'
import { toast, toastError } from '@/components/ui/toast'
import { timeAgo } from '@/lib/format'
import { SChoice, SDuration, SNumber, SSecret, SSwitch, SText } from '../fields'
import { Row, Section, TextInput } from '../parts'

const LastSync = graphql(`
  query LastSync {
    lastSyncStatus {
      state
      startDate
      endDate
      errorMessage
    }
  }
`)

const StartSync = graphql(`
  mutation StartSync {
    startSync(input: {}) {
      result
    }
  }
`)

const KoSyncStatus = graphql(`
  query KoSyncStatus {
    koSyncStatus {
      isLoggedIn
      serverAddress
      username
    }
  }
`)

const ConnectKoSync = graphql(`
  mutation ConnectKoSync($input: ConnectKoSyncAccountInput!) {
    connectKoSyncAccount(input: $input) {
      message
      status {
        isLoggedIn
        serverAddress
        username
      }
    }
  }
`)

const LogoutKoSync = graphql(`
  mutation LogoutKoSync {
    logoutKoSyncAccount(input: {}) {
      status {
        isLoggedIn
        serverAddress
        username
      }
    }
  }
`)

const SYNC_STATE: Record<SyncState, string> = {
  STARTED: '已开始',
  CREATING_BACKUP: '正在打包本地数据',
  DOWNLOADING: '正在下载远端数据',
  MERGING: '正在合并',
  UPLOADING: '正在上传',
  RESTORING: '正在写入',
  SUCCESS: '成功',
  ERROR: '失败',
}

const STRATEGIES: { value: KoreaderSyncConflictStrategy; label: string }[] = [
  { value: 'PROMPT', label: '询问' },
  { value: 'KEEP_LOCAL', label: '保留这里的' },
  { value: 'KEEP_REMOTE', label: '使用 KOReader 的' },
  { value: 'DISABLED', label: '不处理' },
]

export function SyncTab() {
  return (
    <>
      <SyncYomiSection />
      <KoReaderSection />
    </>
  )
}

function SyncYomiSection() {
  const last = useQuery(LastSync, { fetchPolicy: 'cache-and-network' })
  const [start, { loading }] = useMutation(StartSync)
  const s = last.data?.lastSyncStatus

  const syncNow = async () => {
    try {
      const r = await start()
      const result = r.data?.startSync.result
      toast(result === 'SUCCESS' ? '已开始同步' : result === 'SYNC_IN_PROGRESS' ? '正在同步中' : '同步没有开启')
      setTimeout(() => void last.refetch(), 3000)
    } catch (e) {
      toastError('同步失败', e)
    }
  }

  return (
    <Section
      title="SyncYomi"
      desc="通过自建的 SyncYomi 服务，和 Mihon 等其他设备同步书库与阅读进度。"
      action={
        <Glass as="button" type="button" className="gbtn rounded-full" onClick={() => void syncNow()} disabled={loading}>
          <RefreshCw className="size-[18px]" strokeWidth={1.8} />
          立即同步
        </Glass>
      }
    >
      {s && (
        <p className="m-0 text-sm text-muted">
          上次同步：{SYNC_STATE[s.state]} · {timeAgo(Number(s.endDate ?? s.startDate))}
          {s.errorMessage && ` · ${s.errorMessage}`}
        </p>
      )}
      <SSwitch k="syncYomiEnabled" label="启用 SyncYomi" />
      <SText k="syncYomiHost" label="服务地址" placeholder="https://" width="w-[280px]" />
      <SSecret k="syncYomiApiKey" label="API Key" />
      <SDuration k="syncInterval" label="自动同步间隔" unit="min" hint="0 表示只手动同步" />
      <SSwitch k="syncDataManga" label="同步漫画" />
      <SSwitch k="syncDataChapters" label="同步章节与进度" />
      <SSwitch k="syncDataHistory" label="同步阅读历史" />
      <SSwitch k="syncDataCategories" label="同步分类" />
      <SSwitch k="syncDataTracking" label="同步追踪" />
    </Section>
  )
}

function KoReaderSection() {
  const { data } = useQuery(KoSyncStatus)
  const [connect, { loading: connecting }] = useMutation(ConnectKoSync)
  const [logout] = useMutation(LogoutKoSync)
  const [form, setForm] = useState({ serverAddress: '', username: '', password: '' })
  const st = data?.koSyncStatus

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    try {
      const r = await connect({ variables: { input: form } })
      const res = r.data?.connectKoSyncAccount
      if (res?.status.isLoggedIn) {
        setForm({ serverAddress: '', username: '', password: '' })
        toast('已连接 KOReader 同步')
      } else toast(res?.message ?? '连接失败', 'error')
    } catch (err) {
      toastError('连接失败', err)
    }
  }

  return (
    <Section title="KOReader 同步" desc="和 KOReader 阅读器（电子书设备常用）同步阅读进度，使用 KOReader 的进度同步服务。">
      {st?.isLoggedIn ? (
        <Row label={`已连接：${st.username ?? ''}`} hint={st.serverAddress ?? undefined}>
          <Glass as="button" type="button" className="gbtn rounded-full" onClick={() => void logout().catch((e) => toastError('退出失败', e))}>
            断开
          </Glass>
        </Row>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-2.5">
          <TextInput
            placeholder="同步服务地址，例如 https://sync.koreader.rocks"
            value={form.serverAddress}
            onChange={(e) => setForm({ ...form, serverAddress: e.target.value })}
            aria-label="同步服务地址"
          />
          <div className="flex flex-wrap gap-2.5">
            <TextInput
              placeholder="用户名"
              autoComplete="off"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              className="flex-[1_1_180px]"
              aria-label="KOReader 用户名"
            />
            <TextInput
              type="password"
              placeholder="密码"
              autoComplete="new-password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="flex-[1_1_180px]"
              aria-label="KOReader 密码"
            />
            <button type="submit" className="solid min-h-11" disabled={connecting || !form.serverAddress || !form.username || !form.password}>
              连接
            </button>
          </div>
        </form>
      )}
      <SChoice k="koreaderSyncChecksumMethod" label="文档识别方式" hint="KOReader 用什么判断是同一话" options={[
        { value: 'BINARY', label: '文件内容' },
        { value: 'FILENAME', label: '文件名' },
      ]} />
      <SChoice<KoreaderSyncConflictStrategy> k="koreaderSyncStrategyForward" label="KOReader 进度更新时" options={STRATEGIES} />
      <SChoice<KoreaderSyncConflictStrategy> k="koreaderSyncStrategyBackward" label="KOReader 进度更旧时" options={STRATEGIES} />
      <SNumber k="koreaderSyncPercentageTolerance" label="进度差异容忍度" integer={false} min={0} max={1} hint="两边进度相差小于这个比例（0–1）时视为相同" />
    </Section>
  )
}
