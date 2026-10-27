import { statSync } from 'node:fs'
import { isAbsolute, relative, resolve, sep } from 'node:path'

/**
 * 开发服务器上 `/dev-data/open-comics` 后面的路径，解析成缓存目录里的文件。
 * 越界（包括 `open-comics` 的兄弟目录）、目录、不存在的路径、畸形的 % 编码都返回 null，调用方应交给下一个中间件。
 */
export function openComicsFile(root: string, url: string | undefined): string | null {
  const pathname = (url ?? '/').split('?')[0]
  let decoded: string
  try {
    decoded = decodeURIComponent(pathname)
  } catch {
    return null
  }
  const file = resolve(root, decoded.replace(/^[/\\]+/, ''))
  const rel = relative(root, file)
  if (rel === '' || isAbsolute(rel) || rel.split(sep).includes('..')) return null
  try {
    if (!statSync(file).isFile()) return null
  } catch {
    return null
  }
  return file
}
