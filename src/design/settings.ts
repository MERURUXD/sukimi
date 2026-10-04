import { useEffect } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useApplyGlassTuning } from './glassTuning'

export type ThemePref = 'system' | 'dark' | 'light'
export type GlassMode = 'refract' | 'frosted' | 'solid'

interface AppearanceState {
  theme: ThemePref
  glass: GlassMode
  setTheme: (theme: ThemePref) => void
  setGlass: (glass: GlassMode) => void
}

// 键名与 index.html 里防闪烁脚本一致
export const APPEARANCE_KEY = 'suwayomi-web.appearance'

export const useAppearance = create<AppearanceState>()(
  persist(
    (set) => ({
      theme: 'dark',
      glass: 'refract',
      setTheme: (theme) => set({ theme }),
      setGlass: (glass) => set({ glass }),
    }),
    { name: APPEARANCE_KEY, partialize: ({ theme, glass }) => ({ theme, glass }) },
  ),
)

const darkQuery = window.matchMedia('(prefers-color-scheme: dark)')

/** 把主题与玻璃档位同步到 <html data-theme data-glass> */
export function useApplyAppearance() {
  useApplyGlassTuning()
  const theme = useAppearance((s) => s.theme)
  const glass = useAppearance((s) => s.glass)

  useEffect(() => {
    const root = document.documentElement
    const apply = () => {
      root.dataset.theme = theme === 'system' ? (darkQuery.matches ? 'dark' : 'light') : theme
    }
    apply()
    if (theme !== 'system') return
    darkQuery.addEventListener('change', apply)
    return () => darkQuery.removeEventListener('change', apply)
  }, [theme])

  useEffect(() => {
    document.documentElement.dataset.glass = glass
  }, [glass])
}
