import { ApolloClient, ApolloLink, CombinedGraphQLErrors, HttpLink, ServerError } from '@apollo/client'
import { SetContextLink } from '@apollo/client/link/context'
import { ErrorLink } from '@apollo/client/link/error'
import { GraphQLWsLink } from '@apollo/client/link/subscriptions'
import { getMainDefinition } from '@apollo/client/utilities'
import { OperationTypeNode } from 'graphql'
import { createClient } from 'graphql-ws'
import { from, mergeMap } from 'rxjs'
import { getAccessToken, refreshAccessToken, useAuth } from './auth'
import { isDemo } from '@/lib/demo'
import { clearSnapshots } from './persist'
import { resetUserContext } from './userContext'
import { createCache } from './cache'

const ENDPOINT = '/api/graphql'

function isUnauthorized(error: unknown) {
  if (ServerError.is(error)) return error.statusCode === 401
  return CombinedGraphQLErrors.is(error) && error.errors.some((e) => e.message.includes('Unauthorized'))
}

// 令牌过期 → 续期后重试一次
const retryOnUnauthorized = new ErrorLink(({ error, operation, forward }) => {
  if (!isUnauthorized(error) || operation.getContext().authRetried) return
  return from(refreshAccessToken()).pipe(
    mergeMap(() => {
      operation.setContext({ authRetried: true })
      return forward(operation)
    }),
  )
})

const withToken = new SetContextLink((prev) => {
  const token = getAccessToken()
  return token ? { headers: { ...prev.headers, authorization: `Bearer ${token}` } } : {}
})

// 订阅走 WebSocket（graphql-transport-ws）。
// 服务端只在 connection_init 时鉴权，读 payload.Authorization，且要的是不带 "Bearer " 的裸令牌。
export const wsClient = createClient({
  url: `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}${ENDPOINT}`,
  lazy: true,
  retryAttempts: Infinity,
  // 服务端（Jetty）空闲 30 秒会断开连接，没有下载时订阅很安静，靠心跳保活
  keepAlive: 15_000,
  connectionParams: async () => ({ Authorization: getAccessToken() ?? (await refreshAccessToken()) }),
})
const wsLink = new GraphQLWsLink(wsClient)

const transport = ApolloLink.split(
  ({ query }) => {
    const def = getMainDefinition(query)
    return def.kind === 'OperationDefinition' && def.operation === OperationTypeNode.SUBSCRIPTION
  },
  wsLink,
  // 演示页使用独立的本地客户端；万一误用了这个客户端，也不让请求真的发到服务端
  new HttpLink({ uri: ENDPOINT, fetch: isDemo ? () => Promise.reject(new TypeError('演示模式不会请求真实服务端')) : undefined }),
)

export const apollo = new ApolloClient({
  link: ApolloLink.from([retryOnUnauthorized, withToken, transport]),
  cache: createCache(),
})

// 退出登录时清掉缓存，避免下一个账号看到上一个账号的书库
useAuth.subscribe((s, prev) => {
  if (s.status !== 'signedOut' || prev.status === 'signedOut') return
  // 启动时发现登录已过期（checking → signedOut）也要清掉本地快照
  void clearSnapshots()
  resetUserContext()
  if (prev.status === 'signedIn') {
    wsClient.terminate()
    void apollo.clearStore()
  }
})

const sameRights = (a: { roles: string[]; permissions: string[] }, b: { roles: string[]; permissions: string[] }) =>
  a.roles.join() === b.roles.join() && a.permissions.join() === b.permissions.join()

// 已登录状态下用户变了（启动时发现保存的身份与服务端不符等）：丢掉上一个用户的缓存、快照与连接，
// 订阅用旧令牌建立的连接也要断开重连。页面树由 AuthGate 按用户 id 重建。
// 同一个用户的角色或权限变了（管理员改了权限，下次续期才发现）同样算身份环境变了：
// 缓存里按旧权限取到的数据（如成人来源）不能继续显示，订阅只在建立连接时鉴权，也要重连。
// 这时页面不会重建，所以用 resetStore 清空后让正在显示的查询重新请求。
useAuth.subscribe((s, prev) => {
  if (s.status !== 'signedIn' || !s.user || !prev.user) return
  const switched = s.user.id !== prev.user.id
  // 启动时从保存的身份（还没有角色权限）过渡到服务端给出的真实身份，不算权限变化
  const rights = !switched && prev.status === 'signedIn' && !sameRights(s.user, prev.user)
  if (!switched && !rights) return
  void clearSnapshots()
  resetUserContext()
  wsClient.terminate()
  void (rights ? apollo.resetStore().catch(() => {}) : apollo.clearStore())
})
