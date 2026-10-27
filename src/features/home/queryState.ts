/** 首页一块数据现在该怎么画。没有数据且失败时不能再当成「还在加载」。有快照时继续显示，并标成这次没同步上。 */
export function homeBlockState(hasData: boolean, loading: boolean, failed: boolean) {
  if (!hasData) {
    if (failed) return 'error' as const
    if (loading) return 'loading' as const
    return 'empty' as const
  }
  return failed ? 'stale' as const : 'ready' as const
}
