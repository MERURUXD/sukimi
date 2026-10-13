/** 演示入口用完整页面导航进出，避免沿用登录状态、内存缓存和订阅。 */
export const isDemoPath = (path: string) => path === '/demo' || path.startsWith('/demo/')
export const isDemo = isDemoPath(window.location.pathname)
export const preferenceKey = (key: string) => isDemo ? `${key}.demo` : key
/**
 * 开发环境和 Preview 的虚构验收页（/dev/*，不含需要登录的调参页 /dev/glass）：不登录，用虚构用户，不读写本地快照。
 * 条件须与 app/router.tsx 注册 /dev/* 的条件一致，否则页面会带着真实登录打开
 */
export const isDevLab = (import.meta.env.DEV || __APP_CHANNEL__ === 'preview') && /^\/dev\/(?!glass)/.test(window.location.pathname)
