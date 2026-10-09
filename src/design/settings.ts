import { useEffect, useLayoutEffect } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useApplyGlassTuning } from './glassTuning'
import { preferenceKey } from '@/lib/demo'

export type ThemePref = 'system' | 'dark' | 'light'
export type GlassMode = 'refract' | 'frosted' | 'solid'
export type HomeLayout = 'poster' | 'cover'

interface AppearanceState {
  theme: ThemePref
  glass: GlassMode
  mangaDetailMotion: boolean
  autoHideNav: boolean
  homeMobileLayout: HomeLayout
  homeDesktopLayout: HomeLayout
  homeMotionBg: boolean
  /** 画廊放映每部停留的秒数 */
  galleryInterval: number
  setTheme: (theme: ThemePref) => void
  setGlass: (glass: GlassMode) => void
  setMangaDetailMotion: (on: boolean) => void
  setAutoHideNav: (on: boolean) => void
  setHomeMobileLayout: (layout: HomeLayout) => void
  setHomeDesktopLayout: (layout: HomeLayout) => void
  setHomeMotionBg: (on: boolean) => void
  setGalleryInterval: (seconds: number) => void
}

// 键名与 index.html 里防闪烁脚本一致
export const APPEARANCE_KEY = preferenceKey('suwayomi-web.appearance')

export const useAppearance = create<AppearanceState>()(
  persist(
    (set) => ({
      theme: 'dark',
      glass: 'refract',
      mangaDetailMotion: true,
      // 旧偏好里没有这个字段，合并默认值后等于关闭
      autoHideNav: false,
      homeMobileLayout: 'poster',
      homeDesktopLayout: 'poster',
      // 旧偏好里没有这个字段，合并默认值后开启
      homeMotionBg: true,
      // 旧偏好里没有这个字段，合并默认值后为 7 秒
      galleryInterval: 7,
      setTheme: (theme) => set({ theme }),
      setGlass: (glass) => set({ glass }),
      setMangaDetailMotion: (mangaDetailMotion) => set({ mangaDetailMotion }),
      setAutoHideNav: (autoHideNav) => set({ autoHideNav }),
      setHomeMobileLayout: (homeMobileLayout) => set({ homeMobileLayout }),
      setHomeDesktopLayout: (homeDesktopLayout) => set({ homeDesktopLayout }),
      setHomeMotionBg: (homeMotionBg) => set({ homeMotionBg }),
      setGalleryInterval: (galleryInterval) => set({ galleryInterval }),
    }),
    {
      name: APPEARANCE_KEY,
      partialize: ({ theme, glass, mangaDetailMotion, autoHideNav, homeMobileLayout, homeDesktopLayout, homeMotionBg, galleryInterval }) =>
        ({ theme, glass, mangaDetailMotion, autoHideNav, homeMobileLayout, homeDesktopLayout, homeMotionBg, galleryInterval }),
    },
  ),
)

const darkQuery = window.matchMedia('(prefers-color-scheme: dark)')

/** 正挂着的「固定深色」页面数（书库画廊各页）；按计数算，从一个画廊页换到另一个时不会闪回浅色 */
let forcedDark = 0

/** 当前页面固定深色时为 true：主题按钮只记下选择，离开这些页面后才生效 */
export const themeForced = () => forcedDark > 0

function applyTheme() {
  const theme = useAppearance.getState().theme
  document.documentElement.dataset.theme = forcedDark > 0 ? 'dark' : theme === 'system' ? (darkQuery.matches ? 'dark' : 'light') : theme
}

/**
 * 挂着这个页面期间整个文档固定深色（含顶栏、滚动条和弹出层），离开时恢复用户的主题。
 * 用布局副作用同步写：换页动画的新快照拍到的就已经是深色，不会先闪一帧浅色。
 */
export function useForceDark() {
  useLayoutEffect(() => {
    forcedDark++
    applyTheme()
    return () => {
      forcedDark--
      applyTheme()
    }
  }, [])
}

/** 把主题与玻璃档位同步到 <html data-theme data-glass> */
export function useApplyAppearance() {
  useApplyGlassTuning()
  const theme = useAppearance((s) => s.theme)
  const glass = useAppearance((s) => s.glass)

  useEffect(() => {
    const apply = applyTheme
    apply()
    if (theme !== 'system') return
    darkQuery.addEventListener('change', apply)
    return () => darkQuery.removeEventListener('change', apply)
  }, [theme])

  useEffect(() => {
    document.documentElement.dataset.glass = glass
  }, [glass])
}
