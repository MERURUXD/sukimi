import { useEffect } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { preferenceKey } from '@/lib/demo'

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
  { key: 'bezel', label: '透镜带宽度', min: 0, max: 40, step: 1, hint: '0 = 自动（按组件短边的 30%）' },
  { key: 'strength', label: '折射强度', min: 0, max: 2, step: 0.05 },
  { key: 'falloff', label: '集中到外缘', min: 0.5, max: 5, step: 0.1 },
  { key: 'dispersion', label: '色散', min: 0, max: 8, step: 0.5, hint: '0 = 关闭' },
  { key: 'blur', label: '模糊 · 普通', min: 0, max: 30, step: 1 },
  { key: 'denseBlur', label: '模糊 · 浮动条', min: 0, max: 30, step: 1, hint: '阅读器工具栏、批量栏、弹出层' },
  { key: 'tint', label: '底色 · 普通（%）', min: 0, max: 100, step: 5 },
  { key: 'denseTint', label: '底色 · 浮动条（%）', min: 0, max: 100, step: 5 },
  { key: 'saturate', label: '饱和度', min: 1, max: 2.5, step: 0.05 },
]

export const useGlassTuning = create<GlassTuning & { set: (p: Partial<GlassTuning>) => void; reset: () => void }>()(
  persist(
    (set) => ({
      ...GLASS_DEFAULTS,
      set: (p) => set(p),
      reset: () => set(GLASS_DEFAULTS),
    }),
    {
      name: preferenceKey('suwayomi-web.glass'),
      version: 1,
      partialize: ({ set: _s, reset: _r, ...rest }) => rest,
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
