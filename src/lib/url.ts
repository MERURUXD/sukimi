/**
 * 外链只留下 http 和 https。javascript:、data: 以及无法解析的地址返回 null，调用方不渲染链接。
 * 以 # 开头的是当前页锚点（演示数据用 # 占位），不会离开本页。
 */
export function httpUrl(value: string | null | undefined): string | null {
  if (!value) return null
  if (value.startsWith('#') && !/[\s\\]/.test(value)) return value
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return null
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
  return value
}
