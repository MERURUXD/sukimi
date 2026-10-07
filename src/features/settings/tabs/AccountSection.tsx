import { useMutation } from '@apollo/client/react'
import { KeyRound, LogOut } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { signOut, useAuth } from '@/api/auth'
import { graphql } from '@/api/gql'
import { captureUser, StaleSessionError } from '@/api/userContext'
import { Glass } from '@/components/glass/Glass'
import { confirm } from '@/components/ui/Confirm'
import { toast, toastError } from '@/components/ui/toast'
import { ROLE_LABEL } from '@/features/auth/permissions'
import { Row, Section, TextInput } from '../parts'

const SetPassword = graphql(`
  mutation SetPassword($input: SetPasswordInput!) {
    setPassword(input: $input) {
      clientMutationId
    }
  }
`)

/** 服务端内置管理员（用户 1）的密码来自服务端配置，不能在这里改 */
const BUILTIN_ADMIN_ID = 1

function ChangePassword() {
  const [open, setOpen] = useState(false)
  const [oldPassword, setOld] = useState('')
  const [newPassword, setNew] = useState('')
  const [again, setAgain] = useState('')
  const [save, { loading }] = useMutation(SetPassword)

  const mismatch = again !== '' && again !== newPassword
  const ready = !!oldPassword && !!newPassword && again === newPassword && newPassword !== oldPassword

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!ready || loading) return
    // 等响应期间换了账号：这次修改属于上一个账号，不能把新账号退出登录
    const still = captureUser()
    try {
      await save({ variables: { input: { oldPassword, newPassword } } })
      still()
      // 改密码会让这个账号在所有设备上登出，包括这一台
      toast('密码已修改，请用新密码重新登录')
      signOut()
    } catch (err) {
      if (!(err instanceof StaleSessionError)) toastError('修改密码失败', err)
    }
  }

  if (!open) {
    return (
      <Row label="修改密码" hint="修改后这个账号在所有设备上都会退出登录">
        <Glass as="button" type="button" className="gbtn rounded-full" onClick={() => setOpen(true)}>
          <KeyRound className="size-[18px]" strokeWidth={1.8} />
          修改密码
        </Glass>
      </Row>
    )
  }

  return (
    <form onSubmit={submit} className="flex max-w-[360px] flex-col gap-3">
      <div className="font-semibold">修改密码</div>
      <TextInput type="password" placeholder="当前密码" autoComplete="current-password" value={oldPassword} onChange={(e) => setOld(e.target.value)} />
      <TextInput type="password" placeholder="新密码" autoComplete="new-password" value={newPassword} onChange={(e) => setNew(e.target.value)} />
      <TextInput type="password" placeholder="再输入一次新密码" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} />
      <p role="alert" className="m-0 min-h-[18px] text-xs text-danger">
        {mismatch ? '两次输入的新密码不一致' : newPassword && newPassword === oldPassword ? '新密码不能和当前密码相同' : ''}
      </p>
      <div className="flex gap-2">
        <button className="solid" disabled={!ready || loading}>
          {loading ? '正在修改…' : '确认修改'}
        </button>
        <Glass as="button" type="button" className="gbtn rounded-full" onClick={() => setOpen(false)}>
          取消
        </Glass>
      </div>
    </form>
  )
}

/** 「关于」里的账户区：当前用户、改密码、退出 */
export function AccountSection({ hideSignOut }: { hideSignOut?: boolean }) {
  const user = useAuth((s) => s.user)
  // 旧服务端没有用户账号，只有退出登录
  const multi = !!user && !user.legacy

  return (
    <Section title="账户">
      {multi && (
        <Row label="当前用户" hint={user.roles.map((r) => ROLE_LABEL[r]).join('、') || undefined}>
          <span className="text-muted">{user.username}</span>
        </Row>
      )}
      {multi &&
        (user.id === BUILTIN_ADMIN_ID ? (
          <Row label="修改密码" hint="内置管理员的密码请在服务端配置里修改" />
        ) : (
          <ChangePassword />
        ))}
      {!hideSignOut && (
        <Row label="退出登录" hint="清除这台设备上保存的登录状态和书库缓存">
          <Glass
            as="button"
            type="button"
            className="gbtn rounded-full"
            onClick={async () => {
              if (await confirm({ title: '退出登录？', ok: '退出' })) signOut()
            }}
          >
            <LogOut className="size-[18px]" strokeWidth={1.8} />
            退出登录
          </Glass>
        </Row>
      )}
    </Section>
  )
}
