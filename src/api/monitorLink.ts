import { ApolloLink } from '@apollo/client'
import { finalize, tap } from 'rxjs'
import { errorText, getMonitor, GRAPHQL_ERROR, type MonitorHandle, type OpStatus } from './monitor.ts'

/**
 * 请求监视的 Apollo link：放在链路最外层，401 续期后的重试算同一次请求。
 * 只在开发和 Preview 构建接入（见 client.ts）；关闭时原样放行
 */
export function monitorLink() {
  return new ApolloLink((operation, forward) => {
    // 只取名字、类型和变量名，闭包里不留 operation，免得变量值跟着记录活下来
    const kind = operation.operationType
    const h: MonitorHandle | null = getMonitor().begin({
      name: operation.operationName ?? '（未命名）',
      kind,
      vars: Object.keys(operation.variables ?? {}),
    })
    if (!h) return forward(operation)
    // 没等到结束就被取消（离开页面、停止轮询）的，记成取消而不是成功
    let status: Exclude<OpStatus, 'pending'> = 'cancelled'
    let error: string | undefined
    return forward(operation).pipe(
      tap({
        next: (r) => {
          const error = r.errors?.length ? GRAPHQL_ERROR : undefined
          h.event(error)
          // 查询和修改收到结果就算结束：带 GraphQL 错误时 Apollo 拿到结果就退订、不等 complete，
          // 留到 finalize 会被记成取消，耗时也会拖到退订那一刻
          if (kind !== 'subscription') h.end(error ? 'error' : 'ok', error)
        },
        error: (e) => {
          status = 'error'
          error = errorText(e)
        },
        complete: () => {
          status = 'ok'
        },
      }),
      finalize(() => h.end(status, error)),
    )
  })
}
