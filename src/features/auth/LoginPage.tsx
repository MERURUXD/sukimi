import { useQuery } from '@apollo/client/react'
import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, type Location } from 'react-router'
import { AuthError, login, useAuth } from '@/api/auth'
import { graphql } from '@/api/gql'
import { Glass } from '@/components/glass/Glass'
import { useApplyAppearance } from '@/design/settings'

const AboutServer = graphql(`
  query AboutServer {
    aboutServer {
      name
      version
    }
  }
`)

export function LoginPage() {
  useApplyAppearance()
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
      setError(err instanceof AuthError ? '用户名或密码不正确' : (err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const field =
    'h-12 w-full rounded-full border-0 bg-transparent px-5 text-[15px] text-text outline-none placeholder:text-muted'

  return (
    <div className="relative isolate grid min-h-dvh place-items-center overflow-hidden px-4">
      {/* 没有封面可用时的中性氛围光 */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 opacity-70 blur-[90px]"
        style={{
          background:
            'radial-gradient(40% 50% at 30% 30%, color-mix(in srgb, var(--text) 18%, transparent), transparent), radial-gradient(35% 45% at 72% 70%, color-mix(in srgb, var(--text) 10%, transparent), transparent)',
        }}
      />

      <form onSubmit={submit} className="flex w-full max-w-[360px] flex-col items-center">
        <span className="grid size-14 place-items-center rounded-[16px] bg-solid text-2xl font-bold text-on-solid">S</span>
        <h1 className="mt-6 mb-1 text-[28px] font-bold">登录 Sukimi</h1>
        <p className="m-0 text-muted num">
          {data ? `${data.aboutServer.name} ${data.aboutServer.version}` : ' '}
        </p>

        <div className="mt-8 flex w-full flex-col gap-3">
          <Glass className="rounded-full">
            <input
              className={field}
              placeholder="用户名"
              autoComplete="username"
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </Glass>
          <Glass className="rounded-full">
            <input
              className={field}
              type="password"
              placeholder="密码"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Glass>
        </div>

        <p role="alert" className="mt-3 mb-0 min-h-[21px] text-danger">
          {error}
        </p>

        <button className="solid mt-3 w-full" disabled={busy || !username || !password}>
          {busy ? '正在登录…' : '登录'}
        </button>
        <Glass as="a" href="/demo/" className="gbtn mt-4 w-full justify-center rounded-full no-underline">
          无需登录，体验演示
        </Glass>
        <p className="mt-3 text-center text-xs text-muted">虚构作品，可体验书库与阅读器，无需连接服务器。</p>
      </form>
    </div>
  )
}
