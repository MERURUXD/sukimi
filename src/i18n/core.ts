import i18next from 'i18next'
import zhCN from './zh-CN/index.ts'
import en from './en/index.ts'

export type LocalePref = 'system' | 'zh-CN' | 'en'
export type Locale = 'zh-CN' | 'en'

/** 语言偏好单独存放：要在整个模块图加载之前读出来，不能等外观 store 恢复 */
export const LOCALE_KEY = 'suwayomi-web.locale'

/** 跟随系统：浏览器语言以 zh 开头、或读不到语言（Node 测试）时用简体中文，其余用英文 */
export function resolveLocale(pref: LocalePref, navLang?: string | null): Locale {
  if (pref === 'zh-CN' || pref === 'en') return pref
  if (!navLang) return 'zh-CN'
  return /^zh/i.test(navLang) ? 'zh-CN' : 'en'
}

export function readLocalePref(): LocalePref {
  try {
    const v = typeof localStorage === 'undefined' ? null : localStorage.getItem(LOCALE_KEY)
    return v === 'zh-CN' || v === 'en' ? v : 'system'
  } catch {
    return 'system'
  }
}

const lang = resolveLocale(readLocalePref(), typeof navigator === 'undefined' ? null : navigator.language)

export const i18n = i18next.createInstance()
// 词典内联，init 同步完成，模块顶层和纯函数里也能直接用 t
void i18n.init({
  lng: lang,
  fallbackLng: 'zh-CN',
  resources: { 'zh-CN': { translation: zhCN }, en: { translation: en } },
  interpolation: { escapeValue: false },
  returnNull: false,
})

export const locale: Locale = lang
export const t = i18n.t.bind(i18n)

if (typeof document !== 'undefined') document.documentElement.lang = lang

/**
 * 保存语言偏好并刷新页面。模块顶层的常量（标签表、选项表）只在加载时取一次文案，
 * 刷新比逐个订阅更可靠；偏好已存好，刷新后设置页会停在原处。
 */
export function setLocalePref(pref: LocalePref) {
  try {
    if (pref === 'system') localStorage.removeItem(LOCALE_KEY)
    else localStorage.setItem(LOCALE_KEY, pref)
  } catch {
    // 存不了就只能保持当前语言
    return
  }
  location.reload()
}
