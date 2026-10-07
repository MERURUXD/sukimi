import { useMutation, useQuery } from '@apollo/client/react'
import { Copy, KeyRound, Plus, Trash2, UserPlus } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useAuth } from '@/api/auth'
import { graphql } from '@/api/gql'
import type { UserPermission, UserRole } from '@/api/gql/graphql'
import { Glass } from '@/components/glass/Glass'
import { confirm } from '@/components/ui/Confirm'
import { Seg } from '@/components/ui/Seg'
import { toast, toastError } from '@/components/ui/toast'
import { ALL_PERMISSIONS, PERMISSION_LABEL, ROLE_LABEL } from '@/features/auth/permissions'
import { Row, Section, Switch, TextInput } from '../parts'
import { codeExpiryText, registerLink } from '../userCodes'

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
    toast(`已复制${what}`)
  } catch {
    toast('复制失败，请手动选中复制', 'error')
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
      <div className="text-sm text-muted">
        {issued.kind === 'register' ? '注册码' : `${issued.username} 的找回码`}只显示这一次，请现在复制并私下发给对方 · {codeExpiryText(issued.expiresAt)}
      </div>
      <code className="font-mono text-lg break-all select-all">{issued.code}</code>
      <div className="flex flex-wrap gap-2">
        <Glass as="button" type="button" className="gbtn rounded-full" onClick={() => void copy(issued.code, '码')}>
          <Copy className="size-[18px]" strokeWidth={1.8} />
          复制码
        </Glass>
        {link && (
          <Glass as="button" type="button" className="gbtn rounded-full" onClick={() => void copy(link, '链接')}>
            <Copy className="size-[18px]" strokeWidth={1.8} />
            复制注册链接
          </Glass>
        )}
        <Glass as="button" type="button" className="gbtn rounded-full" onClick={onClose}>
          我已保存
        </Glass>
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
      toastError('生成注册码失败', e)
    }
  }

  return (
    <Section
      title="邀请新用户"
      desc="生成注册码发给对方，对方在登录页选择「用注册码注册」，自己设置用户名和密码。新用户的默认权限沿用服务端设置，注册后可以在下面调整。"
    >
      {issued && <IssuedCode issued={issued} onClose={() => onIssued(null)} />}
      <Row label="注册码" hint="一次性，7 天内有效">
        <Glass as="button" type="button" className="gbtn rounded-full" disabled={loading} onClick={() => void make()}>
          <Plus className="size-[18px]" strokeWidth={1.8} />
          生成注册码
        </Glass>
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
      title: `给「${username}」生成找回码？`,
      body: '对方用找回码设置新密码后，旧密码就不能再用了。每个用户同时只有一个未用的找回码。',
      ok: '生成',
    })
    if (!ok) return
    try {
      const r = await recovery({ variables: { userId: id } })
      if (r.data) onIssued({ kind: 'recover', code: r.data.createRecoveryCode.code, expiresAt: r.data.createRecoveryCode.expiresAt, username })
    } catch (e) {
      toastError('生成找回码失败', e)
    }
  }

  const users = data?.users.nodes

  return (
    <Section title="用户" desc="权限和角色的改动要等对方的登录令牌下一次刷新才生效，最长 5 分钟。">
      <div className="flex flex-col gap-5">
        {!users && <span className="text-muted">…</span>}
        {users?.map((u) => (
          <div key={u.id} className="flex flex-col gap-3">
            <Row
              label={u.username}
              hint={
                u.id === BUILTIN_ADMIN_ID
                  ? '内置管理员，权限和密码都在服务端配置里管理'
                  : u.id === selfId
                    ? '这是你自己，不能在这里改自己的角色'
                    : u.roles.includes('ADMIN')
                    ? '拥有全部权限'
                    : u.permissions.length
                      ? u.permissions.map((p) => PERMISSION_LABEL[p]).join('、')
                      : '没有额外权限'
              }
            >
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted">{u.roles.map((r) => ROLE_LABEL[r]).join('、')}</span>
                {u.id !== BUILTIN_ADMIN_ID && u.id !== selfId && (
                  <>
                    <Glass as="button" type="button" className="gbtn rounded-full" onClick={() => setEditing(editing === u.id ? null : u.id)}>
                      {editing === u.id ? '收起' : '编辑'}
                    </Glass>
                    <Glass as="button" type="button" className="gicon rounded-full" aria-label={`给 ${u.username} 生成找回码`} onClick={() => void recover(u.id, u.username)}>
                      <KeyRound className="size-[18px]" strokeWidth={1.8} />
                    </Glass>
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
  const [role, setRole] = useState<UserRole>(user.roles.includes('ADMIN') ? 'ADMIN' : user.roles.includes('VISITOR') ? 'VISITOR' : 'USER')
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
      await save({ variables: { input: { userId: user.id, role, permissions: ALL_PERMISSIONS.filter((p) => perms.has(p)) } } })
      toast(`已更新「${user.username}」，最长 5 分钟后对方生效`)
      onDone()
    } catch (e) {
      toastError('更新失败', e)
    }
  }

  return (
    <div className="flex flex-col gap-4 pl-1 md:pl-4">
      <Seg
        label="角色"
        value={role}
        onChange={setRole}
        items={[
          { value: 'USER', label: ROLE_LABEL.USER },
          { value: 'ADMIN', label: ROLE_LABEL.ADMIN },
          ...(role === 'VISITOR' ? [{ value: 'VISITOR' as const, label: ROLE_LABEL.VISITOR }] : []),
        ]}
      />
      {role === 'ADMIN' ? (
        <p className="m-0 text-sm text-muted">管理员拥有全部权限，不需要单独勾选。</p>
      ) : (
        <div className="flex flex-col gap-3">
          {ALL_PERMISSIONS.map((p) => (
            <Row key={p} label={PERMISSION_LABEL[p]}>
              <Switch on={perms.has(p)} onChange={() => toggle(p)} label={PERMISSION_LABEL[p]} />
            </Row>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <button type="button" className="solid" disabled={loading} onClick={() => void submit()}>
          {loading ? '正在保存…' : '保存'}
        </button>
        <Glass as="button" type="button" className="gbtn rounded-full" onClick={onDone}>
          取消
        </Glass>
      </div>
    </div>
  )
}

function CodesSection() {
  const { data } = useQuery(UserCodes)
  const [revoke] = useMutation(RevokeUserCode, { refetchQueries: [UserCodes] })
  const codes = data?.userCodes.filter((c) => c.expiresAt && codeExpiryText(c.expiresAt) !== '已过期')

  const drop = async (id: number) => {
    if (!(await confirm({ title: '撤销这个码？', body: '撤销后对方无法再用它。', ok: '撤销', danger: true }))) return
    try {
      await revoke({ variables: { id } })
    } catch (e) {
      toastError('撤销失败', e)
    }
  }

  if (codes?.length === 0) return null
  return (
    <Section title="未使用的码" desc="服务端不保存码的明文，这里只能看到它们还没被使用，并撤销。">
      <div className="flex flex-col gap-3">
        {!codes && <span className="text-muted">…</span>}
        {codes?.map((c) => (
          <Row
            key={c.id}
            label={c.purpose === 'REGISTRATION' ? '注册码' : `${c.user?.username ?? ''} 的找回码`}
            hint={`${codeExpiryText(c.expiresAt)} · 由 ${c.createdBy.username} 生成`}
          >
            <Glass as="button" type="button" className="gicon rounded-full" aria-label="撤销" onClick={() => void drop(c.id)}>
              <Trash2 className="size-[18px]" strokeWidth={1.8} />
            </Glass>
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
      toast(`已创建用户「${username.trim()}」`)
      setUsername('')
      setPassword('')
      setOpen(false)
    } catch (err) {
      toastError('创建失败', err)
    }
  }

  return (
    <Section title="直接创建账号" desc="由你设置初始密码并告知对方；对方之后可以自己修改。更推荐用注册码，密码不会经过你。">
      {open ? (
        <form onSubmit={submit} className="flex max-w-[360px] flex-col gap-3">
          <TextInput placeholder="用户名" autoComplete="off" value={username} onChange={(e) => setUsername(e.target.value)} />
          <TextInput type="password" placeholder="初始密码" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <div className="flex gap-2">
            <button className="solid" disabled={loading || !username.trim() || !password}>
              {loading ? '正在创建…' : '创建'}
            </button>
            <Glass as="button" type="button" className="gbtn rounded-full" onClick={() => setOpen(false)}>
              取消
            </Glass>
          </div>
        </form>
      ) : (
        <Row label="创建账号">
          <Glass as="button" type="button" className="gbtn rounded-full" onClick={() => setOpen(true)}>
            <UserPlus className="size-[18px]" strokeWidth={1.8} />
            创建账号
          </Glass>
        </Row>
      )}
    </Section>
  )
}
