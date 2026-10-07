/** 服务端因为账号权限不够而拒绝时的提示，替代原始的 Forbidden 报错 */
export const FORBIDDEN_TEXT = '没有权限，请联系管理员'

/** 把请求错误整理成一行可读的文字 */
export function errorText(e: unknown) {
  const msg = (e as Error)?.message?.split('\n')[0] ?? String(e)
  return /Forbidden/i.test(msg) ? FORBIDDEN_TEXT : msg
}
