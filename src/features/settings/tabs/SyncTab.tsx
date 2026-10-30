import { useMutation, useQuery } from '@apollo/client/react'
import { RefreshCw } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { graphql } from '@/api/gql'
import type { KoreaderSyncConflictStrategy, SyncState } from '@/api/gql/graphql'
import { toast, toastError } from '@/components/ui/toast'
import { timeAgo } from '@/lib/format'
import { SChoice, SDuration, SNumber, SSecret, SSwitch, SText } from '../fields'
import { Row, Section, TextInput } from '../parts'
import { t } from '@/i18n'

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
  STARTED: t('cfg.sync.state.STARTED'),
  CREATING_BACKUP: t('cfg.sync.state.CREATING_BACKUP'),
  DOWNLOADING: t('cfg.sync.state.DOWNLOADING'),
  MERGING: t('cfg.sync.state.MERGING'),
  UPLOADING: t('cfg.sync.state.UPLOADING'),
  RESTORING: t('cfg.sync.state.RESTORING'),
  SUCCESS: t('cfg.sync.state.SUCCESS'),
  ERROR: t('cfg.sync.state.ERROR'),
}

const STRATEGIES: { value: KoreaderSyncConflictStrategy; label: string }[] = [
  { value: 'PROMPT', label: t('cfg.sync.strategy.PROMPT') },
  { value: 'KEEP_LOCAL', label: t('cfg.sync.strategy.KEEP_LOCAL') },
  { value: 'KEEP_REMOTE', label: t('cfg.sync.strategy.KEEP_REMOTE') },
  { value: 'DISABLED', label: t('cfg.sync.strategy.DISABLED') },
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
      toast(result === 'SUCCESS' ? t('cfg.sync.started') : result === 'SYNC_IN_PROGRESS' ? t('cfg.sync.inProgress') : t('cfg.sync.notEnabled'))
      setTimeout(() => void last.refetch(), 3000)
    } catch (e) {
      toastError(t('cfg.sync.failed'), e)
    }
  }

  return (
    <Section
      title="SyncYomi"
      desc={t('cfg.sync.desc')}
      help={t('cfg.selfHelp')}
      action={
        <button type="button" className="gbtn plain min-h-9 rounded-full px-3.5 text-[13px]" onClick={() => void syncNow()} disabled={loading}>
          <RefreshCw className="size-4" strokeWidth={1.8} />
          {t('cfg.sync.now')}
        </button>
      }
    >
      {s && (
        <p className="m-0 text-[13px] leading-snug text-muted">
          {t('cfg.sync.last', { state: SYNC_STATE[s.state], time: timeAgo(Number(s.endDate ?? s.startDate)) })}
          {s.errorMessage && ` · ${s.errorMessage}`}
        </p>
      )}
      <SSwitch k="syncYomiEnabled" label={t('cfg.sync.enable')} aria={t('cfg.sync.enableAria')} />
      <SText k="syncYomiHost" label={t('cfg.sync.host')} placeholder="https://" width="w-[280px]" />
      <SSecret k="syncYomiApiKey" label="API Key" />
      <SDuration k="syncInterval" label={t('cfg.sync.interval')} unit="min" hint={t('cfg.sync.intervalHint')} />
      <SSwitch k="syncDataManga" label={t('cfg.sync.dataManga')} />
      <SSwitch k="syncDataChapters" label={t('cfg.sync.dataChapters')} />
      <SSwitch k="syncDataHistory" label={t('cfg.sync.dataHistory')} />
      <SSwitch k="syncDataCategories" label={t('cfg.sync.dataCategories')} />
      <SSwitch k="syncDataTracking" label={t('cfg.sync.dataTracking')} />
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
        toast(t('cfg.sync.koConnected'))
      } else toast(res?.message ?? t('cfg.sync.koFailed'), 'error')
    } catch (err) {
      toastError(t('cfg.sync.koFailed'), err)
    }
  }

  return (
    <Section title={t('cfg.sync.koTitle')} desc={t('cfg.sync.koDesc')} help={t('cfg.selfHelp')}>
      {st?.isLoggedIn ? (
        <Row label={t('cfg.sync.koConnectedAs', { name: st.username ?? '' })} hint={st.serverAddress ?? undefined}>
          <button type="button" className="gbtn plain rounded-full" onClick={() => void logout().catch((e) => toastError(t('cfg.sync.koDisconnectFailed'), e))}>
            {t('cfg.sync.koDisconnect')}
          </button>
        </Row>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-2.5">
          <TextInput
            placeholder={t('cfg.sync.koServerPh')}
            value={form.serverAddress}
            onChange={(e) => setForm({ ...form, serverAddress: e.target.value })}
            aria-label={t('cfg.sync.koServerAria')}
          />
          <div className="flex flex-wrap gap-2.5">
            <TextInput
              placeholder={t('cfg.username')}
              autoComplete="off"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              className="flex-[1_1_180px]"
              aria-label={t('cfg.sync.koUserAria')}
            />
            <TextInput
              type="password"
              placeholder={t('cfg.password')}
              autoComplete="new-password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="flex-[1_1_180px]"
              aria-label={t('cfg.sync.koPwAria')}
            />
            <button type="submit" className="solid min-h-11" disabled={connecting || !form.serverAddress || !form.username || !form.password}>
              {t('cfg.sync.koConnect')}
            </button>
          </div>
        </form>
      )}
      <SChoice
        k="koreaderSyncChecksumMethod"
        label={t('cfg.sync.docId')}
        help={t('cfg.sync.docIdHint')}
        options={[
          { value: 'BINARY', label: t('cfg.sync.binary') },
          { value: 'FILENAME', label: t('cfg.sync.filename') },
        ]}
      />
      <SChoice<KoreaderSyncConflictStrategy> k="koreaderSyncStrategyForward" label={t('cfg.sync.forward')} options={STRATEGIES} />
      <SChoice<KoreaderSyncConflictStrategy> k="koreaderSyncStrategyBackward" label={t('cfg.sync.backward')} options={STRATEGIES} />
      <SNumber k="koreaderSyncPercentageTolerance" label={t('cfg.sync.tolerance')} integer={false} min={0} max={1} hint={t('cfg.sync.toleranceHint')} />
    </Section>
  )
}
