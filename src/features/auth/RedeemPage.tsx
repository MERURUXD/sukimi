import { useState, type FormEvent } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router'
import { redeemRecoveryCode, redeemRegistrationCode, useAuth } from '@/api/auth'
import { errorText } from '@/lib/errorText'
import { AuthInput, AuthLayout } from './AuthLayout'
import { t } from '@/i18n'

/** 注册与找回共用：输入码（可由 ?code= 预填）、用户名（仅注册）和密码，兑换成功后直接登录 */
function RedeemForm({ mode }: { mode: 'register' | 'recover' }) {
  const register = mode === 'register'
  const status = useAuth((s) => s.status)
  const [params] = useSearchParams()
  const [code, setCode] = useState(params.get('code') ?? '')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [again, setAgain] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (status === 'signedIn') return <Navigate to="/" replace />

  const mismatch = again !== '' && again !== password
  const ready = !!code.trim() && !!password && again === password && (!register || !!username.trim())

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!ready) return
    setBusy(true)
    setError('')
    try {
      if (register) await redeemRegistrationCode(code.trim(), username.trim(), password)
      else await redeemRecoveryCode(code.trim(), password)
    } catch (err) {
      setError(t(register ? 'auth.redeem.registerFailed' : 'auth.redeem.recoverFailed', { reason: errorText(err) }))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout
      title={register ? t('auth.redeem.registerTitle') : t('auth.redeem.recoverTitle')}
      subtitle={register ? t('auth.redeem.registerSub') : t('auth.redeem.recoverSub')}
      onSubmit={submit}
    >
      <div className="mt-8 flex w-full flex-col gap-3">
        <AuthInput
          placeholder={register ? t('auth.redeem.registerCode') : t('auth.redeem.recoverCode')}
          autoComplete="off"
          autoFocus={!code}
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        {register && (
          <AuthInput placeholder={t('auth.login.username')} autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} />
        )}
        <AuthInput
          type="password"
          placeholder={register ? t('auth.login.password') : t('auth.redeem.newPassword')}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <AuthInput
          type="password"
          placeholder={t('auth.redeem.confirmPassword')}
          autoComplete="new-password"
          value={again}
          onChange={(e) => setAgain(e.target.value)}
        />
      </div>

      <p role="alert" className="mt-3 mb-0 min-h-[21px] text-danger">
        {mismatch ? t('auth.redeem.mismatch') : error}
      </p>

      <button className="solid mt-3 w-full" disabled={busy || !ready}>
        {busy ? t('auth.redeem.wait') : register ? t('auth.redeem.registerGo') : t('auth.redeem.recoverGo')}
      </button>
      <Link to="/login" className="mt-4 text-muted no-underline hover:text-text">
        {t('auth.redeem.backToLogin')}
      </Link>
    </AuthLayout>
  )
}

export const RegisterPage = () => <RedeemForm mode="register" />
export const RecoverPage = () => <RedeemForm mode="recover" />
