/*
 * 模块里按「当前账号与权限」缓存的数据（来源浏览结果、搜索结果等）登记在这里。
 * 退出登录、换账号、同一账号的角色权限变化时统一清空，避免下一个身份直接用上一个身份取到的内容
 * （其中还有按用户的 inLibrary 标记，以及按旧权限才看得到的来源）。
 */
const resets = new Set<() => void>()

export function resetOnUserContext(fn: () => void) {
  resets.add(fn)
}

export function resetUserContext() {
  for (const fn of resets) fn()
}
