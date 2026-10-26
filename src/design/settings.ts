import { useEffect, useLayoutEffect } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useApplyGlassTuning, useGlassTuning } from './glassTuning'
import { preferenceKey } from '@/lib/demo'
import { defaultGlass } from './defaultGlass'
import { normalizeHomeOrder, normalizeHomePreferences, type HomeContentSection, type HomeSection } from '@/features/home/preferences'

export type ThemePref = 'system' | 'dark' | 'light'
export type GlassMode = 'refract' | 'frosted' | 'solid'
export type HomeLayout = 'poster' | 'cover'

interface AppearanceState {
  theme: ThemePref
  glass: GlassMode
  mangaDetailMotion: boolean
  /** 进出阅读器时从入口展开 / 缩回 */
  readerMotion: boolean
  autoHideNav: boolean
  /** 顶栏背后叠一条越往上越模糊的渐进模糊带 */
  navBlur: boolean
  homeMobileLayout: HomeLayout
  homeDesktopLayout: HomeLayout
  homeMotionBg: boolean
  /** 冷启动打开首页时桌面「舞台」播一次开屏动画，之后回到首页播轻进场 */
  homeIntro: boolean
  homeSections: Record<HomeContentSection, boolean>
  homeSectionOrder: HomeSection[]
  homeGallery: boolean
  /** 画廊放映每部停留的秒数 */
  galleryInterval: number
  setTheme: (theme: ThemePref) => void
  setGlass: (glass: GlassMode) => void
  setMangaDetailMotion: (on: boolean) => void
  setReaderMotion: (on: boolean) => void
  setAutoHideNav: (on: boolean) => void
  setNavBlur: (on: boolean) => void
  setHomeMobileLayout: (layout: HomeLayout) => void
  setHomeDesktopLayout: (layout: HomeLayout) => void
  setHomeMotionBg: (on: boolean) => void
  setHomeIntro: (on: boolean) => void
  setHomeSection: (id: HomeContentSection, on: boolean) => void
  setHomeSectionOrder: (order: readonly HomeSection[]) => void
  setHomeGallery: (on: boolean) => void
  setGalleryInterval: (seconds: number) => void
}

// 键名与 index.html 里防闪烁脚本一致
export const APPEARANCE_KEY = preferenceKey('suwayomi-web.appearance')

export const useAppearance = create<AppearanceState>()(
  persist(
    (set) => ({
      theme: 'dark',
      glass: defaultGlass(navigator.hardwareConcurrency),
      mangaDetailMotion: true,
      // 旧偏好里没有这个字段，合并默认值后开启
      readerMotion: true,
      // 旧偏好里没有这个字段，合并默认值后等于关闭
      autoHideNav: false,
      // 旧偏好里没有这个字段，合并默认值后等于关闭
      navBlur: false,
      homeMobileLayout: 'poster',
      homeDesktopLayout: 'poster',
      // 旧偏好里没有这个字段，合并默认值后开启
      homeMotionBg: true,
      // 旧偏好里没有这个字段，合并默认值后开启
      homeIntro: true,
      ...normalizeHomePreferences(null),
      // 旧偏好里没有这个字段，合并默认值后为 7 秒
      galleryInterval: 7,
      setTheme: (theme) => set({ theme }),
      setGlass: (glass) => set({ glass }),
      setMangaDetailMotion: (mangaDetailMotion) => set({ mangaDetailMotion }),
      setReaderMotion: (readerMotion) => set({ readerMotion }),
      setAutoHideNav: (autoHideNav) => set({ autoHideNav }),
      setNavBlur: (navBlur) => set({ navBlur }),
      setHomeMobileLayout: (homeMobileLayout) => set({ homeMobileLayout }),
      setHomeDesktopLayout: (homeDesktopLayout) => set({ homeDesktopLayout }),
      setHomeMotionBg: (homeMotionBg) => set({ homeMotionBg }),
      setHomeIntro: (homeIntro) => set({ homeIntro }),
      setHomeSection: (id, on) => set((s) => ({ homeSections: { ...s.homeSections, [id]: on } })),
      setHomeSectionOrder: (order) => set({ homeSectionOrder: normalizeHomeOrder(order) }),
      setHomeGallery: (homeGallery) => set({ homeGallery }),
      setGalleryInterval: (galleryInterval) => set({ galleryInterval }),
    }),
    {
      name: APPEARANCE_KEY,
      partialize: ({ theme, glass, mangaDetailMotion, readerMotion, autoHideNav, navBlur, homeMobileLayout, homeDesktopLayout, homeMotionBg, homeIntro, galleryInterval,
        homeSections, homeSectionOrder, homeGallery }) =>
        ({ theme, glass, mangaDetailMotion, readerMotion, autoHideNav, navBlur, homeMobileLayout, homeDesktopLayout, homeMotionBg, homeIntro, galleryInterval,
          homeSections, homeSectionOrder, homeGallery }),
      merge: (saved, current) => ({ ...current, ...saved as Partial<AppearanceState>, ...normalizeHomePreferences(saved) }),
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
  const resolved = forcedDark > 0 ? 'dark' : theme === 'system' ? (darkQuery.matches ? 'dark' : 'light') : theme
  document.documentElement.dataset.theme = resolved
  useGlassTuning.getState().setTheme(resolved)
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
