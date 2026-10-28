import { useEffect } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { preferenceKey } from '@/lib/demo'
import { t } from '@/i18n'

/**
 * 液态折射的可调参数。默认值是 2026-10-03 手调的「激进」预设；
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
  /** 底色浓度（%）：在玻璃上叠多少页面背景色（--bg） */
  tint: number
  denseTint: number
  saturate: number
  /**
   * 底色方式：
   * - tint：在玻璃上叠一层页面背景色（--bg）；
   * - veil：试验中。在背景滤镜里直接提亮（浅色）或压暗（深色）背后的画面，再叠一层很薄的中性白 / 近黑，
   *   白的仍是白、黑的仍是黑，不会像叠一层米色那样发灰。思路参考 lumno-extension，代码自写。
   */
  tone: 'tint' | 'veil'
}

export const GLASS_DEFAULTS: GlassTuning = {
  bezel: 0,
  strength: 1,
  falloff: 2.2,
  dispersion: 0.5,
  blur: 2,
  denseBlur: 2,
  tint: 25,
  denseTint: 25,
  saturate: 1.6,
  tone: 'tint',
}

/**
 * 试验预设「通透」：滤镜里提亮 / 压暗、中性底色、饱和度降到 1.2（彩色封面不再把玻璃染色）；
 * 浮动条模糊只到 3px：10px 会把背后的条纹、封面边缘揉成一片脏的渐变色带，折射边也一起糊掉，像磨砂不像清玻璃。
 * 「厚玻璃」质感靠边缘弯折：强度 1.6、曲线 2，外缘把画面弯成镜像的弧线；色散 2 让弧线带一点彩边。
 */
export const GLASS_PRESETS: Record<GlassTuning['tone'], GlassTuning> = {
  tint: GLASS_DEFAULTS,
  veil: {
    ...GLASS_DEFAULTS,
    tone: 'veil',
    strength: 1.6,
    falloff: 2,
    dispersion: 2,
    saturate: 1.2,
    denseBlur: 3,
    tint: 20,
    denseTint: 20,
  },
}

/** 设置页与调参页共用的滑块定义 */
export const GLASS_PARAMS: { key: Exclude<keyof GlassTuning, 'tone'>; label: string; min: number; max: number; step: number; hint?: string }[] = [
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

/** 取出一组参数里的数值部分（不含 tone 以外的 store 字段） */
function pickTuning(s: GlassTuning): GlassTuning {
  return {
    bezel: s.bezel,
    strength: s.strength,
    falloff: s.falloff,
    dispersion: s.dispersion,
    blur: s.blur,
    denseBlur: s.denseBlur,
    tint: s.tint,
    denseTint: s.denseTint,
    saturate: s.saturate,
    tone: s.tone,
  }
}

export type GlassTheme = 'light' | 'dark'

interface GlassProfile extends GlassTuning {
  /**
   * 各预设上一次离开时的参数；切换预设时据此恢复，而不是回到预设默认值。
   * 当前预设的参数不在这里，直接存在顶层字段里。
   */
  saved: Partial<Record<GlassTuning['tone'], GlassTuning>>
}

interface GlassTuningStore extends GlassProfile {
  theme: GlassTheme
  profiles: Record<GlassTheme, GlassProfile>
  setTheme: (theme: GlassTheme) => void
  set: (p: Partial<GlassTuning>) => void
  /** 切换预设：先记下当前预设的改动，再恢复目标预设上次的参数（没改过则用预设默认值） */
  switchPreset: (tone: GlassTuning['tone']) => void
  reset: () => void
}

const initialTheme: GlassTheme = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'
const defaultProfile = (): GlassProfile => ({ ...GLASS_DEFAULTS, saved: {} })

export const useGlassTuning = create<GlassTuningStore>()(
  persist(
    (set) => ({
      ...defaultProfile(),
      theme: initialTheme,
      profiles: { light: defaultProfile(), dark: defaultProfile() },
      setTheme: (theme) => set((s) => s.theme === theme ? {} : { ...s.profiles[theme], theme }),
      set: (p) => set((s) => {
        const profile = { ...s.profiles[s.theme], ...p }
        return { ...profile, profiles: { ...s.profiles, [s.theme]: profile } }
      }),
      switchPreset: (tone) =>
        set((s) => {
          if (s.tone === tone) return {}
          const { [tone]: target, ...rest } = s.saved
          const profile = { ...(target ?? GLASS_PRESETS[tone]), saved: { ...rest, [s.tone]: pickTuning(s) } }
          return { ...profile, profiles: { ...s.profiles, [s.theme]: profile } }
        }),
      reset: () => set((s) => {
        const profile = defaultProfile()
        return { ...profile, profiles: { ...s.profiles, [s.theme]: profile } }
      }),
    }),
    {
      name: preferenceKey('suwayomi-web.glass'),
      version: 2,
      partialize: ({ profiles }) => ({ profiles }),
      // 旧版共用一组参数，复制到两个模式作为起点，保留已调整的预设。
      migrate: (saved) => {
        const previous = saved as Partial<GlassProfile>
        const profile = { ...defaultProfile(), ...previous }
        return { profiles: { light: profile, dark: { ...profile, saved: { ...profile.saved } } } }
      },
      merge: (saved, current) => {
        const profiles = (saved as { profiles?: GlassTuningStore['profiles'] })?.profiles ?? current.profiles
        return { ...current, ...profiles[current.theme], profiles }
      },
    },
  ),
)

/** 把底色浓度和底色方式写到 <html>（.glass[data-refract] 使用） */
export function useApplyGlassTuning() {
  const tint = useGlassTuning((s) => s.tint)
  const denseTint = useGlassTuning((s) => s.denseTint)
  const tone = useGlassTuning((s) => s.tone)
  useEffect(() => {
    const r = document.documentElement.style
    r.setProperty('--refract-tint', `${tint}%`)
    r.setProperty('--refract-tint-dense', `${denseTint}%`)
  }, [tint, denseTint])
  useEffect(() => {
    document.documentElement.dataset.glassTone = tone
  }, [tone])
}
