import { useMutation } from '@apollo/client/react'
import { KeyRound, LogOut } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { signOut, useAuth } from '@/api/auth'
import { graphql } from '@/api/gql'
import { captureUser, StaleSessionError } from '@/api/userContext'
import { confirm } from '@/components/ui/Confirm'
import { toast, toastError } from '@/components/ui/toast'
import { ROLE_LABEL } from '@/features/auth/permissions'
import { Row, Section, TextInput } from '../parts'
import { t } from '@/i18n'

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
      toast(t('cfg.account.changed'))
      signOut()
    } catch (err) {
      if (!(err instanceof StaleSessionError)) toastError(t('cfg.account.changeFailed'), err)
    }
  }

  if (!open) {
    return (
      <Row label={t('cfg.account.changePw')} hint={t('cfg.account.changePwHint')}>
        <button type="button" className="gbtn plain rounded-full" onClick={() => setOpen(true)}>
          <KeyRound className="size-[18px]" strokeWidth={1.8} />
          {t('cfg.account.changePw')}
        </button>
      </Row>
    )
  }

  return (
    <form onSubmit={submit} className="flex max-w-[360px] flex-col gap-3">
      <div className="font-semibold">{t('cfg.account.changePw')}</div>
      <TextInput type="password" placeholder={t('cfg.account.oldPw')} autoComplete="current-password" value={oldPassword} onChange={(e) => setOld(e.target.value)} />
      <TextInput type="password" placeholder={t('cfg.account.newPw')} autoComplete="new-password" value={newPassword} onChange={(e) => setNew(e.target.value)} />
      <TextInput type="password" placeholder={t('cfg.account.againPw')} autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} />
      <p role="alert" className="m-0 min-h-[18px] text-[13px] text-danger">
        {mismatch ? t('cfg.account.mismatch') : newPassword && newPassword === oldPassword ? t('cfg.account.same') : ''}
      </p>
      <div className="flex gap-2">
        <button className="solid" disabled={!ready || loading}>
          {loading ? t('cfg.account.changing') : t('cfg.account.confirmChange')}
        </button>
        <button type="button" className="gbtn plain rounded-full" onClick={() => setOpen(false)}>
          {t('common.cancel')}
        </button>
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
    <Section title={t('cfg.account.title')}>
      {multi && (
        <Row label={t('cfg.account.currentUser')} hint={user.roles.map((r) => ROLE_LABEL[r]).join(t('cfg.sep')) || undefined}>
          <span className="text-muted">{user.username}</span>
        </Row>
      )}
      {multi &&
        (user.id === BUILTIN_ADMIN_ID ? (
          <Row label={t('cfg.account.changePw')} hint={t('cfg.account.builtinPw')} />
        ) : (
          <ChangePassword />
        ))}
      {!hideSignOut && (
        <Row label={t('cfg.account.signOut')} hint={t('cfg.account.signOutHint')}>
          <button
            type="button"
            className="gbtn plain rounded-full"
            onClick={async () => {
              if (await confirm({ title: t('cfg.account.signOutTitle'), ok: t('cfg.account.signOutOk'), local: true })) signOut()
            }}
          >
            <LogOut className="size-[18px]" strokeWidth={1.8} />
            {t('cfg.account.signOut')}
          </button>
        </Row>
      )}
    </Section>
  )
}
