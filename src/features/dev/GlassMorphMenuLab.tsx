/**
 * Isolated PoC verification lab for the Liquid Glass Morphing Menu (`/dev/liquid-glass-menu`).
 * Uses purely fictional procedural backdrop data and never connects to `/api` or real library state.
 *
 * SPDX-License-Identifier: MPL-2.0
 */

import {
  Bookmark,
  BookOpen,
  Download,
  Eye,
  Heart,
  Layers,
  Moon,
  MoreHorizontal,
  Pause,
  Play,
  RotateCcw,
  Share2,
  SlidersHorizontal,
  Sun,
  Trash2,
} from 'lucide-react'
import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { useApplyAppearance, useAppearance } from '@/design/settings'
import { t } from '@/i18n'
import { cn } from '@/lib/cn'
import { BACKDROP_PRESETS, type BackdropPreset } from './glassMorphMenu/backdropScene'
import type { MorphPhase, PlacementMode, Point } from './glassMorphMenu/contracts'
import {
  LiquidGlassMorphMenu,
  type LiquidGlassMenuItem,
  type MenuTelemetry,
  type ScrubState,
  type TriggerStyleMode,
} from './glassMorphMenu/LiquidGlassMorphMenu'
import type { GlassDebugMode } from './glassMorphMenu/renderer'

const PRESET_LABEL_KEYS = {
  'manga-shelf': 'misc.devMorphLab.presets.mangaShelf',
  'editorial-contrast': 'misc.devMorphLab.presets.editorialContrast',
  'vivid-mesh': 'misc.devMorphLab.presets.vividMesh',
} as const satisfies Record<BackdropPreset, string>

const ANCHOR_SPOTS: readonly {
  id: string
  labelKey:
    | 'misc.devMorphLab.spots.topRight'
    | 'misc.devMorphLab.spots.topLeft'
    | 'misc.devMorphLab.spots.center'
    | 'misc.devMorphLab.spots.bottom'
  point: Point
}[] = [
  { id: 'top-right', labelKey: 'misc.devMorphLab.spots.topRight', point: { x: 0.82, y: 0.16 } },
  { id: 'top-left', labelKey: 'misc.devMorphLab.spots.topLeft', point: { x: 0.18, y: 0.16 } },
  { id: 'center', labelKey: 'misc.devMorphLab.spots.center', point: { x: 0.5, y: 0.45 } },
  { id: 'bottom', labelKey: 'misc.devMorphLab.spots.bottom', point: { x: 0.72, y: 0.86 } },
]

function buildMenuItems(): readonly LiquidGlassMenuItem[] {
  return [
    { id: 'read-next', label: t('misc.devMorphLab.menu.readNext'), icon: <BookOpen className="size-4" />, shortcut: '↵' },
    { id: 'favorite', label: t('misc.devMorphLab.menu.favorite'), icon: <Heart className="size-4" />, shortcut: 'F' },
    { id: 'bookmark', label: t('misc.devMorphLab.menu.bookmark'), icon: <Bookmark className="size-4" />, shortcut: 'B' },
    { id: 'download', label: t('misc.devMorphLab.menu.download'), icon: <Download className="size-4" />, shortcut: 'D' },
    { id: 'share', label: t('misc.devMorphLab.menu.share'), icon: <Share2 className="size-4" /> },
    { id: 'remove', label: t('misc.devMorphLab.menu.remove'), icon: <Trash2 className="size-4" />, destructive: true },
  ]
}

export function GlassMorphMenuLab() {
  useApplyAppearance()
  const systemTheme = useAppearance((s) => s.theme)

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (systemTheme === 'light' || systemTheme === 'dark') return systemTheme
    return typeof document !== 'undefined' && document.documentElement.dataset.theme === 'light'
      ? 'light'
      : 'dark'
  })
  const [preset, setPreset] = useState<BackdropPreset>('manga-shelf')
  const [scroll, setScroll] = useState<Point>({ x: 0, y: 0 })
  const [animateBackdrop, setAnimateBackdrop] = useState(false)

  const [triggerStyle, setTriggerStyle] = useState<TriggerStyleMode>('glass-pill')
  const [placement, setPlacement] = useState<PlacementMode>('overAnchorEnd')
  const [anchorSpotId, setAnchorSpotId] = useState<string>('top-right')

  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1)
  const [paused, setPaused] = useState(false)
  const [scrubActive, setScrubActive] = useState(false)
  const [scrubPhase, setScrubPhase] = useState<MorphPhase>('opening')
  const [scrubT, setScrubT] = useState(0.35)

  const [debugMode, setDebugMode] = useState<GlassDebugMode>('off')
  const [dispersion, setDispersion] = useState<number>(0)
  const [reducedMotion, setReducedMotion] = useState(false)

  const [telemetry, setTelemetry] = useState<MenuTelemetry | null>(null)
  const [lastSelected, setLastSelected] = useState<{ label: string; time: string } | null>(null)

  const menuItems = useMemo(() => buildMenuItems(), [])

  const anchorNormalized = useMemo(
    () => ANCHOR_SPOTS.find((s) => s.id === anchorSpotId)?.point ?? ANCHOR_SPOTS[0].point,
    [anchorSpotId],
  )

  const scrubState = useMemo<ScrubState>(
    () => ({
      active: scrubActive,
      phase: scrubPhase,
      normalizedT: scrubT,
    }),
    [scrubActive, scrubPhase, scrubT],
  )

  const handleSelect = useCallback((item: LiquidGlassMenuItem) => {
    const now = new Date()
    const time = now.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
    setLastSelected({ label: item.label, time })
  }, [])

  const isDark = theme === 'dark'

  return (
    <div
      data-sfw=""
      className={cn(
        'flex min-h-screen flex-col transition-colors',
        isDark ? 'bg-[#0b0b0d] text-zinc-100' : 'bg-[#f4f3ef] text-zinc-900',
      )}
    >
      {/* Compact Header */}
      <header
        className={cn(
          'flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 sm:px-6',
          isDark ? 'border-white/10 bg-zinc-950/70' : 'border-black/10 bg-white/70',
        )}
      >
        <div className="flex items-center gap-3">
          <div className="flex size-8 items-center justify-center rounded-xl bg-sky-500/15 text-sky-500">
            <Layers className="size-4" />
          </div>
          <div>
            <h1 className="m-0 text-sm font-bold tracking-tight sm:text-base">
              {t('misc.devMorphLab.title')}
            </h1>
            <p className="m-0 text-xs opacity-65">
              {t('misc.devMorphLab.subtitle')}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {lastSelected && (
            <div
              data-testid="deferred-selection-toast"
              className={cn(
                'rounded-full px-3 py-1 text-xs font-medium',
                isDark ? 'bg-emerald-500/15 text-emerald-300' : 'bg-emerald-600/12 text-emerald-700',
              )}
            >
              {t('misc.devMorphLab.deferredPrefix')} <strong>{lastSelected.label}</strong> @ {lastSelected.time}
            </div>
          )}

          <button
            type="button"
            onClick={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
            className={cn(
              'flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold',
              isDark ? 'border-white/15 bg-white/8 hover:bg-white/14' : 'border-black/12 bg-black/5 hover:bg-black/10',
            )}
          >
            {isDark ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
            <span>{isDark ? t('misc.devMorphLab.themeDark') : t('misc.devMorphLab.themeLight')}</span>
          </button>
        </div>
      </header>

      {/* Main Layout: Spacious Stage + Compact Inspector Sidebar */}
      <div className="flex flex-1 flex-col lg:flex-row">
        {/* Interactive Stage */}
        <main className="relative flex min-h-[520px] flex-1 flex-col p-3 sm:p-5">
          <div
            className={cn(
              'relative flex-1 overflow-hidden rounded-3xl border shadow-2xl',
              isDark ? 'border-white/12' : 'border-black/10',
            )}
          >
            <LiquidGlassMorphMenu
              items={menuItems}
              triggerLabel={
                triggerStyle === 'point-context'
                  ? t('misc.devMorphLab.triggerClickStage')
                  : t('misc.devMorphLab.triggerActions')
              }
              triggerIcon={
                triggerStyle === 'bare-icon' ? (
                  <MoreHorizontal className="size-5" />
                ) : (
                  <SlidersHorizontal className="size-4" />
                )
              }
              triggerStyle={triggerStyle}
              placement={placement}
              theme={theme}
              backdropPreset={preset}
              backdropScroll={scroll}
              onBackdropScrollChange={setScroll}
              animateBackdrop={animateBackdrop}
              playbackSpeed={playbackSpeed}
              paused={paused}
              scrubState={scrubState}
              debugMode={debugMode}
              dispersion={dispersion}
              reducedMotion={reducedMotion}
              anchorNormalized={anchorNormalized}
              onSelect={handleSelect}
              onTelemetry={setTelemetry}
            />

            {/* Live Telemetry HUD (bottom-left of stage) */}
            {telemetry && (
              <div
                data-testid="telemetry-hud"
                className={cn(
                  'pointer-events-none absolute bottom-3 left-3 z-40 max-w-[calc(100%-24px)] rounded-2xl border px-3 py-2 font-mono text-[11px] backdrop-blur-md',
                  isDark
                    ? 'border-white/12 bg-black/65 text-zinc-200'
                    : 'border-black/10 bg-white/75 text-zinc-800',
                )}
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span>
                    {t('misc.devMorphLab.hud.phase')} <strong className="text-sky-500">{telemetry.phase}</strong>
                  </span>
                  <span>t: {telemetry.normalizedT.toFixed(2)}</span>
                  <span>
                    {t('misc.devMorphLab.hud.progress')} {telemetry.morphProgress.toFixed(2)}
                  </span>
                  <span>
                    {t('misc.devMorphLab.hud.mergeDepth')} <strong>{telemetry.mergeDepth.toFixed(1)}</strong> (
                    {telemetry.isMerged ? t('misc.devMorphLab.hud.merged') : t('misc.devMorphLab.hud.goo')})
                  </span>
                  <span>k: {telemetry.blendK.toFixed(1)}</span>
                  <span>
                    {t('misc.devMorphLab.hud.settled')} {telemetry.settled.toFixed(2)}
                  </span>
                  <span>
                    {t('misc.devMorphLab.hud.blurBump')} {telemetry.blurBumpPx.toFixed(2)}px
                  </span>
                  <span>
                    {t('misc.devMorphLab.hud.styleMix')} {telemetry.styleMix.toFixed(2)}
                  </span>
                  <span>
                    {t('misc.devMorphLab.hud.rim')} {telemetry.rimOpacity.toFixed(2)}
                  </span>
                  <span>{t('misc.devMorphLab.hud.fps', { fps: telemetry.fps })}</span>
                  <span
                    className={cn(
                      'font-semibold',
                      telemetry.capabilities.webgl2 ? 'text-emerald-500' : 'text-amber-500',
                    )}
                  >
                    {telemetry.capabilities.webgl2
                      ? t('misc.devMorphLab.hud.webgl2')
                      : t('misc.devMorphLab.hud.cssFallback')}
                  </span>
                </div>
                {!telemetry.capabilities.webgl2 && telemetry.capabilities.fallbackNotice && (
                  <div className="mt-1 text-[10px] text-amber-500">{telemetry.capabilities.fallbackNotice}</div>
                )}
              </div>
            )}

            {/* Hint pill (bottom-right inside stage, clear of backdrop header) */}
            <div
              className={cn(
                'pointer-events-none absolute right-3 bottom-3 z-20 hidden rounded-full px-3 py-1 text-[11px] font-medium backdrop-blur-sm xl:block',
                isDark ? 'bg-black/45 text-white/75' : 'bg-white/65 text-black/70',
              )}
            >
              {triggerStyle === 'point-context'
                ? t('misc.devMorphLab.hintPoint')
                : t('misc.devMorphLab.hintControl')}
            </div>
          </div>
        </main>

        {/* Controls Panel */}
        <aside
          className={cn(
            'w-full shrink-0 space-y-4 overflow-y-auto border-t p-4 lg:w-80 lg:border-t-0 lg:border-l',
            isDark ? 'border-white/10 bg-zinc-950/60' : 'border-black/10 bg-white/60',
          )}
        >
          {/* Trigger Style */}
          <Section title={t('misc.devMorphLab.sections.triggerStyle')} isDark={isDark}>
            <div className="grid grid-cols-3 gap-1.5">
              {(
                [
                  ['glass-pill', t('misc.devMorphLab.triggers.glassPill')],
                  ['bare-icon', t('misc.devMorphLab.triggers.bareIcon')],
                  ['point-context', t('misc.devMorphLab.triggers.pointContext')],
                ] as const
              ).map(([id, label]) => (
                <Chip
                  key={id}
                  active={triggerStyle === id}
                  isDark={isDark}
                  onClick={() => setTriggerStyle(id)}
                >
                  {label}
                </Chip>
              ))}
            </div>
          </Section>

          {/* Placement & Anchor */}
          <Section title={t('misc.devMorphLab.sections.placementAnchor')} isDark={isDark}>
            <div className="grid grid-cols-3 gap-1.5">
              {(
                [
                  ['overAnchorEnd', t('misc.devMorphLab.placements.overAnchorEnd')],
                  ['overAnchorStart', t('misc.devMorphLab.placements.overAnchorStart')],
                  ['belowPoint', t('misc.devMorphLab.placements.belowPoint')],
                ] as const
              ).map(([id, label]) => (
                <Chip
                  key={id}
                  active={placement === id}
                  isDark={isDark}
                  onClick={() => setPlacement(id)}
                >
                  {label}
                </Chip>
              ))}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              {ANCHOR_SPOTS.map((spot) => (
                <Chip
                  key={spot.id}
                  active={anchorSpotId === spot.id}
                  isDark={isDark}
                  onClick={() => setAnchorSpotId(spot.id)}
                >
                  {t(spot.labelKey)}
                </Chip>
              ))}
            </div>
          </Section>

          {/* Backdrop Preset */}
          <Section title={t('misc.devMorphLab.sections.backdropScene')} isDark={isDark}>
            <div className="grid grid-cols-3 gap-1.5">
              {BACKDROP_PRESETS.map((p) => (
                <Chip
                  key={p.id}
                  active={preset === p.id}
                  isDark={isDark}
                  onClick={() => setPreset(p.id)}
                >
                  {t(PRESET_LABEL_KEYS[p.id])}
                </Chip>
              ))}
            </div>
            <div className="mt-2 flex items-center gap-1.5">
              <Chip
                active={animateBackdrop}
                isDark={isDark}
                onClick={() => setAnimateBackdrop((v) => !v)}
                className="flex-1"
              >
                {animateBackdrop ? t('misc.devMorphLab.driftOn') : t('misc.devMorphLab.driftOff')}
              </Chip>
              <Chip
                active={false}
                isDark={isDark}
                onClick={() => setScroll({ x: 0, y: 0 })}
                className="flex items-center justify-center gap-1"
              >
                <RotateCcw className="size-3" />
                <span>{t('misc.devMorphLab.reset')}</span>
              </Chip>
            </div>
          </Section>

          {/* Playback & Timeline Scrubber */}
          <Section title={t('misc.devMorphLab.sections.playbackScrubber')} isDark={isDark}>
            <div className="flex items-center gap-1.5">
              {[1, 0.25, 0.1].map((spd) => (
                <Chip
                  key={spd}
                  active={playbackSpeed === spd}
                  isDark={isDark}
                  onClick={() => setPlaybackSpeed(spd)}
                  className="flex-1"
                >
                  {t('misc.devMorphLab.speedFactor', { speed: spd })}
                </Chip>
              ))}
              <Chip
                active={paused}
                isDark={isDark}
                onClick={() => setPaused((p) => !p)}
                className="flex items-center justify-center gap-1 px-2.5"
              >
                {paused ? <Play className="size-3" /> : <Pause className="size-3" />}
              </Chip>
            </div>

            <div className="mt-2.5 space-y-2 rounded-xl border border-current/10 p-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium opacity-80">{t('misc.devMorphLab.timelineScrub')}</span>
                <Chip
                  active={scrubActive}
                  isDark={isDark}
                  onClick={() => setScrubActive((s) => !s)}
                >
                  {scrubActive ? t('misc.devMorphLab.scrubActive') : t('misc.devMorphLab.scrubOff')}
                </Chip>
              </div>
              {scrubActive && (
                <>
                  <div className="grid grid-cols-2 gap-1.5">
                    <Chip
                      active={scrubPhase === 'opening'}
                      isDark={isDark}
                      onClick={() => setScrubPhase('opening')}
                    >
                      {t('misc.devMorphLab.openingPhase')}
                    </Chip>
                    <Chip
                      active={scrubPhase === 'closing'}
                      isDark={isDark}
                      onClick={() => setScrubPhase('closing')}
                    >
                      {t('misc.devMorphLab.closingPhase')}
                    </Chip>
                  </div>
                  <label className="block">
                    <div className="mb-1 flex justify-between text-[11px] opacity-75">
                      <span>{t('misc.devMorphLab.scrubProgress')}</span>
                      <span>{Math.round(scrubT * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.005}
                      value={scrubT}
                      onChange={(e) => setScrubT(Number(e.target.value))}
                      className="w-full accent-sky-500"
                    />
                  </label>
                </>
              )}
            </div>
          </Section>

          {/* Shader & Accessibility */}
          <Section title={t('misc.devMorphLab.sections.shaderA11y')} isDark={isDark}>
            <div className="grid grid-cols-3 gap-1.5">
              {(
                [
                  ['off', t('misc.devMorphLab.debugOff')],
                  ['sdf', t('misc.devMorphLab.debugSdf')],
                  ['normals', t('misc.devMorphLab.debugNormals')],
                ] as const
              ).map(([mode, label]) => (
                <Chip
                  key={mode}
                  active={debugMode === mode}
                  isDark={isDark}
                  onClick={() => setDebugMode(mode)}
                >
                  <span className="inline-flex items-center gap-1">
                    {mode !== 'off' && <Eye className="size-3" />}
                    {label}
                  </span>
                </Chip>
              ))}
            </div>

            <div className="mt-2.5">
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="opacity-80">
                  {t('misc.devMorphLab.dispersionLabel', { px: dispersion.toFixed(1) })}
                </span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setDispersion(0)}
                    className="cursor-pointer rounded px-1.5 py-0.5 text-[10px] opacity-75 hover:opacity-100"
                  >
                    0
                  </button>
                  <button
                    type="button"
                    onClick={() => setDispersion(6.5)}
                    className="cursor-pointer rounded px-1.5 py-0.5 text-[10px] opacity-75 hover:opacity-100"
                  >
                    6.5
                  </button>
                </div>
              </div>
              <input
                type="range"
                min={0}
                max={8}
                step={0.5}
                value={dispersion}
                onChange={(e) => setDispersion(Number(e.target.value))}
                className="w-full accent-sky-500"
              />
            </div>

            <label className="mt-2 flex cursor-pointer items-center justify-between rounded-xl border border-current/10 px-3 py-2 text-xs">
              <span>{t('misc.devMorphLab.reducedMotion')}</span>
              <input
                type="checkbox"
                checked={reducedMotion}
                onChange={(e) => setReducedMotion(e.target.checked)}
                className="accent-sky-500"
              />
            </label>
          </Section>

          {/* Fidelity & Limitations Notes */}
          <details
            className={cn(
              'rounded-2xl border p-3 text-xs leading-relaxed',
              isDark ? 'border-white/10 bg-white/[0.03]' : 'border-black/10 bg-black/[0.02]',
            )}
          >
            <summary className="cursor-pointer font-semibold">
              {t('misc.devMorphLab.notesSummary')}
            </summary>
            <ul className="mt-2 list-disc space-y-1.5 pl-4 opacity-80">
              <li>
                <strong>{t('misc.devMorphLab.notesGooTitle')}</strong> {t('misc.devMorphLab.notesGooBody')}
              </li>
              <li>
                <strong>{t('misc.devMorphLab.notesSpringTitle')}</strong> {t('misc.devMorphLab.notesSpringBody')}
              </li>
              <li>
                <strong>{t('misc.devMorphLab.notesShaderTitle')}</strong> {t('misc.devMorphLab.notesShaderBody')}
              </li>
              <li>
                <strong>{t('misc.devMorphLab.notesWebTitle')}</strong> {t('misc.devMorphLab.notesWebBody')}
              </li>
            </ul>
          </details>
        </aside>
      </div>
    </div>
  )
}

function Section({ title, isDark, children }: { title: string; isDark: boolean; children: ReactNode }) {
  return (
    <section
      className={cn(
        'rounded-2xl border p-3',
        isDark ? 'border-white/10 bg-white/[0.02]' : 'border-black/10 bg-black/[0.015]',
      )}
    >
      <h2 className="m-0 mb-2 text-[11px] font-bold tracking-wider uppercase opacity-60">{title}</h2>
      {children}
    </section>
  )
}

function Chip({
  active,
  isDark,
  onClick,
  className,
  children,
}: {
  active: boolean
  isDark: boolean
  onClick: () => void
  className?: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'cursor-pointer rounded-xl px-2.5 py-1.5 text-xs font-medium transition-colors',
        active
          ? isDark
            ? 'bg-sky-500/25 text-sky-200 ring-1 ring-sky-400/50'
            : 'bg-sky-600 text-white shadow-sm'
          : isDark
            ? 'bg-white/6 text-zinc-300 hover:bg-white/12'
            : 'bg-black/5 text-zinc-700 hover:bg-black/10',
        className,
      )}
    >
      {children}
    </button>
  )
}
