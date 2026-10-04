/*
 * 登录与令牌（服务端 authMode = UI_LOGIN）
 *
 * - access token（默认 5 分钟）：存内存，同时写进 `suwayomi-server-token` Cookie。
 *   服务端认这个 Cookie，所以 <img> 封面 / 漫画页和 WebSocket 订阅都能直接鉴权。
 * - refresh token（默认 60 天）：存 localStorage，用来静默续期；服务端不轮换它。
 * - 账号密码只在登录时发送一次，任何地方都不保存。
 */
import type { TypedDocumentNode } from '@apollo/client'
import { print } from 'graphql'
import { create } from 'zustand'
import { graphql } from './gql'

const REFRESH_KEY = 'suwayomi-web.refreshToken'
const COOKIE = 'suwayomi-server-token'
/** 提前多久续期 */
const LEEWAY = 60_000

export type AuthStatus = 'checking' | 'signedIn' | 'signedOut' | 'unreachable'

export const useAuth = create<{ status: AuthStatus }>(() => ({ status: 'checking' }))

const LoginMutation = graphql(`
  mutation Login($input: LoginInput!) {
    login(input: $input) {
      accessToken
      refreshToken
    }
  }
`)

const RefreshMutation = graphql(`
  mutation RefreshToken($input: RefreshTokenInput!) {
    refreshToken(input: $input) {
      accessToken
    }
  }
`)

let accessToken: string | null = null
let accessExp = 0
let refreshTimer: ReturnType<typeof setTimeout> | undefined
let inflight: Promise<string> | null = null

export class AuthError extends Error {}

export function getAccessToken() {
  return accessToken
}

/** 不带任何令牌直接请求（登录、续期用） */
async function anonymousRequest<R, V>(doc: TypedDocumentNode<R, V>, variables: V): Promise<R> {
  let res: Response
  try {
    res = await fetch('/api/graphql', {
      method: 'POST',
      // 过期 Cookie 不能跟着登录请求发出去
      credentials: 'omit',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: print(doc), variables }),
    })
  } catch (e) {
    throw new TypeError(`无法连接服务器：${(e as Error).message}`)
  }
  if (!res.ok && res.status >= 500) throw new TypeError(`服务器错误 ${res.status}`)
  const json = (await res.json()) as { data?: R; errors?: { message: string }[] }
  if (json.errors?.length || !json.data) {
    throw new AuthError(json.errors?.[0]?.message.split('\n')[0] ?? '请求失败')
  }
  return json.data
}

function jwtExpiry(token: string) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    return typeof payload.exp === 'number' ? payload.exp * 1000 : 0
  } catch {
    return 0
  }
}

function applyAccessToken(token: string) {
  accessToken = token
  accessExp = jwtExpiry(token)
  const expires = accessExp ? `; expires=${new Date(accessExp).toUTCString()}` : ''
  document.cookie = `${COOKIE}=${token}; path=/; SameSite=Strict${expires}`

  clearTimeout(refreshTimer)
  if (accessExp) {
    const wait = Math.min(Math.max(accessExp - Date.now() - LEEWAY, 5_000), 2 ** 31 - 1)
    refreshTimer = setTimeout(() => void refreshAccessToken().catch(() => {}), wait)
  }
}

export async function login(username: string, password: string) {
  const { login } = await anonymousRequest(LoginMutation, { input: { username, password } })
  localStorage.setItem(REFRESH_KEY, login.refreshToken)
  applyAccessToken(login.accessToken)
  useAuth.setState({ status: 'signedIn' })
}

export function signOut() {
  clearTimeout(refreshTimer)
  accessToken = null
  accessExp = 0
  localStorage.removeItem(REFRESH_KEY)
  document.cookie = `${COOKIE}=; path=/; max-age=0`
  useAuth.setState({ status: 'signedOut' })
}

/**
 * 用 refresh token 换新的 access token。并发调用共享同一次请求。
 * refresh token 失效 → 退出登录；网络问题 → 抛出但保留登录态。
 */
export function refreshAccessToken(): Promise<string> {
  if (inflight) return inflight
  const refreshToken = localStorage.getItem(REFRESH_KEY)
  if (!refreshToken) {
    signOut()
    return Promise.reject(new AuthError('未登录'))
  }
  const request = anonymousRequest(RefreshMutation, { input: { refreshToken } })
    .then(({ refreshToken: r }) => {
      applyAccessToken(r.accessToken)
      if (useAuth.getState().status !== 'signedIn') useAuth.setState({ status: 'signedIn' })
      return r.accessToken
    })
    .catch((e: unknown) => {
      if (e instanceof AuthError) signOut()
      throw e
    })
    .finally(() => {
      inflight = null
    })
  inflight = request
  return request
}

/** 启动时恢复会话 */
export async function restoreSession() {
  if (!localStorage.getItem(REFRESH_KEY)) {
    useAuth.setState({ status: 'signedOut' })
    return
  }
  try {
    await refreshAccessToken()
  } catch (e) {
    if (!(e instanceof AuthError)) useAuth.setState({ status: 'unreachable' })
  }
}

// 标签页休眠时定时器会被节流，回到前台时补一次续期
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible' || useAuth.getState().status !== 'signedIn') return
  if (!accessExp || accessExp - Date.now() < LEEWAY) void refreshAccessToken().catch(() => {})
})
