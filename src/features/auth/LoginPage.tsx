import { useQuery } from '@apollo/client/react'
import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, type Location } from 'react-router'
import { AuthError, login, useAuth } from '@/api/auth'
import { graphql } from '@/api/gql'
import { Glass } from '@/components/glass/Glass'
import { AuthInput, AuthLayout } from './AuthLayout'
import { t } from '@/i18n'

const AboutServer = graphql(`
  query AboutServer {
    aboutServer {
      name
      version
    }
  }
`)

export function LoginPage() {
  const status = useAuth((s) => s.status)
  const location = useLocation()
  const from = (location.state as { from?: Location } | null)?.from
  const { data } = useQuery(AboutServer)

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (status === 'signedIn') {
    return <Navigate to={from ? `${from.pathname}${from.search}` : '/'} replace />
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await login(username.trim(), password)
    } catch (err) {
      setError(err instanceof AuthError ? t('auth.login.badCredentials') : (err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout
      title={t('auth.login.title')}
      subtitle={data ? `${data.aboutServer.name} ${data.aboutServer.version}` : undefined}
      onSubmit={submit}
    >
      <div className="mt-8 flex w-full flex-col gap-3">
        <AuthInput placeholder={t('auth.login.username')} autoComplete="username" autoFocus value={username} onChange={(e) => setUsername(e.target.value)} />
        <AuthInput
          type="password"
          placeholder={t('auth.login.password')}
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      <p role="alert" className="mt-3 mb-0 min-h-[21px] text-danger">
        {error}
      </p>

      <button className="solid mt-3 w-full" disabled={busy || !username || !password}>
        {busy ? t('auth.login.signingIn') : t('auth.login.signIn')}
      </button>
      <p className="mt-4 mb-0 flex gap-4 text-sm">
        <Link to="/register" className="text-muted no-underline hover:text-text">
          {t('auth.login.registerByCode')}
        </Link>
        <Link to="/recover" className="text-muted no-underline hover:text-text">
          {t('auth.login.forgot')}
        </Link>
      </p>
      <Glass as="a" href="/demo/" className="gbtn mt-4 w-full justify-center rounded-full no-underline">
        {t('auth.login.demo')}
      </Glass>
      <p className="mt-3 text-center text-xs text-muted">{t('auth.login.demoHint')}</p>
    </AuthLayout>
  )
}
