/*
 * 开发用安全模式的白名单：这些来源的漫画在安全模式下照常显示（见 index.css 的 [data-safe]）。
 * 只在 dev 构建里生效，生产构建里恒为 undefined。
 */
const SFW_SOURCES = ['再漫画']

export function sfwAttr(sourceName: string | null | undefined): '' | undefined {
  if (!import.meta.env.DEV || !sourceName) return undefined
  return SFW_SOURCES.some((n) => sourceName.includes(n)) ? '' : undefined
}
