import { useApolloClient, useMutation } from '@apollo/client/react'
import { DatabaseBackup, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { graphql } from '@/api/gql'
import type { BackupRestoreState } from '@/api/gql/graphql'
import { FILE_SLOT, uploadRequest } from '@/api/upload'
import { Glass } from '@/components/glass/Glass'
import { confirm } from '@/components/ui/Confirm'
import { toast, toastError } from '@/components/ui/toast'
import { SNumber, SSwitch, SText } from '../fields'
import { Row, Section } from '../parts'

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
  IDLE: '准备中',
  RESTORING_CATEGORIES: '正在恢复分类',
  RESTORING_MANGA: '正在恢复漫画',
  RESTORING_META: '正在恢复附加数据',
  RESTORING_SETTINGS: '正在恢复设置',
  SUCCESS: '恢复完成',
  FAILURE: '恢复失败',
}

export function BackupTab() {
  return (
    <>
      <ManualBackup />

      <Section title="自动备份" desc="服务端每隔一段时间自动备份一次，旧备份过期后自动删除。">
        <SNumber k="backupInterval" label="备份间隔" unit="天" min={0} hint="0 表示不自动备份" />
        <SText k="backupTime" label="备份时间" type="time" width="w-[140px]" hint="在这个时间点进行（服务端所在电脑的时间）" />
        <SNumber k="backupTTL" label="保留" unit="天" min={0} hint="超过这个天数的自动备份会被删除；0 表示一直保留" />
        <SText k="backupPath" label="备份目录" placeholder="默认" hint="服务端所在电脑上的路径；留空使用数据目录下的 backups" stack />
      </Section>

      <Section title="自动备份包含">
        <SSwitch k="autoBackupIncludeManga" label="漫画" />
        <SSwitch k="autoBackupIncludeCategories" label="分类" />
        <SSwitch k="autoBackupIncludeChapters" label="章节与阅读进度" />
        <SSwitch k="autoBackupIncludeHistory" label="阅读历史" />
        <SSwitch k="autoBackupIncludeTracking" label="追踪" />
        <SSwitch k="autoBackupIncludeClientData" label="客户端数据" hint="各个前端保存在服务端的偏好" />
        <SSwitch k="autoBackupIncludeServerSettings" label="服务端设置" />
      </Section>
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
      if (!url) throw new Error('服务端没有返回备份地址')
      // 同源地址，带着登录 Cookie 直接下载
      const a = document.createElement('a')
      a.href = url
      a.download = ''
      a.click()
      toast('备份已生成，正在下载')
    } catch (e) {
      toastError('备份失败', e)
    }
  }

  const pick = async (file: File) => {
    try {
      const v = await uploadRequest(ValidateBackup, { input: { backup: FILE_SLOT } }, { 'input.backup': file })
      const { missingSources, missingTrackers } = v.validateBackup
      const ok = await confirm({
        title: `从「${file.name}」恢复？`,
        body: (
          <>
            <p className="m-0">备份里的漫画、分类、章节进度会合并进当前书库，已有的不会被删除。恢复过程中可以继续使用。</p>
            {missingSources.length > 0 && (
              <p className="mb-0">
                缺少 {missingSources.length} 个来源的扩展，这些漫画能恢复，但要装上扩展才能阅读：
                {missingSources.map((s) => s.name).join('、')}
              </p>
            )}
            {missingTrackers.length > 0 && <p className="mb-0">未登录的追踪服务：{missingTrackers.map((t) => t.name).join('、')}</p>}
          </>
        ),
        ok: '开始恢复',
        danger: true,
      })
      if (!ok) return
      const r = await uploadRequest(RestoreBackup, { input: { backup: FILE_SLOT } }, { 'input.backup': file })
      setRestore({ id: r.restoreBackup.id, state: 'IDLE', done: 0, total: 0 })
    } catch (e) {
      toastError('恢复失败', e)
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
          toast('备份恢复完成')
          void client.refetchQueries({ include: 'active' })
        }
        if (s.state === 'FAILURE') toast('备份恢复失败，详情见服务端日志', 'error')
      } catch {
        /* 下一次再试 */
      }
    }, 1000)
    return () => clearInterval(t)
  }, [id, finished, client])

  return (
    <Section title="备份与恢复" desc="备份文件（.tachibk）与 Tachiyomi / Mihon 通用。">
      <Row label="立即备份" hint="包含书库、分类、阅读进度、历史、追踪和设置，生成后自动下载">
        <button type="button" className="solid min-h-11" onClick={() => void backupNow()} disabled={creating}>
          <DatabaseBackup className="size-[18px]" strokeWidth={2} />
          {creating ? '正在生成…' : '备份并下载'}
        </button>
      </Row>
      <Row label="从文件恢复" hint="先检查备份里缺哪些扩展，确认后再开始">
        <Glass as="button" type="button" className="gbtn rounded-full" onClick={() => fileRef.current?.click()} disabled={!!restore && !finished}>
          <Upload className="size-[18px]" strokeWidth={1.8} />
          选择备份文件
        </Glass>
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
                {restore.done} / {restore.total} 部
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
