import { locale, t } from '../../i18n/core.ts'
/*
 * 阅读档案第三屏的「口味」：按已读话数算最常读的题材和作者。纯函数，测试直接导入。
 *
 * 题材和作者都来自各个来源，写法不统一：同一个意思有中文、英文、近义词，
 * 还夹着「连载中」「漫画」这类没有意义的标签；作者可能几个人写在一起。这里先归一再合计。
 */

/** 不算题材的标签（小写比较） */
const STOP = new Set(
  [
    '漫画', '连载', '连载中', '完结', '已完结', '热门', '推荐', '全彩', '彩色', '其他', '未分类', '日漫', '国漫', '韩漫',
    'manga', 'manhua', 'manhwa', 'comic', 'comics', 'webtoon', 'ongoing', 'completed', 'other', 'others', 'full color',
  ],
)

/** 同义的写法：第一列是归一后的中文名，第二列是英文界面里显示的名字，其余是各来源常见的写法（小写比较） */
const GENRE_TABLE = [
  ['恋爱', 'romance', '爱情', '恋爱'],
  ['喜剧', 'comedy', '搞笑', '喜剧'],
  ['校园', 'school life', 'school', '校园', '学园'],
  ['日常', 'slice of life', '日常', '生活'],
  ['奇幻', 'fantasy', '奇幻', '魔幻', '魔法'],
  ['科幻', 'sci-fi', 'science fiction', '科幻'],
  ['悬疑', 'mystery', '悬疑', '推理'],
  ['冒险', 'adventure', '冒险'],
  ['动作', 'action', '动作'],
  ['剧情', 'drama', '剧情'],
  ['恐怖', 'horror', '恐怖'],
  ['运动', 'sports', 'sport', '运动', '体育', '竞技'],
  ['美食', 'cooking', 'gourmet', '美食'],
  ['治愈', 'healing', 'iyashikei', '治愈'],
  ['历史', 'historical', 'history', '历史'],
  ['异世界', 'isekai', '异世界', '穿越'],
  ['音乐', 'music', '音乐'],
  ['心理', 'psychological', '心理'],
  ['百合', 'yuri', 'girls love', "girls' love", '百合'],
  ['耽美', 'yaoi', 'boys love', "boys' love", 'bl', '耽美'],
] as const

/** 「漫画」「连载中」这类不算题材的词；外站标签里也不给加入我的标签 */
export const isStopTag = (name: string) => STOP.has(name.trim().replace(/\s+/g, ' ').toLowerCase())

const ALIAS: Record<string, string> = Object.fromEntries(GENRE_TABLE.flatMap(([name, ...keys]) => keys.map((k) => [k, name])))

const EN_NAME = new Map<string, string>(GENRE_TABLE.map(([name, en]): [string, string] => [name, en.charAt(0).toUpperCase() + en.slice(1)]))

/** 题材的显示名：英文界面把归一过的中文名换成英文，来源自带的写法原样显示 */
export const genreLabel = (name: string) => (locale === 'en' ? (EN_NAME.get(name) ?? name) : name)

/** 一部作品的题材：归一、去掉无意义的标签、去重 */
export function genresOf(raw: readonly string[] | null | undefined) {
  const out: string[] = []
  for (const g of raw ?? []) {
    const t = g.trim().replace(/\s+/g, ' ')
    if (!t || STOP.has(t.toLowerCase())) continue
    const name = canonicalTag(t)
    if (!out.includes(name)) out.push(name)
  }
  return out
}

/** 同义写法归一成一个名字（Romance、爱情 → 恋爱）；不在表里的原样返回，不过滤无意义的词 */
export const canonicalTag = (raw: string) => {
  const t = raw.trim().replace(/\s+/g, ' ')
  return ALIAS[t.toLowerCase()] ?? t
}

/** 一部作品的作者：几个人写在一起时拆开，去重 */
export const authorsOf = (raw: string | null | undefined) => [
  ...new Set(
    (raw ?? '')
      .split(/[,，、/／&;；×]|\s+x\s+/i)
      .map((s) => s.trim())
      .filter(Boolean),
  ),
]

export interface TasteWork {
  id: number
  read: number
  /** 已读页数估算 */
  pages: number
  genre: readonly string[] | null | undefined
  author: string | null | undefined
}

export interface Taste {
  /** pct：占「有题材的作品」已读话数的百分比；read 是分到这个题材的话数（取整），works 是带这个题材的部数 */
  genres: { name: string; pct: number; read: number; works: number }[]
  /** ids：这位作者的作品，按传入顺序（调用方按排行传，前面的读得多） */
  authors: { name: string; read: number; works: number; pages: number; ids: number[] }[]
}

/**
 * 题材：每部的已读话数平均分给它的几个题材，占比按「有题材的作品」的已读话数算，取前 genreTop 个。
 * 作者：合写的作品算进每一位，取前 authorTop 位。并列时先出现的在前（调用方按排行传入）
 */
export function tasteOf(works: readonly TasteWork[], genreTop = 6, authorTop = 3): Taste {
  const g = new Map<string, { read: number; works: number }>()
  const a = new Map<string, { read: number; works: number; pages: number; ids: number[] }>()
  let sum = 0
  for (const w of works) {
    if (w.read <= 0) continue
    const gs = genresOf(w.genre)
    if (gs.length) {
      sum += w.read
      for (const x of gs) {
        const e = g.get(x) ?? { read: 0, works: 0 }
        e.read += w.read / gs.length
        e.works++
        g.set(x, e)
      }
    }
    for (const x of authorsOf(w.author)) {
      const e = a.get(x) ?? { read: 0, works: 0, pages: 0, ids: [] }
      e.read += w.read
      e.works++
      e.pages += w.pages
      e.ids.push(w.id)
      a.set(x, e)
    }
  }
  return {
    genres: [...g]
      .sort((x, y) => y[1].read - x[1].read)
      .slice(0, genreTop)
      .map(([name, e]) => ({ name, pct: sum ? (e.read / sum) * 100 : 0, read: Math.round(e.read), works: e.works })),
    authors: [...a]
      .sort((x, y) => y[1].read - x[1].read)
      .slice(0, authorTop)
      .map(([name, e]) => ({ name, ...e })),
  }
}

/**
 * 读过的作品的口味（read 按排行顺序传入）；skip 为 true 的不计入。阅读档案和分享海报都跳过 NSFW 作品，
 * 免得题材和作者认出是哪部
 */
export function readTaste<M extends { genre?: readonly string[] | null; author?: string | null }>(
  read: readonly { id: number; read: number; pages: number }[],
  byId: ReadonlyMap<number, M>,
  skip: (m: M) => boolean,
) {
  return tasteOf(
    read.flatMap((r) => {
      const m = byId.get(r.id)
      return m && !skip(m) ? [{ id: r.id, read: r.read, pages: r.pages, genre: m.genre, author: m.author }] : []
    }),
  )
}

/** 标题里放得下的题材名：英文 12 个字符、中文 6 个字以内（来源没归一的题材可能是一长串英文） */
const fits = (name: string) => name.length <= (/^[ -~]+$/.test(name) ? 12 : 6)

/**
 * 口味屏的大标题：直接说结论，strong 是亮的那段，tail 是灰的那段。
 * 题材名太长时换成不带题材名的说法，免得标题撑成好几行
 */
export function tasteHeadline(genres: readonly { name: string }[]): { lead: string; strong?: string; tail: string } {
  const [a, b] = genres
  if (!a) return { lead: t('gallery.taste.none'), tail: t('gallery.taste.noneTail') }
  const na = genreLabel(a.name)
  if (!b) return fits(na) ? { lead: t('gallery.taste.top'), strong: na, tail: t('gallery.taste.topTail') } : { lead: t('gallery.taste.one'), tail: t('gallery.taste.oneTail') }
  const nb = genreLabel(b.name)
  if (fits(na) && fits(nb)) return { lead: t('gallery.taste.prefer'), strong: na, tail: t('gallery.taste.preferTail', { other: nb }) }
  return { lead: t('gallery.taste.many'), tail: t('gallery.taste.manyTail') }
}
