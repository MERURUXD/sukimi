// 官方 WebUI 在同一地址注册过 Service Worker（/sw.js，带离线缓存）。
// 换成本前端后，浏览器检查更新时会拿到这个文件：它立即接管、清掉旧缓存、注销自己，
// 再刷新已打开的页面，之后就不会再从旧缓存里拿到官方界面。本前端自己不使用 Service Worker。
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.map((k) => caches.delete(k)))
      await self.registration.unregister()
      const clients = await self.clients.matchAll({ type: 'window' })
      for (const c of clients) c.navigate(c.url)
    })(),
  )
})
