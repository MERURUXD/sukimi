/** 演示入口用完整页面导航进出，避免沿用登录状态、内存缓存和订阅。 */
export const isDemoPath = (path: string) => path === '/demo' || path.startsWith('/demo/')
export const isDemo = isDemoPath(window.location.pathname)
export const preferenceKey = (key: string) => isDemo ? `${key}.demo` : key
/** 仅开发环境的虚构验收页（/dev/*，不含需要登录的调参页 /dev/glass）：不登录，用虚构用户 */
export const isDevLab = import.meta.env.DEV && /^\/dev\/(?!glass)/.test(window.location.pathname)
