/**
 * Route B3 dynamic SVG refraction filter component for Live-DOM Hybrid Liquid Glass morphing.
 *
 * Uses Gaussian half-plane blur -> circular-bevel integral lookup -> discrete Sobel normal gradient ->
 * `feDisplacementMap` + chromatic dispersion, self-masked to `shapeAlpha` and merged over untouched
 * `SourceGraphic` so Chromium never leaks a rectangular `backdrop-filter` bounds box.
 *
 * SPDX-License-Identifier: MPL-2.0
 */

import { Fragment, useImperativeHandle, useMemo, useRef, type Ref } from 'react'
import {
  buildCircularBevelTable,
  buildColorOpticsMatrix,
  buildContourAlphaDataUrl,
} from './refractOptics'

export interface MorphRefractFrame {
  width: number
  height: number
  contourPath: string
  blurSigma: number
  saturate: number
  brightness: number
  contrast: number
  contrastFirst?: boolean
}

export interface MorphRefractFilterHandle {
  updateFrame: (frame: MorphRefractFrame) => void
}

export function MorphRefractFilter({
  id,
  bezel,
  strength,
  dispersion,
  bevelBlurStd,
  postBlurStd = 0.35,
  scaleMultiplier = 1.1,
  ref,
}: {
  id: string
  bezel: number
  strength: number
  dispersion: number
  bevelBlurStd?: number
  postBlurStd?: number
  scaleMultiplier?: number
  ref?: Ref<MorphRefractFilterHandle>
}) {
  const feImageRef = useRef<SVGFEImageElement>(null)
  const bgBlurRef = useRef<SVGFEGaussianBlurElement>(null)
  const colorMatrixRef = useRef<SVGFEColorMatrixElement>(null)

  const lastFrameRef = useRef({
    width: -1,
    height: -1,
    contourPath: '',
    sigma: '',
    matrix: '',
  })

  const safeBezel = Math.max(1, bezel)
  const bevel = useMemo(
    () => buildCircularBevelTable(safeBezel, bevelBlurStd),
    [safeBezel, bevelBlurStd],
  )

  const targetScale = Math.max(0, Math.round(2 * safeBezel * strength * scaleMultiplier))

  useImperativeHandle(
    ref,
    () => ({
      updateFrame(frame) {
        const w = Math.max(1, Math.round(frame.width))
        const h = Math.max(1, Math.round(frame.height))
        const prev = lastFrameRef.current
        const fe = feImageRef.current

        if (fe) {
          if (w !== prev.width || h !== prev.height) {
            fe.setAttribute('width', String(w))
            fe.setAttribute('height', String(h))
          }
          if (frame.contourPath && (frame.contourPath !== prev.contourPath || w !== prev.width || h !== prev.height)) {
            fe.setAttribute('href', buildContourAlphaDataUrl(frame.contourPath, w, h))
            prev.contourPath = frame.contourPath
          }
          prev.width = w
          prev.height = h
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
    [],
  )

  return (
    <svg aria-hidden className="pointer-events-none fixed top-0 left-0 size-0 overflow-hidden opacity-0">
      <defs>
        <filter id={id} colorInterpolationFilters="sRGB" x="0%" y="0%" width="100%" height="100%">
          <feImage
            ref={feImageRef}
            x="0"
            y="0"
            width={1}
            height={1}
            preserveAspectRatio="none"
            result="shapeAlpha"
          />
          <feGaussianBlur in="shapeAlpha" stdDeviation={bevel.blurStd} result="blurredAlpha" />
          <feColorMatrix
            in="blurredAlpha"
            type="matrix"
            values="0 0 0 1 0  0 0 0 1 0  0 0 0 1 0  0 0 0 0 1"
            result="blurBase"
          />
          <feComponentTransfer in="blurBase" result="blurShaped">
            <feFuncR type="table" tableValues={bevel.tableValues} />
            <feFuncG type="table" tableValues={bevel.tableValues} />
            <feFuncB type="table" tableValues={bevel.tableValues} />
          </feComponentTransfer>

          <feConvolveMatrix
            in="blurShaped"
            order="3 3"
            divisor={bevel.divisor}
            bias="0.5"
            edgeMode="duplicate"
            preserveAlpha="true"
            kernelMatrix="1 0 -1 2 0 -2 1 0 -1"
            result="gradX"
          />
          <feConvolveMatrix
            in="blurShaped"
            order="3 3"
            divisor={bevel.divisor}
            bias="0.5"
            edgeMode="duplicate"
            preserveAlpha="true"
            kernelMatrix="1 2 1 0 0 0 -1 -2 -1"
            result="gradY"
          />
          <feColorMatrix in="gradX" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="rx" />
          <feColorMatrix in="gradY" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="gy" />
          <feComposite in="rx" in2="gy" operator="arithmetic" k2={1} k3={1} result="mapRaw" />
          <feGaussianBlur in="mapRaw" stdDeviation={postBlurStd} edgeMode="duplicate" result="map" />

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
      </defs>
    </svg>
  )
}
