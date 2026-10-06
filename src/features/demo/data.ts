import { mergeMeta } from '../reader/remote.ts'
const svgUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
const TITLES = ['云海邮局', '月台尽头', '森林慢车', '星河旅人', '雨后的咖啡馆', '山间来信', '小岛日记', '风的收藏家', '灯塔与猫', '夏日观测站', '旧城漫游', '夜航书店']
const COLORS = ['#23475d', '#563c66', '#365f50', '#303e70', '#705047', '#526a70', '#317177', '#6c6051', '#3d586c', '#626c49', '#704960', '#3a4260']

/** 原创几何风景封面，不引用书库或外部图片。 */
function cover(title: string, i: number) {
  return svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="840" viewBox="0 0 600 840">
    <defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="${COLORS[i]}"/><stop offset="1" stop-color="#162630"/></linearGradient></defs>
    <rect width="600" height="840" fill="url(#sky)"/>
    <circle cx="${180 + i % 4 * 65}" cy="240" r="105" fill="#f2ddaf" opacity=".85"/>
    <path d="M0 490 180 300 350 495 480 370 600 500V840H0Z" fill="#aec9c4" opacity=".4"/>
    <path d="M0 580 240 425 420 570 600 470V840H0Z" fill="#233c43"/>
    <path d="M0 695Q250 500 600 660V840H0Z" fill="#112832"/>
    <path d="M${190 + i * 7} 840Q260 680 310 595" fill="none" stroke="#a9beb2" stroke-width="18" opacity=".5"/>
    <g fill="#f4f1e6" font-family="sans-serif"><text x="48" y="84" font-size="16" letter-spacing="5">SUKIMI · 演示作品</text>
    <text x="48" y="160" font-size="48" font-weight="700">${title}</text><text x="48" y="790" font-size="18">一段关于旅途与相遇的故事 · ${String(i + 1).padStart(2, '0')}</text></g>
  </svg>`)
}

/** 六页短故事供正式阅读器演示翻页、缩放和纵向阅读。 */
function storyPage(title: string, page: number) {
  const lines = ['清晨，一封没有地址的信来到了邮局。', '「把它送到云海另一端吧。」', '列车穿过森林，山风翻动着信封。', '在最后一站，小猫已经等了很久。', '原来，最远的地方也有人等你。', '明天，我们再出发。']
  return svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1300" viewBox="0 0 900 1300">
    <rect width="900" height="1300" fill="#f3efe5"/><g stroke="#303735" stroke-width="4">
    <rect x="45" y="130" width="810" height="450" fill="#d1dcda"/>
    <circle cx="${220 + page * 60}" cy="265" r="72" fill="#f3efe5"/>
    <path d="M45 490 270 310 460 480 690 340 855 460V580H45Z" fill="#839892"/>
    <rect x="45" y="610" width="390" height="520" fill="#bbc9c4"/><rect x="465" y="610" width="390" height="520" fill="#dedcd2"/>
    <path d="M70 1070 150 840 180 880 230 830 270 860 360 1070Z" fill="#4f6260"/>
    <path d="M525 970V865L550 820 583 850 635 850 670 820 695 865V970Z" fill="#f3efe5"/>
    <circle cx="572" cy="906" r="5"/><circle cx="643" cy="906" r="5"/>
    <path d="M585 945Q610 965 635 945" fill="none"/>
    <rect x="525" y="670" width="270" height="100" rx="38" fill="#fffdf5"/>
    </g><g fill="#303735" font-family="sans-serif">
    <text x="45" y="85" font-size="32" font-weight="700">${title}</text><text x="855" y="85" font-size="18" text-anchor="end">原创演示 · ${page + 1} / 6</text>
    <text x="85" y="535" font-size="24">${lines[page]}</text><text x="660" y="730" font-size="24" text-anchor="middle">${page === 5 ? '下一段旅途见！' : '一起出发吧。'}</text>
    <text x="450" y="1210" font-size="22" text-anchor="middle">${String(page + 1).padStart(2, '0')}</text></g>
  </svg>`)
}

interface Category { id: number; name: string; order: number; default: boolean }
interface DemoChapter {
  id: number; mangaId: number; name: string; chapterNumber: number; sourceOrder: number;
  pageCount: number; lastPageRead: number; lastReadAt: string; fetchedAt: string; uploadDate: string;
  isRead: boolean; isBookmarked: boolean; isDownloaded: boolean; scanlator: string; manga: DemoManga;
  /** 本地缓存的真实章节才有，缺省时用生成的演示页。 */
  pages?: string[];
  meta: { chapterId: number; key: string; value: string }[];
}
interface DemoManga {
  id: number; title: string; thumbnailUrl: string; author: string; artist: string; description: string;
  genre: string[]; status: string; realUrl: null; initialized: boolean; inLibrary: boolean; inLibraryAt: string;
  source: typeof SOURCE; categories: { nodes: Category[] }; chapters: { nodes: DemoChapter[] };
  unreadCount: number; downloadCount: number; bookmarkCount: number;
  firstUnreadChapter: DemoChapter | null; lastReadChapter: DemoChapter | null;
  latestFetchedChapter: DemoChapter; latestUploadedChapter: DemoChapter;
  trackRecords: { nodes: never[]; totalCount: number };
  meta: { mangaId: number; key: string; value: string }[];
}
const SOURCE = { id: '9000', name: '演示画室', displayName: '演示画室', lang: 'zh', iconUrl: '/favicon.svg', supportsLatest: true, contentWarning: 'SAFE', homeUrl: null, filters: [] }
const OPEN_SOURCE = { ...SOURCE, id: '9001', name: '开放漫画（本地缓存）', displayName: '开放漫画（本地缓存）' }

/** `pnpm fetch:comics` 生成的 manifest 结构；只在开发环境从本地缓存读取，不进仓库与构建产物。 */
export interface OpenWork {
  id: string; title: string; author: string; description: string; genre: string[]; status: string
  license: { name: string; url: string }; cover: string
  chapters: { name: string; number: number; pages: string[] }[]
}
type Condition = Record<string, { equalTo?: unknown; in?: unknown[]; greaterThan?: string }>
interface ListArgs { condition?: Record<string, unknown>; filter?: Condition; first?: number; offset?: number; order?: { by: string; byType?: string }[] }
function matches(item: object, condition: Record<string, unknown> = {}, filter: Condition = {}) {
  const record = item as Record<string, unknown>
  return Object.entries(condition).every(([k, v]) => record[k] === v) && Object.entries(filter).every(([k, v]) => {
    const value = k === 'inLibrary' && 'manga' in record ? (record.manga as DemoManga).inLibrary : record[k]
    return (v.equalTo === undefined || value === v.equalTo) && (!v.in || v.in.includes(value)) && (v.greaterThan === undefined || Number(value) > Number(v.greaterThan))
  })
}
function connection<T>(nodes: T[], { first = nodes.length, offset = 0 }: ListArgs = {}) {
  return { nodes: nodes.slice(offset, offset + first), totalCount: nodes.length, pageInfo: { hasNextPage: offset + first < nodes.length, hasPreviousPage: offset > 0 } }
}

/** 每个客户端拥有自己的数据，修改仅在本次演示内存中生效。 */
export function createDemoData(now = Date.now(), openWorks: { work: OpenWork; url: (file: string) => string }[] = []) {
  const categories: Category[] = [{ id: 1, name: '旅途', order: 0, default: false }, { id: 2, name: '日常', order: 1, default: false }]
  const mangas: DemoManga[] = TITLES.map((title, i) => {
    const chapters: DemoChapter[] = []
    const m: DemoManga = {
      id: i + 1, title, thumbnailUrl: cover(title, i), author: 'Sukimi 演示画室', artist: 'Sukimi 演示画室',
      description: '一封寄往远方的信，一趟不赶时间的旅程。在山间、森林与小城之间，发现那些被日常忽略的相遇。\n这是为 Sukimi 创作的虚构演示作品，封面和阅读页面均在本地生成。',
      genre: i % 2 ? ['日常', '治愈'] : ['冒险', '奇幻'], status: i % 3 ? 'ONGOING' : 'COMPLETED',
      realUrl: null, initialized: true, inLibrary: i < 10, inLibraryAt: String(Math.floor(now / 1000) - i * 86400),
      source: SOURCE, categories: { nodes: [categories[i % 2]] }, chapters: { nodes: chapters }, trackRecords: { nodes: [], totalCount: 0 }, meta: [],
      get unreadCount() { return chapters.filter((c) => !c.isRead).length },
      get downloadCount() { return chapters.filter((c) => c.isDownloaded).length },
      get bookmarkCount() { return chapters.filter((c) => c.isBookmarked).length },
      get firstUnreadChapter() { return chapters.find((c) => !c.isRead) ?? null },
      get lastReadChapter() { return [...chapters].filter((c) => Number(c.lastReadAt) > 0).sort((a, b) => Number(b.lastReadAt) - Number(a.lastReadAt))[0] ?? null },
      get latestFetchedChapter() { return chapters[chapters.length - 1] },
      get latestUploadedChapter() { return chapters[chapters.length - 1] },
    }
    for (let n = 1; n <= 8; n++) chapters.push({
      id: m.id * 100 + n, mangaId: m.id, manga: m, name: ['出发', '山间的风', '一封来信', '森林站台', '远方的灯', '雨过天晴', '新的朋友', '下一段旅途'][n - 1],
      chapterNumber: n, sourceOrder: n, pageCount: 6, lastPageRead: n < 3 ? 5 : n === 3 ? 1 : 0,
      isRead: n < 3, isBookmarked: n === 3, isDownloaded: n < 4, scanlator: '演示画室', meta: [],
      lastReadAt: n <= 3 ? String(Math.floor(now / 1000) - i * 7200 - (3 - n) * 300) : '0',
      fetchedAt: String(Math.floor(now / 1000) - (8 - n) * 86400 - i * 600), uploadDate: String(now - (8 - n) * 86400000 - i * 600000),
    })
    return m
  })
  openWorks.forEach(({ work, url }, w) => {
    const chapters: DemoChapter[] = []
    const m: DemoManga = {
      id: 1001 + w, title: work.title, thumbnailUrl: url(`${work.id}/${work.cover}`), author: work.author, artist: work.author,
      description: work.description, genre: work.genre, status: work.status,
      realUrl: null, initialized: true, inLibrary: true, inLibraryAt: String(Math.floor(now / 1000) - w * 86400),
      source: OPEN_SOURCE, categories: { nodes: [] }, chapters: { nodes: chapters }, trackRecords: { nodes: [], totalCount: 0 }, meta: [],
      get unreadCount() { return chapters.filter((c) => !c.isRead).length },
      get downloadCount() { return 0 },
      get bookmarkCount() { return chapters.filter((c) => c.isBookmarked).length },
      get firstUnreadChapter() { return chapters.find((c) => !c.isRead) ?? null },
      get lastReadChapter() { return [...chapters].filter((c) => Number(c.lastReadAt) > 0).sort((a, b) => Number(b.lastReadAt) - Number(a.lastReadAt))[0] ?? null },
      get latestFetchedChapter() { return chapters[chapters.length - 1] },
      get latestUploadedChapter() { return chapters[chapters.length - 1] },
    }
    for (const c of work.chapters) chapters.push({
      id: m.id * 100 + c.number, mangaId: m.id, manga: m, name: c.name, chapterNumber: c.number, sourceOrder: c.number,
      pageCount: c.pages.length, lastPageRead: 0, lastReadAt: '0', isRead: false, isBookmarked: false, isDownloaded: false,
      scanlator: work.license.name, meta: [], pages: c.pages.map((f) => url(`${work.id}/${f}`)),
      fetchedAt: String(Math.floor(now / 1000) - (work.chapters.length - c.number) * 86400), uploadDate: String(now - (work.chapters.length - c.number) * 86400000),
    })
    mangas.push(m)
  })
  const allChapters = mangas.flatMap((m) => m.chapters.nodes)
  const findManga = (id: number) => {
    const m = mangas.find((m) => m.id === id)
    if (!m) throw new Error('这部漫画不在演示书库中')
    return m
  }
  const findChapter = (id: number) => {
    const c = allChapters.find((c) => c.id === id)
    if (!c) throw new Error('这一话不在演示书库中')
    return c
  }
  const patchChapter = (id: number, patch: Partial<DemoChapter>) => {
    const c = findChapter(id)
    for (const k of ['isRead', 'isBookmarked', 'lastPageRead'] as const) if (patch[k] !== undefined) Object.assign(c, { [k]: patch[k] })
    if (patch.lastPageRead !== undefined || patch.isRead) c.lastReadAt = String(Math.floor(Date.now() / 1000))
    return c
  }
  const changeCategories = (id: number, patch: { addToCategories?: number[]; removeFromCategories?: number[] }) => {
    const m = findManga(id)
    const ids = new Set(m.categories.nodes.map((c) => c.id))
    patch.addToCategories?.forEach((id) => ids.add(id))
    patch.removeFromCategories?.forEach((id) => ids.delete(id))
    m.categories.nodes = categories.filter((c) => ids.has(c.id))
    return m
  }
  const root = {
    mangas: (args: ListArgs) => connection(mangas.filter((m) => matches(m, args.condition, args.filter)), args),
    manga: ({ id }: { id: number }) => findManga(id),
    categories: () => connection(categories),
    chapters: (args: ListArgs) => {
      const nodes = allChapters.filter((c) => matches(c, args.condition, args.filter))
      const fields: Record<string, keyof DemoChapter> = { LAST_READ_AT: 'lastReadAt', FETCHED_AT: 'fetchedAt', SOURCE_ORDER: 'sourceOrder' }
      nodes.sort((a, b) => {
        for (const order of args.order ?? []) {
          const key = fields[order.by]
          const diff = key ? Number(a[key]) - Number(b[key]) : 0
          if (diff) return diff * (order.byType === 'DESC' ? -1 : 1)
        }
        return 0
      })
      return connection(nodes, args)
    },
    sources: () => connection(openWorks.length ? [SOURCE, OPEN_SOURCE] : [SOURCE]), source: ({ id }: { id: string }) => id === OPEN_SOURCE.id ? OPEN_SOURCE : SOURCE,
    extensions: () => connection([]), fetchExtensions: () => ({ extensions: [] }),
    trackers: () => connection([]), trackRecords: () => connection([]),
    lastUpdateTimestamp: () => ({ timestamp: String(now) }),
    // 按来源过滤：否则切到「开放漫画」时还是演示画室的作品
    fetchSourceManga: ({ input }: { input: { source: string; page: number; query?: string; type: string } }) => ({
      hasNextPage: false,
      mangas: input.page > 1 ? [] : mangas.filter((m) => m.source.id === String(input.source) && (!input.query || m.title.includes(input.query))),
    }),
    fetchMangaAndChapters: ({ input }: { input: { id: number } }) => ({ manga: findManga(input.id), chapters: findManga(input.id).chapters.nodes }),
    fetchChapterPages: ({ input }: { input: { chapterId: number } }) => {
      const c = findChapter(input.chapterId)
      return { chapter: c, pages: c.pages ?? Array.from({ length: c.pageCount }, (_, i) => storyPage(c.manga.title, i)) }
    },
    updateChapter: ({ input }: { input: { id: number; patch: Partial<DemoChapter> } }) => ({ chapter: patchChapter(input.id, input.patch) }),
    updateChapters: ({ input }: { input: { ids: number[]; patch: Partial<DemoChapter> } }) => ({ chapters: input.ids.map((id) => patchChapter(id, input.patch)) }),
    updateManga: ({ input }: { input: { id: number; patch: { inLibrary?: boolean } } }) => {
      const manga = findManga(input.id)
      if (input.patch.inLibrary !== undefined) manga.inLibrary = input.patch.inLibrary
      return { manga }
    },
    updateMangas: ({ input }: { input: { ids: number[]; patch: { inLibrary: boolean } } }) => ({ mangas: input.ids.map((id) => { const m = findManga(id); m.inLibrary = input.patch.inLibrary; return m }) }),
    updateMangaCategories: ({ input }: { input: { id: number; patch: Parameters<typeof changeCategories>[1] } }) => ({ manga: changeCategories(input.id, input.patch) }),
    updateMangasCategories: ({ input }: { input: { ids: number[]; patch: Parameters<typeof changeCategories>[1] } }) => ({ mangas: input.ids.map((id) => changeCategories(id, input.patch)) }),
    // 阅读器按漫画记住的设置存在这里，只在本次演示的内存里
    setMangaMetas: ({ input }: { input: { items: { mangaIds: number[]; metas: { key: string; value: string }[] }[] } }) => {
      const metas = input.items.flatMap((item) => item.mangaIds.flatMap((mangaId) => {
        const m = findManga(mangaId)
        const incoming = item.metas.map((meta) => ({ ...meta, mangaId }))
        m.meta = mergeMeta(m.meta, incoming)
        return incoming
      }))
      return { metas, mangas: [...new Set(metas.map((x) => x.mangaId))].map(findManga) }
    },
    deleteMangaMetas: ({ input }: { input: { items: { mangaIds: number[]; keys?: string[]; prefixes?: string[] }[] } }) => {
      const metas = input.items.flatMap((item) => item.mangaIds.flatMap((mangaId) => {
        const m = findManga(mangaId)
        const gone = (key: string) => !!item.keys?.includes(key) || !!item.prefixes?.some((p) => key.startsWith(p))
        const removed = m.meta.filter((x) => gone(x.key))
        m.meta = m.meta.filter((x) => !gone(x.key))
        return removed
      }))
      return { metas, mangas: [...new Set(metas.map((x) => x.mangaId))].map(findManga) }
    },
    setChapterMetas: ({ input }: { input: { items: { chapterIds: number[]; metas: { key: string; value: string }[] }[] } }) => {
      const metas = input.items.flatMap((item) => item.chapterIds.flatMap((chapterId) => item.metas.map((meta) => {
        const c = findChapter(chapterId)
        c.meta = c.meta.filter((m) => m.key !== meta.key)
        const value = { ...meta, chapterId }
        c.meta.push(value)
        return value
      })))
      return { metas }
    },
  }
  return new Proxy(root, { get(target, key) {
    if (key in target) return Reflect.get(target, key)
    return () => { throw new Error('这项功能需要连接服务器；演示模式只在本地运行') }
  } })
}
