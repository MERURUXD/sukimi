import { useEffect } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { preferenceKey } from '@/lib/demo'
import { t } from '@/i18n'

/**
 * 液态折射的可调参数。默认使用「通透」，深浅模式分别保存；
 * 用户可在设置页调整，结果存在本地并作用到整个应用。
 */
export interface GlassTuning {
  /** 边缘透镜带宽度（px）；0 = 按组件短边自动（约 30%，6–22px） */
  bezel: number
  /** 折射强度：边缘最大位移 = 透镜带宽度 × 强度 */
  strength: number
  /** 透镜曲线：越大越集中在最外缘 */
  falloff: number
  /** 色散（px）：0 = 关闭 */
  dispersion: number
  /** 背景模糊（px）：普通 / 浮在内容上的密集条 */
  blur: number
  denseBlur: number
  /** 底色浓度（%）：在玻璃上叠多少中性白 / 近黑 */
  tint: number
  denseTint: number
  saturate: number
}

export const GLASS_DEFAULTS: GlassTuning = {
  bezel: 0,
  strength: 1.6,
  falloff: 2,
  dispersion: 2,
  blur: 2,
  denseBlur: 2,
  tint: 20,
  denseTint: 20,
  saturate: 1.2,
}

/**
 * 通透：滤镜里提亮 / 压暗、中性底色、饱和度降到 1.2（彩色封面不再把玻璃染色）；
 * 普通和浮动条模糊均为 2px，保留背后的条纹、封面边缘和折射细节。
 * 「厚玻璃」质感靠边缘弯折：强度 1.6、曲线 2，外缘把画面弯成镜像的弧线；色散 2 让弧线带一点彩边。
 * 底色思路参考 lumno-extension，代码自写。
 */
export function glassDefaults(theme: GlassTheme): GlassTuning {
  return theme === 'light' ? { ...GLASS_DEFAULTS, tint: 60, denseTint: 60 } : { ...GLASS_DEFAULTS }
}

/** 设置页与调参页共用的滑块定义 */
export const GLASS_PARAMS: { key: keyof GlassTuning; label: string; min: number; max: number; step: number; hint?: string }[] = [
  { key: 'bezel', label: t('misc.glass.bezel'), min: 0, max: 40, step: 1, hint: t('misc.glass.bezelHint') },
  { key: 'strength', label: t('misc.glass.strength'), min: 0, max: 2, step: 0.05 },
  { key: 'falloff', label: t('misc.glass.falloff'), min: 0.5, max: 5, step: 0.1 },
  { key: 'dispersion', label: t('misc.glass.dispersion'), min: 0, max: 8, step: 0.5, hint: t('misc.glass.dispersionHint') },
  { key: 'blur', label: t('misc.glass.blur'), min: 0, max: 30, step: 1 },
  { key: 'denseBlur', label: t('misc.glass.denseBlur'), min: 0, max: 30, step: 1, hint: t('misc.glass.denseBlurHint') },
  { key: 'tint', label: t('misc.glass.tint'), min: 0, max: 100, step: 5 },
  { key: 'denseTint', label: t('misc.glass.denseTint'), min: 0, max: 100, step: 5 },
  { key: 'saturate', label: t('misc.glass.saturate'), min: 1, max: 2.5, step: 0.05 },
]

export type GlassTheme = 'light' | 'dark'

interface LegacyGlassProfile extends Partial<GlassTuning> {
  tone?: 'tint' | 'veil'
  saved?: { veil?: Partial<GlassTuning> }
}

/** 只保留通透参数；旧经典配置优先恢复曾保存的通透参数，否则使用当前主题默认值。 */
function normalizeProfile(saved: LegacyGlassProfile | undefined, theme: GlassTheme): GlassTuning {
  const source = saved?.tone === 'tint' ? saved.saved?.veil : saved
  const profile = glassDefaults(theme)
  for (const { key } of GLASS_PARAMS) {
    const value = source?.[key]
    if (typeof value === 'number' && Number.isFinite(value)) profile[key] = value
  }
  return profile
}

interface GlassTuningStore extends GlassTuning {
  theme: GlassTheme
  profiles: Record<GlassTheme, GlassTuning>
  setTheme: (theme: GlassTheme) => void
  set: (p: Partial<GlassTuning>) => void
  reset: () => void
}

const initialTheme: GlassTheme = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'

export const useGlassTuning = create<GlassTuningStore>()(
  persist(
    (set) => ({
      ...glassDefaults(initialTheme),
      theme: initialTheme,
      profiles: { light: glassDefaults('light'), dark: glassDefaults('dark') },
      setTheme: (theme) => set((s) => s.theme === theme ? {} : { ...s.profiles[theme], theme }),
      set: (p) => set((s) => {
        const profile = { ...s.profiles[s.theme], ...p }
        return { ...profile, profiles: { ...s.profiles, [s.theme]: profile } }
      }),
      reset: () => set((s) => {
        const profile = glassDefaults(s.theme)
        return { ...profile, profiles: { ...s.profiles, [s.theme]: profile } }
      }),
    }),
    {
      name: preferenceKey('suwayomi-web.glass'),
      version: 3,
      partialize: ({ profiles }) => ({ profiles }),
      migrate: (saved, version) => {
        if (version >= 2) return saved
        // 早期版本共用一组参数，没有 tone 的存储属于经典预设。
        const previous = { tone: 'tint' as const, ...saved as LegacyGlassProfile }
        return { profiles: { light: previous, dark: previous } }
      },
      merge: (saved, current) => {
        const previous = (saved as { profiles?: Partial<Record<GlassTheme, LegacyGlassProfile>> })?.profiles
        const profiles = {
          light: normalizeProfile(previous?.light, 'light'),
          dark: normalizeProfile(previous?.dark, 'dark'),
        }
        return { ...current, ...profiles[current.theme], profiles }
      },
    },
  ),
)

/** 把底色浓度写到 <html>（.glass[data-refract] 使用） */
export function useApplyGlassTuning() {
  const tint = useGlassTuning((s) => s.tint)
  const denseTint = useGlassTuning((s) => s.denseTint)
  useEffect(() => {
    const r = document.documentElement.style
    r.setProperty('--refract-tint', `${tint}%`)
    r.setProperty('--refract-tint-dense', `${denseTint}%`)
  }, [tint, denseTint])
}
