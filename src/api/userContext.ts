/*
 * 模块里按「当前账号与权限」缓存的数据（来源浏览结果、搜索结果等）登记在这里。
 * 退出登录、换账号、同一账号的角色权限变化时统一清空，避免下一个身份直接用上一个身份取到的内容
 * （其中还有按用户的 inLibrary 标记，以及按旧权限才看得到的来源）。
 */
import { useAuth } from './auth'

const resets = new Set<() => void>()

export function resetOnUserContext(fn: () => void) {
  resets.add(fn)
}

let generation = 0

/** 身份环境的代数：每次重置加一。异步任务开始时记下，返回后对不上就丢弃结果 */
export const contextGeneration = () => generation

export function resetUserContext() {
  generation++
  for (const fn of resets) fn()
}

/** 账号在异步流程进行中被换掉了 */
export class StaleSessionError extends Error {
  constructor() {
    super('账号已切换，这次操作已中止')
  }
}

/**
 * 多步操作（先查再改、连续几次修改）开始时调用，返回的检查函数在每次 await 之后调用：
 * 期间换了账号就抛出 StaleSessionError。卸载页面不会取消已经在跑的异步函数，
 * 不检查的话后面的请求会带着新账号的令牌发出。
 */
export function captureUser() {
  const id = useAuth.getState().user?.id
  return () => {
    if (useAuth.getState().user?.id !== id) throw new StaleSessionError()
  }
}
