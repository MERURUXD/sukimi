/*
 * 「特别关心」和「稍后再看」一样存在服务端的全局元数据里：一部漫画一个键，值是标记时间（秒），键里带账号 id。
 * 服务端只检查书库里漫画的更新，所以只在书库里显示；移出书库时标记保留，加回书库就恢复。
 * 这里只放纯逻辑（Node 测试直接导入），不依赖 React、Apollo 或路径别名。
 */

export const FAVORITE_PREFIX = 'sukimi.favorite.'

/** 某个账号的键前缀；旧服务端的单用户身份 id 为 0，同样适用 */
export const favoritePrefix = (userId: number) => `${FAVORITE_PREFIX}${userId}.`

export const favoriteKey = (userId: number, mangaId: number) => `${favoritePrefix(userId)}${mangaId}`

/** 该账号的 漫画 id → 标记时间（秒）；别的账号的键、写坏的键和值直接忽略 */
export function parseFavorites(userId: number, metas: readonly { key: string; value: string }[] = []) {
  const prefix = favoritePrefix(userId)
  const out = new Map<number, number>()
  for (const { key, value } of metas) {
    if (!key.startsWith(prefix)) continue
    const id = Number(key.slice(prefix.length))
    const at = Number(value)
    if (Number.isSafeInteger(id) && id > 0 && Number.isFinite(at) && at >= 0) out.set(id, at)
  }
  return out
}

type Fresh = { id: number; unreadCount: number; latestFetchedChapter?: { fetchedAt: string } | null }

/** 最新一话的抓取时间（秒）；没抓过章节为 0 */
export const fetchedAtOf = (m: Fresh) => Number(m.latestFetchedChapter?.fetchedAt ?? 0)

/** 首页模块：书库里被标记、还有未读章节的，最近抓到新章节的在前 */
export function favoritesWithNew<M extends Fresh>(library: readonly M[], favorites: ReadonlyMap<number, number>) {
  return library
    .filter((m) => favorites.has(m.id) && m.unreadCount > 0)
    .sort((a, b) => fetchedAtOf(b) - fetchedAtOf(a))
}

/** 离开不到这么久回来不提示，免得刷新一下就弹一次 */
export const AWAY_MIN_SEC = 30 * 60

/**
 * 「离开期间更新了」：上次离开之后抓到新章节、现在还没读完的特别关心。
 * 没有离开记录（第一次打开、换了浏览器）或离开太短时返回 0，不凭空提示。
 */
export function awayUpdates<M extends Fresh>(library: readonly M[], favorites: ReadonlyMap<number, number>, leftAt: number | null, now: number) {
  if (leftAt === null || now - leftAt < AWAY_MIN_SEC) return []
  return favoritesWithNew(library, favorites).filter((m) => fetchedAtOf(m) > leftAt)
}

/** 置顶：排好序的列表里把特别关心挪到最前，两组内部保持原来的顺序 */
export function favoritesFirst<M extends { id: number }>(list: readonly M[], favorites: ReadonlyMap<number, number> | ReadonlySet<number>) {
  const top: M[] = []
  const rest: M[] = []
  for (const m of list) (favorites.has(m.id) ? top : rest).push(m)
  return top.length ? [...top, ...rest] : rest
}
