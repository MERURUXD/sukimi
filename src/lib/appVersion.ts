/**
 * 从首页 HTML 里取出入口脚本地址。打包后的入口文件名带内容哈希，
 * 部署新版本后必然变化，用它判断「服务端上的前端已经换了」，不需要另外生成版本文件。
 */
export function entryScript(html: string): string | undefined {
  for (const [tag] of html.matchAll(/<script\b[^>]*>/gi)) {
    if (!/\btype\s*=\s*["']?module\b/i.test(tag)) continue
    const src = /\bsrc\s*=\s*["']?([^"'\s>]+)/i.exec(tag)?.[1]
    if (src) return src
  }
}
