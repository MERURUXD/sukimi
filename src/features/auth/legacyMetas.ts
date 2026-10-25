/*
 * 升级到多用户服务端（Suwayomi PR #623）时，服务端把原来的全局元数据整体归到第一个账号（id 1）名下，
 * 但键名不改：旧单用户身份（id 0）写的 `sukimi.later.0.*`、`sukimi.nsfw.0.*` 留在 id 1 的账号里，
 * 而前端只查 `.1.` 前缀，导致「稍后再看」清空、NSFW 标记失效。
 * 这里只放纯逻辑（Node 测试直接导入）：算出要把哪些键搬到 id 1 名下。
 */

/** 升级后继承原有数据的账号：服务端迁移时归并到的第一个账号 */
export const LEGACY_HEIR_ID = 1

/** 本机记下已经搬完，之后不再每次启动都去查 */
export const legacyMetasDoneKey = (userId: number) => `suwayomi-web.legacyMetasMigrated.${userId}`

interface Meta {
  key: string
  value: string
}

/**
 * 把 `from` 前缀的键换成 `to` 前缀。
 * - set：要写入的新键；新键已存在时以新的为准，不覆盖
 * - remove：旧键，新键写入成功后再删
 */
export function planPrefixMove(from: string, to: string, old: readonly Meta[], current: readonly Meta[]) {
  const existing = new Set(current.map((m) => m.key))
  const set: Meta[] = []
  const remove: string[] = []
  for (const { key, value } of old) {
    if (!key.startsWith(from)) continue
    const next = to + key.slice(from.length)
    if (!existing.has(next)) set.push({ key: next, value })
    remove.push(key)
  }
  return { set, remove }
}
