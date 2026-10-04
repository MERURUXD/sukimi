import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ReadMode = 'single' | 'double' | 'vertical' | 'webtoon'
export type ReadDir = 'ltr' | 'rtl'
export type Fit = 'screen' | 'width' | 'height' | 'original'
export type ReaderBg = 'black' | 'gray' | 'white'
/** 点击分区：auto = 分页模式左右分、纵向模式上下分 */
export type TapZones = 'auto' | 'lr' | 'tb' | 'off'

export interface ReaderSettings {
  mode: ReadMode
  dir: ReadDir
  fit: Fit
  bg: ReaderBg
  /** 预加载后面几页 */
  preload: number
  /** 双页时第一页（封面）单独显示 */
  offsetFirst: boolean
  /** 读完自动进入下一话 */
  autoNext: boolean
  tapZones: TapZones
}

export const MODES: { value: ReadMode; label: string; hint: string }[] = [
  { value: 'single', label: '单页', hint: '一次一页，点按翻页' },
  { value: 'double', label: '双页', hint: '跨页对开，适合宽屏' },
  { value: 'vertical', label: '纵向连续', hint: '页间留缝，滚动阅读' },
  { value: 'webtoon', label: 'Webtoon', hint: '无缝长条，条漫专用' },
]

export const FITS: { value: Fit; label: string }[] = [
  { value: 'screen', label: '适应屏幕' },
  { value: 'width', label: '适应宽度' },
  { value: 'height', label: '适应高度' },
  { value: 'original', label: '原始大小' },
]

export const BGS: { value: ReaderBg; color: string; label: string }[] = [
  { value: 'black', color: '#000000', label: '黑色' },
  { value: 'gray', color: '#232427', label: '深灰' },
  { value: 'white', color: '#EDECE7', label: '白色' },
]

export const TAP_ZONES: { value: TapZones; label: string; hint: string }[] = [
  { value: 'auto', label: '自动', hint: '分页模式左右分区，纵向模式上下分区' },
  { value: 'lr', label: '左右', hint: '左 30% / 右 30% 翻页，中间呼出菜单' },
  { value: 'tb', label: '上下', hint: '上 30% 上一页，下 30% 下一页' },
  { value: 'off', label: '关闭', hint: '点击只呼出菜单，用手势或按键翻页' },
]

export const DEFAULTS: ReaderSettings = {
  mode: 'single',
  dir: 'rtl',
  fit: 'screen',
  bg: 'black',
  preload: 3,
  offsetFirst: true,
  autoNext: true,
  tapZones: 'auto',
}

/** 「按漫画记住」时，这些项按漫画单独存；其余是全局偏好 */
const PER_MANGA: (keyof ReaderSettings)[] = ['mode', 'dir', 'fit']

interface Store {
  defaults: ReaderSettings
  perManga: Record<number, Partial<ReaderSettings>>
  rememberPerManga: boolean
  set: (mangaId: number, patch: Partial<ReaderSettings>) => void
  setRemember: (v: boolean) => void
  /** 设置页：直接改全局默认值 */
  setDefaults: (patch: Partial<ReaderSettings>) => void
  /** 清掉所有按漫画记住的模式 / 方向 / 缩放 */
  clearPerManga: () => void
}

export const useReaderStore = create<Store>()(
  persist(
    (set) => ({
      defaults: DEFAULTS,
      perManga: {},
      rememberPerManga: true,
      set: (mangaId, patch) =>
        set((s) => {
          if (!s.rememberPerManga) return { defaults: { ...s.defaults, ...patch } }
          const local: Partial<ReaderSettings> = {}
          const global: Partial<ReaderSettings> = {}
          for (const [k, v] of Object.entries(patch) as [keyof ReaderSettings, never][]) {
            if (PER_MANGA.includes(k)) local[k] = v
            else global[k] = v
          }
          return {
            defaults: { ...s.defaults, ...global },
            perManga: { ...s.perManga, [mangaId]: { ...s.perManga[mangaId], ...local } },
          }
        }),
      setRemember: (rememberPerManga) => set({ rememberPerManga }),
      setDefaults: (patch) => set((s) => ({ defaults: { ...s.defaults, ...patch } })),
      clearPerManga: () => set({ perManga: {} }),
    }),
    { name: 'suwayomi-web.reader', version: 1 },
  ),
)

export function useReaderSettings(mangaId: number) {
  const defaults = useReaderStore((s) => s.defaults)
  const local = useReaderStore((s) => (s.rememberPerManga ? s.perManga[mangaId] : undefined))
  const set = useReaderStore((s) => s.set)
  // 旧版本存下的默认值可能缺新字段，用内置默认补齐
  const settings: ReaderSettings = { ...DEFAULTS, ...defaults, ...local }
  return [settings, (patch: Partial<ReaderSettings>) => set(mangaId, patch)] as const
}

export const cycle = <T,>(list: readonly { value: T }[], cur: T) =>
  list[(list.findIndex((x) => x.value === cur) + 1) % list.length].value
