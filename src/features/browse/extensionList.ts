import type { ExtensionFieldsFragment } from '@/api/gql/graphql'

export type Extension = ExtensionFieldsFragment
export type ExtensionTab = 'installed' | 'updates' | 'available'
export interface ExtensionView {
  tab: ExtensionTab
  /** 「未安装」里只看这些语言；空数组表示不限 */
  langs: readonly string[]
  query: string
  /** 只作用于「未安装」：已经装上的扩展总要能看到、能卸载 */
  hideNsfw: boolean
}

const key = (lang: string) => lang.toLowerCase()

export const inTab = (e: Extension, tab: ExtensionTab) =>
  tab === 'installed' ? e.isInstalled : tab === 'updates' ? e.isInstalled && e.hasUpdate : !e.isInstalled

export function tabCounts(list: readonly Extension[]): Record<ExtensionTab, number> {
  const counts = { installed: 0, updates: 0, available: 0 }
  for (const e of list) {
    if (inTab(e, 'installed')) counts.installed++
    if (inTab(e, 'updates')) counts.updates++
    if (inTab(e, 'available')) counts.available++
  }
  return counts
}

/** 浏览器语言对应的扩展语言代码：zh-CN → zh、zh-hans；pt-BR → pt-br、pt */
function browserLangs(languages: readonly string[]) {
  const out = new Set<string>()
  for (const l of languages) {
    const full = key(l)
    const base = full.split('-')[0]
    out.add(full).add(base)
    if (base === 'zh') out.add(/tw|hk|mo|hant/.test(full) ? 'zh-hant' : 'zh-hans')
  }
  return out
}

/**
 * 没选过语言时的默认值：已安装扩展的语言、多语言扩展，加上浏览器语言。
 * 只保留列表里确实存在的语言，避免出现选中了却看不到的芯片。
 */
export function defaultLangs(list: readonly Extension[], languages: readonly string[] = []): string[] {
  const wanted = browserLangs(languages).add('all')
  for (const e of list) if (e.isInstalled) wanted.add(key(e.lang))
  const present = new Set(list.map((e) => key(e.lang)))
  return [...wanted].filter((l) => present.has(l))
}

/** 「未安装」里各语言的扩展数量，多的在前 */
export function langCounts(list: readonly Extension[]): [string, number][] {
  const m = new Map<string, number>()
  for (const e of list) if (!e.isInstalled) m.set(key(e.lang), (m.get(key(e.lang)) ?? 0) + 1)
  return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
}

/** 按当前分栏、语言、关键词筛出扩展，再按语言分组；组内按名称排序 */
export function visibleExtensions(list: readonly Extension[], view: ExtensionView): { lang: string; items: Extension[] }[] {
  const q = view.query.trim().toLowerCase()
  const langs = new Set(view.langs.map(key))
  const groups = new Map<string, Extension[]>()
  for (const e of list) {
    if (!inTab(e, view.tab)) continue
    if (view.tab === 'available') {
      if (langs.size > 0 && !langs.has(key(e.lang))) continue
      if (view.hideNsfw && e.contentWarning === 'NSFW') continue
    }
    if (q && !e.name.toLowerCase().includes(q) && !e.pkgName.toLowerCase().includes(q)) continue
    const g = groups.get(key(e.lang))
    if (g) g.push(e)
    else groups.set(key(e.lang), [e])
  }
  // 选中的语言按选择顺序排在前面，其余按数量
  const order = [...langs]
  return [...groups.entries()]
    .map(([lang, items]) => ({ lang, items: items.sort((a, b) => a.name.localeCompare(b.name)) }))
    .sort((a, b) => {
      const ia = order.indexOf(a.lang)
      const ib = order.indexOf(b.lang)
      if (ia !== ib) return (ia < 0 ? Infinity : ia) - (ib < 0 ? Infinity : ib)
      return b.items.length - a.items.length || a.lang.localeCompare(b.lang)
    })
}
