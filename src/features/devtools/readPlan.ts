/*
 * 开发者工具箱「批量已读 / 未读」的纯逻辑：按范围挑出要改的章节，算出预演结果。
 * 只在独立测试实例的构建里出现（见 DevToolsPage），请求由调用方发，测试直接用虚构数据驱动。
 */

export interface ReadManga {
  id: number
  title: string
  categoryIds: number[]
}

export interface ReadChapter {
  id: number
  mangaId: number
}

/** all：整个书库；数字：某个分类；0 是服务端的默认分类，没有手动分过类的作品都在这里 */
export type ReadScope = 'all' | number

export interface ReadPlan {
  /** 范围内的作品数 */
  mangas: number
  /** 范围内、确实有章节要改的作品，按章节数从多到少 */
  touched: { id: number; title: string; chapters: number }[]
  /** 要改的章节 id，按作品分组排好，分批时同一部尽量落在一起 */
  ids: number[]
  /** 超出上限、这次不改的章节数 */
  overLimit: number
}

// 每批章节数与间隔：测试实例跑在别人电脑上，同样不要一次压太多
export const READ_BATCH = 100
export const READ_DELAY = 500
/** 一次最多改多少话；测试书库再大也够用，防止误选范围后一口气改掉几万话 */
export const READ_LIMIT = 5000

const inScope = (m: ReadManga, scope: ReadScope) =>
  scope === 'all' || (scope === 0 ? m.categoryIds.length === 0 || m.categoryIds.includes(0) : m.categoryIds.includes(scope))

/** 预演：chapters 是服务端按目标状态筛过的「还需要改」的章节，这里只按范围与上限取舍，不发请求 */
export function planRead(mangas: readonly ReadManga[], chapters: readonly ReadChapter[], scope: ReadScope, limit = READ_LIMIT): ReadPlan {
  const picked = new Map(mangas.filter((m) => inScope(m, scope)).map((m) => [m.id, { id: m.id, title: m.title, list: [] as number[] }]))
  for (const c of chapters) picked.get(c.mangaId)?.list.push(c.id)
  const touched = [...picked.values()].filter((m) => m.list.length).sort((a, b) => b.list.length - a.list.length || a.id - b.id)
  const all = touched.flatMap((m) => m.list)
  return {
    mangas: picked.size,
    touched: touched.map((m) => ({ id: m.id, title: m.title, chapters: m.list.length })),
    ids: all.slice(0, limit),
    overLimit: Math.max(0, all.length - limit),
  }
}

/** 标为未读时同时把读到的页数归零，和详情页单话「标为未读」一致，否则首页还会当成读了一半 */
export const readPatch = (isRead: boolean) => (isRead ? { isRead } : { isRead, lastPageRead: 0 })
