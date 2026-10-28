import { useMutation } from '@apollo/client/react'
import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router'
import { toast, toastError } from '@/components/ui/toast'
import { LoginTrackerOAuth } from './queries'
import { consumeOAuthNonce, parseOAuthState } from './tracking'
import { t } from '@/i18n'

/**
 * 追踪网站授权完成后回到这里（地址里带着令牌和 state）。
 * 把完整地址交给服务端解析令牌，然后回到设置的追踪栏目。
 */
export function OAuthCallback() {
  const navigate = useNavigate()
  const [login] = useMutation(LoginTrackerOAuth)
  const state = parseOAuthState(window.location.href)
  const once = useRef(false)

  useEffect(() => {
    if (once.current) return
    once.current = true
    void (async () => {
      if (!state || !consumeOAuthNonce(state.nonce)) toast(t('track.oauthMissing'), 'error')
      else
        try {
          const r = await login({ variables: { trackerId: state.trackerId, callbackUrl: window.location.href } })
          if (r.data?.loginTrackerOAuth.isLoggedIn) toast(t('track.loggedIn', { name: state.trackerName }))
          else toast(t('track.loginFailed', { name: state.trackerName }), 'error')
        } catch (e) {
          toastError(t('track.loginFailed', { name: state.trackerName }), e)
        }
      // 替换掉带令牌的地址，不留在历史记录里
      navigate('/settings/tracking', { replace: true })
    })()
  }, [login, navigate, state])

  return <p className="wrap py-24 text-center text-muted">{t('track.loggingIn', { name: state ? ` ${state.trackerName}` : '' })}</p>
}
