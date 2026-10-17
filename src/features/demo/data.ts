import { DEMO_ACCOUNT_REJECT, PREVIEW_ADMIN, PREVIEW_MEMBER } from '../auth/previewUsers.ts'
import { mergeMeta } from '../reader/remote.ts'
const svgUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
const TITLES = ['云海邮局', '月台尽头', '森林慢车', '星河旅人', '雨后的咖啡馆', '山间来信', '小岛日记', '风的收藏家', '灯塔与猫', '夏日观测站', '旧城漫游', '夜航书店']
const COLORS = ['#23475d', '#563c66', '#365f50', '#303e70', '#705047', '#526a70', '#317177', '#6c6051', '#3d586c', '#626c49', '#704960', '#3a4260']

/** 原创几何风景封面，不引用书库或外部图片。 */
function cover(title: string, i: number) {
  return svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="840" viewBox="0 0 600 840">
    <defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="${COLORS[i % COLORS.length]}"/><stop offset="1" stop-color="#162630"/></linearGradient></defs>
    <rect width="600" height="840" fill="url(#sky)"/>
    <circle cx="${180 + i % 4 * 65}" cy="240" r="105" fill="#f2ddaf" opacity=".85"/>
    <path d="M0 490 180 300 350 495 480 370 600 500V840H0Z" fill="#aec9c4" opacity=".4"/>
    <path d="M0 580 240 425 420 570 600 470V840H0Z" fill="#233c43"/>
    <path d="M0 695Q250 500 600 660V840H0Z" fill="#112832"/>
    <path d="M${190 + i % 12 * 7} 840Q260 680 310 595" fill="none" stroke="#a9beb2" stroke-width="18" opacity=".5"/>
    <g fill="#f4f1e6" font-family="sans-serif"><text x="48" y="84" font-size="16" letter-spacing="5">SUKIMI · 演示作品</text>
    <text x="48" y="160" font-size="48" font-weight="700">${title}</text><text x="48" y="790" font-size="18">一段关于旅途与相遇的故事 · ${String(i + 1).padStart(2, '0')}</text></g>
  </svg>`)
}

/** 六页短故事供正式阅读器演示翻页、缩放和纵向阅读；大书库的章节页数更多，画面按六页循环，页码照实际页数 */
function storyPage(title: string, index: number, total = 6) {
  const page = index % 6
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
    <text x="45" y="85" font-size="32" font-weight="700">${title}</text><text x="855" y="85" font-size="18" text-anchor="end">原创演示 · ${index + 1} / ${total}</text>
    <text x="85" y="535" font-size="24">${lines[page]}</text><text x="660" y="730" font-size="24" text-anchor="middle">${index === total - 1 ? '下一段旅途见！' : '一起出发吧。'}</text>
    <text x="450" y="1210" font-size="22" text-anchor="middle">${String(index + 1).padStart(2, '0')}</text></g>
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
  id: number; title: string; thumbnailUrl: string | null; author: string | null; artist: string | null; description: string | null;
  genre: string[]; status: string; updateStrategy?: string; realUrl: null; initialized: boolean; inLibrary: boolean; inLibraryAt: string;
  source: typeof SOURCE; categories: { nodes: Category[] }; chapters: { nodes: DemoChapter[]; totalCount: number };
  unreadCount: number; downloadCount: number; bookmarkCount: number;
  firstUnreadChapter: DemoChapter | null; lastReadChapter: DemoChapter | null; latestReadChapter: DemoChapter | null;
  latestFetchedChapter: DemoChapter | null; latestUploadedChapter: DemoChapter | null;
  trackRecords: { nodes: DemoTrack[]; totalCount: number };
  meta: { mangaId: number; key: string; value: string }[];
}
interface DemoTrack {
  id: number; trackerId: number; mangaId: number; remoteId: string; remoteUrl: string; title: string; status: number;
  lastChapterRead: number; totalChapters: number; score: number; displayScore: string; startDate: string; finishDate: string; private: boolean;
}
/** 虚构的 Bangumi 追踪：已「登录」，只在演示内存里改状态、进度和评分；搜索、绑定、登录仍走统一拒绝 */
const TRACKER = {
  id: 1, name: 'Bangumi（演示）', icon: '', isLoggedIn: true, isTokenExpired: false, authUrl: null,
  supportsPrivateTracking: false, supportsReadingDates: true, supportsTrackDeletion: false,
  scores: Array.from({ length: 11 }, (_, i) => String(i)),
  statuses: [['Reading', 3], ['Completed', 2], ['On hold', 4], ['Dropped', 5], ['Plan to read', 1]].map(([name, value]) => ({ name, value })),
}
const SOURCE = { id: '9000', name: '演示画室', displayName: '演示画室', lang: 'zh', iconUrl: '/favicon.svg', supportsLatest: true, contentWarning: 'SAFE', homeUrl: null, filters: [] }
/** 只给「同名漫画迁移」演示用：不出现在来源列表里，只作为漫画自带的来源 */
const ALT_SOURCE = { ...SOURCE, id: '9002', name: '演示图书馆', displayName: '演示图书馆' }
const OPEN_SOURCE = { ...SOURCE, id: '9001', name: '开放漫画（本地缓存）', displayName: '开放漫画（本地缓存）' }
/** 标明 NSFW 的虚构来源：演示按来源自动标记。作品内容和其余演示作品一样，只是来源带了标记 */
const NSFW_SOURCE = { ...SOURCE, id: '9003', name: '演示夜读社', displayName: '演示夜读社', contentWarning: 'NSFW' }

/** `pnpm fetch:comics` 生成的 manifest 结构；只在开发环境从本地缓存读取，不进仓库与构建产物。 */
export interface OpenWork {
  id: string; title: string; author: string; description: string; genre: string[]; status: string
  license: { name: string; url: string }; cover: string
  chapters: { name: string; number: number; pages: string[] }[]
}
type Condition = { equalTo?: unknown; in?: unknown[]; greaterThan?: string }
/** 与服务端的筛选输入同形：字段条件之外还有 and / or / not 组合 */
type Filter = { and?: Filter[]; or?: Filter[]; not?: Filter } & { [field: string]: Condition | Filter[] | Filter | undefined }
interface ListArgs { condition?: Record<string, unknown>; filter?: Filter; first?: number; offset?: number; order?: { by: string; byType?: string }[] }
function passes(record: Record<string, unknown>, filter: Filter): boolean {
  return Object.entries(filter).every(([k, v]) => {
    if (v === undefined) return true
    if (k === 'and') return (v as Filter[]).every((f) => passes(record, f))
    if (k === 'or') return (v as Filter[]).some((f) => passes(record, f))
    if (k === 'not') return !passes(record, v as Filter)
    const c = v as Condition
    const value = k === 'inLibrary' && 'manga' in record ? (record.manga as DemoManga).inLibrary : record[k]
    return (c.equalTo === undefined || value === c.equalTo) && (!c.in || c.in.includes(value)) && (c.greaterThan === undefined || Number(value) > Number(c.greaterThan))
  })
}
function matches(item: object, condition: Record<string, unknown> = {}, filter: Filter = {}) {
  const record = item as Record<string, unknown>
  return Object.entries(condition).every(([k, v]) => record[k] === v) && passes(record, filter)
}
function connection<T>(nodes: T[], { first = nodes.length, offset = 0 }: ListArgs = {}) {
  return { nodes: nodes.slice(offset, offset + first), totalCount: nodes.length, pageInfo: { hasNextPage: offset + first < nodes.length, hasPreviousPage: offset > 0 } }
}

type MangaFields = Omit<DemoManga, 'chapters' | 'trackRecords' | 'unreadCount' | 'downloadCount' | 'bookmarkCount' | 'firstUnreadChapter' | 'lastReadChapter' | 'latestReadChapter' | 'latestFetchedChapter' | 'latestUploadedChapter'>
type MakeManga = (fields: MangaFields, chapters: DemoChapter[]) => DemoManga

/** 固定种子的伪随机数，同样的规模每次生成同一份书库 */
function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
/** 一天里各小时的阅读权重：午休和晚上读得多，凌晨少 */
const HOUR_WEIGHTS = [3, 2, 1, 1, 0, 0, 0, 1, 2, 2, 2, 3, 5, 4, 2, 2, 2, 3, 4, 5, 7, 9, 9, 6]

/** 大书库最多生成的作品数 */
export const MAX_SCALE = 10_000

/**
 * 开发环境与 Preview 的 `?scale=N`：再生成 N 部虚构作品、上万话，测画廊和书库在大书库下的性能。
 * 漫画 id 从 5001 起；章节 id 用 1000 万 + 序号 × 1000 + 话数，与原有「漫画 id × 100 + 话数」不会重叠。
 * 超过 1000 部时按比例减少每部话数，一万部约十万话，免得演示占用几百 MB 内存。
 */
function scaledLibrary(scale: number, now: number, categories: Category[], makeManga: MakeManga) {
  const rand = seeded(scale)
  const nowSec = Math.floor(now / 1000)
  const hourSum = HOUR_WEIGHTS.reduce((a, b) => a + b, 0)
  const pickHour = () => {
    let r = rand() * hourSum
    for (let h = 0; h < 24; h++) if ((r -= HOUR_WEIGHTS[h]) < 0) return h
    return 21
  }
  // 按浏览器本地零点生成，阅读高峰才会落在本地的晚上
  const today = Math.floor(new Date(now).setHours(0, 0, 0, 0) / 1000)
  const span = Math.max(12, Math.floor(150 * Math.min(1, 1000 / scale)))
  return Array.from({ length: Math.min(scale, MAX_SCALE) }, (_, k) => {
    const title = `${TITLES[k % TITLES.length]} ${Math.floor(k / TITLES.length) + 2}`
    const chapters: DemoChapter[] = []
    const m = makeManga({
      id: 5001 + k, title, thumbnailUrl: cover(title, k), author: 'Sukimi 演示画室', artist: 'Sukimi 演示画室',
      description: '为性能测试生成的虚构作品。', genre: k % 2 ? ['日常'] : ['冒险'], status: k % 4 ? 'ONGOING' : 'COMPLETED',
      realUrl: null, initialized: true, inLibrary: true, inLibraryAt: String(nowSec - Math.floor(rand() * 400) * 86400),
      source: SOURCE, categories: { nodes: [categories[k % 2]] }, meta: [],
    }, chapters)
    const total = 3 + Math.floor(rand() * span)
    const r = rand()
    // 约两成已追平，一成半没开始读，其余读到一半
    const read = r < 0.2 ? total : r < 0.35 ? 0 : Math.floor(total * rand())
    const imported = rand() < 0.05
    // 最后一次读这部在多少天前；越靠前的话读得越早，每天读四话左右
    const last = Math.floor(rand() ** 2 * 200)
    for (let n = 1; n <= total; n++) {
      const isRead = n <= read
      const at = isRead && !imported ? today - (last + Math.floor((read - n) / 4)) * 86400 + pickHour() * 3600 + Math.floor(rand() * 3600) : 0
      chapters.push({
        id: 10_000_000 + k * 1000 + n, mangaId: m.id, manga: m, name: `第 ${n} 话`, chapterNumber: n, sourceOrder: n,
        pageCount: rand() < 0.05 ? 0 : 18 + Math.floor(rand() * 30), lastPageRead: 0,
        isRead, isBookmarked: false, isDownloaded: false, scanlator: '演示画室', meta: [],
        lastReadAt: String(Math.min(at, nowSec)),
        fetchedAt: String(nowSec - (total - n) * 86400 * 3), uploadDate: String(now - (total - n) * 86400000 * 3),
      })
    }
    return m
  })
}

/** `?edge=1` 时追加的两个分类：超长名称、没有作品 */
const EDGE_CATEGORIES: Category[] = [
  { id: 3, name: '一个名字非常非常长、用来检查分类标签换行和截断效果的虚构分类', order: 2, default: false },
  { id: 4, name: '空分类', order: 3, default: false },
]

/**
 * 开发环境与 Preview 的 `?edge=1`：追加几部边界作品，测超长标题、缺封面、极多 / 零章节和分类组合。
 * 漫画 id 从 4001 起；章节 id 用 3000 万 + 序号 × 1 万 + 话数，和其他编号段不重叠。
 */
function edgeLibrary(now: number, categories: Category[], makeManga: MakeManga) {
  const nowSec = Math.floor(now / 1000)
  const specs: { title: string; cover: 'ok' | 'none' | 'broken'; author: string | null; description: string | null; categories: Category[]; total: number; read: number }[] = [
    {
      title: '在很久很久以前那座被云海环绕、只有每月第一个满月之夜才会出现的山顶小镇上，住着一位负责把寄错地址的信件重新送达的邮差和她那只总是迷路的猫',
      cover: 'ok', author: '一位名字同样特别长、长到作者栏需要折行显示的虚构作者', categories: categories.slice(0, 3), total: 8, read: 2,
      description: '超长标题、超长作者名、超长简介，并且同时属于三个分类。\n' + '这一段简介会不断重复，用来检查简介的折叠和展开。'.repeat(12),
    },
    { title: 'An_Extremely_Long_Fictional_Title_Without_Any_Spaces_To_Check_Overflow_And_Wrapping_0123456789', cover: 'none', author: null, description: null, categories: [], total: 3, read: 0 },
    { title: '封面地址失效的作品', cover: 'broken', author: 'Sukimi 演示画室', description: '封面地址打不开，检查占位图。', categories: [categories[1]], total: 5, read: 5 },
    { title: '五千话的长篇连载', cover: 'ok', author: 'Sukimi 演示画室', description: '有 5000 话，读到第 3200 话，检查长章节列表与跳转。', categories: [categories[0]], total: 5000, read: 3200 },
    { title: '还没有任何章节', cover: 'ok', author: 'Sukimi 演示画室', description: '一话都没有。', categories: [], total: 0, read: 0 },
    { title: '🌙 Emoji と混排タイトル · 혼합 제목 · Ñandú', cover: 'ok', author: 'Sukimi 演示画室', description: '混合多种文字与表情符号。', categories: [categories[2]], total: 12, read: 6 },
  ]
  return specs.map((spec, i) => {
    const chapters: DemoChapter[] = []
    const m = makeManga({
      id: 4001 + i, title: spec.title, author: spec.author, artist: spec.author, description: spec.description,
      thumbnailUrl: spec.cover === 'ok' ? cover(spec.title.slice(0, 8), i) : spec.cover === 'broken' ? 'data:image/webp;base64,' : null,
      genre: i % 2 ? [] : ['冒险', '奇幻', '日常', '治愈', '悬疑', '科幻'], status: i % 2 ? 'UNKNOWN' : 'ONGOING',
      realUrl: null, initialized: true, inLibrary: true, inLibraryAt: String(nowSec - i * 3600),
      source: SOURCE, categories: { nodes: spec.categories }, meta: [],
    }, chapters)
    for (let n = 1; n <= spec.total; n++) chapters.push({
      id: 30_000_000 + i * 10_000 + n, mangaId: m.id, manga: m, name: `第 ${n} 话`, chapterNumber: n, sourceOrder: n,
      pageCount: 6, lastPageRead: 0, isRead: n <= spec.read, isBookmarked: false, isDownloaded: false, scanlator: '演示画室', meta: [],
      lastReadAt: n <= spec.read ? String(nowSec - i * 7200 - (spec.read - n) * 60) : '0',
      fetchedAt: String(nowSec - (spec.total - n) * 3600), uploadDate: String(now - (spec.total - n) * 3_600_000),
    })
    return m
  })
}

/**
 * 更新日历的演示节奏：书库里几部连载按不同规律出新话（周更、晚了、三日更、没有发布日期的双周更、不规律、今天刚更）。
 * last 是最新一话在几天前，gaps 从新到旧依次是每两话之间隔几天；hour 缺省时像多数来源一样只给日期。
 */
const RHYTHM: Record<number, { last: number; gaps: number[]; hour?: number; noUpload?: boolean }> = {
  1: { last: 6, gaps: [7], hour: 20 },
  2: { last: 10, gaps: [7] },
  4: { last: 3, gaps: [3] },
  5: { last: 6, gaps: [14], noUpload: true },
  7: { last: 2, gaps: [5, 19, 9, 30, 12, 25, 8] },
  8: { last: 0, gaps: [7], hour: 9 },
}
function rhythmTimes(i: number, n: number, now: number) {
  const r = RHYTHM[i]
  if (!r) return {}
  let ago = r.last
  for (let k = 0; k < 8 - n; k++) ago += r.gaps[k % r.gaps.length]
  const day = new Date(now)
  day.setHours(0, 0, 0, 0)
  day.setDate(day.getDate() - ago)
  const upload = Math.min(now - 60_000, day.getTime() + (r.hour ?? 0) * 3_600_000)
  // 服务端检查要过一阵才抓到；没给发布日期的来源只剩这个时间
  const fetched = Math.min(now, upload + (r.hour === undefined ? 21 : 2) * 3_600_000)
  return { uploadDate: r.noUpload ? '0' : String(upload), fetchedAt: String(Math.floor(fetched / 1000)) }
}

/** 每个客户端拥有自己的数据，修改仅在本次演示内存中生效。 */
export function createDemoData(now = Date.now(), openWorks: { work: OpenWork; url: (file: string) => string }[] = [], { scale = 0, edge = false }: { scale?: number; edge?: boolean } = {}) {
  const categories: Category[] = [{ id: 1, name: '旅途', order: 0, default: false }, { id: 2, name: '日常', order: 1, default: false }, ...(edge ? EDGE_CATEGORIES : [])]
  /** 各项统计都按章节现算，改了已读、书签后跟着变 */
  const makeManga: MakeManga = (fields, chapters) => {
    const m: DemoManga = {
      updateStrategy: 'ALWAYS_UPDATE',
      ...fields,
      chapters: { nodes: chapters, get totalCount() { return chapters.length } },
      get trackRecords() { return connection(tracks.filter((t) => t.mangaId === m.id)) },
      get unreadCount() { return chapters.filter((c) => !c.isRead).length },
      get downloadCount() { return chapters.filter((c) => c.isDownloaded).length },
      get bookmarkCount() { return chapters.filter((c) => c.isBookmarked).length },
      get firstUnreadChapter() { return chapters.find((c) => !c.isRead) ?? null },
      // 与真实服务端一致：没读过时也会返回第一话，只是阅读时间为 0
      get lastReadChapter() { return [...chapters].sort((a, b) => Number(b.lastReadAt) - Number(a.lastReadAt) || a.sourceOrder - b.sourceOrder)[0] ?? null },
      get latestReadChapter() { return chapters.filter((c) => c.isRead).sort((a, b) => b.sourceOrder - a.sourceOrder)[0] ?? null },
      get latestFetchedChapter() { return chapters[chapters.length - 1] ?? null },
      get latestUploadedChapter() { return chapters[chapters.length - 1] ?? null },
    }
    return m
  }
  const mangas: DemoManga[] = TITLES.map((title, i) => {
    const chapters: DemoChapter[] = []
    const m = makeManga({
      id: i + 1, title, thumbnailUrl: cover(title, i), author: 'Sukimi 演示画室', artist: 'Sukimi 演示画室',
      description: '一封寄往远方的信，一趟不赶时间的旅程。在山间、森林与小城之间，发现那些被日常忽略的相遇。\n这是为 Sukimi 创作的虚构演示作品，封面和阅读页面均在本地生成。',
      genre: i % 2 ? ['日常', '治愈'] : ['冒险', '奇幻'], status: i % 3 ? 'ONGOING' : 'COMPLETED',
      realUrl: null, initialized: true, inLibrary: i < 10, inLibraryAt: String(Math.floor(now / 1000) - i * 86400),
      // 第 4、5 部来自 NSFW 来源：第 4 部跟随来源被隐藏，第 5 部在下面的全局元数据里手动放行
      source: i === 3 || i === 4 ? NSFW_SOURCE : SOURCE, categories: { nodes: [categories[i % 2]] }, meta: [],
    }, chapters)
    // 第 9 部（在书库）和最后一部（不在书库）从没读过，演示「开始阅读」与首页「还没开始读」
    const fresh = i === 8 || i === TITLES.length - 1
    // 第 10 部像 Tachiyomi 时期导入的：前两话标了已读、没有阅读时间，不能算「还没开始读」
    const imported = i === 9
    // 第 6～8 部三到五周前读过，演示首页「好久没看」
    const away = i >= 5 && i <= 7 ? (i - 2) * 7 * 86400 : 0
    for (let n = 1; n <= 8; n++) chapters.push({
      id: m.id * 100 + n, mangaId: m.id, manga: m, name: ['出发', '山间的风', '一封来信', '森林站台', '远方的灯', '雨过天晴', '新的朋友', '下一段旅途'][n - 1],
      chapterNumber: n, sourceOrder: n, pageCount: 6, lastPageRead: fresh ? 0 : n < 3 ? 5 : n === 3 ? 1 : 0,
      isRead: !fresh && n < 3, isBookmarked: !fresh && n === 3, isDownloaded: n < 4, scanlator: '演示画室', meta: [],
      lastReadAt: !fresh && !imported && n <= 3 ? String(Math.floor(now / 1000) - away - i * 7200 - (3 - n) * 300) : '0',
      // 第 1 部的后三话同一天抓到，演示更新页的折叠
      fetchedAt: String(Math.floor(now / 1000) - (i === 0 && n >= 6 ? 3600 + (8 - n) * 60 : (8 - n) * 86400 + i * 600)), uploadDate: String(now - (8 - n) * 86400000 - i * 600000),
      ...rhythmTimes(i, n, now),
    })
    return m
  })
  // 书库第 1 部在另一个来源的同名版本，没加入书库：从它的详情页点收藏会提示迁移
  {
    const chapters: DemoChapter[] = []
    const m = makeManga({
      id: 2001, title: TITLES[0], thumbnailUrl: cover(TITLES[0], 0), author: 'Sukimi 演示画室', artist: 'Sukimi 演示画室',
      description: '书库里《云海邮局》在另一个来源的同名版本，用来演示加入书库时迁移阅读进度。',
      genre: ['冒险', '奇幻'], status: 'ONGOING', realUrl: null, initialized: true, inLibrary: false, inLibraryAt: '0',
      source: ALT_SOURCE, categories: { nodes: [] }, meta: [],
    }, chapters)
    // 比书库里那一版多两话，看得出话数对应
    for (let n = 1; n <= 10; n++) chapters.push({
      id: m.id * 100 + n, mangaId: m.id, manga: m, name: `第 ${n} 话`, chapterNumber: n, sourceOrder: n, pageCount: 6, lastPageRead: 0,
      isRead: false, isBookmarked: false, isDownloaded: false, scanlator: '演示图书馆', meta: [], lastReadAt: '0',
      fetchedAt: String(Math.floor(now / 1000) - (10 - n) * 86400), uploadDate: String(now - (10 - n) * 86400000),
    })
    mangas.push(m)
  }
  openWorks.forEach(({ work, url }, w) => {
    const chapters: DemoChapter[] = []
    const m = makeManga({
      id: 1001 + w, title: work.title, thumbnailUrl: url(`${work.id}/${work.cover}`), author: work.author, artist: work.author,
      description: work.description, genre: work.genre, status: work.status,
      realUrl: null, initialized: true, inLibrary: true, inLibraryAt: String(Math.floor(now / 1000) - w * 86400),
      source: OPEN_SOURCE, categories: { nodes: [] }, meta: [],
    }, chapters)
    for (const c of work.chapters) chapters.push({
      id: m.id * 100 + c.number, mangaId: m.id, manga: m, name: c.name, chapterNumber: c.number, sourceOrder: c.number,
      pageCount: c.pages.length, lastPageRead: 0, lastReadAt: '0', isRead: false, isBookmarked: false, isDownloaded: false,
      scanlator: work.license.name, meta: [], pages: c.pages.map((f) => url(`${work.id}/${f}`)),
      fetchedAt: String(Math.floor(now / 1000) - (work.chapters.length - c.number) * 86400), uploadDate: String(now - (work.chapters.length - c.number) * 86400000),
    })
    mangas.push(m)
  })
  if (scale > 0) mangas.push(...scaledLibrary(scale, now, categories, makeManga))
  if (edge) {
    mangas.push(...edgeLibrary(now, categories, makeManga))
    // 大书库里再混进不在任何分类、同时在三个分类的作品；不消耗随机数，同样规模的其余数据不变
    for (const m of mangas) if (m.id > 5000 && (m.id - 5001) % 7 < 2) m.categories.nodes = (m.id - 5001) % 7 ? categories.slice(0, 3) : []
  }
  const allChapters = mangas.flatMap((m) => m.chapters.nodes)
  // 第一部已绑定，读过两话、打了 8 分
  const tracks: DemoTrack[] = [{
    id: 1, trackerId: TRACKER.id, mangaId: 1, remoteId: '1', remoteUrl: '#', title: TITLES[0], status: 3,
    lastChapterRead: 2, totalChapters: 8, score: 8, displayScore: '8', startDate: String(now - 20 * 86400000), finishDate: '0', private: false,
  }]
  const findTrack = (id: number) => {
    const t = tracks.find((t) => t.id === id)
    if (!t) throw new Error('这条追踪不在演示数据中')
    return t
  }
  const findManga = (id: number) => {
    const m = mangas.find((m) => m.id === id)
    if (!m) throw new Error('这部漫画不在演示书库中')
    return m
  }
  const chapterById = new Map(allChapters.map((c) => [c.id, c]))
  const findChapter = (id: number) => {
    const c = chapterById.get(id)
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
  // 虚构的用户与未使用的码，给演示里的「用户」页看；改账号的操作都拒绝
  const reject = () => { throw new Error(DEMO_ACCOUNT_REJECT) }
  const demoUsers = [
    { id: 1, username: 'admin', roles: ['ADMIN'], permissions: [] },
    { ...PREVIEW_ADMIN }, { ...PREVIEW_MEMBER },
    { id: 4, username: '阿远', roles: ['USER'], permissions: ['DOWNLOAD_CHAPTERS', 'INSTALL_EXTENSIONS', 'UNINSTALL_EXTENSIONS'] },
  ]
  const demoCodes = [
    { id: 1, purpose: 'REGISTRATION', expiresAt: String(Math.floor(now / 1000) + 5 * 86400), createdBy: demoUsers[1], user: null },
    { id: 2, purpose: 'RECOVERY', expiresAt: String(Math.floor(now / 1000) + 20 * 3600), createdBy: demoUsers[1], user: demoUsers[3] },
  ]
  // 全局元数据（「稍后再看」，键带账号 id）：给演示管理员预置两部不在书库的和一部在书库没读过的，
  // 切到演示成员时清单为空；只在本次演示的内存里改
  const nowSec = Math.floor(now / 1000)
  const laterOf = (mangaId: number) => `sukimi.later.${PREVIEW_ADMIN.id}.${mangaId}`
  const globalMeta = new Map<string, string>([
    [laterOf(12), String(nowSec - 3 * 86400)],
    [laterOf(2001), String(nowSec - 9 * 86400)],
    [laterOf(9), String(nowSec - 40 * 86400)],
    // NSFW 标记（features/nsfw）：第 7 部手动标记，第 5 部来源是 NSFW 但手动放行
    [`sukimi.nsfw.${PREVIEW_ADMIN.id}.m.7`, '1'],
    [`sukimi.nsfw.${PREVIEW_ADMIN.id}.m.5`, '0'],
  ])
  const root = {
    users: () => connection(demoUsers), userCodes: () => demoCodes,
    createRegistrationCode: reject, createRecoveryCode: reject, revokeUserCode: reject, updateUser: reject, register: reject, setPassword: reject,
    mangas: (args: ListArgs) => connection(mangas.filter((m) => matches(m, args.condition, args.filter)), args),
    manga: ({ id }: { id: number }) => findManga(id),
    categories: () => connection(categories),
    chapters: (args: ListArgs) => {
      const nodes = allChapters.filter((c) => matches(c, args.condition, args.filter))
      const fields: Record<string, keyof DemoChapter> = { ID: 'id', LAST_READ_AT: 'lastReadAt', FETCHED_AT: 'fetchedAt', SOURCE_ORDER: 'sourceOrder' }
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
    trackers: () => connection([TRACKER]), trackRecords: (args: ListArgs) => connection(tracks.filter((t) => matches(t, args.condition, args.filter)), args),
    updateTrack: ({ input }: { input: { recordId: number; status?: number; lastChapterRead?: number; scoreString?: string; startDate?: string; finishDate?: string } }) => {
      const t = findTrack(input.recordId)
      if (input.status != null) t.status = input.status
      if (input.lastChapterRead != null) t.lastChapterRead = input.lastChapterRead
      if (input.scoreString != null) Object.assign(t, { displayScore: input.scoreString, score: Number(input.scoreString) || 0 })
      if (input.startDate != null) t.startDate = input.startDate
      if (input.finishDate != null) t.finishDate = input.finishDate
      return { trackRecord: t }
    },
    fetchTrack: ({ input }: { input: { recordId: number } }) => ({ trackRecord: findTrack(input.recordId) }),
    lastUpdateTimestamp: () => ({ timestamp: String(now) }),
    // 只有更新日历读检查频率（小时）；设置页在演示里不连服务端
    settings: () => ({ globalUpdateInterval: 12 }),
    // 按来源过滤：否则切到「开放漫画」时还是演示画室的作品
    fetchSourceManga: ({ input }: { input: { source: string; page: number; query?: string; type: string } }) => ({
      hasNextPage: false,
      mangas: input.page > 1 ? [] : mangas.filter((m) => m.source.id === String(input.source) && (!input.query || m.title.includes(input.query))),
    }),
    fetchMangaAndChapters: ({ input }: { input: { id: number } }) => ({ manga: findManga(input.id), chapters: findManga(input.id).chapters.nodes }),
    fetchChapterPages: ({ input }: { input: { chapterId: number } }) => {
      const c = findChapter(input.chapterId)
      return { chapter: c, pages: c.pages ?? Array.from({ length: c.pageCount }, (_, i) => storyPage(c.manga.title, i, c.pageCount)) }
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
    metas: ({ filter }: { filter?: { key?: { startsWith?: string } } }) => {
      const prefix = filter?.key?.startsWith ?? ''
      return connection([...globalMeta].filter(([key]) => key.startsWith(prefix)).map(([key, value]) => ({ key, value })))
    },
    setGlobalMeta: ({ input }: { input: { meta: { key: string; value: string } } }) => {
      globalMeta.set(input.meta.key, input.meta.value)
      return { meta: input.meta }
    },
    setGlobalMetas: ({ input }: { input: { metas: { key: string; value: string }[] } }) => {
      input.metas.forEach((m) => globalMeta.set(m.key, m.value))
      return { metas: input.metas }
    },
    deleteGlobalMetas: ({ input }: { input: { keys?: string[]; prefixes?: string[] } }) => {
      const gone = [...globalMeta].filter(([key]) => !!input.keys?.includes(key) || !!input.prefixes?.some((p) => key.startsWith(p)))
      gone.forEach(([key]) => globalMeta.delete(key))
      return { metas: gone.map(([key, value]) => ({ key, value })) }
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
