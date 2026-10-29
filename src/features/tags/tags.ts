/*
 * 自建标签：和特别关心一样存在服务端的全局元数据里，一部漫画一个键，键里带账号 id。
 * 值记两样：自己加的标签（add），以及这部漫画里不想看到的来源标签（hide，存来源原本的写法）。
 * 显示、搜索、筛选和统计都用「来源标签去掉隐藏的，再加上自己加的」，两种标签地位相同。
 * 这里只放纯逻辑（Node 测试直接导入），不依赖 React、Apollo 或路径别名。
 */

import { canonicalTag, genresOf } from '../gallery/taste.ts'

export const TAGS_PREFIX = 'sukimi.tags.'

export const tagsPrefix = (userId: number) => `${TAGS_PREFIX}${userId}.`

export const tagsKey = (userId: number, mangaId: number) => `${tagsPrefix(userId)}${mangaId}`

export interface TagEdit {
  add: readonly string[]
  hide: readonly string[]
}

export const NO_EDIT: TagEdit = { add: [], hide: [] }

/** 标签名过长时截断：来源偶尔把一整句简介塞进标签 */
export const TAG_MAX = 30

/** 去掉首尾空白、合并中间空白；空串表示无效 */
export const cleanTag = (s: string) => s.trim().replace(/\s+/g, ' ').slice(0, TAG_MAX)

/** 比较用：不分大小写，Romance 与 romance 算同一个 */
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

const has = (list: readonly string[], name: string) => list.some((x) => same(x, name))

function uniq(list: readonly unknown[]) {
  const out: string[] = []
  for (const x of list) {
    const name = typeof x === 'string' ? cleanTag(x) : ''
    if (name && !has(out, name)) out.push(name)
  }
  return out
}

/** 该账号的 漫画 id → 编辑；别的账号的键、写坏的键和值直接忽略 */
export function parseTags(userId: number, metas: readonly { key: string; value: string }[] = []) {
  const prefix = tagsPrefix(userId)
  const out = new Map<number, TagEdit>()
  for (const { key, value } of metas) {
    if (!key.startsWith(prefix)) continue
    const id = Number(key.slice(prefix.length))
    if (!Number.isSafeInteger(id) || id <= 0) continue
    let raw: unknown
    try { raw = JSON.parse(value) } catch { continue }
    if (!raw || typeof raw !== 'object') continue
    const { add, hide } = raw as { add?: unknown; hide?: unknown }
    const edit = { add: uniq(Array.isArray(add) ? add : []), hide: uniq(Array.isArray(hide) ? hide : []) }
    if (edit.add.length || edit.hide.length) out.set(id, edit)
  }
  return out
}

/** 写入的值；没有任何改动时返回 null，由调用方删掉这个键 */
export const serializeTags = (edit: TagEdit) => (edit.add.length || edit.hide.length ? JSON.stringify({ add: edit.add, hide: edit.hide }) : null)

/** 来源标签：原样去重，分出显示的和被隐藏的 */
export function sourceTags(genre: readonly string[] | null | undefined, edit: TagEdit = NO_EDIT) {
  const all = uniq(genre ?? [])
  return { shown: all.filter((g) => !has(edit.hide, g)), hidden: all.filter((g) => has(edit.hide, g)) }
}

/** 最终的标签：来源标签去掉隐藏的，后面接自己加的；和来源重复的不再列一次 */
export function tagsOf(genre: readonly string[] | null | undefined, edit: TagEdit = NO_EDIT) {
  const { shown } = sourceTags(genre, edit)
  return [...shown, ...edit.add.filter((a) => !has(shown, a))]
}

/** 这部漫画上已经有这个标签（来源显示中的或自己加的） */
export const hasTag = (genre: readonly string[] | null | undefined, edit: TagEdit, name: string) => has(tagsOf(genre, edit), cleanTag(name))

/** 加一个标签。和被隐藏的来源标签同名时直接取消隐藏，不重复存一份 */
export function addTag(edit: TagEdit, name: string): TagEdit {
  const tag = cleanTag(name)
  if (!tag) return edit
  if (has(edit.hide, tag)) return { ...edit, hide: edit.hide.filter((x) => !same(x, tag)) }
  return has(edit.add, tag) ? edit : { ...edit, add: [...edit.add, tag] }
}

export const removeTag = (edit: TagEdit, name: string): TagEdit => ({ ...edit, add: edit.add.filter((x) => !same(x, name)) })

/** 隐藏或恢复一个来源标签 */
export function hideSource(edit: TagEdit, name: string, hidden: boolean): TagEdit {
  const rest = edit.hide.filter((x) => !same(x, name))
  return { ...edit, hide: hidden ? [...rest, name] : rest }
}

/** 所有漫画里自己加过的标签和各自用在几部上（不在书库的也算），用得多的在前；大小写不同的算一个，显示先见到的写法 */
export function tagUsage(edits: Iterable<TagEdit>) {
  const count = new Map<string, { name: string; count: number }>()
  for (const e of edits) {
    for (const a of e.add) {
      const k = a.toLowerCase()
      const hit = count.get(k)
      if (hit) hit.count++
      else count.set(k, { name: a, count: 1 })
    }
  }
  return [...count.values()].sort((a, b) => b.count - a.count)
}

/** 输入时补全用 */
export const knownTags = (edits: Iterable<TagEdit>) => tagUsage(edits).map((x) => x.name)

/**
 * 把自己加的一个标签改名，位置不变；改成已有的名字就是合并。
 * 和这部隐藏的来源标签同名时不去取消隐藏：批量改名只动自己的标签
 */
export function renameTag(edit: TagEdit, from: string, to: string): TagEdit {
  const name = cleanTag(to)
  if (!name || !has(edit.add, from)) return edit
  return { ...edit, add: uniq(edit.add.map((x) => (same(x, from) ? name : x))) }
}

/**
 * 对每部漫画套用同一个改动，只返回真的变了的：漫画 id → 新的值（null 表示删掉这个键）。
 * 设置里改名、删除标签时一次写完
 */
export function changedTags(edits: ReadonlyMap<number, TagEdit>, change: (edit: TagEdit) => TagEdit) {
  const out = new Map<number, string | null>()
  for (const [id, edit] of edits) {
    const value = serializeTags(change(edit))
    if (value !== serializeTags(edit)) out.set(id, value)
  }
  return out
}

/** 换源迁移：旧漫画的标签并进新漫画已有的，两边自己加的都留着；隐藏的来源标签一并带上（同名的才会生效） */
export const mergeTags = (from: TagEdit, to: TagEdit = NO_EDIT): TagEdit => ({
  add: uniq([...to.add, ...from.add]),
  hide: uniq([...to.hide, ...from.hide]),
})

/* ───────── 书库按标签筛选 ───────── */

/** 筛选里选中的标签：名字 → 1 包含 / 2 排除 */
export type TagPicks = Readonly<Record<string, 1 | 2>>

/**
 * 筛选、统计用的标签：来源标签按口味屏的规则归一（同义合并、去掉「连载中」这类词），
 * 自己加的只做同义合并：是自己特意写上的，哪怕是「完结」也要能筛出来
 */
export function filterTags(genre: readonly string[] | null | undefined, edit: TagEdit = NO_EDIT) {
  const out: string[] = []
  for (const name of [...genresOf(sourceTags(genre, edit).shown), ...edit.add.map(canonicalTag)]) {
    if (!has(out, name)) out.push(name)
  }
  return out
}

/** 书库里出现过的标签和各自的部数，多的在前；部数相同按名字 */
export function libraryTags(list: readonly { id: number; genre?: readonly string[] | null }[], edits: ReadonlyMap<number, TagEdit>) {
  const count = new Map<string, { name: string; count: number }>()
  for (const m of list) {
    for (const name of filterTags(m.genre, edits.get(m.id))) {
      const k = name.toLowerCase()
      const hit = count.get(k)
      if (hit) hit.count++
      else count.set(k, { name, count: 1 })
    }
  }
  const collator = new Intl.Collator('zh-CN', { numeric: true, sensitivity: 'base' })
  return [...count.values()].sort((a, b) => b.count - a.count || collator.compare(a.name, b.name))
}

/** 包含的标签满足任一即可（没选包含时不限），排除的一个都不能有 */
export function matchTags(names: readonly string[], picks: TagPicks) {
  const hit = (pick: 1 | 2) => Object.keys(picks).filter((k) => picks[k] === pick).map((k) => k.toLowerCase())
  const own = new Set(names.map((n) => n.toLowerCase()))
  const inc = hit(1)
  return (!inc.length || inc.some((k) => own.has(k))) && !hit(2).some((k) => own.has(k))
}
