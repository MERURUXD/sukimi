/*
 * 自建标签：和特别关心一样存在服务端的全局元数据里，一部漫画一个键，键里带账号 id。
 * 值记两样：自己加的标签（add），以及这部漫画里不想看到的来源标签（hide，存来源原本的写法）。
 * 显示、搜索、筛选和统计都用「来源标签去掉隐藏的，再加上自己加的」，两种标签地位相同。
 * 这里只放纯逻辑（Node 测试直接导入），不依赖 React、Apollo 或路径别名。
 */

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

/** 所有漫画里自己加过的标签，用得多的在前；输入时补全用 */
export function knownTags(edits: Iterable<TagEdit>) {
  const count = new Map<string, { name: string; n: number }>()
  for (const e of edits) {
    for (const a of e.add) {
      const k = a.toLowerCase()
      const hit = count.get(k)
      if (hit) hit.n++
      else count.set(k, { name: a, n: 1 })
    }
  }
  return [...count.values()].sort((a, b) => b.n - a.n).map((x) => x.name)
}

/** 换源迁移：旧漫画的标签并进新漫画已有的，两边自己加的都留着；隐藏的来源标签一并带上（同名的才会生效） */
export const mergeTags = (from: TagEdit, to: TagEdit = NO_EDIT): TagEdit => ({
  add: uniq([...to.add, ...from.add]),
  hide: uniq([...to.hide, ...from.hide]),
})
