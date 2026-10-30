import { useMutation, useQuery } from '@apollo/client/react'
import { Copy, KeyRound, Plus, Trash2, UserPlus } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useAuth } from '@/api/auth'
import { graphql } from '@/api/gql'
import type { UserPermission, UserRole } from '@/api/gql/graphql'
import { confirm } from '@/components/ui/Confirm'
import { toast, toastError } from '@/components/ui/toast'
import { ALL_PERMISSIONS, PERMISSION_LABEL, ROLE_LABEL } from '@/features/auth/permissions'
import { Dropdown, Row, Section, Switch, TextInput } from '../parts'
import { codeExpiryText, registerLink } from '../userCodes'
import { t } from '@/i18n'

/** 服务端内置管理员（用户 1）：不能改角色权限，也没有找回码 */
const BUILTIN_ADMIN_ID = 1

const Users = graphql(`
  query Users {
    users {
      nodes {
        id
        username
        roles
        permissions
      }
    }
  }
`)

const UserCodes = graphql(`
  query UserCodes {
    userCodes {
      id
      purpose
      expiresAt
      createdBy {
        id
        username
      }
      user {
        id
        username
      }
    }
  }
`)

const CreateRegistrationCode = graphql(`
  mutation CreateRegistrationCode {
    createRegistrationCode(input: {}) {
      code
      expiresAt
    }
  }
`)

const CreateRecoveryCode = graphql(`
  mutation CreateRecoveryCode($userId: Int!) {
    createRecoveryCode(input: { userId: $userId }) {
      code
      expiresAt
    }
  }
`)

const RevokeUserCode = graphql(`
  mutation RevokeUserCode($id: Int!) {
    revokeUserCode(input: { id: $id }) {
      clientMutationId
    }
  }
`)

const UpdateUser = graphql(`
  mutation UpdateUser($input: UpdateUserInput!) {
    updateUser(input: $input) {
      user {
        id
        username
        roles
        permissions
      }
    }
  }
`)

const RegisterUser = graphql(`
  mutation RegisterUser($input: RegisterInput!) {
    register(input: $input) {
      clientMutationId
    }
  }
`)

interface Issued {
  kind: 'register' | 'recover'
  code: string
  expiresAt: string
  /** 找回码是给谁的 */
  username?: string
}

async function copy(text: string, what: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast(t('cfg.users.copied', { what }))
  } catch {
    toast(t('cfg.users.copyFailed'), 'error')
  }
}

export function UsersTab() {
  const [issued, setIssued] = useState<Issued | null>(null)

  return (
    <>
      <InviteSection issued={issued} onIssued={setIssued} />
      <UserListSection onIssued={setIssued} />
      <CodesSection />
      <CreateUserSection />
    </>
  )
}

/** 刚生成的码：只显示这一次，之后服务端只记得它存在、不再给出明文 */
function IssuedCode({ issued, onClose }: { issued: Issued; onClose: () => void }) {
  const link = issued.kind === 'register' ? registerLink(window.location.origin, issued.code) : null
  return (
    <div className="flex flex-col gap-3">
      <div className="text-[13px] leading-snug text-muted">
        {t('cfg.users.shownOnce', { what: issued.kind === 'register' ? t('cfg.users.regCode') : t('cfg.users.recoveryOf', { name: issued.username }), expiry: codeExpiryText(issued.expiresAt) })}
      </div>
      <code className="font-mono text-lg break-all select-all">{issued.code}</code>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="gbtn plain rounded-full" onClick={() => void copy(issued.code, t('cfg.users.whatCode'))}>
          <Copy className="size-[18px]" strokeWidth={1.8} />
          {t('cfg.users.copyCode')}
        </button>
        {link && (
          <button type="button" className="gbtn plain rounded-full" onClick={() => void copy(link, t('cfg.users.whatLink'))}>
            <Copy className="size-[18px]" strokeWidth={1.8} />
            {t('cfg.users.copyLink')}
          </button>
        )}
        <button type="button" className="gbtn plain rounded-full" onClick={onClose}>
          {t('cfg.users.saved')}
        </button>
      </div>
    </div>
  )
}

function InviteSection({ issued, onIssued }: { issued: Issued | null; onIssued: (i: Issued | null) => void }) {
  const [create, { loading }] = useMutation(CreateRegistrationCode, { refetchQueries: [UserCodes] })

  const make = async () => {
    try {
      const r = await create()
      if (r.data) onIssued({ kind: 'register', code: r.data.createRegistrationCode.code, expiresAt: r.data.createRegistrationCode.expiresAt })
    } catch (e) {
      toastError(t('cfg.users.genFailed'), e)
    }
  }

  return (
    <Section
      title={t('cfg.users.inviteTitle')}
      desc={t('cfg.users.inviteDesc')}
    >
      {issued && <IssuedCode issued={issued} onClose={() => onIssued(null)} />}
      <Row label={t('cfg.users.regCodeLabel')} hint={t('cfg.users.regCodeHint')}>
        <button type="button" className="gbtn plain rounded-full" disabled={loading} onClick={() => void make()}>
          <Plus className="size-[18px]" strokeWidth={1.8} />
          {t('cfg.users.gen')}
        </button>
      </Row>
    </Section>
  )
}

function UserListSection({ onIssued }: { onIssued: (i: Issued) => void }) {
  const { data } = useQuery(Users)
  const selfId = useAuth((s) => s.user?.id)
  const [editing, setEditing] = useState<number | null>(null)
  const [recovery] = useMutation(CreateRecoveryCode, { refetchQueries: [UserCodes] })

  const recover = async (id: number, username: string) => {
    const ok = await confirm({
      title: t('cfg.users.recoverTitle', { name: username }),
      body: t('cfg.users.recoverBody'),
      ok: t('cfg.users.recoverOk'),
    })
    if (!ok) return
    try {
      const r = await recovery({ variables: { userId: id } })
      if (r.data) onIssued({ kind: 'recover', code: r.data.createRecoveryCode.code, expiresAt: r.data.createRecoveryCode.expiresAt, username })
    } catch (e) {
      toastError(t('cfg.users.recoverFailed'), e)
    }
  }

  const users = data?.users.nodes

  return (
    <Section title={t('cfg.users.title')} desc={t('cfg.users.desc')}>
      <div className="flex flex-col gap-4">
        {!users && <span className="text-[13px] text-muted">…</span>}
        {users?.map((u) => (
          <div key={u.id} className="flex flex-col gap-3">
            <Row
              label={u.username}
              hint={
                u.id === BUILTIN_ADMIN_ID
                  ? t('cfg.users.builtin')
                  : u.id === selfId
                    ? t('cfg.users.self')
                    : u.roles.includes('ADMIN')
                    ? t('cfg.users.allPerms')
                    : u.permissions.length
                      ? u.permissions.map((p) => PERMISSION_LABEL[p]).join(t('cfg.sep'))
                      : t('cfg.users.noExtra')
              }
            >
              <div className="flex items-center gap-2">
                <span className="text-[13px] text-muted">{u.roles.map((r) => ROLE_LABEL[r]).join(t('cfg.sep'))}</span>
                {u.id !== BUILTIN_ADMIN_ID && u.id !== selfId && (
                  <>
                    <button type="button" className="gbtn plain rounded-full" onClick={() => setEditing(editing === u.id ? null : u.id)}>
                      {editing === u.id ? t('cfg.users.collapse') : t('cfg.users.edit')}
                    </button>
                    <button type="button" className="gicon plain rounded-full" aria-label={t('cfg.users.recoverAria', { name: u.username })} onClick={() => void recover(u.id, u.username)}>
                      <KeyRound className="size-[18px]" strokeWidth={1.8} />
                    </button>
                  </>
                )}
              </div>
            </Row>
            {editing === u.id && <EditUser user={u} onDone={() => setEditing(null)} />}
          </div>
        ))}
      </div>
    </Section>
  )
}

function EditUser({ user, onDone }: { user: { id: number; username: string; roles: UserRole[]; permissions: UserPermission[] }; onDone: () => void }) {
  // 访客角色服务端不允许授予；已经是访客的保持原样显示
  const initialRole: UserRole = user.roles.includes('ADMIN') ? 'ADMIN' : user.roles.includes('VISITOR') ? 'VISITOR' : 'USER'
  const [role, setRole] = useState<UserRole>(initialRole)
  // 服务端只允许管理员授予角色：只有「管理用户」权限的账号只能改权限，请求里也不能带 role
  const isAdmin = useAuth((s) => !!s.user?.roles.includes('ADMIN'))
  const [perms, setPerms] = useState(() => new Set(user.permissions))
  const [save, { loading }] = useMutation(UpdateUser)

  const toggle = (p: UserPermission) =>
    setPerms((s) => {
      const next = new Set(s)
      if (!next.delete(p)) next.add(p)
      return next
    })

  const submit = async () => {
    try {
      const permissions = ALL_PERMISSIONS.filter((p) => perms.has(p))
      await save({ variables: { input: { userId: user.id, permissions, ...(role !== initialRole && { role }) } } })
      toast(t('cfg.users.updated', { name: user.username }))
      onDone()
    } catch (e) {
      toastError(t('cfg.users.updateFailed'), e)
    }
  }

  return (
    <div className="flex flex-col gap-4 pl-1 md:pl-4">
      {isAdmin && (
        <Row label={t('cfg.users.role')}>
          <Dropdown
            label={t('cfg.users.role')}
            value={role}
            onChange={setRole}
            className="min-w-[160px]"
            options={[
              { value: 'USER', label: ROLE_LABEL.USER },
              { value: 'ADMIN', label: ROLE_LABEL.ADMIN },
              ...(role === 'VISITOR' ? [{ value: 'VISITOR' as const, label: ROLE_LABEL.VISITOR }] : []),
            ]}
          />
        </Row>
      )}
      {role === 'ADMIN' ? (
        <p className="m-0 text-[13px] leading-snug text-muted">{t('cfg.users.adminNote')}</p>
      ) : (
        <div className="flex flex-col gap-4">
          {ALL_PERMISSIONS.map((p) => (
            <Row key={p} label={PERMISSION_LABEL[p]}>
              <Switch on={perms.has(p)} onChange={() => toggle(p)} label={PERMISSION_LABEL[p]} />
            </Row>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <button type="button" className="solid min-h-11" disabled={loading} onClick={() => void submit()}>
          {loading ? t('cfg.users.saving') : t('cfg.users.save')}
        </button>
        <button type="button" className="gbtn plain rounded-full" onClick={onDone}>
          {t('common.cancel')}
        </button>
      </div>
    </div>
  )
}

function CodesSection() {
  const { data } = useQuery(UserCodes)
  const [revoke] = useMutation(RevokeUserCode, { refetchQueries: [UserCodes] })
  const codes = data?.userCodes.filter((c) => c.expiresAt && codeExpiryText(c.expiresAt) !== t('cfg.code.expired'))

  const drop = async (id: number) => {
    if (!(await confirm({ title: t('cfg.users.revokeTitle'), body: t('cfg.users.revokeBody'), ok: t('cfg.users.revokeOk'), danger: true }))) return
    try {
      await revoke({ variables: { id } })
    } catch (e) {
      toastError(t('cfg.users.revokeFailed'), e)
    }
  }

  if (codes?.length === 0) return null
  return (
    <Section title={t('cfg.users.unusedTitle')} desc={t('cfg.users.unusedDesc')}>
      <div className="flex flex-col gap-4">
        {!codes && <span className="text-[13px] text-muted">…</span>}
        {codes?.map((c) => (
          <Row
            key={c.id}
            label={c.purpose === 'REGISTRATION' ? t('cfg.users.regCodeLabel') : t('cfg.users.codeLabelRecovery', { name: c.user?.username ?? '' })}
            hint={t('cfg.users.codeHint', { expiry: codeExpiryText(c.expiresAt), name: c.createdBy.username })}
          >
            <button type="button" className="gicon plain rounded-full" aria-label={t('cfg.users.revokeAria')} onClick={() => void drop(c.id)}>
              <Trash2 className="size-[18px]" strokeWidth={1.8} />
            </button>
          </Row>
        ))}
      </div>
    </Section>
  )
}

function CreateUserSection() {
  const [open, setOpen] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [create, { loading }] = useMutation(RegisterUser, { refetchQueries: [Users] })

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !password) return
    try {
      await create({ variables: { input: { username: username.trim(), password } } })
      toast(t('cfg.users.created', { name: username.trim() }))
      setUsername('')
      setPassword('')
      setOpen(false)
    } catch (err) {
      toastError(t('cfg.users.createFailed'), err)
    }
  }

  return (
    <Section title={t('cfg.users.directTitle')} desc={t('cfg.users.directDesc')}>
      {open ? (
        <form onSubmit={submit} className="flex max-w-[360px] flex-col gap-3">
          <TextInput placeholder={t('cfg.username')} autoComplete="off" value={username} onChange={(e) => setUsername(e.target.value)} />
          <TextInput type="password" placeholder={t('cfg.users.initPw')} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <div className="flex gap-2">
            <button className="solid min-h-11" disabled={loading || !username.trim() || !password}>
              {loading ? t('cfg.users.creating') : t('cfg.users.create')}
            </button>
            <button type="button" className="gbtn plain rounded-full" onClick={() => setOpen(false)}>
              {t('common.cancel')}
            </button>
          </div>
        </form>
      ) : (
        <Row label={t('cfg.users.createRow')}>
          <button type="button" className="gbtn plain rounded-full" onClick={() => setOpen(true)}>
            <UserPlus className="size-[18px]" strokeWidth={1.8} />
            {t('cfg.users.create')}
          </button>
        </Row>
      )}
    </Section>
  )
}
