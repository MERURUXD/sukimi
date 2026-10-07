import type { TypedDocumentNode } from '@apollo/client'
import { print } from 'graphql'
import { getAccessToken, getSessionEpoch, refreshAccessToken } from './auth'
import { isDemo } from '@/lib/demo'

/** 变量里文件所在位置的占位（实际文件通过 files 传入） */
export const FILE_SLOT = null as unknown as File

/**
 * 带文件的 GraphQL 请求（GraphQL multipart request 规范）。
 * Apollo 的 HttpLink 不支持上传，只有恢复备份这类少数操作用到，单独发。
 *
 * files 的键是变量里的路径（如 "input.backup"），对应位置在 variables 里填 FILE_SLOT。
 */
export async function uploadRequest<R, V extends Record<string, unknown>>(
  doc: TypedDocumentNode<R, V>,
  variables: V,
  files: Record<string, File>,
): Promise<R> {
  if (isDemo) throw new Error('演示模式不上传文件，请退出演示后登录服务器')
  const send = async (token: string | null) => {
    const form = new FormData()
    form.append('operations', JSON.stringify({ query: print(doc), variables }))
    const paths = Object.keys(files)
    form.append('map', JSON.stringify(Object.fromEntries(paths.map((p, i) => [String(i), [`variables.${p}`]]))))
    paths.forEach((p, i) => form.append(String(i), files[p]))
    return fetch('/api/graphql', {
      method: 'POST',
      body: form,
      headers: token ? { authorization: `Bearer ${token}` } : {},
    })
  }

  const epoch = getSessionEpoch()
  let res = await send(getAccessToken())
  if (res.status === 401) {
    const token = await refreshAccessToken()
    // 上传期间会话换了：不重放，免得用新会话的令牌上传旧会话选的文件
    if (epoch !== getSessionEpoch()) throw new Error('会话已更换，上传已取消')
    res = await send(token)
  }
  const json = (await res.json()) as { data?: R; errors?: { message: string }[] }
  if (json.errors?.length || !json.data) throw new Error(json.errors?.[0]?.message ?? `请求失败（${res.status}）`)
  return json.data
}
