/*
 * 本地偏好按用户分开存。键名规则：
 * - 演示：`<base>.demo`，不分用户
 * - 旧服务端的单用户（id 0）：沿用原键 `<base>`，升级前后的数据不用搬
 * - 真实用户：`<base>.u<id>`
 * - 还不知道是谁（未登录）：没有键，什么都不读不写
 * 外观类偏好（appearance、glass）整台设备共用，不走这里。
 */
export const USER_KEYS = {
  library: 'suwayomi-web.library',
  reader: 'suwayomi-web.reader',
  chapters: 'suwayomi-web.chapters',
  extensions: 'suwayomi-web.extensions',
  /** 隐藏 / 模糊 NSFW 的本机开关；升级前原有的设置由第一个账号继承 */
  nsfw: 'suwayomi-web.nsfw',
} as const

/** 旧数据已被某个账号认领的标记，值为认领者的用户 id */
export const LEGACY_CLAIMED_KEY = 'suwayomi-web.legacyClaimed'

export function scopedKey(base: string, userId: number | null | undefined, demo = false): string | null {
  if (demo) return `${base}.demo`
  if (userId == null) return null
  return userId === 0 ? base : `${base}.u${userId}`
}

type KeyValueStore = Pick<Storage, 'getItem' | 'setItem'>

/**
 * 升级到多用户后，第一个登录的真实账号认领旧的无后缀偏好（复制到它自己的键）。
 * 旧键保留不删，便于回退；之后登录的其他账号从默认值开始。旧服务端的单用户（id 0）本来就用旧键。
 */
export function claimLegacyData(storage: KeyValueStore, userId: number, bases: readonly string[] = Object.values(USER_KEYS)) {
  if (userId === 0 || storage.getItem(LEGACY_CLAIMED_KEY) !== null) return
  for (const base of bases) {
    const old = storage.getItem(base)
    const mine = scopedKey(base, userId)!
    if (old !== null && storage.getItem(mine) === null) storage.setItem(mine, old)
  }
  storage.setItem(LEGACY_CLAIMED_KEY, String(userId))
}

/** 快照只给保存它的那个用户用；版本不符的旧快照也作废 */
export const snapshotUsable = (snap: { v: number; userId: number } | undefined, version: number, userId: number | undefined) =>
  !!snap && userId !== undefined && snap.v === version && snap.userId === userId

/** 有本地快照、且不按权限跳转的页面：登录验证完成前就先用快照显示 */
const EARLY_PATHS = new Set(['/', '/library', '/updates'])

/**
 * 重开页面时是否不等登录验证、先显示上次的内容。
 * 只给本机记得上次是谁登录的情况（验证在后台进行，失败照常跳登录页），
 * 并且要等快照读完，否则先渲染的空页面不会再换成快照
 */
export function showBeforeVerified(status: string, userId: number | undefined, snapshotsLoaded: boolean, pathname: string) {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  return status === 'checking' && userId !== undefined && snapshotsLoaded && EARLY_PATHS.has(path)
}
