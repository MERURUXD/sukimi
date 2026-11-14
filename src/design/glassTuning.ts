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

export type GlassTheme = 'light' | 'dark'
export type GlassPreset = 'clear' | 'prism'

export const GLASS_DEFAULTS: GlassTuning = {
  bezel: 30,
  strength: 1.32,
  falloff: 2.6,
  // 在约 20px 宽的透镜带上接近 Lumno 的 ±15%，保留滑块原有的固定偏移单位。
  dispersion: 8,
  blur: 2,
  denseBlur: 2,
  tint: 20,
  denseTint: 20,
  saturate: 1.6,
}

export const PRISM_GLASS_DEFAULTS: GlassTuning = {
  bezel: 20,
  strength: 1.5,
  falloff: 2.0,
  dispersion: 0,
  blur: 3,
  denseBlur: 12,
  tint: 40,
  denseTint: 40,
  saturate: 1.75,
}

/**
 * 通透：参考 Lumno 1.4.1 的搜索框和浮层，折射强度按 1.2 × 1.1 换算。
 * 浅色用固定 50% 的中性底色，为没有自适应着色时的文字保留对比。
 */
export function glassDefaults(theme: GlassTheme): GlassTuning {
  return theme === 'light' ? { ...GLASS_DEFAULTS, blur: 3, denseBlur: 3, tint: 50, denseTint: 50 } : { ...GLASS_DEFAULTS }
}

/** PrismUI 预设：对应实验页深/浅光学参数（20px 倒角透镜、柔和模糊与较高饱和透亮底色）。 */
export function prismGlassDefaults(theme: GlassTheme): GlassTuning {
  return theme === 'light'
    ? { ...PRISM_GLASS_DEFAULTS, tint: 55, denseTint: 55, saturate: 2.0 }
    : { ...PRISM_GLASS_DEFAULTS }
}

export function presetDefaults(preset: GlassPreset, theme: GlassTheme): GlassTuning {
  return preset === 'prism' ? prismGlassDefaults(theme) : glassDefaults(theme)
}

/** 设置页与调参页共用的滑块定义 */
export const GLASS_PARAMS: { key: keyof GlassTuning; label: string; min: number; max: number; step: number; hint?: string }[] = [
  { key: 'bezel', label: t('misc.glass.bezel'), min: 0, max: 40, step: 1, hint: t('misc.glass.bezelHint') },
  { key: 'strength', label: t('misc.glass.strength'), min: 0, max: 2, step: 0.01 },
  { key: 'falloff', label: t('misc.glass.falloff'), min: 0.5, max: 5, step: 0.1 },
  { key: 'dispersion', label: t('misc.glass.dispersion'), min: 0, max: 8, step: 0.5, hint: t('misc.glass.dispersionHint') },
  { key: 'blur', label: t('misc.glass.blur'), min: 0, max: 30, step: 1 },
  { key: 'denseBlur', label: t('misc.glass.denseBlur'), min: 0, max: 30, step: 1, hint: t('misc.glass.denseBlurHint') },
  { key: 'tint', label: t('misc.glass.tint'), min: 0, max: 100, step: 5 },
  { key: 'denseTint', label: t('misc.glass.denseTint'), min: 0, max: 100, step: 5 },
  { key: 'saturate', label: t('misc.glass.saturate'), min: 1, max: 2.5, step: 0.05 },
]

interface LegacyGlassProfile extends Partial<GlassTuning> {
  tone?: 'tint' | 'veil'
  saved?: { veil?: Partial<GlassTuning> }
}

/** 规范化单主题参数；旧经典配置优先恢复曾保存的通透参数，否则使用目标预设默认值。 */
function normalizeProfile(saved: LegacyGlassProfile | undefined, theme: GlassTheme, preset: GlassPreset = 'clear'): GlassTuning {
  const source = saved?.tone === 'tint' ? saved.saved?.veil : saved
  const profile = presetDefaults(preset, theme)
  for (const { key } of GLASS_PARAMS) {
    const value = source?.[key]
    if (typeof value === 'number' && Number.isFinite(value)) profile[key] = value
  }
  return profile
}

function defaultPresetsMap(): Record<GlassPreset, Record<GlassTheme, GlassTuning>> {
  return {
    clear: { light: glassDefaults('light'), dark: glassDefaults('dark') },
    prism: { light: prismGlassDefaults('light'), dark: prismGlassDefaults('dark') },
  }
}

interface GlassTuningStore extends GlassTuning {
  preset: GlassPreset
  theme: GlassTheme
  profiles: Record<GlassTheme, GlassTuning>
  presets: Record<GlassPreset, Record<GlassTheme, GlassTuning>>
  setPreset: (preset: GlassPreset) => void
  setTheme: (theme: GlassTheme) => void
  set: (p: Partial<GlassTuning>) => void
  reset: () => void
}

const initialTheme: GlassTheme = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'

export const useGlassTuning = create<GlassTuningStore>()(
  persist(
    (set) => {
      const presets = defaultPresetsMap()
      return {
        ...presets.clear[initialTheme],
        preset: 'clear',
        theme: initialTheme,
        profiles: { ...presets.clear },
        presets,
        setPreset: (preset) =>
          set((s) => {
            if (s.preset === preset) return {}
            const nextProfiles = s.presets[preset]
            return { ...nextProfiles[s.theme], preset, profiles: { ...nextProfiles } }
          }),
        setTheme: (theme) => set((s) => s.theme === theme ? {} : { ...s.presets[s.preset][theme], theme }),
        set: (p) =>
          set((s) => {
            const profile = { ...s.presets[s.preset][s.theme], ...p }
            const nextProfiles = { ...s.presets[s.preset], [s.theme]: profile }
            return {
              ...profile,
              profiles: nextProfiles,
              presets: { ...s.presets, [s.preset]: nextProfiles },
            }
          }),
        reset: () =>
          set((s) => {
            const profile = presetDefaults(s.preset, s.theme)
            const nextProfiles = { ...s.presets[s.preset], [s.theme]: profile }
            return {
              ...profile,
              profiles: nextProfiles,
              presets: { ...s.presets, [s.preset]: nextProfiles },
            }
          }),
      }
    },
    {
      name: preferenceKey('suwayomi-web.glass'),
      version: 3,
      partialize: ({ preset, profiles, presets }) => ({ preset, profiles, presets }),
      migrate: (saved, version) => {
        if (version >= 2) return saved
        // 早期版本共用一组参数，没有 tone 的存储属于经典预设。
        const previous = { tone: 'tint' as const, ...saved as LegacyGlassProfile }
        return { profiles: { light: previous, dark: previous } }
      },
      merge: (saved, current) => {
        const stored = saved as {
          preset?: GlassPreset
          profiles?: Partial<Record<GlassTheme, LegacyGlassProfile>>
          presets?: Partial<Record<GlassPreset, Partial<Record<GlassTheme, LegacyGlassProfile>>>>
        } | undefined
        const preset: GlassPreset = stored?.preset === 'prism' ? 'prism' : 'clear'
        const clearSource = stored?.presets?.clear ?? (preset === 'clear' ? stored?.profiles : undefined)
        const prismSource = stored?.presets?.prism ?? (preset === 'prism' ? stored?.profiles : undefined)
        const presets: Record<GlassPreset, Record<GlassTheme, GlassTuning>> = {
          clear: {
            light: normalizeProfile(clearSource?.light, 'light', 'clear'),
            dark: normalizeProfile(clearSource?.dark, 'dark', 'clear'),
          },
          prism: {
            light: normalizeProfile(prismSource?.light, 'light', 'prism'),
            dark: normalizeProfile(prismSource?.dark, 'dark', 'prism'),
          },
        }
        const profiles = { ...presets[preset] }
        return { ...current, ...profiles[current.theme], preset, profiles, presets }
      },
    },
  ),
)

/** 把预设与底色浓度写到 <html>（.glass[data-refract] 使用） */
export function useApplyGlassTuning() {
  const preset = useGlassTuning((s) => s.preset)
  const tint = useGlassTuning((s) => s.tint)
  const denseTint = useGlassTuning((s) => s.denseTint)
  useEffect(() => {
    const el = document.documentElement
    el.dataset.glassPreset = preset
    el.style.setProperty('--refract-tint', `${tint}%`)
    el.style.setProperty('--refract-tint-dense', `${denseTint}%`)
  }, [preset, tint, denseTint])
}
