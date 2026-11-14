import { Fragment, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { extractGooContourPath } from '@/components/glass/morph/contour'
import {
  buildCircularBevelTable,
  buildColorOpticsMatrix,
  buildContourAlphaDataUrl,
} from '@/components/glass/morph/refractOptics'
import { resolveOpticalStyle } from '@/components/glass/morph/motion'
import { createMorphOverlayRenderer } from '@/components/glass/morph/overlayRenderer'
import type { GlassOpticalStyle, GlassShapeState, GooFrameGeometry, IMorphOverlayRenderer } from '@/components/glass/morph/contracts'
import { LensFilter, useLensMap } from '@/components/glass/refract'
import { glassDefaults, prismGlassDefaults } from '@/design/glassTuning'
import { createLiquidGlassRenderer, type ILiquidGlassRendererWithDebug } from '@/features/dev/glassMorphMenu/renderer'
import { t } from '@/i18n'

const W = 240
const H = 200

type ProbePresetId = 'prism-menu' | 'prism-control' | 'clear-menu'
type ViewMode = 'all' | 'b2' | 'b3'

interface UnifiedOpticalParams {
  label: string
  bezel: number
  strength: number
  falloff: number
  blurPx: number
  saturate: number
  brightness: number
  contrastCss: number
  tintRgbNormalized: readonly [number, number, number]
  effectiveTintAlpha: number
  dispersion: number
  rimScale: number
}

function getUnifiedParams(preset: ProbePresetId): UnifiedOpticalParams {
  if (preset === 'clear-menu') {
    const tokens = glassDefaults('dark')
    return {
      label: t('misc.devRefractProbe.presetClearLabel'),
      bezel: tokens.bezel,
      strength: tokens.strength,
      falloff: tokens.falloff,
      blurPx: tokens.denseBlur,
      saturate: tokens.saturate,
      brightness: 0.78,
      contrastCss: 1.0,
      tintRgbNormalized: [30 / 255, 30 / 255, 34 / 255],
      effectiveTintAlpha: Math.min(1, (tokens.denseTint / 100) * 1.6),
      dispersion: tokens.dispersion,
      rimScale: 0.45,
    }
  }
  const tokens = prismGlassDefaults('dark')
  const isMenu = preset === 'prism-menu'
  return {
    label: isMenu ? t('misc.devRefractProbe.presetMenuLabel') : t('misc.devRefractProbe.presetControlLabel'),
    bezel: tokens.bezel,
    strength: tokens.strength,
    falloff: tokens.falloff,
    blurPx: isMenu ? tokens.denseBlur : tokens.blur,
    saturate: tokens.saturate,
    brightness: isMenu ? 1.1 : 1.04,
    contrastCss: isMenu ? 0.94 : 0.95,
    tintRgbNormalized: [53 / 255, 53 / 255, 56 / 255],
    effectiveTintAlpha: Math.min(1, ((isMenu ? tokens.denseTint : tokens.tint) / 100) * 1.55),
    dispersion: tokens.dispersion,
    rimScale: isMenu ? 0.9 : 0.85,
  }
}

function buildUnifiedWebGLStyle(u: UnifiedOpticalParams, base: GlassOpticalStyle): GlassOpticalStyle {
  // WebGL shader keeps mix(luma, bg, uSaturation) * uBrightness unclamped in HDR before tint mix
  // and does not apply CSS contrast reduction, so compensate saturation/brightness to match CSS/SVG [0,1] gamut.
  const webglSaturation = 1 + (u.saturate - 1) * 0.45
  const webglBrightness = u.brightness * u.contrastCss * 0.88
  const rimScale = u.rimScale
  return {
    ...base,
    bevel: u.bezel,
    refraction: u.bezel * u.strength,
    blur: u.blurPx,
    dispersion: u.dispersion,
    saturation: webglSaturation,
    brightness: webglBrightness,
    contrast: 0.05,
    tintRgba: [u.tintRgbNormalized[0], u.tintRgbNormalized[1], u.tintRgbNormalized[2], u.effectiveTintAlpha],
    rimOpacity: base.rimOpacity * rimScale,
  }
}

function buildMorphShapes(phase: number): {
  path: string
  platter: GlassShapeState
  droplet: GlassShapeState
  blendK: number
} {
  const t = 0.5 - 0.5 * Math.cos(phase)
  const platter: GlassShapeState = {
    center: { x: 120, y: 112 + 12 * Math.sin(phase) },
    size: { width: 100 + 80 * t, height: 70 + 70 * t },
    radius: 24,
  }
  const droplet: GlassShapeState = {
    center: { x: 165 - 20 * t, y: 38 + 20 * t },
    size: { width: 76 - 24 * t, height: 38 },
    radius: 19,
  }
  const blendK = 28
  const path = extractGooContourPath(platter, droplet, blendK, false)
  return { path, platter, droplet, blendK }
}

function makeProbeGeometry(platter: GlassShapeState, droplet: GlassShapeState, blendK: number): GooFrameGeometry {
  return {
    targetCardRect: { x: 30, y: 35, width: 180, height: 130 },
    targetCardRadius: 24,
    platter,
    droplet,
    blendK,
    mergeDepth: 0.5,
    isMerged: false,
    rimOpacity: 1,
    styleMix: 1,
    contentTransform: {
      originX: 0,
      originY: 0,
      scale: 1,
      translateX: 0,
      translateY: 0,
      clipLeft: 0,
      clipTop: 0,
      clipRight: 0,
      clipBottom: 0,
      clipRadius: 24,
    },
    glyphTransform: { centerX: droplet.center.x, centerY: droplet.center.y, scale: 1 },
  }
}

const STRIPE_COLORS = ['#ff5f6d', '#ffc371', '#24c6dc', '#514a9d'] as const

function drawProbeScene(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  sampleText: string,
): void {
  ctx.save()
  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = '#141418'
  ctx.fillRect(0, 0, width, height)

  const bandPx = 18
  const step = bandPx * Math.SQRT2
  // Match CSS repeating-linear-gradient(45deg, ...): axis goes bottom-left -> top-right,
  // so constant-color stripes run top-left -> bottom-right (xTop = xBottom - height).
  for (let i = -4, idx = 0; i * step - height < width + step * 2; i++, idx++) {
    ctx.fillStyle = STRIPE_COLORS[((idx % STRIPE_COLORS.length) + STRIPE_COLORS.length) % STRIPE_COLORS.length]
    const xBottom = i * step
    const xTop = xBottom - height
    ctx.beginPath()
    ctx.moveTo(xTop, 0)
    ctx.lineTo(xTop + step + 0.5, 0)
    ctx.lineTo(xBottom + step + 0.5, height)
    ctx.lineTo(xBottom, height)
    ctx.closePath()
    ctx.fill()
  }

  ctx.fillStyle = 'rgba(0, 0, 0, 0.75)'
  ctx.font = '900 24px ui-sans-serif, system-ui, -apple-system, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(sampleText, width / 2, height / 2)
  ctx.restore()
}

function applyMorphToTargets(
  p: number,
  targets: {
    feRefs: (SVGFEImageElement | null)[]
    clipBoxRefs: (HTMLDivElement | null)[]
    rimRenderers: (IMorphOverlayRenderer | null)[]
    showcaseRenderer: ILiquidGlassRendererWithDebug | null
    optical: UnifiedOpticalParams
    rimOverlay: boolean
  },
): { pathMs: number; svgUrlMs: number } {
  const t0 = performance.now()
  const { path, platter, droplet, blendK } = buildMorphShapes(p)
  const pathMs = performance.now() - t0

  let svgUrlMs = 0
  if (path) {
    const clip = `path("${path}")`
    for (const box of targets.clipBoxRefs) {
      if (box) box.style.clipPath = clip
    }

    const ts0 = performance.now()
    const dataUrl = buildContourAlphaDataUrl(path, W, H)
    for (const fe of targets.feRefs) {
      fe?.setAttribute('href', dataUrl)
    }
    svgUrlMs = performance.now() - ts0
  }

  const geometry = makeProbeGeometry(platter, droplet, blendK)
  const baseStyle = resolveOpticalStyle('dark', 1)
  const unifiedWebglStyle = buildUnifiedWebGLStyle(targets.optical, baseStyle)
  const dpr = window.devicePixelRatio || 1

  if (targets.showcaseRenderer) {
    targets.showcaseRenderer.render({
      viewport: { width: W, height: H },
      dpr,
      theme: 'dark',
      geometry,
      style: unifiedWebglStyle,
      opacity: 1,
      blurBumpPx: 0,
    })
  }

  for (const rimRenderer of targets.rimRenderers) {
    if (!rimRenderer) continue
    if (targets.rimOverlay) {
      rimRenderer.render({
        viewport: { width: W, height: H },
        dpr,
        theme: 'dark',
        geometry,
        style: unifiedWebglStyle,
        opacity: 1,
        blurBumpPx: 0,
      })
    } else {
      rimRenderer.clear()
    }
  }

  return { pathMs, svgUrlMs }
}

interface ChainConfig {
  key: 'b1' | 'b2' | 'b3'
  id: string
  label: string
  blurStd: number
  tableValues?: string
  divisor: number
  postBlurStd: number
  scaleMultiplier: number
}

function SvgGradientChainFilter({
  cfg,
  optical,
  dispersionStep,
  feRef,
}: {
  cfg: ChainConfig
  optical: UnifiedOpticalParams
  dispersionStep: number
  feRef: React.Ref<SVGFEImageElement>
}) {
  const colorMatrix = buildColorOpticsMatrix(optical.saturate, optical.brightness, optical.contrastCss, true)
  // Match CSS backdrop-filter blur(optical.blurPx) 1:1 to eliminate animated <-> static blur pop
  const contentBlurSigma = Math.max(0.5, optical.blurPx)
  const targetScale = Math.round(2 * optical.bezel * optical.strength * cfg.scaleMultiplier)

  return (
    <filter id={cfg.id} colorInterpolationFilters="sRGB" x="0%" y="0%" width="100%" height="100%">
      <feImage ref={feRef} x="0" y="0" width={W} height={H} preserveAspectRatio="none" result="shapeAlpha" />
      <feGaussianBlur in="shapeAlpha" stdDeviation={cfg.blurStd} result="blurredAlpha" />
      <feColorMatrix
        in="blurredAlpha"
        type="matrix"
        values="0 0 0 1 0  0 0 0 1 0  0 0 0 1 0  0 0 0 0 1"
        result="blurBase"
      />
      {cfg.tableValues ? (
        <feComponentTransfer in="blurBase" result="blurShaped">
          <feFuncR type="table" tableValues={cfg.tableValues} />
          <feFuncG type="table" tableValues={cfg.tableValues} />
          <feFuncB type="table" tableValues={cfg.tableValues} />
        </feComponentTransfer>
      ) : null}

      <feConvolveMatrix
        in={cfg.tableValues ? 'blurShaped' : 'blurBase'}
        order="3 3"
        divisor={cfg.divisor}
        bias="0.5"
        edgeMode="duplicate"
        preserveAlpha="true"
        kernelMatrix="1 0 -1 2 0 -2 1 0 -1"
        result="gradX"
      />
      <feConvolveMatrix
        in={cfg.tableValues ? 'blurShaped' : 'blurBase'}
        order="3 3"
        divisor={cfg.divisor}
        bias="0.5"
        edgeMode="duplicate"
        preserveAlpha="true"
        kernelMatrix="1 2 1 0 0 0 -1 -2 -1"
        result="gradY"
      />
      <feColorMatrix in="gradX" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="rx" />
      <feColorMatrix in="gradY" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="gy" />
      <feComposite in="rx" in2="gy" operator="arithmetic" k2={1} k3={1} result="mapRaw" />
      <feGaussianBlur in="mapRaw" stdDeviation={cfg.postBlurStd} edgeMode="duplicate" result="map" />

      <feGaussianBlur in="SourceGraphic" stdDeviation={contentBlurSigma} edgeMode="duplicate" result="bgBlur" />
      <feColorMatrix in="bgBlur" type="matrix" values={colorMatrix} result="bgOptics" />

      {dispersionStep > 0 ? (
        <>
          {(['R', 'G', 'B'] as const).map((channel, index) => (
            <Fragment key={channel}>
              <feComponentTransfer in="bgOptics" result={`input-${channel}`}>
                <feFuncR type="linear" slope={channel === 'R' ? 1 : 0} />
                <feFuncG type="linear" slope={channel === 'G' ? 1 : 0} />
                <feFuncB type="linear" slope={channel === 'B' ? 1 : 0} />
              </feComponentTransfer>
              <feDisplacementMap
                in={`input-${channel}`}
                in2="map"
                xChannelSelector="R"
                yChannelSelector="G"
                scale={targetScale + (index - 1) * dispersionStep}
                result={`lens-${channel}`}
              />
            </Fragment>
          ))}
          <feComposite in="lens-R" in2="lens-G" operator="arithmetic" k2={1} k3={1} result="rg" />
          <feComposite in="rg" in2="lens-B" operator="arithmetic" k2={1} k3={1} result="refractRaw" />
        </>
      ) : (
        <feDisplacementMap
          in="bgOptics"
          in2="map"
          xChannelSelector="R"
          yChannelSelector="G"
          scale={targetScale}
          result="refractRaw"
        />
      )}

      <feGaussianBlur in="refractRaw" stdDeviation="0.5" edgeMode="duplicate" result="refractSmooth" />
      <feComposite in="refractSmooth" in2="shapeAlpha" operator="in" result="glassOnly" />
      <feMerge>
        <feMergeNode in="SourceGraphic" />
        <feMergeNode in="glassOnly" />
      </feMerge>
    </filter>
  )
}

function buildChains(bezel: number): ChainConfig[] {
  const bevelG75 = buildCircularBevelTable(bezel, 7.5)
  const bevelG85 = buildCircularBevelTable(bezel, 8.5)
  return [
    {
      key: 'b1',
      id: 'probe-filter-b1',
      label: t('misc.devRefractProbe.chainB1'),
      blurStd: 6.5,
      divisor: 1.15,
      postBlurStd: 0.8,
      scaleMultiplier: 0.78,
    },
    {
      key: 'b2',
      id: 'probe-filter-b2',
      label: t('misc.devRefractProbe.chainB2'),
      blurStd: 7.5,
      tableValues: bevelG75.tableValues,
      divisor: Number((bevelG75.peakSobelEffective / 0.48).toFixed(2)),
      postBlurStd: 0.35,
      scaleMultiplier: 1.04,
    },
    {
      key: 'b3',
      id: 'probe-filter-b3',
      label: t('misc.devRefractProbe.chainB3'),
      blurStd: 8.5,
      tableValues: bevelG85.tableValues,
      divisor: Number((bevelG85.peakSobelEffective / 0.48).toFixed(2)),
      postBlurStd: 0.35,
      scaleMultiplier: 1.1,
    },
  ]
}

export function RefractProbe() {
  const [preset, setPreset] = useState<ProbePresetId>('prism-menu')
  const [viewMode, setViewMode] = useState<ViewMode>('all')
  const [running, setRunning] = useState(true)
  const [phase, setPhase] = useState(1.2)
  const [rimOverlay, setRimOverlay] = useState(true)
  const [dispersion, setDispersion] = useState(false)
  const [stats, setStats] = useState({ fps: 0, pathMs: 0, svgUrlMs: 0 })

  const optical = useMemo(() => getUnifiedParams(preset), [preset])
  const allChains = useMemo(() => buildChains(optical.bezel), [optical.bezel])
  const activeChains = useMemo(
    () => (viewMode === 'all' ? allChains : allChains.filter((c) => c.key === viewMode)),
    [allChains, viewMode],
  )
  const activeChainIds = useMemo(() => activeChains.map((c) => c.id).join(','), [activeChains])
  const sampleText = t('misc.devRefractProbe.sampleText')

  const phaseRef = useRef(phase)
  const rimOverlayRef = useRef(rimOverlay)
  const opticalRef = useRef(optical)
  const feRefs = useRef<(SVGFEImageElement | null)[]>([])
  const clipBoxRefs = useRef<(HTMLDivElement | null)[]>([])
  const rimCanvasRefs = useRef<(HTMLCanvasElement | null)[]>([])
  const rimRenderersRef = useRef<(IMorphOverlayRenderer | null)[]>([])

  const showcaseCanvasRef = useRef<HTMLCanvasElement>(null)
  const showcaseRendererRef = useRef<ILiquidGlassRendererWithDebug | null>(null)

  const baselineHostRef = useRef<HTMLDivElement>(null)
  const baselineFilterId = `probe-d-${useId().replace(/[:«»]/g, '')}`
  const effectiveDispersion = dispersion ? Math.max(4, optical.dispersion) : optical.dispersion
  const baselineFeImage = useLensMap(baselineHostRef, true, {
    bezel: optical.bezel,
    strength: optical.strength,
    falloff: optical.falloff,
    dispersion: effectiveDispersion,
  })

  const syncFrame = useCallback((p: number) => {
    return applyMorphToTargets(p, {
      feRefs: feRefs.current,
      clipBoxRefs: clipBoxRefs.current,
      rimRenderers: rimRenderersRef.current,
      showcaseRenderer: showcaseRendererRef.current,
      optical: opticalRef.current,
      rimOverlay: rimOverlayRef.current,
    })
  }, [])

  useEffect(() => {
    const dpr = window.devicePixelRatio || 1
    const showcaseCanvas = showcaseCanvasRef.current
    let showcaseRenderer: ILiquidGlassRendererWithDebug | null = null
    if (showcaseCanvas) {
      showcaseRenderer = createLiquidGlassRenderer()
      showcaseRenderer.mount(showcaseCanvas)
      showcaseRenderer.setBackdrop({
        size: { width: W, height: H },
        dpr,
        version: 1,
        source: (ctx, w, h) => drawProbeScene(ctx, w, h, sampleText),
      })
      showcaseRendererRef.current = showcaseRenderer
    }

    const chainCount = activeChains.length
    feRefs.current.length = chainCount
    clipBoxRefs.current.length = chainCount
    rimCanvasRefs.current.length = chainCount

    const overlays: (IMorphOverlayRenderer | null)[] = []
    for (let i = 0; i < chainCount; i++) {
      const c = rimCanvasRefs.current[i]
      if (!c) {
        overlays.push(null)
        continue
      }
      const r = createMorphOverlayRenderer()
      r.mount(c)
      overlays.push(r)
    }
    rimRenderersRef.current = overlays

    syncFrame(phaseRef.current)

    return () => {
      showcaseRenderer?.dispose()
      if (showcaseRendererRef.current === showcaseRenderer) showcaseRendererRef.current = null
      for (const r of overlays) {
        r?.dispose()
      }
      rimRenderersRef.current = []
    }
  }, [syncFrame, viewMode, activeChainIds, activeChains.length, sampleText])

  useEffect(() => {
    phaseRef.current = phase
  }, [phase])

  useEffect(() => {
    rimOverlayRef.current = rimOverlay
    opticalRef.current = optical
    syncFrame(phaseRef.current)
  }, [rimOverlay, optical, syncFrame])

  useEffect(() => {
    let rafId = 0
    let currentPhase = phaseRef.current
    let lastTs = performance.now()
    let frames = 0
    let accFpsMs = 0
    let lastPathMs = 0
    let lastSvgMs = 0

    const step = (now: number) => {
      const dt = Math.min(0.05, Math.max(0, (now - lastTs) / 1000))
      lastTs = now
      if (running) {
        currentPhase = (currentPhase + dt * 2.2) % (Math.PI * 2)
      }
      const res = syncFrame(currentPhase)
      lastPathMs = res.pathMs
      lastSvgMs = res.svgUrlMs

      frames++
      accFpsMs += dt * 1000
      if (accFpsMs >= 500) {
        setStats({
          fps: Math.round((frames * 1000) / accFpsMs),
          pathMs: Number(lastPathMs.toFixed(2)),
          svgUrlMs: Number(lastSvgMs.toFixed(2)),
        })
        if (running) setPhase(Number(currentPhase.toFixed(2)))
        frames = 0
        accFpsMs = 0
      }
      if (running) rafId = requestAnimationFrame(step)
    }

    syncFrame(currentPhase)
    if (running) rafId = requestAnimationFrame(step)
    return () => cancelAnimationFrame(rafId)
  }, [running, syncFrame])

  const stripeBg =
    'repeating-linear-gradient(45deg,#ff5f6d 0 18px,#ffc371 18px 36px,#24c6dc 36px 54px,#514a9d 54px 72px)'

  const dispStep = effectiveDispersion > 0 ? Math.max(3, Math.round(effectiveDispersion)) : 0
  const cssVeil = `rgba(${Math.round(optical.tintRgbNormalized[0] * 255)}, ${Math.round(optical.tintRgbNormalized[1] * 255)}, ${Math.round(optical.tintRgbNormalized[2] * 255)}, ${optical.effectiveTintAlpha.toFixed(3)})`
  const baselineFilter = `blur(${optical.blurPx}px) saturate(${optical.saturate}) brightness(${optical.brightness}) contrast(${optical.contrastCss}) url(#${baselineFilterId}) blur(0.5px)`

  return (
    <div className="min-h-screen bg-[#141418] p-6 text-white">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="m-0 text-lg font-bold">{t('misc.devRefractProbe.title')}</h1>
        <select
          value={preset}
          onChange={(e) => setPreset(e.target.value as ProbePresetId)}
          className="rounded-lg border border-white/15 bg-white/10 px-2.5 py-1 text-sm text-white"
        >
          <option value="prism-menu" className="bg-[#1c1c20]">{t('misc.devRefractProbe.presetMenuOption')}</option>
          <option value="prism-control" className="bg-[#1c1c20]">{t('misc.devRefractProbe.presetControlOption')}</option>
          <option value="clear-menu" className="bg-[#1c1c20]">{t('misc.devRefractProbe.presetClearOption')}</option>
        </select>
        <select
          value={viewMode}
          onChange={(e) => setViewMode(e.target.value as ViewMode)}
          className="rounded-lg border border-white/15 bg-white/10 px-2.5 py-1 text-sm text-white"
        >
          <option value="all" className="bg-[#1c1c20]">{t('misc.devRefractProbe.viewAll')}</option>
          <option value="b2" className="bg-[#1c1c20]">{t('misc.devRefractProbe.viewB2')}</option>
          <option value="b3" className="bg-[#1c1c20]">{t('misc.devRefractProbe.viewB3')}</option>
        </select>
        <button
          type="button"
          onClick={() => setRunning((v) => !v)}
          className="rounded-full bg-white/15 px-3.5 py-1 text-sm font-semibold"
        >
          {running ? t('misc.devRefractProbe.pause') : t('misc.devRefractProbe.resume')}
        </button>
        <label className="flex items-center gap-1.5 text-sm text-white/80">
          <input type="checkbox" checked={rimOverlay} onChange={(e) => setRimOverlay(e.target.checked)} />
          <span>{t('misc.devRefractProbe.webgl2Rim')}</span>
        </label>
        <label className="flex items-center gap-1.5 text-sm text-white/80">
          <input type="checkbox" checked={dispersion} onChange={(e) => setDispersion(e.target.checked)} />
          <span>{t('misc.devRefractProbe.dispersion')}</span>
        </label>
        <label className="flex items-center gap-2 text-sm text-white/80">
          <span>{t('misc.devRefractProbe.phase')}</span>
          <input
            type="range"
            min={0}
            max={6.28}
            step={0.05}
            value={phase}
            onChange={(e) => {
              const next = Number(e.target.value)
              phaseRef.current = next
              setRunning(false)
              setPhase(next)
              syncFrame(next)
            }}
          />
          <span className="num w-10">{phase.toFixed(2)}</span>
        </label>
        <div className="text-sm text-white/80 num" data-testid="probe-stats">
          {t('misc.devRefractProbe.stats', {
            fps: stats.fps,
            pathMs: stats.pathMs,
            svgUrlMs: stats.svgUrlMs,
          })}
        </div>
      </div>

      <svg aria-hidden className="pointer-events-none fixed top-0 left-0 size-0 overflow-hidden opacity-0">
        <defs>
          {activeChains.map((c, idx) => (
            <SvgGradientChainFilter
              key={c.id}
              cfg={c}
              optical={optical}
              dispersionStep={dispStep}
              feRef={(el) => {
                feRefs.current[idx] = el
              }}
            />
          ))}
        </defs>
      </svg>

      <div className="flex flex-wrap gap-6">
        {activeChains.map((c, idx) => {
          const filterCss = `url(#${c.id})`
          return (
            <div key={c.id} className="flex flex-col gap-2" style={{ width: W }}>
              <div className="text-xs font-semibold text-white/90">{c.label}</div>
              <div className="relative overflow-hidden rounded-2xl border border-white/15" style={{ width: W, height: H, background: stripeBg }}>
                <div className="absolute inset-0 flex items-center justify-center text-2xl font-black tracking-wider text-black/75 select-none">
                  {sampleText}
                </div>
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{
                    backdropFilter: filterCss,
                    WebkitBackdropFilter: filterCss,
                    background: 'transparent',
                  }}
                />
                <div
                  ref={(el) => {
                    clipBoxRefs.current[idx] = el
                  }}
                  className="pointer-events-none absolute inset-0"
                  style={{ background: cssVeil }}
                />
                <canvas
                  ref={(el) => {
                    rimCanvasRefs.current[idx] = el
                  }}
                  className="pointer-events-none absolute inset-0"
                  style={{ width: W, height: H }}
                />
              </div>
            </div>
          )
        })}

        <div className="flex flex-col gap-2" style={{ width: W }}>
          <div className="text-xs font-semibold text-sky-300">
            {t('misc.devRefractProbe.cardWebglTitle', { label: optical.label })}
          </div>
          <div className="relative overflow-hidden rounded-2xl border border-sky-400/35" style={{ width: W, height: H, background: stripeBg }}>
            <div className="absolute inset-0 flex items-center justify-center text-2xl font-black tracking-wider text-black/75 select-none">
              {sampleText}
            </div>
            <canvas
              ref={showcaseCanvasRef}
              className="pointer-events-none absolute inset-0"
              style={{ width: W, height: H }}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2" style={{ width: W }}>
          <div className="text-xs font-semibold text-white/90">
            {t('misc.devRefractProbe.cardStaticTitle', { label: optical.label })}
          </div>
          <div className="relative overflow-hidden rounded-2xl border border-white/15" style={{ width: W, height: H, background: stripeBg }}>
            <div className="absolute inset-0 flex items-center justify-center text-2xl font-black tracking-wider text-black/75 select-none">
              {sampleText}
            </div>
            <div
              ref={baselineHostRef}
              className="absolute"
              style={{
                inset: '35px 30px',
                borderRadius: 24,
                backdropFilter: baselineFilter,
                WebkitBackdropFilter: baselineFilter,
                background: cssVeil,
                boxShadow:
                  preset === 'clear-menu'
                    ? '0 0 0 0.5px rgba(0,0,0,0.28), inset 0 0 6px -2px rgb(255 255 255 / 0.45), 0 4px 14px rgba(0,0,0,0.22)'
                    : '0 0 0 0.5px rgba(0,0,0,0.34), inset 0 1.5px 3px -0.5px rgb(255 255 255 / 0.34), inset 0 -1px 2px -0.5px rgb(255 255 255 / 0.16), 0 4px 14px rgba(0,0,0,0.24)',
              }}
            >
              <LensFilter id={baselineFilterId} feImage={baselineFeImage} dispersion={effectiveDispersion} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
