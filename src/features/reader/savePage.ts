/**
 * 保存 / 分享页面原图。手机（触屏）优先调起系统分享（可以存到相册或发给别人），
 * 浏览器不支持分享文件时下载到本地；电脑直接下载。
 * 页面图片与前端同源，直接 fetch 带上登录 Cookie；演示模式的页面是本地生成的 data: 地址，不发请求。
 */
const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif', 'image/svg+xml': 'svg' }

/** 文件名里去掉系统不允许的字符 */
const safe = (name: string) => name.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim()

export async function savePages(items: { url: string; name: string }[]) {
  const files = await Promise.all(
    items.map(async ({ url, name }) => {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`图片请求失败（${res.status}）`)
      const blob = await res.blob()
      const type = blob.type.split(';')[0]
      return new File([blob], `${safe(name)}.${EXT[type] ?? 'jpg'}`, { type: type || 'image/jpeg' })
    }),
  )
  const touch = matchMedia('(pointer: coarse)').matches
  if (touch && navigator.canShare?.({ files })) {
    try {
      await navigator.share({ files })
      return
    } catch (e) {
      // 用户关掉了分享面板
      if ((e as Error).name === 'AbortError') return
      // 其他失败（例如图片下载太久、点击带来的分享权限已过期）：改为下载
    }
  }
  for (const file of files) {
    const href = URL.createObjectURL(file)
    const a = document.createElement('a')
    a.href = href
    a.download = file.name
    a.click()
    setTimeout(() => URL.revokeObjectURL(href), 10_000)
  }
}
