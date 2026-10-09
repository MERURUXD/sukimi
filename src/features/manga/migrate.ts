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
  /** 旧来源读到的最大话数；-1 表示没读过有话数的章节 */
  maxRead: number
}

// 话数是小数（如 10.5），换成整数做键，避免浮点误差
const key = (n: number) => Math.round(n * 1000)
const known = (c: MigrationChapter) => c.chapterNumber >= 0

/**
 * 按话数把旧来源的阅读状态搬到新来源（和 Mihon 的规则一致）：
 * - 旧来源读过的最大话数之前（含）的章节都算已读，跳着读的也一样；
 * - 同一话数在旧来源有书签，新来源对应章节也加书签；
 * - 识别不出话数的章节不处理。已经是目标状态的章节不重复提交。
 */
export function planMigration(from: readonly MigrationChapter[], to: readonly MigrationChapter[]): MigrationPlan {
  const byNo = new Map<number, MigrationChapter[]>()
  let maxRead = -1
  for (const c of from) {
    if (!known(c)) continue
    const list = byNo.get(key(c.chapterNumber))
    if (list) list.push(c)
    else byNo.set(key(c.chapterNumber), [c])
    if (c.isRead && c.chapterNumber > maxRead) maxRead = c.chapterNumber
  }

  const plan: MigrationPlan = { read: [], bookmarked: [], matched: 0, maxRead }
  for (const c of to) {
    if (!known(c)) continue
    const prev = byNo.get(key(c.chapterNumber))
    if (prev) plan.matched++
    const read = (maxRead >= 0 && c.chapterNumber <= maxRead) || !!prev?.some((p) => p.isRead)
    if (read && !c.isRead) plan.read.push(c.id)
    if (prev?.some((p) => p.isBookmarked) && !c.isBookmarked) plan.bookmarked.push(c.id)
  }
  return plan
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
