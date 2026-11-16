/*
 * 升级到多用户服务端（Suwayomi PR #623）后，旧单用户（id 0）的元数据留在 id 1 名下但键名不变，
 * 前端只查 `.1.` 前缀会丢数据；这里只放纯逻辑，算出要搬的键。
 */

/** 升级后继承原有数据的账号：服务端迁移时归并到的第一个账号 */
export const LEGACY_HEIR_ID = 1

export const legacyMetasDoneKey = (userId: number) => `suwayomi-web.legacyMetasMigrated.${userId}`

interface Meta {
  key: string
  value: string
}

/** 新键已存在时不覆盖；旧键由调用方在新键写入后删除。 */
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
