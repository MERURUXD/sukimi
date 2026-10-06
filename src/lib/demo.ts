/** 演示入口用完整页面导航进出，避免沿用登录状态、内存缓存和订阅。 */
export const isDemoPath = (path: string) => path === '/demo' || path.startsWith('/demo/')
export const isDemo = isDemoPath(window.location.pathname)
export const preferenceKey = (key: string) => isDemo ? `${key}.demo` : key
