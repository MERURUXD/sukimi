import { useMutation, useQuery } from '@apollo/client/react'
import { useState, type FormEvent } from 'react'
import { confirm } from '@/components/ui/Confirm'
import { toast, toastError } from '@/components/ui/toast'
import { SourceIcon } from '@/features/browse/SourceIcon'
import { LoginTrackerCredentials, LogoutTracker, Trackers, type Tracker } from '@/features/tracking/queries'
import { oauthUrl } from '@/features/tracking/tracking'
import { Section, TextInput } from '../parts'

export function TrackingTab() {
  const { data, error } = useQuery(Trackers)
  const trackers = data?.trackers.nodes
  return (
    <Section
      title="追踪服务"
      desc="登录后可以在漫画详情页把漫画绑定到这些网站上的条目，读完章节后服务端会把进度同步过去。登录信息保存在服务端。"
    >
      {error && !trackers && <span className="text-sm text-danger">无法读取追踪服务：{error.message.split('\n')[0]}</span>}
      {!trackers && !error && <span className="text-muted">…</span>}
      <div className="flex flex-col gap-1">
        {trackers?.map((t) => <TrackerRow key={t.id} t={t} />)}
      </div>
    </Section>
  )
}

function TrackerRow({ t }: { t: Tracker }) {
  const [logout, { loading: leaving }] = useMutation(LogoutTracker)
  const [login, { loading: entering }] = useMutation(LoginTrackerCredentials)
  const [form, setForm] = useState<{ username: string; password: string } | null>(null)
  const oauth = !!t.authUrl

  const signIn = () => {
    // 跳到追踪网站授权，完成后回到 /tracker/login/oauth（features/tracking/OAuthCallback）
    if (oauth) window.location.assign(oauthUrl({ id: t.id, name: t.name, authUrl: t.authUrl! }, window.location.origin))
    else setForm({ username: '', password: '' })
  }

  const signOut = async () => {
    const ok = await confirm({ title: `退出 ${t.name}？`, body: '已绑定的漫画会保留绑定，但在重新登录前不会再同步进度。', ok: '退出' })
    if (!ok) return
    try {
      await logout({ variables: { trackerId: t.id } })
      toast(`已退出 ${t.name}`)
    } catch (e) {
      toastError('退出失败', e)
    }
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!form) return
    try {
      const r = await login({ variables: { trackerId: t.id, ...form } })
      if (r.data?.loginTrackerCredentials.isLoggedIn) {
        setForm(null)
        toast(`已登录 ${t.name}`)
      } else toast(`登录 ${t.name} 失败，请检查用户名和密码`, 'error')
    } catch (err) {
      toastError('登录失败', err)
    }
  }

  const state = !t.isLoggedIn ? '未登录' : t.isTokenExpired ? '登录已过期，请重新登录' : '已登录'

  return (
    <div className="flex flex-col gap-3 rounded-2xl py-2 pr-1 pl-2 hover:bg-hover">
      <div className="flex items-center gap-3">
        <SourceIcon s={{ iconUrl: t.icon, displayName: t.name }} size={36} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-semibold">{t.name}</span>
          <span className={t.isLoggedIn && t.isTokenExpired ? 'text-[13px] text-danger' : 'text-[13px] text-muted'}>
            {state}
            {!t.isLoggedIn && oauth && ' · 会跳到网站授权，完成后自动回来'}
          </span>
        </span>
        {t.isLoggedIn && !t.isTokenExpired ? (
          <button type="button" className="gbtn plain rounded-full" disabled={leaving} onClick={() => void signOut()}>
            退出
          </button>
        ) : (
          !form && (
            <button type="button" className="solid min-h-10" onClick={signIn}>
              {t.isLoggedIn ? '重新登录' : '登录'}
            </button>
          )
        )}
      </div>
      {form && (
        <form onSubmit={submit} className="flex flex-wrap gap-2.5 pl-12">
          <TextInput
            placeholder="用户名"
            autoComplete="username"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            className="flex-[1_1_160px]"
            aria-label={`${t.name} 用户名`}
          />
          <TextInput
            type="password"
            placeholder="密码"
            autoComplete="current-password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="flex-[1_1_160px]"
            aria-label={`${t.name} 密码`}
          />
          <button type="submit" className="solid min-h-11" disabled={entering || !form.username || !form.password}>
            登录
          </button>
          <button type="button" className="gbtn rounded-full hover:bg-hover" onClick={() => setForm(null)}>
            取消
          </button>
        </form>
      )}
    </div>
  )
}
