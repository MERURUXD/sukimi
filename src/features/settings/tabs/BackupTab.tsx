import { useApolloClient, useMutation } from '@apollo/client/react'
import { DatabaseBackup, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/api/auth'
import { captureUser, StaleSessionError } from '@/api/userContext'
import { graphql } from '@/api/gql'
import type { BackupRestoreState } from '@/api/gql/graphql'
import { FILE_SLOT, uploadRequest } from '@/api/upload'
import { confirm } from '@/components/ui/Confirm'
import { toast, toastError } from '@/components/ui/toast'
import { SNumber, SSwitch, SText } from '../fields'
import { Row, Section, Switch } from '../parts'
import { RequireSettings, SettingsNotice } from '../gate'
import { t as tl } from '@/i18n'

const CreateBackup = graphql(`
  mutation CreateBackup {
    createBackup(input: {}) {
      url
    }
  }
`)

const ValidateBackup = graphql(`
  query ValidateBackup($input: ValidateBackupInput!) {
    validateBackup(input: $input) {
      missingSources {
        id
        name
      }
      missingTrackers {
        name
      }
    }
  }
`)

const RestoreBackup = graphql(`
  mutation RestoreBackup($input: RestoreBackupInput!) {
    restoreBackup(input: $input) {
      id
    }
  }
`)

const RestoreStatus = graphql(`
  query RestoreStatus($id: String!) {
    restoreStatus(id: $id) {
      state
      mangaProgress
      totalManga
    }
  }
`)

const STATE: Record<BackupRestoreState, string> = {
  IDLE: tl('cfg.backup.state.IDLE'),
  RESTORING_CATEGORIES: tl('cfg.backup.state.RESTORING_CATEGORIES'),
  RESTORING_MANGA: tl('cfg.backup.state.RESTORING_MANGA'),
  RESTORING_META: tl('cfg.backup.state.RESTORING_META'),
  RESTORING_SETTINGS: tl('cfg.backup.state.RESTORING_SETTINGS'),
  RESTORING_USER_SETTINGS: tl('cfg.backup.state.RESTORING_USER_SETTINGS'),
  SUCCESS: tl('cfg.backup.state.SUCCESS'),
  FAILURE: tl('cfg.backup.state.FAILURE'),
}

/** 备份里的设置默认不恢复：它们会直接覆盖服务端设置（含换界面的 webUIFlavor）和当前账号的个人设置 */
interface RestoreOptions {
  serverSettings: boolean
  userSettings: boolean
}

/** 确认框里的两个开关；确认框的内容是静态节点，开关状态通过回调写进调用方的 opts，确认后读取 */
function RestoreOptionsPicker({ onServer, onUser }: { onServer: (v: boolean) => void; onUser: (v: boolean) => void }) {
  const [server, setServer] = useState(false)
  const [user, setUser] = useState(false)
  return (
    <div className="mt-3 flex flex-col gap-3">
      <label className="flex items-start justify-between gap-4">
        <span>
          {tl('cfg.backup.serverRestore')}
          <span className="block text-[13px] text-muted">{tl('cfg.backup.serverRestoreHint')}</span>
        </span>
        <Switch
          label={tl('cfg.backup.serverRestore')}
          on={server}
          onChange={(v) => {
            onServer(v)
            setServer(v)
          }}
        />
      </label>
      <label className="flex items-start justify-between gap-4">
        <span>
          {tl('cfg.backup.userRestore')}
          <span className="block text-[13px] text-muted">{tl('cfg.backup.userRestoreHint')}</span>
        </span>
        <Switch
          label={tl('cfg.backup.userRestore')}
          on={user}
          onChange={(v) => {
            onUser(v)
            setUser(v)
          }}
        />
      </label>
    </div>
  )
}

export function BackupTab() {
  // 旧服务端没有用户账号，也就没有这一项
  const multi = useAuth((s) => !!s.user && !s.user.legacy)
  return (
    <>
      <SettingsNotice />
      <ManualBackup />

      <RequireSettings>
        <Section title={tl('cfg.backup.autoTitle')} desc={tl('cfg.backup.autoDesc')}>
          <SNumber k="backupInterval" label={tl('cfg.backup.interval')} unit={tl('cfg.backup.days')} min={0} hint={tl('cfg.backup.intervalHint')} />
          <SText k="backupTime" label={tl('cfg.backup.time')} type="time" width="w-[140px]" hint={tl('cfg.backup.timeHint')} />
          <SNumber k="backupTTL" label={tl('cfg.backup.ttl')} unit={tl('cfg.backup.days')} min={0} hint={tl('cfg.backup.ttlHint')} />
          <SText k="backupPath" label={tl('cfg.backup.path')} placeholder={tl('cfg.default')} hint={tl('cfg.backup.pathHint')} stack />
        </Section>
      </RequireSettings>

      <RequireSettings>
        <Section fold title={tl('cfg.backup.inclTitle')} desc={tl('cfg.backup.inclDesc')}>
          <SSwitch k="autoBackupIncludeManga" label={tl('cfg.backup.manga')} />
          <SSwitch k="autoBackupIncludeCategories" label={tl('cfg.backup.categories')} />
          <SSwitch k="autoBackupIncludeChapters" label={tl('cfg.backup.chapters')} />
          <SSwitch k="autoBackupIncludeHistory" label={tl('cfg.backup.history')} />
          <SSwitch k="autoBackupIncludeTracking" label={tl('cfg.backup.tracking')} />
          <SSwitch k="autoBackupIncludeClientData" label={tl('cfg.backup.clientData')} hint={tl('cfg.backup.clientDataHint')} />
          <SSwitch k="autoBackupIncludeServerSettings" label={tl('cfg.backup.serverSettings')} />
          {multi && (
            <SSwitch
              k="autoBackupIncludeUserSettings"
              label={tl('cfg.backup.userSettings')}
              hint={tl('cfg.backup.userSettingsHint')}
              help={tl('cfg.backup.userSettingsHelp')}
            />
          )}
        </Section>
      </RequireSettings>
    </>
  )
}

function ManualBackup() {
  const client = useApolloClient()
  const [create, { loading: creating }] = useMutation(CreateBackup)
  const fileRef = useRef<HTMLInputElement>(null)
  const [restore, setRestore] = useState<{ id: string; state: BackupRestoreState; done: number; total: number } | null>(null)

  const backupNow = async () => {
    try {
      const r = await create()
      const url = r.data?.createBackup.url
      if (!url) throw new Error(tl('cfg.backup.noUrl'))
      // 同源地址，带着登录 Cookie 直接下载
      const a = document.createElement('a')
      a.href = url
      a.download = ''
      a.click()
      toast(tl('cfg.backup.created'))
    } catch (e) {
      toastError(tl('cfg.backup.failed'), e)
    }
  }

  const pick = async (file: File) => {
    // 校验与确认期间换了账号：不能把上一个账号选的备份恢复进新账号的书库
    const still = captureUser()
    const opts: RestoreOptions = { serverSettings: false, userSettings: false }
    try {
      const v = await uploadRequest(ValidateBackup, { input: { backup: FILE_SLOT } }, { 'input.backup': file })
      still()
      const { missingSources, missingTrackers } = v.validateBackup
      const ok = await confirm({
        title: tl('cfg.backup.restoreTitle', { name: file.name }),
        body: (
          <>
            <p className="m-0">{tl('cfg.backup.restoreBody1')}</p>
            <p className="mb-0">{tl('cfg.backup.restoreBody2')}</p>
            {missingSources.length > 0 && (
              <p className="mb-0">
                {tl('cfg.backup.missingSources', { count: missingSources.length, n: missingSources.length })}
                {missingSources.map((s) => s.name).join(tl('cfg.sep'))}
              </p>
            )}
            {missingTrackers.length > 0 && <p className="mb-0">{tl('cfg.backup.missingTrackers', { names: missingTrackers.map((t) => t.name).join(tl('cfg.sep')) })}</p>}
            <RestoreOptionsPicker
              onServer={(v) => (opts.serverSettings = v)}
              onUser={(v) => (opts.userSettings = v)}
            />
          </>
        ),
        ok: tl('cfg.backup.restoreOk'),
        danger: true,
      })
      if (!ok) return
      still()
      const r = await uploadRequest(
        RestoreBackup,
        { input: { backup: FILE_SLOT, flags: { includeServerSettings: opts.serverSettings, includeUserSettings: opts.userSettings } } },
        { 'input.backup': file },
      )
      setRestore({ id: r.restoreBackup.id, state: 'IDLE', done: 0, total: 0 })
    } catch (e) {
      if (!(e instanceof StaleSessionError)) toastError(tl('cfg.backup.restoreFailed'), e)
    }
  }

  // 轮询恢复进度
  const id = restore?.id
  const finished = restore?.state === 'SUCCESS' || restore?.state === 'FAILURE'
  useEffect(() => {
    if (!id || finished) return
    const t = setInterval(async () => {
      try {
        const { data } = await client.query({ query: RestoreStatus, variables: { id }, fetchPolicy: 'network-only' })
        const s = data?.restoreStatus
        if (!s) return
        setRestore({ id, state: s.state, done: s.mangaProgress, total: s.totalManga })
        if (s.state === 'SUCCESS') {
          toast(tl('cfg.backup.restored'))
          void client.refetchQueries({ include: 'active' })
        }
        if (s.state === 'FAILURE') toast(tl('cfg.backup.restoreLogs'), 'error')
      } catch {
        /* 下一次再试 */
      }
    }, 1000)
    return () => clearInterval(t)
  }, [id, finished, client])

  return (
    <Section title={tl('cfg.backup.title')} desc={tl('cfg.backup.desc')}>
      <Row label={tl('cfg.backup.now')} hint={tl('cfg.backup.nowHint')}>
        <button type="button" className="solid min-h-11" onClick={() => void backupNow()} disabled={creating}>
          <DatabaseBackup className="size-[18px]" strokeWidth={2} />
          {creating ? tl('cfg.backup.creating') : tl('cfg.backup.createBtn')}
        </button>
      </Row>
      <Row label={tl('cfg.backup.fromFile')} hint={tl('cfg.backup.fromFileHint')}>
        <button type="button" className="gbtn plain rounded-full" onClick={() => fileRef.current?.click()} disabled={!!restore && !finished}>
          <Upload className="size-[18px]" strokeWidth={1.8} />
          {tl('cfg.backup.pick')}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".tachibk,.proto.gz,.gz"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (f) void pick(f)
          }}
        />
      </Row>
      {restore && (
        <div className="flex flex-col gap-2" role="status">
          <div className="flex justify-between text-sm">
            <span className="font-semibold">{STATE[restore.state]}</span>
            {restore.total > 0 && (
              <span className="text-muted num">
                {tl('cfg.backup.progress', { done: restore.done, total: restore.total })}
              </span>
            )}
          </div>
          <div className="prog">
            <i style={{ width: `${restore.state === 'SUCCESS' ? 100 : restore.total ? (restore.done / restore.total) * 100 : 0}%` }} />
          </div>
        </div>
      )}
    </Section>
  )
}
