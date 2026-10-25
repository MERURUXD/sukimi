/** 迁移规划只依赖这几个字段，方便用虚构数据测试 */
export interface MigrationChapter {
  id: number
  /** 来源识别不出话数时是 -1 */
  chapterNumber: number
  isRead: boolean
  isBookmarked: boolean
}

export interface MigrationPlan {
  /** 新来源里要标为已读的章节 */
  read: number[]
  /** 新来源里要加书签的章节 */
  bookmarked: number[]
  /** 新来源里和旧来源对得上话数的章节数 */
  matched: number
}

// 话数是小数（如 10.5），换成整数做键，避免浮点误差
const key = (n: number) => Math.round(n * 1000)
const known = (c: MigrationChapter) => c.chapterNumber >= 0
/** 旧来源缺的话数，前后两话都读过、且相隔不超过这么多话时才补成已读；再远就可能是识别错的话数（如按年份命名的特别篇） */
const FILL_GAP = 10

/**
 * 按话数把旧来源的阅读状态搬到新来源：
 * - 旧来源有同一话数的，已读与否完全照旧来源，旧来源明确未读的不会被标成已读；
 * - 旧来源缺的话数（如新来源多出的 10.5 话）：前后最近的两话都读过且离得不远才算已读，
 *   比旧来源最早一话还早的跟着最早那一话，比最后一话还晚的保持未读。
 *   不再按「读到的最大话数之前都算已读」：只要有一话被识别成离谱的话数（比如 2024）又读过，后面的就全被标成已读；
 * - 同一话数在旧来源有书签，新来源对应章节也加书签；
 * - 识别不出话数的章节不处理。已经是目标状态的章节不重复提交。
 */
export function planMigration(from: readonly MigrationChapter[], to: readonly MigrationChapter[]): MigrationPlan {
  const byNo = new Map<number, { read: boolean; bookmarked: boolean }>()
  for (const c of from) {
    if (!known(c)) continue
    const k = key(c.chapterNumber)
    const prev = byNo.get(k)
    // 同一话数有多个版本（不同汉化组）时，读过任一版本就算读过
    byNo.set(k, { read: !!prev?.read || c.isRead, bookmarked: !!prev?.bookmarked || c.isBookmarked })
  }
  const nos = [...byNo.keys()].sort((a, b) => a - b)

  /** 旧来源没有这一话时，按前后最近的两话推断 */
  const inferRead = (k: number) => {
    // 二分找第一个大于 k 的话数
    let lo = 0
    let hi = nos.length
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (nos[mid] < k) lo = mid + 1
      else hi = mid
    }
    if (lo === nos.length) return false
    const after = nos[lo]
    if (lo === 0) return byNo.get(after)!.read
    const before = nos[lo - 1]
    return byNo.get(before)!.read && byNo.get(after)!.read && after - before <= key(FILL_GAP)
  }

  const plan: MigrationPlan = { read: [], bookmarked: [], matched: 0 }
  for (const c of to) {
    if (!known(c)) continue
    const k = key(c.chapterNumber)
    const prev = byNo.get(k)
    if (prev) plan.matched++
    const read = prev ? prev.read : inferRead(k)
    if (read && !c.isRead) plan.read.push(c.id)
    if (prev?.bookmarked && !c.isBookmarked) plan.bookmarked.push(c.id)
  }
  return plan
}

/**
 * 要搬到新漫画的追踪记录：旧漫画绑定过、网站仍可用（已登录且未过期），
 * 并且新漫画在这个网站上还没有自己的绑定（已有的不覆盖）
 */
export function planTrackCopy<R extends { trackerId: number }>(from: readonly R[], existing: readonly { trackerId: number }[], usable: ReadonlySet<number>): R[] {
  const taken = new Set(existing.map((r) => r.trackerId))
  return from.filter((r) => usable.has(r.trackerId) && !taken.has(r.trackerId))
}

/** 候选来源：排除本地来源和当前来源；「同语言」再加上多语言来源 */
export function migrationSources<S extends { id: string; lang: string }>(sources: readonly S[], current: { id: string; lang: string } | null, scope: 'lang' | 'all'): S[] {
  const others = sources.filter((s) => s.id !== '0' && s.id !== current?.id)
  if (scope === 'all' || !current) return others
  const lang = current.lang.toLowerCase()
  const base = lang.split('-')[0]
  return others.filter((s) => {
    const l = s.lang.toLowerCase()
    return l === 'all' || l === lang || l.split('-')[0] === base
  })
}

/** 标题比较用：统一全半角和大小写，去掉空白与标点，「Foo Bar！」和「foo-bar」算同名 */
export const titleKey = (title: string) => title.normalize('NFKC').toLowerCase().replace(/[\p{P}\p{S}\s]+/gu, '')

/** 书库里和 manga 同名、但不是同一部（换了来源）的漫画；标题去掉标点后为空的不比较 */
export function findSameTitle<T extends { id: number; title: string }>(library: readonly T[], manga: { id: number; title: string }): T[] {
  const key = titleKey(manga.title)
  if (!key) return []
  return library.filter((m) => m.id !== manga.id && titleKey(m.title) === key)
}

type Meta = { key: string; value: string }

/**
 * 跟着漫画 id 存的全局元数据（稍后再看、特别关心）：pairs 是要搬的「旧键 → 新键」。
 * 旧键的值（标记时间）原样写到新键，排序和「读完自动移出」都靠这个时间；新漫画已有的不覆盖。
 * 不保留旧漫画时删掉旧键：稍后再看会列出不在书库里的漫画，留着旧的那部会一直挂在清单里。
 */
export function planMetaCopy(metas: readonly Meta[], pairs: readonly (readonly [from: string, to: string])[], keepOld: boolean) {
  const values = new Map(metas.map((m) => [m.key, m.value]))
  const set: Meta[] = []
  const remove: string[] = []
  for (const [from, to] of pairs) {
    const value = values.get(from)
    if (value === undefined || from === to) continue
    if (!values.has(to)) set.push({ key: to, value })
    if (!keepOld) remove.push(from)
  }
  return { set, remove }
}
