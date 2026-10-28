import { useMutation, useQuery } from '@apollo/client/react'
import { useState, type FormEvent } from 'react'
import { confirm } from '@/components/ui/Confirm'
import { toast, toastError } from '@/components/ui/toast'
import { SourceIcon } from '@/features/browse/SourceIcon'
import { LoginTrackerCredentials, LogoutTracker, Trackers, type Tracker } from '@/features/tracking/queries'
import { oauthUrl } from '@/features/tracking/tracking'
import { Section, TextInput } from '../parts'
import { t as tl } from '@/i18n'

export function TrackingTab() {
  const { data, error } = useQuery(Trackers)
  const trackers = data?.trackers.nodes
  return (
    <Section
      title={tl('cfg.tracking.title')}
      desc={tl('cfg.tracking.desc')}
    >
      {error && !trackers && <span className="text-sm text-danger">{tl('cfg.tracking.loadFailed', { reason: error.message.split('\n')[0] })}</span>}
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
    if (!oauth) {
      setForm({ username: '', password: '' })
      return
    }
    // 跳到追踪网站授权，完成后回到 /tracker/login/oauth（features/tracking/OAuthCallback）
    const url = oauthUrl({ id: t.id, name: t.name, authUrl: t.authUrl! }, window.location.origin)
    if (!url) {
      toast(tl('cfg.tracking.authFailed'), 'error')
      return
    }
    window.location.assign(url)
  }

  const signOut = async () => {
    const ok = await confirm({ title: tl('cfg.tracking.signOutTitle', { name: t.name }), body: tl('cfg.tracking.signOutBody'), ok: tl('cfg.tracking.signOutOk') })
    if (!ok) return
    try {
      await logout({ variables: { trackerId: t.id } })
      toast(tl('cfg.tracking.signedOut', { name: t.name }))
    } catch (e) {
      toastError(tl('cfg.tracking.signOutFailed'), e)
    }
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!form) return
    try {
      const r = await login({ variables: { trackerId: t.id, ...form } })
      if (r.data?.loginTrackerCredentials.isLoggedIn) {
        setForm(null)
        toast(tl('cfg.tracking.signedIn', { name: t.name }))
      } else toast(tl('cfg.tracking.signInFailedFor', { name: t.name }), 'error')
    } catch (err) {
      toastError(tl('cfg.tracking.signInFailed'), err)
    }
  }

  const state = !t.isLoggedIn ? tl('cfg.tracking.notLoggedIn') : t.isTokenExpired ? tl('cfg.tracking.expired') : tl('cfg.tracking.loggedIn')

  return (
    <div className="flex flex-col gap-3 rounded-2xl py-2 pr-1 pl-2 hover:bg-hover">
      <div className="flex items-center gap-3">
        <SourceIcon s={{ iconUrl: t.icon, displayName: t.name }} size={36} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-semibold">{t.name}</span>
          <span className={t.isLoggedIn && t.isTokenExpired ? 'text-[13px] font-medium text-danger' : 'text-[13px] text-muted'}>
            {state}
            {!t.isLoggedIn && oauth && tl('cfg.tracking.oauth')}
          </span>
        </span>
        {t.isLoggedIn && !t.isTokenExpired ? (
          <button type="button" className="gbtn plain rounded-full" disabled={leaving} onClick={() => void signOut()}>
            {tl('cfg.tracking.signOut')}
          </button>
        ) : (
          !form && (
            <button type="button" className="solid min-h-10" onClick={signIn}>
              {t.isLoggedIn ? tl('cfg.tracking.relogin') : tl('cfg.tracking.login')}
            </button>
          )
        )}
      </div>
      {form && (
        <form onSubmit={submit} className="flex flex-wrap gap-2.5 pl-12">
          <TextInput
            placeholder={tl('cfg.username')}
            autoComplete="username"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            className="flex-[1_1_160px]"
            aria-label={tl('cfg.tracking.usernameAria', { name: t.name })}
          />
          <TextInput
            type="password"
            placeholder={tl('cfg.password')}
            autoComplete="current-password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="flex-[1_1_160px]"
            aria-label={tl('cfg.tracking.passwordAria', { name: t.name })}
          />
          <button type="submit" className="solid min-h-11" disabled={entering || !form.username || !form.password}>
            {tl('cfg.tracking.login')}
          </button>
          <button type="button" className="gbtn rounded-full hover:bg-hover" onClick={() => setForm(null)}>
            {tl('common.cancel')}
          </button>
        </form>
      )}
    </div>
  )
}
