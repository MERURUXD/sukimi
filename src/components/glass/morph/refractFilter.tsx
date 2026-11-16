/**
 * Route B3 dynamic SVG refraction filter component for Live-DOM Hybrid Liquid Glass morphing.
 *
 * Uses a 0.5x stored-PNG RGBA displacement + inward-AA alpha map (`refractMap.ts`) ->
 * background blur + color optics -> 1x/3x RGB `feDisplacementMap` with full dispersion ->
 * self-masked to `map` alpha and merged over untouched `SourceGraphic` so Chromium never leaks
 * a rectangular `backdrop-filter` bounds box.
 *
 * SPDX-License-Identifier: MPL-2.0
 */

import { Fragment, useImperativeHandle, useLayoutEffect, useRef, type Ref } from 'react'
import { autoBezel } from '../refract'
import type { GlassShapeState, Rect } from './contracts'
import { createMorphRefractMapBuilder, type MorphRefractMapBuilder } from './refractMap'
import { buildColorOpticsMatrix } from './refractOptics'

const FULL_RES_MAP_THRESHOLD_PX = 128

export interface MorphRefractFrame {
  bounds: Rect
  platter: GlassShapeState
  droplet: GlassShapeState | null
  blendK: number
  isMerged: boolean
  blurSigma: number
  saturate: number
  brightness: number
  contrast: number
  contrastFirst?: boolean
  bezel?: number
}

export interface MorphRefractFilterHandle {
  updateFrame: (frame: MorphRefractFrame) => void
}

function resolveFrameBezel(requestedBezel: number, frame: MorphRefractFrame): number {
  const hasDroplet =
    !frame.isMerged &&
    frame.droplet !== null &&
    frame.droplet.size.width > 0.01 &&
    frame.droplet.size.height > 0.01
  const refW = hasDroplet
    ? Math.max(frame.platter.size.width, frame.droplet!.size.width)
    : frame.platter.size.width
  const refH = hasDroplet
    ? Math.max(frame.platter.size.height, frame.droplet!.size.height)
    : frame.platter.size.height
  return requestedBezel > 0
    ? Math.max(1, Math.min(requestedBezel, refW * 0.5, refH * 0.5))
    : autoBezel(refW, refH)
}

export function MorphRefractFilter({
  id,
  bezel,
  strength,
  dispersion,
  falloff = 2.6,
  scaleMultiplier = 1,
  mapScale = 0.5,
  ref,
}: {
  id: string
  bezel: number
  strength: number
  dispersion: number
  falloff?: number
  scaleMultiplier?: number
  mapScale?: number
  ref?: Ref<MorphRefractFilterHandle>
}) {
  const filterRef = useRef<SVGFilterElement>(null)
  const feImageRef = useRef<SVGFEImageElement>(null)
  const bgBlurRef = useRef<SVGFEGaussianBlurElement>(null)
  const colorMatrixRef = useRef<SVGFEColorMatrixElement>(null)

  const mapBuilderRef = useRef<MorphRefractMapBuilder | null>(null)
  const safeBezel = bezel > 0 ? Math.max(1, bezel) : 22
  const safeFalloff = Number.isFinite(falloff) && falloff >= 0 ? falloff : 2.6

  const lastFrameRef = useRef({
    width: -1,
    height: -1,
    sigma: '',
    matrix: '',
    scaleKey: '',
  })

  const targetScale = Math.max(0, 2 * safeBezel * strength * scaleMultiplier)

  useLayoutEffect(() => {
    // Dispersion switches DOM <feDisplacementMap> nodes; force next updateFrame to re-sync scale attributes.
    lastFrameRef.current.scaleKey = ''
  }, [dispersion, strength, scaleMultiplier, bezel])

  useImperativeHandle(
    ref,
    () => ({
      updateFrame(frame) {
        const prev = lastFrameRef.current
        const fe = feImageRef.current
        const frameBezel = resolveFrameBezel(frame.bezel ?? bezel, frame)
        const frameMapScale =
          mapScale === 0.5 && Math.max(frame.bounds.width, frame.bounds.height) <= FULL_RES_MAP_THRESHOLD_PX
            ? 1
            : mapScale

        if (fe) {
          const builder = (mapBuilderRef.current ??= createMorphRefractMapBuilder())
          const mapResult = builder.build({
            bounds: frame.bounds,
            platter: frame.platter,
            droplet: frame.droplet,
            blendK: frame.blendK,
            isMerged: frame.isMerged,
            bezel: frameBezel,
            falloff: safeFalloff,
            mapScale: frameMapScale,
          })
          if (mapResult.width !== prev.width || mapResult.height !== prev.height) {
            fe.setAttribute('width', String(mapResult.width))
            fe.setAttribute('height', String(mapResult.height))
            prev.width = mapResult.width
            prev.height = mapResult.height
          }
          if (mapResult.changed) {
            fe.setAttribute('href', mapResult.dataUrl)
          }
        }

        const baseScale = Math.max(0, 2 * frameBezel * strength * scaleMultiplier)
        const scaleKey = `${baseScale.toFixed(2)}:${dispersion}`
        if (scaleKey !== prev.scaleKey) {
          filterRef.current?.querySelectorAll('feDisplacementMap').forEach((node) => {
            const extra = Number((node as SVGElement).dataset.extra ?? 0)
            node.setAttribute('scale', String(Math.max(0, baseScale + extra)))
          })
          prev.scaleKey = scaleKey
        }

        const sigma = frame.blurSigma > 0.05 ? frame.blurSigma.toFixed(2) : '0'
        if (sigma !== prev.sigma) {
          bgBlurRef.current?.setAttribute('stdDeviation', sigma)
          prev.sigma = sigma
        }

        const matrix = buildColorOpticsMatrix(
          frame.saturate,
          frame.brightness,
          frame.contrast,
          frame.contrastFirst,
        )
        if (matrix !== prev.matrix) {
          colorMatrixRef.current?.setAttribute('values', matrix)
          prev.matrix = matrix
        }
      },
    }),
    [bezel, strength, dispersion, scaleMultiplier, safeFalloff, mapScale],
  )

  return (
    <svg aria-hidden className="pointer-events-none fixed top-0 left-0 size-0 overflow-hidden opacity-0">
      <defs>
        <filter ref={filterRef} id={id} colorInterpolationFilters="sRGB" x="0%" y="0%" width="100%" height="100%">
          <feImage
            ref={feImageRef}
            x="0"
            y="0"
            width={1}
            height={1}
            preserveAspectRatio="none"
            result="map"
          />

          <feGaussianBlur ref={bgBlurRef} in="SourceGraphic" stdDeviation="0" edgeMode="duplicate" result="bgBlur" />
          <feColorMatrix
            ref={colorMatrixRef}
            in="bgBlur"
            type="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0"
            result="bgOptics"
          />

          {dispersion > 0 ? (
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
                    data-extra={(index - 1) * dispersion}
                    scale={Math.max(0, targetScale + (index - 1) * dispersion)}
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
              data-extra={0}
              scale={targetScale}
              result="refractRaw"
            />
          )}

          <feGaussianBlur in="refractRaw" stdDeviation="0.5" edgeMode="duplicate" result="refractSmooth" />
          <feComposite in="refractSmooth" in2="map" operator="in" result="glassOnly" />
          <feMerge>
            <feMergeNode in="SourceGraphic" />
            <feMergeNode in="glassOnly" />
          </feMerge>
        </filter>
      </defs>
    </svg>
  )
}
