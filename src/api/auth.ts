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
import { isDemo, isDevLab } from '@/lib/demo'
import { graphql } from './gql'
import { can, type AuthUser } from '@/features/auth/permissions'
import { PREVIEW_ADMIN } from '@/features/auth/previewUsers'
import { claimLegacyData } from '@/features/auth/userScope'
import type { UserPermission } from './gql/graphql'

const REFRESH_KEY = 'suwayomi-web.refreshToken'
/** 只存 id 与用户名，让各本地存储在首屏前就能知道当前是谁；角色与权限每次续期时重新查询 */
const USER_KEY = 'suwayomi-web.user'
const COOKIE = 'suwayomi-server-token'
/** 提前多久续期 */
const LEEWAY = 60_000

export type AuthStatus = 'checking' | 'signedIn' | 'signedOut' | 'unreachable'

/** 旧服务端没有 `user` 查询时的身份；id 0 不会和服务端分配的真实用户（从 1 起）重合 */
const LEGACY_USER: AuthUser = { id: 0, username: '', roles: ['ADMIN'], permissions: [], legacy: true }

function readStoredUser(): AuthUser | null {
  // 演示与虚构验收页：默认虚构管理员，各功能入口都能看到
  if (isDemo || isDevLab) return PREVIEW_ADMIN
  try {
    const v = JSON.parse(localStorage.getItem(USER_KEY) ?? 'null')
    if (typeof v?.id !== 'number' || typeof v.username !== 'string') return null
    return { id: v.id, username: v.username, roles: [], permissions: [], legacy: v.id === 0 || undefined }
  } catch {
    return null
  }
}

/** status 为 signedIn 时 user 一定不为空 */
export const useAuth = create<{ status: AuthStatus; user: AuthUser | null }>(() => ({
  status: 'checking',
  user: readStoredUser(),
}))

export const useCan = (permission: UserPermission) => useAuth((s) => can(s.user, permission))

const LoginMutation = graphql(`
  mutation Login($input: LoginInput!) {
    login(input: $input) {
      accessToken
      refreshToken
    }
  }
`)

const CurrentUser = graphql(`
  query CurrentUser {
    user {
      id
      username
      roles
      permissions
    }
  }
`)

// 兑换返回里不选 user.permissions：刚兑换时还没登录，读它会报未授权，登录后再查当前用户
const RedeemRegistrationMutation = graphql(`
  mutation RedeemRegistrationCode($input: RedeemRegistrationCodeInput!) {
    redeemRegistrationCode(input: $input) {
      accessToken
      refreshToken
    }
  }
`)

const RedeemRecoveryMutation = graphql(`
  mutation RedeemRecoveryCode($input: RedeemRecoveryCodeInput!) {
    redeemRecoveryCode(input: $input) {
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
/**
 * 会话代数：登录、兑换码每次开始都加一。更早发起的续期（比如启动时还没返回的恢复会话）
 * 返回后发现代数变了就作废，不能覆盖刚建立的新会话，也不能因为它失败把新会话登出。
 */
let epoch = 0
const startNewSession = () => {
  inflight = null
  return ++epoch
}

export class AuthError extends Error {}

/** 当前会话的代数（登录、退出、兑换会改变它；普通续期不会）。请求发出时记下，401 重放前核对 */
export const getSessionEpoch = () => epoch

export function getAccessToken() {
  return accessToken
}

/** 不带 Cookie 与登录态直接请求（登录、续期用）；`token` 只给取当前用户这类刚拿到令牌、尚未生效的请求 */
async function anonymousRequest<R, V>(doc: TypedDocumentNode<R, V>, variables: V, token?: string): Promise<R> {
  if (isDemo) throw new TypeError('演示模式不会请求真实服务端')
  let res: Response
  try {
    res = await fetch('/api/graphql', {
      method: 'POST',
      // 过期 Cookie 不能跟着登录请求发出去
      credentials: 'omit',
      headers: { 'content-type': 'application/json', ...(token && { authorization: `Bearer ${token}` }) },
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

/** 服务端不认识这个字段 / 操作（旧版本，没有用户账号功能） */
const isMissingField = (e: unknown) => e instanceof AuthError && /FieldUndefined|Cannot query field|is undefined/i.test(e.message)

/** 用刚拿到的访问令牌查当前用户；服务端没有 `user` 查询（旧版本）时退化为单用户管理员 */
async function fetchUser(token: string): Promise<AuthUser> {
  try {
    const { user } = await anonymousRequest(CurrentUser, {}, token)
    return { id: user.id, username: user.username, roles: user.roles, permissions: user.permissions }
  } catch (e) {
    if (isMissingField(e)) return LEGACY_USER
    throw e
  }
}

const sameUser = (a: AuthUser | null, b: AuthUser) =>
  !!a &&
  a.id === b.id &&
  a.username === b.username &&
  !!a.legacy === !!b.legacy &&
  a.roles.join() === b.roles.join() &&
  a.permissions.join() === b.permissions.join()

/**
 * 拿到令牌后的统一收尾（登录、兑换码、续期共用）：先查用户，成功后才写入令牌与身份，
 * 这样查询失败时不会留下半个登录态。`refreshToken` 续期时不传，沿用已保存的。
 */
async function establishSession(token: string, refreshToken?: string, guard?: number) {
  const user = await fetchUser(token)
  // 等用户信息期间已有更新的登录：这份结果过期了，丢弃
  if (guard !== undefined && guard !== epoch) return
  if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken)
  // 先认领旧偏好再公布新用户，各存储随后重新读取时就能读到
  try {
    claimLegacyData(localStorage, user.id)
  } catch {
    /* 存储不可用就从默认值开始 */
  }
  localStorage.setItem(USER_KEY, JSON.stringify({ id: user.id, username: user.username }))
  applyAccessToken(token)
  // 内容没变就沿用原对象，避免每 5 分钟续期都让订阅了 user 的组件重渲染
  const prev = useAuth.getState().user
  useAuth.setState({ status: 'signedIn', user: sameUser(prev, user) ? prev : user })
}

export async function login(username: string, password: string) {
  const mine = startNewSession()
  const { login } = await anonymousRequest(LoginMutation, { input: { username, password } })
  // 更晚开始的登录 / 兑换已经接手，这份结果就丢弃（见 epoch 的说明）
  await establishSession(login.accessToken, login.refreshToken, mine)
}

const UNSUPPORTED = '这台服务端不支持用户账号，需要新版 Suwayomi'

/** 兑换注册码：创建账号并直接登录 */
export async function redeemRegistrationCode(code: string, username: string, password: string) {
  const mine = startNewSession()
  try {
    const { redeemRegistrationCode: r } = await anonymousRequest(RedeemRegistrationMutation, { input: { code, username, password } })
    await establishSession(r.accessToken, r.refreshToken, mine)
  } catch (e) {
    throw isMissingField(e) ? new AuthError(UNSUPPORTED) : e
  }
}

/** 兑换找回码：设置新密码并直接登录 */
export async function redeemRecoveryCode(code: string, newPassword: string) {
  const mine = startNewSession()
  try {
    const { redeemRecoveryCode: r } = await anonymousRequest(RedeemRecoveryMutation, { input: { code, newPassword } })
    await establishSession(r.accessToken, r.refreshToken, mine)
  } catch (e) {
    throw isMissingField(e) ? new AuthError(UNSUPPORTED) : e
  }
}

export function signOut() {
  // 退出也是一次会话变化：还在路上的续期 / 登录返回后不能把令牌和用户再写回来
  startNewSession()
  clearTimeout(refreshTimer)
  accessToken = null
  accessExp = 0
  localStorage.removeItem(REFRESH_KEY)
  localStorage.removeItem(USER_KEY)
  document.cookie = `${COOKIE}=; path=/; max-age=0`
  useAuth.setState({ status: 'signedOut', user: null })
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
  const started = epoch
  const request: Promise<string> = anonymousRequest(RefreshMutation, { input: { refreshToken } })
    .then(async ({ refreshToken: r }) => {
      await establishSession(r.accessToken, undefined, started)
      // 期间已退出或换了会话：不能让等着重放请求的 retryOnUnauthorized 拿着新会话的令牌去执行旧会话的操作
      if (started !== epoch) throw new AuthError('会话已更换')
      return r.accessToken
    })
    .catch((e: unknown) => {
      // 过期的续期失败不能把后来建立的新会话登出
      if (e instanceof AuthError && started === epoch) signOut()
      throw e
    })
    .finally(() => {
      if (inflight === request) inflight = null
    })
  inflight = request
  return request
}

/** 启动时恢复会话 */
export async function restoreSession() {
  if (!localStorage.getItem(REFRESH_KEY)) {
    useAuth.setState({ status: 'signedOut', user: null })
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
