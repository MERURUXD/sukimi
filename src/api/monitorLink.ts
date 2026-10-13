import { ApolloLink } from '@apollo/client'
import { finalize, tap } from 'rxjs'
import { errorText, getMonitor, GRAPHQL_ERROR, type MonitorHandle, type OpStatus } from './monitor'

/**
 * 请求监视的 Apollo link：放在链路最外层，401 续期后的重试算同一次请求。
 * 只在开发和 Preview 构建接入（见 client.ts）；关闭时原样放行
 */
export function monitorLink() {
  return new ApolloLink((operation, forward) => {
    // 只取名字和变量名，闭包里不留 operation，免得变量值跟着记录活下来
    const h: MonitorHandle | null = getMonitor().begin({
      name: operation.operationName ?? '（未命名）',
      kind: operation.operationType,
      vars: Object.keys(operation.variables ?? {}),
    })
    if (!h) return forward(operation)
    // 没等到结束就被取消（离开页面、停止轮询）的，记成取消而不是成功
    let status: Exclude<OpStatus, 'pending'> = 'cancelled'
    let error: string | undefined
    return forward(operation).pipe(
      tap({
        next: (r) => h.event(r.errors?.length ? GRAPHQL_ERROR : undefined),
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
