import { isVisible } from '../history/history.ts'

/** 超过这么多天没打开，就从「继续阅读」挪到「好久没看」 */
export const STALE_DAYS = 14
const STALE_SEC = STALE_DAYS * 86400

/**
 * 32 位 FNV-1a，只用来打散顺序。末尾再做一次 murmur3 的混合：
 * 只有 FNV 时，id 相近的几部分数差距由种子的低几位决定，换种子也总是那几种排法
 */
function hash(s: string) {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193)
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b)
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35)
  return (h ^ (h >>> 16)) >>> 0
}

/**
 * 按种子随机挑 n 个。每项按「种子 + id」单独打分再取分数最小的，
 * 而不是洗整个数组：网络数据替换快照时列表多一项少一项，已选中的大多不变，画面不会整批跳动。
 */
export function pick<T>(items: readonly T[], n: number, seed: string, id: (t: T) => number) {
  return items
    .map((t) => ({ t, k: hash(`${seed}:${id(t)}`) }))
    .sort((a, b) => a.k - b.k)
    .slice(0, n)
    .map((x) => x.t)
}

/**
 * 第 batch 批（从 0 起）：随机挑 n 个，顺序也随机；从第 1 批起，第一个不与上一批的第一个相同，
 * 换一批时大图区一定换一部。上一批也按同样规则得出，所以从第 0 批逐批推过来。
 */
export function pickBatch<T>(items: readonly T[], n: number, seed: string, batch: number, id: (t: T) => number) {
  let prev: T | undefined
  let cur: T[] = []
  for (let b = 0; b <= batch; b++) {
    cur = pick(items, n, `${seed}#${b}`, id)
    const i = cur.length > 1 && cur[0] === prev ? 1 : 0
    // 和上一批第一个相同就与第二个对调
    if (i) [cur[0], cur[1]] = [cur[1], cur[0]]
    prev = cur[0]
  }
  return cur
}

interface LibraryManga {
  id: number
  unreadCount: number
  /** 服务端在一话都没读过时也会返回第一话，只是 lastReadAt 为 0 */
  lastReadChapter?: { lastReadAt: string; meta: readonly { key: string; value: string }[] } | null
  /** 标了已读的最后一话；Tachiyomi 时期导入的已读章节只有这个标记，没有阅读时间 */
  latestReadChapter?: { id: number } | null
}

const lastRead = (m: LibraryManga) => Number(m.lastReadChapter?.lastReadAt ?? 0)

/** 还有章节、一话都没读过的：既没有阅读时间，也没有标了已读的章节 */
export const notStarted = (m: LibraryManga) => m.unreadCount > 0 && lastRead(m) <= 0 && !m.latestReadChapter

/** 读到一半、超过 STALE_DAYS 天没打开的；在历史里删掉的不算，和首页其他地方一致 */
export function isStale(m: LibraryManga, nowSec: number) {
  const c = m.lastReadChapter
  return !!c && m.unreadCount > 0 && lastRead(m) > 0 && nowSec - lastRead(m) > STALE_SEC && isVisible(c)
}

/** 最近阅读里「两周内读过」的部分，用来区分继续阅读与好久没看 */
export const isRecent = (lastReadAt: string, nowSec: number) => nowSec - Number(lastReadAt) <= STALE_SEC
