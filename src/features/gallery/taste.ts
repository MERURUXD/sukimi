/*
 * 阅读档案第二屏的「口味」：按已读话数算最常读的题材和作者。纯函数，测试直接导入。
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

/** 同义的写法合并成一个中文名（键为小写） */
const ALIAS: Record<string, string> = Object.fromEntries(
  (
    [
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
  ).flatMap(([name, ...keys]) => keys.map((k) => [k, name])),
)

/** 一部作品的题材：归一、去掉无意义的标签、去重 */
export function genresOf(raw: readonly string[] | null | undefined) {
  const out: string[] = []
  for (const g of raw ?? []) {
    const t = g.trim().replace(/\s+/g, ' ')
    const key = t.toLowerCase()
    if (!t || STOP.has(key)) continue
    const name = ALIAS[key] ?? t
    if (!out.includes(name)) out.push(name)
  }
  return out
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
  read: number
  genre: readonly string[] | null | undefined
  author: string | null | undefined
}

export interface Taste {
  /** pct：占「有题材的作品」已读话数的百分比 */
  genres: { name: string; pct: number }[]
  authors: { name: string; read: number; works: number }[]
}

/**
 * 题材：每部的已读话数平均分给它的几个题材，占比按「有题材的作品」的已读话数算，取前 genreTop 个。
 * 作者：合写的作品算进每一位，取前 authorTop 位。并列时先出现的在前（调用方按排行传入）
 */
export function tasteOf(works: readonly TasteWork[], genreTop = 6, authorTop = 3): Taste {
  const g = new Map<string, number>()
  const a = new Map<string, { read: number; works: number }>()
  let sum = 0
  for (const w of works) {
    if (w.read <= 0) continue
    const gs = genresOf(w.genre)
    if (gs.length) {
      sum += w.read
      for (const x of gs) g.set(x, (g.get(x) ?? 0) + w.read / gs.length)
    }
    for (const x of authorsOf(w.author)) {
      const e = a.get(x) ?? { read: 0, works: 0 }
      e.read += w.read
      e.works++
      a.set(x, e)
    }
  }
  return {
    genres: [...g]
      .sort((x, y) => y[1] - x[1])
      .slice(0, genreTop)
      .map(([name, v]) => ({ name, pct: sum ? (v / sum) * 100 : 0 })),
    authors: [...a]
      .sort((x, y) => y[1].read - x[1].read)
      .slice(0, authorTop)
      .map(([name, e]) => ({ name, ...e })),
  }
}
