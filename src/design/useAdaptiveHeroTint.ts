import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAppearance } from './settings'
import { useGlassTuning } from './glassTuning'
import { computeAdaptiveTint, sampleFromSwatches, type Swatch } from './adaptiveTone'
import { coverPalette, NEUTRAL_SWATCHES } from '@/lib/coverColor'

type PaletteListener = (swatches: Swatch[]) => void
const paletteStore = new Map<string, Swatch[]>()
const listeners = new Map<string, Set<PaletteListener>>()

export function notifyCoverPalette(url: string | null | undefined, swatches: Swatch[]) {
  if (!url) return
  paletteStore.set(url, swatches)
  const set = listeners.get(url)
  if (set) {
    for (const fn of set) fn(swatches)
  }
}

export function subscribeCoverPalette(url: string | null | undefined, fn: PaletteListener) {
  if (!url) return () => {}
  let set = listeners.get(url)
  if (!set) {
    set = new Set()
    listeners.set(url, set)
  }
  set.add(fn)
  return () => {
    set?.delete(fn)
    if (set && set.size === 0) listeners.delete(url)
  }
}

export function getCachedCoverPalette(url: string | null | undefined): Swatch[] | undefined {
  if (!url) return undefined
  return paletteStore.get(url)
}

/**
 * 英雄区（首页大图 / 舞台 / 详情页 Hero）自适应玻璃底色计算 Hook：
 * 1. 优先复用 CoverFlow 的 onPaletteChange 回调或已提取的色板
 * 2. 在动态背景关闭或提取中时通过 coverPalette(url) 兜底
 * 3. 当开启 glassAdaptiveTint 时，根据背景明暗与纹理动态计算 --refract-tint
 * 4. 当关闭 glassAdaptiveTint 时，保持 enabled: false，100% 保持原有表现
 */
export function useAdaptiveHeroTint(coverUrl?: string | null) {
  const glassAdaptiveTint = useAppearance((s) => s.glassAdaptiveTint)
  const theme = useGlassTuning((s) => s.theme)
  const baseTint = useGlassTuning((s) => s.tint)
  const baseDenseTint = useGlassTuning((s) => s.denseTint)

  const [swatches, setSwatches] = useState<Swatch[] | null>(() => getCachedCoverPalette(coverUrl) ?? null)
  const prevTintRef = useRef<number | undefined>(undefined)
  const prevDenseTintRef = useRef<number | undefined>(undefined)

  const onPaletteChange = useCallback(
    (newSwatches: Swatch[]) => {
      const valid = newSwatches?.length ? newSwatches : NEUTRAL_SWATCHES
      if (coverUrl) notifyCoverPalette(coverUrl, valid)
      setSwatches(valid)
    },
    [coverUrl],
  )

  useEffect(() => {
    if (!glassAdaptiveTint) return
    if (!coverUrl) {
      setSwatches(NEUTRAL_SWATCHES)
      return
    }

    const cached = getCachedCoverPalette(coverUrl)
    if (cached) {
      setSwatches(cached)
    }

    // 订阅来自 CoverFlow 或其他组件的调色板通知
    const unsubscribe = subscribeCoverPalette(coverUrl, (s) => setSwatches(s))

    let alive = true
    coverPalette(coverUrl)
      .then((res) => {
        if (!alive) return
        const valid = res?.length ? res : NEUTRAL_SWATCHES
        notifyCoverPalette(coverUrl, valid)
        setSwatches(valid)
      })
      .catch(() => {
        if (!alive) return
        setSwatches(NEUTRAL_SWATCHES)
      })

    return () => {
      alive = false
      unsubscribe()
    }
  }, [coverUrl, glassAdaptiveTint])

  const sample = useMemo(() => (swatches ? sampleFromSwatches(swatches) : null), [swatches])

  const adaptive = useMemo(() => {
    if (!glassAdaptiveTint || !sample) return null
    const normal = computeAdaptiveTint(sample, theme, baseTint, prevTintRef.current, { dense: false })
    const dense = computeAdaptiveTint(sample, theme, baseDenseTint, prevDenseTintRef.current, { dense: true })
    return {
      tint: normal.tint,
      denseTint: dense.tint,
      saturate: normal.saturate,
    }
  }, [glassAdaptiveTint, sample, theme, baseTint, baseDenseTint])

  useEffect(() => {
    if (adaptive) {
      prevTintRef.current = adaptive.tint
      prevDenseTintRef.current = adaptive.denseTint
    }
  }, [adaptive])

  return {
    enabled: Boolean(glassAdaptiveTint && adaptive),
    tint: adaptive?.tint,
    denseTint: adaptive?.denseTint,
    onPaletteChange,
    swatches,
  }
}
