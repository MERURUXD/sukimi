/*
 * 「稍后再看」存在服务端的全局元数据里，一部漫画一个键，值是加入时间（秒）。
 * 漫画元数据没法按键反查出是哪些漫画，不在书库里的也要能列出来，所以用全局元数据当索引；
 * 一部一个键，两台设备同时加入或移出不同漫画时不会互相覆盖。
 * 键里带上账号 id：不依赖服务端是否按用户隔离全局元数据，各账号的清单都互不影响。
 * 这里只放纯逻辑（Node 测试直接导入），不依赖 React、Apollo 或路径别名。
 */

export const LATER_PREFIX = 'sukimi.later.'

/** 某个账号的键前缀；旧服务端的单用户身份 id 为 0，同样适用 */
export const laterPrefix = (userId: number) => `${LATER_PREFIX}${userId}.`

export const laterKey = (userId: number, mangaId: number) => `${laterPrefix(userId)}${mangaId}`

/** 该账号的 漫画 id → 加入时间（秒）；别的账号的键、别的客户端写坏的键和值直接忽略 */
export function parseLater(userId: number, metas: readonly { key: string; value: string }[] = []) {
  const prefix = laterPrefix(userId)
  const out = new Map<number, number>()
  for (const { key, value } of metas) {
    if (!key.startsWith(prefix)) continue
    const id = Number(key.slice(prefix.length))
    const at = Number(value)
    if (Number.isSafeInteger(id) && id > 0 && Number.isFinite(at) && at >= 0) out.set(id, at)
  }
  return out
}

/**
 * 加入之后把已有章节都读完了：可以自动移出。
 * - 没有章节（不在书库的漫画常常还没抓过章节）时未读数也是 0，不能算读完；
 * - 加入前就已经读完的（比如追平了等更新），要等加入之后再读过才算，否则一加入就被移走。
 * lastReadAt 与 at 都是秒。
 */
export function caughtUp(p: { hasChapters: boolean; unread: number; lastReadAt: number }, at: number) {
  return p.hasChapters && p.unread === 0 && p.lastReadAt > at
}
