import { useState, type FormEvent } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router'
import { redeemRecoveryCode, redeemRegistrationCode, useAuth } from '@/api/auth'
import { AuthInput, AuthLayout } from './AuthLayout'

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
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout
      title={register ? '注册账号' : '找回密码'}
      subtitle={register ? '输入管理员发给你的注册码' : '输入管理员发给你的找回码，设置新密码'}
      onSubmit={submit}
    >
      <div className="mt-8 flex w-full flex-col gap-3">
        <AuthInput
          placeholder={register ? '注册码' : '找回码'}
          autoComplete="off"
          autoFocus={!code}
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        {register && (
          <AuthInput placeholder="用户名" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} />
        )}
        <AuthInput
          type="password"
          placeholder={register ? '密码' : '新密码'}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <AuthInput
          type="password"
          placeholder="再输入一次密码"
          autoComplete="new-password"
          value={again}
          onChange={(e) => setAgain(e.target.value)}
        />
      </div>

      <p role="alert" className="mt-3 mb-0 min-h-[21px] text-danger">
        {mismatch ? '两次输入的密码不一致' : error}
      </p>

      <button className="solid mt-3 w-full" disabled={busy || !ready}>
        {busy ? '请稍候…' : register ? '注册并登录' : '设置新密码并登录'}
      </button>
      <Link to="/login" className="mt-4 text-muted no-underline hover:text-text">
        返回登录
      </Link>
    </AuthLayout>
  )
}

export const RegisterPage = () => <RedeemForm mode="register" />
export const RecoverPage = () => <RedeemForm mode="recover" />
