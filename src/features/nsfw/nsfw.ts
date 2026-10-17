/*
 * NSFW 标记存在服务端的全局元数据里，做法与「稍后再看」相同：一部漫画或一个分类一个键，键里带账号 id。
 * - 漫画：值 '1' 为手动标记，'0' 为手动取消（来源或分类判定为 NSFW 时，用它单独放行这一部）；没有键就跟随来源和分类。
 * - 分类：值 '1' 时整个分类视为 NSFW；取消就删掉键。
 * 不放进漫画自己的元数据：那里存着阅读器设置，书库查询一刷新就整组替换，容易和阅读器的写入互相覆盖。
 * 这里只放纯逻辑（Node 测试直接导入），不依赖 React、Apollo 或路径别名。
 */

export const NSFW_PREFIX = 'sukimi.nsfw.'

/** 某个账号的键前缀；旧服务端的单用户身份 id 为 0，同样适用 */
export const nsfwPrefix = (userId: number) => `${NSFW_PREFIX}${userId}.`
export const mangaNsfwKey = (userId: number, mangaId: number) => `${nsfwPrefix(userId)}m.${mangaId}`
export const categoryNsfwKey = (userId: number, categoryId: number) => `${nsfwPrefix(userId)}c.${categoryId}`

export interface NsfwMarks {
  /** 漫画 id → 手动标记（true）或手动取消（false） */
  manga: Record<number, boolean>
  /** 视为 NSFW 的分类 id */
  categories: number[]
}

export const NO_MARKS: NsfwMarks = { manga: {}, categories: [] }

/** 该账号的标记；别的账号的键、别的客户端写坏的键和值直接忽略 */
export function parseNsfw(userId: number, metas: readonly { key: string; value: string }[] = []): NsfwMarks {
  const prefix = nsfwPrefix(userId)
  const manga: Record<number, boolean> = {}
  const categories: number[] = []
  for (const { key, value } of metas) {
    if (!key.startsWith(prefix)) continue
    const [kind, raw, ...rest] = key.slice(prefix.length).split('.')
    const id = Number(raw)
    if (rest.length || !Number.isSafeInteger(id) || id <= 0 || String(id) !== raw) continue
    if (kind === 'm' && (value === '1' || value === '0')) manga[id] = value === '1'
    else if (kind === 'c' && value === '1') categories.push(id)
  }
  return { manga, categories: categories.sort((a, b) => a - b) }
}

/** 判断要用到的漫画字段；首页、书库、详情页的查询都带上这几项 */
export interface NsfwSubject {
  id: number
  source?: { contentWarning?: string | null } | null
  categories?: { nodes: readonly { id: number }[] } | null
}

export type NsfwReason = 'manual' | 'category' | 'source'

/**
 * 不看手动标记时，这部是否因分类或来源算作 NSFW。
 * 来源只认 contentWarning 为 NSFW 的；MIXED（部分内容不宜）不自动标记，需要时手动标。
 */
export function inheritedNsfw(m: NsfwSubject, marks: NsfwMarks, bySource: boolean): Exclude<NsfwReason, 'manual'> | null {
  if (m.categories?.nodes.some((c) => marks.categories.includes(c.id))) return 'category'
  if (bySource && m.source?.contentWarning === 'NSFW') return 'source'
  return null
}

/** 这部为什么算 NSFW；不算时为 null。手动标记优先于分类和来源 */
export function nsfwReason(m: NsfwSubject, marks: NsfwMarks, bySource: boolean): NsfwReason | null {
  const manual = marks.manga[m.id]
  if (manual !== undefined) return manual ? 'manual' : null
  return inheritedNsfw(m, marks, bySource)
}

export const isNsfw = (m: NsfwSubject, marks: NsfwMarks, bySource: boolean) => nsfwReason(m, marks, bySource) !== null

/**
 * 把一部设成 want 要写什么：和分类、来源的判定一致时删掉手动键（null），以后跟着它们走；
 * 不一致时写手动标记。
 */
export function nsfwWrite(m: NsfwSubject, marks: NsfwMarks, bySource: boolean, want: boolean): '1' | '0' | null {
  const inherited = inheritedNsfw(m, marks, bySource) !== null
  return inherited === want ? null : want ? '1' : '0'
}
