import { useEffect } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

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
}

/** 设置页与调参页共用的滑块定义 */
export const GLASS_PARAMS: { key: keyof GlassTuning; label: string; min: number; max: number; step: number; hint?: string }[] = [
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
      name: 'suwayomi-web.glass',
      version: 1,
      partialize: ({ set: _s, reset: _r, ...rest }) => rest,
    },
  ),
)

/** 把底色浓度写成 CSS 变量（.glass[data-refract] 使用） */
export function useApplyGlassTuning() {
  const tint = useGlassTuning((s) => s.tint)
  const denseTint = useGlassTuning((s) => s.denseTint)
  useEffect(() => {
    const r = document.documentElement.style
    r.setProperty('--refract-tint', `${tint}%`)
    r.setProperty('--refract-tint-dense', `${denseTint}%`)
  }, [tint, denseTint])
}
