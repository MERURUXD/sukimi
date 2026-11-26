import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { crc32 as zlibCrc32, inflateSync } from 'node:zlib'
import { JSDOM } from 'jsdom'
import { createServer } from 'vite'

let vite
let core
let dom
let presets

test.before(async () => {
  vite = await createServer({
    server: { middlewareMode: true },
    appType: 'custom',
    logLevel: 'error',
  })
  core = await vite.ssrLoadModule('@sessile/core')
  dom = await vite.ssrLoadModule('@sessile/dom')
  presets = await vite.ssrLoadModule('@sessile/presets')
})

test.after(async () => {
  await vite?.close()
})

function approx(actual, expected, eps = 1e-4, label = '') {
  assert.ok(
    Math.abs(actual - expected) <= eps,
    `${label ? `${label}: ` : ''}expected ${actual} ≈ ${expected} (±${eps})`,
  )
}

test('POPOVER_MORPH_DEFAULTS / DEFAULT_SPRINGS / DEFAULT_OPTICAL_MATERIALS: exact physics, timing, and optical preset constants', () => {
  const C = presets.POPOVER_MORPH_DEFAULTS
  assert.equal(C.openDurationSec, 0.45)
  assert.equal(C.closeDurationSec, 0.5)
  assert.equal(C.pointCloseDurationSec, 0.2)
  assert.equal(C.dropletBlendK, 28)
  assert.equal(C.cornerDelaySec, 0.07)
  assert.equal(C.itemRadius, 16)
  assert.equal(C.panelInset, 8)
  assert.equal(C.restingRadius, 24)
  assert.deepEqual(C.springs.open, { mass: 1, stiffness: 400, dampingRatio: 0.754 })
  assert.deepEqual(C.springs.corners, { mass: 1, stiffness: 324, dampingRatio: 0.75 })
  assert.deepEqual(C.springs.droplet, { mass: 1, stiffness: 165, dampingRatio: 0.8 })
  assert.deepEqual(core.DEFAULT_SPRINGS.elasticPress, { mass: 1, stiffness: 311, dampingRatio: 0.593 })
  // 旧名 regular / menu 对应 crisp / frosted，rimMode 的 control / menu 对应 directional / soft
  const M = core.DEFAULT_OPTICAL_MATERIALS
  assert.equal(M.light.crisp.rimMode, 'directional')
  assert.equal(M.light.frosted.rimMode, 'soft')
  assert.equal(M.dark.crisp.rimMode, 'directional')
  assert.equal(M.dark.frosted.rimMode, 'soft')
  assert.deepEqual(M.dark.crisp.tintRgba, [0.207, 0.207, 0.22, 0.62])
  assert.deepEqual(M.dark.frosted.tintRgba, [0.207, 0.207, 0.22, 0.63])
})

test('Motion: riseAndFall peaks at exactly 1.0 at spec peak times and 0 at t <= 0', () => {
  const { riseAndFall } = core
  const C = presets.POPOVER_MORPH_DEFAULTS
  const peaks = [
    [C.openDipPeakSec, C.openDipSharpness],
    [C.openBlurBumpPeakSec, C.openBlurBumpSharpness],
    [C.closePlatterDipPeakSec, C.closePlatterDipSharpness],
    [C.closeDropletOvershootPeakSec, C.closeDropletOvershootSharpness],
  ]
  for (const [peak, sharpness] of peaks) {
    assert.equal(riseAndFall(0, peak, sharpness), 0)
    assert.equal(riseAndFall(-0.05, peak, sharpness), 0)
    approx(riseAndFall(peak, peak, sharpness), 1.0, 1e-12, `peak=${peak}`)
    assert.ok(riseAndFall(peak * 0.5, peak, sharpness) < 1.0)
    assert.ok(riseAndFall(peak * 1.5, peak, sharpness) < 1.0)
  }
})

test('Motion: analytical spring solver handles underdamped, critical, and overdamped regimes', () => {
  const { evaluateSpringState } = core
  const C = presets.POPOVER_MORPH_DEFAULTS

  // Underdamped open spring (zeta = 0.754 < 1) peaks near pi / omegaD ~= 0.239s (> 1.0) before settling
  const at0 = evaluateSpringState(0, C.springs.open)
  assert.equal(at0.value, 0)
  assert.equal(at0.velocity, 0)
  const peakOpen = evaluateSpringState(0.24, C.springs.open)
  assert.ok(peakOpen.value > 1.02, `underdamped open spring should overshoot past 1.0 at peak (got ${peakOpen.value})`)
  const endOpen = evaluateSpringState(0.45, C.springs.open)
  approx(endOpen.value, 1.0, 0.005, 'open spring settles near 1 at 450ms')

  // Critically damped (zeta = 1.0) never overshoots target
  const critical = { mass: 1, stiffness: 400, dampingRatio: 1.0 }
  for (let t = 0.01; t <= 0.5; t += 0.02) {
    const s = evaluateSpringState(t, critical)
    assert.ok(s.value >= 0 && s.value <= 1.0 + 1e-9, `critical spring overshoot at t=${t}`)
  }

  // Overdamped (zeta = 1.5) approaches monotonically and slower than critical
  const overdamped = { mass: 1, stiffness: 400, dampingRatio: 1.5 }
  const sCrit = evaluateSpringState(0.1, critical).value
  const sOver = evaluateSpringState(0.1, overdamped).value
  assert.ok(sOver < sCrit && sOver > 0, 'overdamped should lag critical damping')
})

test('Motion: open phase timing (70ms corner delay, 98ms dip, 69ms blur bump, glyph & content choreography)', () => {
  const evaluateMotionFrame = presets.evaluatePopoverMotion
  const C = presets.POPOVER_MORPH_DEFAULTS

  // Before 70ms corner delay: cornerProgress remains 1
  const at50ms = evaluateMotionFrame('opening', 0.05 / C.openDurationSec)
  assert.equal(at50ms.cornerProgress, 1)
  approx(at50ms.bareGlassOpacity, 0.5, 1e-4, 'bareGlassOpacity at 50ms')

  // At 98ms dip peak & 69ms blur bump peak
  const atDipPeak = evaluateMotionFrame('opening', C.openDipPeakSec / C.openDurationSec)
  approx(atDipPeak.platterDipEnvelope, 1.0, 1e-6, 'open dip envelope peak')
  assert.ok(atDipPeak.cornerProgress < 1.0, 'cornerProgress decays after 70ms')

  const atBlurPeak = evaluateMotionFrame('opening', C.openBlurBumpPeakSec / C.openDurationSec)
  approx(atBlurPeak.blurBumpPx, C.openBlurBumpAmpPx, 1e-6, 'open blur bump peak')

  // At 100ms+, bareGlassOpacity reaches 1
  const at120ms = evaluateMotionFrame('opening', 0.12 / C.openDurationSec)
  assert.equal(at120ms.bareGlassOpacity, 1)

  // Glyph hides over settled in [0, 0.25], content blurs with hypot(4*(1-settled), blurBumpPx)
  const expectedBlur = Math.hypot(4 * (1 - atBlurPeak.settled), atBlurPeak.blurBumpPx)
  approx(atBlurPeak.contentBlurPx, expectedBlur, 1e-6, 'contentBlurPx hypot')

  // Once settled >= 0.25, triggerGlyphOpacity === 0 and triggerGlyphBlurPx === 4
  const at200ms = evaluateMotionFrame('opening', 0.2 / C.openDurationSec)
  assert.ok(at200ms.settled >= 0.25)
  assert.equal(at200ms.triggerGlyphOpacity, 0)
  assert.equal(at200ms.triggerGlyphBlurPx, C.openGlyphBlurMaxPx)
})

test('Motion: close phase timing (ringing 400..500ms, absorption 300..450ms, 100ms content out, 470ms glyph back)', () => {
  const evaluateMotionFrame = presets.evaluatePopoverMotion
  const C = presets.POPOVER_MORPH_DEFAULTS

  const at25ms = evaluateMotionFrame('closing', 0.025 / C.closeDurationSec)
  approx(at25ms.closeBlendRamp, 0.5, 1e-4, 'blend ramp at 25ms')
  assert.equal(at25ms.absorbed, 0, 'no absorption before 300ms')
  assert.equal(at25ms.ringing, 1, 'ringing is 1 before 400ms')

  const at72ms = evaluateMotionFrame('closing', C.closePlatterDipPeakSec / C.closeDurationSec)
  approx(at72ms.platterDipEnvelope, 1.0, 1e-6, 'close platter dip peak')

  const at100ms = evaluateMotionFrame('closing', 0.1 / C.closeDurationSec)
  assert.equal(at100ms.contentOpacity, 0, 'content hidden by 100ms')
  assert.equal(at100ms.contentBlurPx, C.closeContentBlurMaxPx, 'content blur reaches 8px by 100ms')

  const at176ms = evaluateMotionFrame('closing', C.closeDropletOvershootPeakSec / C.closeDurationSec)
  approx(at176ms.dropletOvershootEnvelope, 1.0, 1e-6, 'close droplet overshoot peak')

  const at375ms = evaluateMotionFrame('closing', 0.375 / C.closeDurationSec)
  approx(at375ms.absorbed, 0.5, 1e-4, 'absorption midpoint at 375ms')
  approx(at375ms.bareGlassOpacity, 0.5, 1e-4, 'bareGlassOpacity fades with 1 - absorbed')

  const at450ms = evaluateMotionFrame('closing', 0.45 / C.closeDurationSec)
  assert.equal(at450ms.absorbed, 1, 'absorption complete at 450ms')
  assert.ok(at450ms.ringing > 0 && at450ms.ringing < 1, 'ringing damps between 400ms and 500ms')

  const at470ms = evaluateMotionFrame('closing', 0.47 / C.closeDurationSec)
  assert.equal(at470ms.triggerGlyphOpacity, 1, 'glyph back by 470ms')

  const at500ms = evaluateMotionFrame('closing', 1.0)
  assert.equal(at500ms.ringing, 0)
  assert.equal(at500ms.morphProgress, 1, 'ringing damps morphProgress exactly to 1 at 500ms')
})

test('Motion: point close fallback (200ms), mid-flight interruption continuity, ElasticPress, and reducedMotion', () => {
  const createMotionController = presets.createPopoverMorphController

  // Point-menu close (200ms)
  const pointCtrl = createMotionController()
  pointCtrl.open(false)
  pointCtrl.step(0.45)
  assert.equal(pointCtrl.getState().phase, 'open')
  pointCtrl.close()
  const pHalf = pointCtrl.step(0.1)
  assert.equal(pHalf.phase, 'closing')
  assert.equal(pHalf.hasControlSource, false)
  assert.equal(pHalf.contentBlurPx, 0)
  assert.ok(pHalf.pointScale < 1 && pHalf.pointScale > 0.8)
  const pEnd = pointCtrl.step(0.11)
  assert.equal(pEnd.phase, 'closed')
  pointCtrl.dispose()

  // Mid-flight open -> close continuity
  const ctrl = createMotionController()
  ctrl.open(true)
  const midOpen = ctrl.step(0.12)
  const snapshot = {
    platter: { center: { x: 200, y: 300 }, size: { width: 120, height: 140 }, radius: 30 },
    droplet: { center: { x: 240, y: 420 }, size: { width: 32, height: 24 }, radius: 12 },
    platterRadius: 30,
    blurPx: midOpen.contentBlurPx,
    elapsedFraction: midOpen.normalizedT,
  }
  ctrl.close(snapshot)
  const closeStart = ctrl.getState()
  approx(closeStart.contentOpacity, midOpen.contentOpacity, 1e-6, 'interrupt contentOpacity')
  approx(closeStart.contentBlurPx, midOpen.contentBlurPx, 1e-6, 'interrupt contentBlurPx')
  approx(closeStart.bareGlassOpacity, midOpen.bareGlassOpacity, 1e-6, 'interrupt bareGlassOpacity')
  assert.equal(ctrl.step(0.25).phase, 'closing', 'mid-flight close still runs full 500ms')
  assert.equal(ctrl.step(0.26).phase, 'closed', 'completes after 500ms total')

  // ElasticPress bounds
  // Sessile 没有导出弹性按压的默认上限，期望值沿用原 PRISM_CONSTANTS：增长 0.25 / 16px，拖拽 7/32
  const press = core.createElasticPressController()
  const box = { width: 120, height: 40 }
  press.pressStart(box)
  for (let i = 0; i < 40; i += 1) press.step(1 / 60)
  const maxGrowth = Math.min(0.25, 16 / 120)
  approx(press.getState().scaleX, 1 + maxGrowth, 1e-2, 'ElasticPress max growth')
  press.pressMove({ x: 1000, y: -1000 }, box)
  for (let i = 0; i < 40; i += 1) press.step(1 / 60)
  const dragLimit = (7 / 32) * 40
  const dragMag = Math.hypot(press.getState().offsetX, press.getState().offsetY)
  assert.ok(dragMag > 0 && dragMag < dragLimit, `rubber-band drag ${dragMag} must stay below ${dragLimit}`)
  press.pressRelease()
  for (let i = 0; i < 90; i += 1) press.step(1 / 60)
  approx(press.getState().scaleX, 1, 1e-3, 'ElasticPress returns to 1')
  approx(press.getState().offsetX, 0, 1e-2, 'ElasticPress offset returns to 0')

  // Reduced motion
  ctrl.setReducedMotion(true)
  ctrl.open(true)
  const rmMid = ctrl.step(0.075)
  assert.equal(rmMid.reducedMotion, true)
  assert.equal(rmMid.platterDipEnvelope, 0)
  assert.equal(rmMid.blurBumpPx, 0)
  assert.equal(rmMid.contentBlurPx, 0)
  assert.equal(rmMid.triggerGlyphBlurPx, 0)
  assert.equal(ctrl.step(0.08).phase, 'open', 'reducedMotion settles in 150ms')
  ctrl.dispose()
})

test('Geometry: placement modes (overAnchorEnd, overAnchorStart, belowPoint flip & viewport clamp)', () => {
  const computeTargetCardRect = presets.computePopoverTargetRect
  const menu = { size: { width: 220, height: 260 } }
  const viewportSize = { width: 400, height: 700 }

  // overAnchorEnd
  const endRect = computeTargetCardRect(
    { anchorRect: { x: 300, y: 400, width: 48, height: 40 }, placement: 'overAnchorEnd', viewportSize },
    menu,
  )
  assert.equal(endRect.x, 300 + 48 - 220)
  assert.equal(endRect.y, 400 - 8)

  // overAnchorStart clamped to left screenMargin (16) + safeInsets.left (10)
  const startRect = computeTargetCardRect(
    {
      anchorRect: { x: 8, y: 400, width: 48, height: 40 },
      placement: 'overAnchorStart',
      viewportSize,
      safeInsets: { top: 0, right: 0, bottom: 0, left: 10 },
    },
    menu,
  )
  assert.equal(startRect.x, 26)
  assert.equal(startRect.y, 392)

  // belowPoint flips above avoidRect when insufficient room below
  const flipped = computeTargetCardRect(
    {
      anchorRect: { x: 100, y: 550, width: 10, height: 10 },
      avoidRect: { x: 80, y: 520, width: 100, height: 40 },
      placement: 'belowPoint',
      viewportSize,
    },
    menu,
  )
  assert.equal(flipped.y, 520 - 8 - 260)
})

test('Geometry: rounded-box SDF and smooth-min (smin) identities', () => {
  const { computeRoundedBoxSdf, computeSmin } = core
  const box = { center: { x: 100, y: 100 }, size: { width: 80, height: 40 }, radius: 12 }

  // Top edge midpoint (100, 80) -> distance 0, normal (0, -1)
  const topEdge = computeRoundedBoxSdf({ x: 100, y: 80 }, box)
  approx(topEdge.distance, 0, 1e-6, 'top edge distance')
  approx(topEdge.normal.x, 0, 1e-6)
  approx(topEdge.normal.y, -1, 1e-6)

  // Outside right (150, 100) -> distance 10, normal (1, 0)
  const rightOut = computeRoundedBoxSdf({ x: 150, y: 100 }, box)
  approx(rightOut.distance, 10, 1e-6)
  approx(rightOut.normal.x, 1, 1e-6)
  approx(rightOut.normal.y, 0, 1e-6)

  // Inside center -> distance -20
  const center = computeRoundedBoxSdf({ x: 100, y: 100 }, box)
  approx(center.distance, -20, 1e-6)

  // smin at equal distances dA == dB == 4, k = 28 -> 4 - 28*0.25 = -3
  const eq = computeSmin(4, 4, { x: 1, y: 0 }, { x: 0, y: 1 }, 28)
  approx(eq.blendH, 0.5, 1e-6)
  approx(eq.distance, -3, 1e-6)
  approx(Math.hypot(eq.normal.x, eq.normal.y), 1, 1e-6)
  approx(eq.normal.x, Math.SQRT1_2, 1e-6)

  // smin with k=0 reduces to exact min
  const hard = computeSmin(2, 5, { x: -1, y: 0 }, { x: 0, y: 1 }, 0)
  assert.equal(hard.distance, 2)
  assert.deepEqual(hard.normal, { x: -1, y: 0 })
})

test('Geometry: open/close goo trajectory, beyondRound elongation, merge threshold, dip & overshoot', () => {
  const evaluateMotionFrame = presets.evaluatePopoverMotion
  const computeMorphGeometry = presets.computePopoverMorphGeometry
  const C = presets.POPOVER_MORPH_DEFAULTS

  const anchor = {
    anchorRect: { x: 260, y: 560, width: 96, height: 40 },
    placement: 'overAnchorEnd',
    bareSource: false,
    viewportSize: { width: 420, height: 720 },
  }
  const menu = { size: { width: 220, height: 280 } }

  // Open t=0: platter has beyondRound elongation (96 - 40 = 56) and droplet equals anchor
  const mStart = evaluateMotionFrame('opening', 0)
  const gStart = computeMorphGeometry(mStart, anchor, menu)
  approx(gStart.platter.size.width, 0.41 * 40 + 56, 1e-4, 'open start platter width + beyondRound')
  approx(gStart.droplet.size.width, 96, 1e-4)
  assert.equal(gStart.blendK, C.dropletBlendK)

  // Open resting (phase='open'): droplet inside deflated card, merged (mergeDepth >= 0), rimOpacity = 1
  const mOpen = evaluateMotionFrame('open', 1)
  const gOpen = computeMorphGeometry(mOpen, anchor, menu)
  assert.equal(gOpen.isMerged, true)
  assert.ok(gOpen.mergeDepth >= 0)
  assert.equal(gOpen.rimOpacity, 1)
  approx(gOpen.contentTransform.scale, 1, 1e-4)
  approx(gOpen.contentTransform.translateX, 0, 1e-4)
  approx(gOpen.contentTransform.translateY, 0, 1e-4)

  // bareSource inflates effective anchor by +24w, +12h unless inflateBareAnchor is false
  const bareAnchor = { ...anchor, bareSource: true }
  const gBareStart = computeMorphGeometry(mStart, bareAnchor, menu)
  approx(gBareStart.droplet.size.width, 96 + 24, 1e-4, 'bareSource droplet width inflated')
  approx(gBareStart.droplet.size.height, 40 + 12, 1e-4, 'bareSource droplet height inflated')
  const uninflatedBareAnchor = { ...bareAnchor, inflateBareAnchor: false }
  const gUninflatedBareStart = computeMorphGeometry(mStart, uninflatedBareAnchor, menu)
  approx(gUninflatedBareStart.droplet.size.width, 96, 1e-4, 'bareSource with inflateBareAnchor:false preserves width')
  approx(gUninflatedBareStart.droplet.size.height, 40, 1e-4, 'bareSource with inflateBareAnchor:false preserves height')

  // Close at 176ms: droplet overshoots past anchorCenter away from card
  const m176 = evaluateMotionFrame('closing', C.closeDropletOvershootPeakSec / C.closeDurationSec)
  const g176 = computeMorphGeometry(m176, anchor, menu)
  const anchorCenterY = anchor.anchorRect.y + anchor.anchorRect.height * 0.5
  const cardCenterY = g176.targetRect.y + g176.targetRect.height * 0.5
  // Card is above anchor (cardCenterY < anchorCenterY), so overshoot pushes droplet BELOW anchorCenterY
  assert.ok(cardCenterY < anchorCenterY)
  assert.ok(
    g176.droplet.center.y > anchorCenterY,
    `droplet (${g176.droplet.center.y}) should overshoot past anchorCenterY (${anchorCenterY})`,
  )

  // Close after absorption (460ms): blendK drops to 0
  const m460 = evaluateMotionFrame('closing', 0.46 / C.closeDurationSec)
  const g460 = computeMorphGeometry(m460, anchor, menu)
  assert.equal(g460.blendK, 0)
})

test('Sessile contour (computeFieldBounds / extractFieldContourPath): union bounds, merged rounded-rect, smin single bridge, and dual pinch-off loops', () => {
  const { computeFieldBounds, extractFieldContourPath } = core
  // 旧参数 (platter, droplet, blendK, isMerged) 换成 field：isMerged 时旧实现只画 platter，对应只含 platter 的 field
  const field = (primitives, blendK) => ({ primitives, blendK })

  const platter = { center: { x: 200, y: 200 }, size: { width: 120, height: 140 }, radius: 22 }
  const dropletNear = { center: { x: 200, y: 112 }, size: { width: 44, height: 44 }, radius: 22 }
  const dropletFar = { center: { x: 200, y: 40 }, size: { width: 32, height: 32 }, radius: 16 }
  const emptyDroplet = { center: { x: 0, y: 0 }, size: { width: 0, height: 0 }, radius: 0 }

  // Union bounds
  const emptyBounds = computeFieldBounds(field([platter, emptyDroplet], 0), 12)
  assert.deepEqual(emptyBounds, { x: 128, y: 118, width: 144, height: 164 })

  const unionBounds = computeFieldBounds(field([platter, dropletFar], 0), 8)
  assert.deepEqual(unionBounds, { x: 132, y: 16, width: 136, height: 262 })

  // Degenerate shapes yield empty path
  assert.equal(extractFieldContourPath(field([emptyDroplet, emptyDroplet], 28)), '')

  // Merged state emits exact analytical rounded-rect path (M...A...Z) shifted by offset
  const mergedPath = extractFieldContourPath(field([platter], 28), { x: 100, y: 80 })
  assert.match(mergedPath, /^M62 50/)
  assert.ok(mergedPath.includes('A22 22 0 0 1'), 'merged path should use exact arc segments')
  assert.equal((mergedPath.match(/M/g) ?? []).length, 1)
  assert.equal((mergedPath.match(/Z/g) ?? []).length, 1)

  // Unblended dual shapes emit two distinct rounded-rect subpaths
  const unblendedPath = extractFieldContourPath(field([platter, dropletFar], 0), { x: 0, y: 0 })
  assert.equal((unblendedPath.match(/M/g) ?? []).length, 2, 'blendK<=0.001 should emit 2 subpaths')
  assert.equal((unblendedPath.match(/Z/g) ?? []).length, 2)

  // Active smin bridge between overlapping/nearby platter & droplet -> single connected loop
  const bridgedPath = extractFieldContourPath(field([platter, dropletNear], 28), { x: 100, y: 80 })
  assert.equal((bridgedPath.match(/M/g) ?? []).length, 1, 'connected smin goo bridge must form 1 closed loop')
  assert.equal((bridgedPath.match(/Z/g) ?? []).length, 1)
  assert.ok(bridgedPath.includes('L'), 'Marching Squares contour should contain polygonal vertices')
  assert.equal(bridgedPath.includes('NaN'), false, 'contour path must not contain NaN')

  // Active smin with wide separation -> dual pinched-off closed loops
  const pinchedPath = extractFieldContourPath(field([platter, dropletFar], 28), { x: 0, y: 0 })
  assert.equal((pinchedPath.match(/M/g) ?? []).length, 2, 'widely separated droplet should pinch off into 2 closed loops')
  assert.equal((pinchedPath.match(/Z/g) ?? []).length, 2)
  assert.equal(pinchedPath.includes('NaN'), false, 'pinched-off path must not contain NaN')
})

test('Sessile popover geometry (computePopoverTargetRect / computePopoverMorphGeometry): targetRectOverride bypasses placement clamping/flipping cleanly', () => {
  const computeTargetCardRect = presets.computePopoverTargetRect
  const computeMorphGeometry = presets.computePopoverMorphGeometry

  const override = { x: 912, y: 42, width: 280, height: 282 }
  const anchor = {
    anchorRect: { x: 1140, y: 12, width: 40, height: 40 },
    placement: 'belowPoint',
    point: { x: 1160, y: 32 },
    viewportSize: { width: 800, height: 600 },
    bareSource: false,
  }
  const menu = {
    size: { width: 280, height: 282 },
    cornerRadius: 24,
    targetRectOverride: override,
  }

  const resolved = computeTargetCardRect(anchor, menu)
  assert.deepEqual(resolved, override, 'targetRectOverride must be returned verbatim without viewport clamping')
  resolved.x = 0
  assert.equal(override.x, 912, 'returned rect must be a shallow copy, not aliased to targetRectOverride')

  const gEnd = computeMorphGeometry(
    { phase: 'opening', normalizedT: 1, morphProgress: 1, cornerProgress: 1, ringing: 0, absorbed: 0, closeBlendRamp: 0, platterDipEnvelope: 0, dropletOvershootEnvelope: 0, blurBumpPx: 0, settled: 1, contentOpacity: 1, contentBlurPx: 0, triggerGlyphOpacity: 0, triggerGlyphBlurPx: 0, bareGlassOpacity: 0, pointScale: 1, pressScaleX: 1, pressScaleY: 1, pressOffsetX: 0, pressOffsetY: 0, pressLift: 0, isAnimating: false },
    anchor,
    menu,
  )
  approx(gEnd.platter.center.x, override.x + override.width * 0.5, 1e-4, 'settled platter cx matches override')
  approx(gEnd.platter.center.y, override.y + override.height * 0.5, 1e-4, 'settled platter cy matches override')
})

test('Sessile popover motion (createPopoverMorphController): mid-closing open() resumes smoothly without snapping to closed start', () => {
  const createMotionController = presets.createPopoverMorphController

  // Standard spring mode: open -> step to open -> close -> mid-close -> re-open
  const ctrl = createMotionController({ reducedMotion: false })
  ctrl.open(true)
  ctrl.step(0.6)
  assert.equal(ctrl.getState().phase, 'open')

  ctrl.close()
  ctrl.step(0.14) // mid-closing where morphProgress < 1
  const midClose = ctrl.getState()
  assert.equal(midClose.phase, 'closing')
  assert.ok(midClose.morphProgress > 0.1 && midClose.morphProgress < 0.9, `expected mid-close morphProgress in (0.1, 0.9), got ${midClose.morphProgress}`)

  const expectedOpenFraction = Math.min(Math.max(1 - midClose.morphProgress, 0), 0.95)
  ctrl.open(true)
  const resumed = ctrl.getState()
  assert.equal(resumed.phase, 'opening')
  approx(resumed.morphProgress, expectedOpenFraction, 0.015, 're-open from mid-close resumes open progress without jump')
  assert.ok(resumed.elapsedSec > 0, 're-open from mid-close advances elapsedSec via solveOpenElapsedForProgress')

  // Fresh open from closed still starts at t = 0
  ctrl.reset()
  ctrl.open(true)
  assert.equal(ctrl.getState().elapsedSec, 0)
  assert.equal(ctrl.getState().morphProgress, 0)
  ctrl.dispose()

  // Reduced motion mode: re-open during closing preserves settled crossfade opacity cleanly
  const rmCtrl = createMotionController({ reducedMotion: true })
  rmCtrl.open(true)
  rmCtrl.step(0.2)
  assert.equal(rmCtrl.getState().phase, 'open')
  rmCtrl.close()
  rmCtrl.step(0.06)
  const rmMidClose = rmCtrl.getState()
  assert.ok(rmMidClose.settled > 0.05 && rmMidClose.settled < 0.95)
  rmCtrl.open(true)
  const rmResumed = rmCtrl.getState()
  assert.equal(rmResumed.phase, 'opening')
  approx(rmResumed.settled, rmMidClose.settled, 1e-4, 'reduced-motion mid-close re-open preserves settled crossfade')
  rmCtrl.dispose()
})

test('Sessile overlay renderer (createGlassOverlayRenderer): GLSL safePow/transparent interior, MPL-2.0 headers, and 2D fallback', () => {
  const { OVERLAY_VERTEX_SHADER, OVERLAY_FRAGMENT_SHADER, createGlassOverlayRenderer } = core

  assert.ok(OVERLAY_VERTEX_SHADER.includes('#version 300 es'))
  assert.ok(OVERLAY_FRAGMENT_SHADER.includes('#version 300 es'))
  assert.ok(OVERLAY_FRAGMENT_SHADER.includes('safePow('), 'overlay shader must guard pow() with safePow')
  const powCalls = OVERLAY_FRAGMENT_SHADER.match(/\bpow\s*\(/g) ?? []
  assert.equal(powCalls.length, 1, 'pow() may only appear inside safePow() definition')
  assert.equal(/\?\s*SdfSample\b/.test(OVERLAY_FRAGMENT_SHADER), false, 'avoid struct ternaries for ANGLE/D3D11 compatibility')
  assert.ok(OVERLAY_FRAGMENT_SHADER.includes('outsideMask') && OVERLAY_FRAGMENT_SHADER.includes('inset < 5.0'), 'overlay shader must keep flat interior transparent')

  // Clean-room MPL-2.0 headers across src/components/glass/morph/
  for (const file of ['refractFilter.tsx']) {
    const src = readFileSync(new URL(`../src/components/glass/morph/${file}`, import.meta.url), 'utf8')
    assert.ok(src.includes('SPDX-License-Identifier: MPL-2.0'), `${file} must declare MPL-2.0`)
    assert.equal(src.includes('GPL-3.0'), false, `${file} must not carry GPL-3.0 header`)
  }

  // Automatic 2D Canvas fallback when WebGL2 is unavailable
  const calls = []
  const fake2d = {
    setTransform: (...a) => calls.push(['setTransform', ...a]),
    clearRect: (...a) => calls.push(['clearRect', ...a]),
    save: () => calls.push(['save']),
    restore: () => calls.push(['restore']),
    beginPath: () => calls.push(['beginPath']),
    rect: (...a) => calls.push(['rect', ...a]),
    roundRect: (...a) => calls.push(['roundRect', ...a]),
    clip: (...a) => calls.push(['clip', ...a]),
    fill: () => calls.push(['fill', fake2d.globalCompositeOperation]),
    stroke: () => calls.push(['stroke']),
    translate: (...a) => calls.push(['translate', ...a]),
    moveTo: (...a) => calls.push(['moveTo', ...a]),
    lineTo: (...a) => calls.push(['lineTo', ...a]),
    arc: (...a) => calls.push(['arc', ...a]),
    closePath: () => calls.push(['closePath']),
    globalCompositeOperation: 'source-over',
    createLinearGradient: () => ({ addColorStop() {} }),
    shadowColor: '',
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
  }
  const listeners = new Map()
  const mockCanvas = {
    width: 10,
    height: 10,
    addEventListener: (k, fn) => listeners.set(k, fn),
    removeEventListener: (k) => listeners.delete(k),
    getContext: (kind) => (kind === '2d' ? fake2d : null),
  }
  const renderer = createGlassOverlayRenderer()
  const caps = renderer.mount(mockCanvas)
  assert.equal(caps.webgl2, false)
  assert.ok(caps.fallbackNotice && caps.fallbackNotice.includes('2D Canvas'))

  const platter = { center: { x: 100, y: 120 }, size: { width: 160, height: 180 }, radius: 22 }
  const droplet = { center: { x: 100, y: 30 }, size: { width: 40, height: 40 }, radius: 20 }
  const geometry = presets.computePopoverMorphGeometry(
    { phase: 'opening', normalizedT: 0.4, morphProgress: 0.5, cornerProgress: 0.4, ringing: 0, absorbed: 0, closeBlendRamp: 0, platterDipEnvelope: 0, dropletOvershootEnvelope: 0, blurBumpPx: 0, settled: 0, contentOpacity: 0.5, contentBlurPx: 1, triggerGlyphOpacity: 0, triggerGlyphBlurPx: 0, bareGlassOpacity: 0, pointScale: 1, pressScaleX: 1, pressScaleY: 1, pressOffsetX: 0, pressOffsetY: 0, pressLift: 0, isAnimating: true },
    { anchorRect: { x: 80, y: 10, width: 40, height: 40 }, placement: 'overAnchorEnd', viewportSize: { width: 400, height: 400 } },
    { size: { width: 160, height: 180 }, cornerRadius: 22 },
  )
  const field = { ...geometry.field, primitives: [platter, droplet] }

  renderer.render({
    viewport: { width: 220, height: 240 },
    dpr: 2,
    field,
    material: core.DEFAULT_OPTICAL_MATERIALS.dark.frosted,
    opacity: 1,
  })
  assert.equal(mockCanvas.width, 440)
  assert.equal(mockCanvas.height, 480)
  // Sessile 不再用 clip('evenodd')，改为 destination-out 擦掉玻璃内部的投影，同样保证投影只落在外侧
  assert.ok(calls.some((c) => c[0] === 'fill' && c[1] === 'destination-out'), '2D fallback shadow must stay outside the glass')
  assert.ok(calls.some((c) => c[0] === 'stroke'), '2D fallback must draw hairline/rim strokes')

  calls.length = 0
  renderer.render({
    viewport: { width: 220, height: 240 },
    dpr: 2,
    field,
    material: core.DEFAULT_OPTICAL_MATERIALS.dark.frosted,
    opacity: 0,
  })
  assert.ok(calls.some((c) => c[0] === 'clearRect'), 'opacity <= 0.001 should clear canvas cleanly')
  renderer.dispose()
  assert.equal(listeners.size, 0, 'dispose must remove webglcontext listeners')
})

test('geometry externalTrigger: open tugs & returns to 1:1 anchor, close catches & overshoots past anchor, externalTrigger=false keeps PoC behavior', () => {
  const computeTargetCardRect = presets.computePopoverTargetRect
  const computeMorphGeometry = presets.computePopoverMorphGeometry
  const anchor = {
    anchorRect: { x: 420, y: 26, width: 112, height: 36 },
    placement: 'belowPoint',
    point: { x: 476, y: 44 },
    viewportSize: { width: 1280, height: 800 },
    bareSource: false,
  }
  const menu = {
    size: { width: 240, height: 280 },
    cornerRadius: 24,
  }
  const targetCardRect = computeTargetCardRect(anchor, menu)
  const anchorCenter = {
    x: anchor.anchorRect.x + anchor.anchorRect.width * 0.5,
    y: anchor.anchorRect.y + anchor.anchorRect.height * 0.5,
  }
  const dirToCard = {
    x: targetCardRect.x + targetCardRect.width * 0.5 - anchorCenter.x,
    y: targetCardRect.y + targetCardRect.height * 0.5 - anchorCenter.y,
  }
  const dirLen = Math.hypot(dirToCard.x, dirToCard.y)
  const dirUnit = { x: dirToCard.x / dirLen, y: dirToCard.y / dirLen }

  const makeMotion = (phase, morphProgress, extra = {}) => ({
    phase,
    hasControlSource: true,
    normalizedT: morphProgress,
    morphProgress,
    cornerProgress: morphProgress,
    ringing: 0,
    absorbed: 0,
    closeBlendRamp: 1,
    platterDipEnvelope: 0,
    dropletOvershootEnvelope: 0,
    blurBumpPx: 0,
    settled: morphProgress >= 1 ? 1 : 0,
    contentOpacity: 1,
    contentBlurPx: 0,
    triggerGlyphOpacity: 1,
    triggerGlyphBlurPx: 0,
    bareGlassOpacity: 0,
    pointScale: 1,
    pressScaleX: 1,
    pressScaleY: 1,
    pressOffsetX: 0,
    pressOffsetY: 0,
    pressLift: 0,
    isAnimating: phase === 'opening' || phase === 'closing',
    ...extra,
  })

  // Opening mid-flight with externalTrigger: true tugs droplet toward card and keeps droplet unmerged
  const openMid = computeMorphGeometry(
    makeMotion('opening', 0.25),
    { ...anchor, externalTrigger: true },
    menu,
  )
  const openMidDot =
    (openMid.droplet.center.x - anchorCenter.x) * dirUnit.x +
    (openMid.droplet.center.y - anchorCenter.y) * dirUnit.y
  assert.ok(openMidDot > 2, `externalTrigger open tug should pull toward card, got projection ${openMidDot}`)
  assert.equal(openMid.isMerged, false, 'externalTrigger open must never switch to merged (must keep droplet visible)')
  assert.ok(openMid.blendK > 0, 'externalTrigger open mid-flight should have positive blendK goo bridge')
  assert.ok(
    Math.abs(openMid.droplet.size.width / anchor.anchorRect.width - 1) > 0.01 ||
      Math.abs(openMid.droplet.size.height / anchor.anchorRect.height - 1) > 0.01,
    'externalTrigger open mid-flight should elastically stretch droplet',
  )
  assert.ok(
    Math.abs(openMid.glyphTransform.scale - 1) > 0.005,
    `externalTrigger open mid-flight should scale glyph with droplet, got ${openMid.glyphTransform.scale}`,
  )

  // Opening settled (phase='open'): returns cleanly to anchorCenter at 1:1 scale
  const openSettled = computeMorphGeometry(
    presets.evaluatePopoverMotion('open', 1),
    { ...anchor, externalTrigger: true },
    menu,
  )
  approx(openSettled.droplet.center.x, anchorCenter.x, 0.01, 'settled open droplet cx matches anchorCenter')
  approx(openSettled.droplet.center.y, anchorCenter.y, 0.01, 'settled open droplet cy matches anchorCenter')
  approx(openSettled.droplet.size.width, anchor.anchorRect.width, 0.01, 'settled open droplet width matches anchor')
  approx(openSettled.droplet.size.height, anchor.anchorRect.height, 0.01, 'settled open droplet height matches anchor')
  approx(openSettled.glyphTransform.scale, 1, 1e-4, 'settled open glyphTransform.scale returns to 1')

  // Closing with externalTrigger: true catches goo bridge toward card early, then overshoots PAST anchorCenter away from card
  const closeSnap = {
    cardRect: targetCardRect,
    cardRadius: menu.cornerRadius,
    droplet: { center: anchorCenter, size: { width: anchor.anchorRect.width, height: anchor.anchorRect.height }, radius: 18 },
    contentOpacity: 1,
  }
  const closeEarly = computeMorphGeometry(
    makeMotion('closing', 0.22, { dropletOvershootEnvelope: 0.05 }),
    { ...anchor, externalTrigger: true },
    menu,
    closeSnap,
  )
  const closeEarlyDot =
    (closeEarly.droplet.center.x - anchorCenter.x) * dirUnit.x +
    (closeEarly.droplet.center.y - anchorCenter.y) * dirUnit.y
  assert.ok(closeEarlyDot > 1, `externalTrigger close catch should pull toward card, got ${closeEarlyDot}`)
  assert.equal(closeEarly.isMerged, false, 'externalTrigger close must keep droplet visible')

  const closeLate = computeMorphGeometry(
    makeMotion('closing', 0.72, { dropletOvershootEnvelope: 0.85 }),
    { ...anchor, externalTrigger: true },
    menu,
    closeSnap,
  )
  const closeLateDot =
    (closeLate.droplet.center.x - anchorCenter.x) * dirUnit.x +
    (closeLate.droplet.center.y - anchorCenter.y) * dirUnit.y
  assert.ok(closeLateDot < -0.5, `externalTrigger close overshoot should pass anchorCenter away from card, got ${closeLateDot}`)

  // PoC externalTrigger: false keeps original merged-platter contract when open on overAnchorEnd placement
  const pocSettled = computeMorphGeometry(
    presets.evaluatePopoverMotion('open', 1),
    {
      ...anchor,
      anchorRect: { x: 420, y: 360, width: 96, height: 40 },
      placement: 'overAnchorEnd',
      externalTrigger: false,
    },
    menu,
  )
  assert.equal(pocSettled.isMerged, true, 'externalTrigger=false must keep original PoC isMerged=true when open')
})

test('contour extractFieldContourPath: 128-step bisected Marching Squares achieves < 0.1px SDF accuracy on active goo bridge', () => {
  const platter = { center: { x: 240, y: 220 }, size: { width: 220, height: 260 }, radius: 24 }
  const droplet = { center: { x: 240, y: 74 }, size: { width: 112, height: 38 }, radius: 19 }
  const blendK = 28
  const path = core.extractFieldContourPath({ primitives: [platter, droplet], blendK }, { x: 0, y: 0 })
  assert.ok(path.startsWith('M'), 'expected SVG contour path')

  const tokens = [...path.matchAll(/[ML](-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g)]
  assert.ok(tokens.length > 40, `expected dense smoothed contour, got ${tokens.length} vertices`)

  let maxAbsSdf = 0
  for (const [, xs, ys] of tokens) {
    const pt = { x: Number(xs), y: Number(ys) }
    const sdfA = core.computeRoundedBoxSdf(pt, platter)
    const sdfB = core.computeRoundedBoxSdf(pt, droplet)
    const smin = core.computeSmin(sdfA.distance, sdfB.distance, sdfA.normal, sdfB.normal, blendK)
    maxAbsSdf = Math.max(maxAbsSdf, Math.abs(smin.distance))
  }
  assert.ok(
    maxAbsSdf < 0.1,
    `expected < 0.1px SDF error on bisected Marching Squares contour, got ${maxAbsSdf.toFixed(4)}px`,
  )
})

test('Route B3 MorphRefractFilter helpers & Popover integration contracts', () => {
  const {
    buildCircularBevelTable,
    buildColorOpticsMatrix,
    parseCssFilterOptics,
    parseCssBoxShadow,
    parseCssGlassSurface,
    interpolateCssGlassSurfaceToMaterial: interpolateCssGlassSurfaceToOverlay,
    buildContourAlphaDataUrl,
  } = core

  // Circular-bevel lookup table: monotonically non-decreasing, antisymmetric around 0.5, calibrated Sobel divisor
  const b20 = buildCircularBevelTable(20, 8.5)
  const vals = b20.tableValues.split(' ').map(Number)
  assert.equal(vals.length, 21)
  approx(vals[0], 0, 1e-4, 'bevel table start')
  approx(vals[10], 0.5, 1e-3, 'bevel table midpoint')
  approx(vals[20], 1, 1e-4, 'bevel table end')
  for (let i = 1; i < vals.length; i++) {
    assert.ok(vals[i] >= vals[i - 1], `bevel table must be monotonic at ${i}`)
  }
  assert.ok(b20.divisor > 1.0 && b20.divisor < 2.0, `calibrated divisor in expected range, got ${b20.divisor}`)
  approx(b20.peakSobelEffective / b20.divisor, 0.48, 0.02, 'Sobel peak normalizes to 0.48 half-range')

  // Generic computed CSS filter & box-shadow parsers adapt to any preset/theme/override automatically
  const prismVeil = parseCssFilterOptics('blur(12px) saturate(1.75) brightness(1.1) contrast(0.94) url("#lens") blur(0.5px)')
  approx(prismVeil.brightness, 1.1, 1e-4)
  approx(prismVeil.contrast, 0.94, 1e-4)
  assert.equal(prismVeil.contrastFirst, false)

  const clearLightVeil = parseCssFilterOptics('blur(3px) saturate(1.6) contrast(0.82) brightness(1.1) url("#lens") blur(0.5px)')
  approx(clearLightVeil.brightness, 1.1, 1e-4)
  approx(clearLightVeil.contrast, 0.82, 1e-4)
  assert.equal(clearLightVeil.contrastFirst, true)

  const parsedPrismShadow = parseCssBoxShadow(
    'rgba(255, 255, 255, 0.34) 0px 1.5px 3px -0.5px inset, rgba(255, 255, 255, 0.16) 0px -1px 2px -0.5px inset, rgba(0, 0, 0, 0.34) 0px 0px 0px 0.5px, rgba(0, 0, 0, 0.45) 0px 24px 60px 0px',
  )
  assert.equal(parsedPrismShadow.length, 4)

  const prismSurface = parseCssGlassSurface({
    backdropFilter: 'blur(12px) saturate(1.75) brightness(1.1) contrast(0.94)',
    borderWidthPx: 1,
    borderColor: 'rgba(255, 255, 255, 0.32)',
    boxShadow:
      'rgba(255, 255, 255, 0.34) 0px 1.5px 3px -0.5px inset, rgba(255, 255, 255, 0.16) 0px -1px 2px -0.5px inset, rgba(0, 0, 0, 0.34) 0px 0px 0px 0.5px, rgba(0, 0, 0, 0.45) 0px 24px 60px 0px',
  })
  const prismOverlay = interpolateCssGlassSurfaceToOverlay(
    core.DEFAULT_OPTICAL_MATERIALS.dark.frosted,
    prismSurface,
    prismSurface,
    1,
  )
  assert.equal(prismOverlay.borderWidth, 1)
  assert.deepEqual(prismOverlay.borderRgba, [1, 1, 1, 0.32])
  approx(prismOverlay.hairlineWidth, 0.5, 1e-4)
  approx(prismOverlay.hairlineSideAlpha, 0.34, 1e-4)
  approx(prismOverlay.hairlineFlatAlpha, 0.34, 1e-4)
  approx(prismOverlay.shadowBlur, 60, 1e-4)
  approx(prismOverlay.shadowOffsetY, 24, 1e-4)
  approx(prismOverlay.shadowAlpha, 0.45, 1e-4)
  assert.ok(prismOverlay.rimOpacity > 0.2 && prismOverlay.rimOpacity < 0.3, `expected Gaussian-attenuated Prism rimOpacity, got ${prismOverlay.rimOpacity}`)

  const clearDarkSurface = parseCssGlassSurface({
    backdropFilter: 'blur(2px) saturate(1.6) brightness(0.76)',
    borderWidthPx: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    boxShadow: 'rgba(255, 255, 255, 0.45) 0px 0px 6px -2px inset, rgba(0, 0, 0, 0.28) 0px 0px 0px 0.5px, rgba(0, 0, 0, 0.45) 0px 24px 60px 0px',
  })
  const clearDarkOverlay = interpolateCssGlassSurfaceToOverlay(
    core.DEFAULT_OPTICAL_MATERIALS.dark.frosted,
    clearDarkSurface,
    clearDarkSurface,
    1,
  )
  assert.equal(clearDarkOverlay.borderWidth, 1)
  approx(clearDarkOverlay.borderRgba[3], 0.14, 1e-4)
  approx(clearDarkOverlay.hairlineSideAlpha, 0.28, 1e-4)
  assert.equal(clearDarkOverlay.rimFocus, 0)
  approx(clearDarkOverlay.rimOpacity, 0.1136, 0.015)
  assert.equal(clearDarkOverlay.rimTail, 0)

  const clearLightSurface = parseCssGlassSurface({
    backdropFilter: 'blur(3px) saturate(1.6) contrast(0.82) brightness(1.1)',
    borderWidthPx: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    boxShadow: 'rgba(255, 255, 255, 0.65) 0px 0px 6px -2px inset, rgba(0, 0, 0, 0.08) 0px 4px 14px 0px',
  })
  const clearLightOverlay = interpolateCssGlassSurfaceToOverlay(
    core.DEFAULT_OPTICAL_MATERIALS.light.frosted,
    clearLightSurface,
    clearLightSurface,
    1,
  )
  assert.equal(clearLightOverlay.borderWidth, 1)
  approx(clearLightOverlay.borderRgba[3], 0.08, 1e-4)
  assert.equal(clearLightOverlay.hairlineWidth, 0)
  assert.equal(clearLightOverlay.rimFocus, 0)
  approx(clearLightOverlay.rimOpacity, 0.1641, 0.015)
  assert.equal(clearLightOverlay.rimTail, 0)

  const zeroDropSurface = parseCssGlassSurface({
    backdropFilter: 'blur(12px) saturate(1.75) brightness(1.1) contrast(0.94)',
    borderWidthPx: 1,
    borderColor: 'rgba(255, 255, 255, 0.32)',
    boxShadow:
      'rgba(255, 255, 255, 0.34) 0px 1.5px 3px -0.5px inset, rgba(255, 255, 255, 0.16) 0px -1px 2px -0.5px inset, rgba(0, 0, 0, 0.34) 0px 0px 0px 0.5px, rgba(0, 0, 0, 0) 0px 0px 0px 0px',
  })
  const zeroDropOverlay = interpolateCssGlassSurfaceToOverlay(
    core.DEFAULT_OPTICAL_MATERIALS.dark.frosted,
    zeroDropSurface,
    zeroDropSurface,
    1,
  )
  assert.equal(zeroDropOverlay.shadowAlpha, 0)
  assert.equal(zeroDropOverlay.shadowBlur, 0)
  approx(zeroDropOverlay.hairlineSideAlpha, 0.34, 1e-4)

  const matrixNums = buildColorOpticsMatrix(1, 1, 1).trim().split(/\s+/).map(Number)
  assert.equal(matrixNums.length, 20)
  approx(matrixNums[0], 1, 1e-4)
  approx(matrixNums[6], 1, 1e-4)
  approx(matrixNums[12], 1, 1e-4)
  approx(matrixNums[18], 1, 1e-4)

  const url = buildContourAlphaDataUrl('M0 0 L10 0 Z', 120.4, 80.2)
  assert.ok(url.startsWith('data:image/svg+xml;charset=utf-8,'))
  const decoded = decodeURIComponent(url.slice('data:image/svg+xml;charset=utf-8,'.length))
  assert.ok(decoded.includes('viewBox="0 0 120 80"') && decoded.includes('fill="white"'))

  // Popover places backdrop-filter: url(#...) on unclipped morphBackdropRef sibling while morphGlassRef keeps clipPath veil
  const popoverSrc = readFileSync(new URL('../src/components/ui/Popover.tsx', import.meta.url), 'utf8')
  const contextMenuSrc = readFileSync(new URL('../src/components/ui/ContextMenu.tsx', import.meta.url), 'utf8')
  const glassSrc = readFileSync(new URL('../src/components/glass/Glass.tsx', import.meta.url), 'utf8')
  assert.ok(popoverSrc.includes('morphBackdropRef'), 'Popover must mount separate unclipped morphBackdropRef for Route B3')
  assert.ok(popoverSrc.includes('<MorphRefractFilter'), 'Popover must render MorphRefractFilter')
  assert.ok(popoverSrc.includes('profile={tuning.profile}') && popoverSrc.includes('ior={tuning.ior}'), 'Popover must forward Snell profile & ior from glassTuning')
  assert.ok(contextMenuSrc.includes('profile={tuning.profile}') && contextMenuSrc.includes('ior={tuning.ior}'), 'ContextMenu must forward Snell profile & ior from glassTuning')
  assert.ok(
    popoverSrc.includes('scaleMultiplier={GLASS_REFRACT_SCALE_MULTIPLIER}') &&
      contextMenuSrc.includes('scaleMultiplier={GLASS_REFRACT_SCALE_MULTIPLIER}') &&
      glassSrc.includes('GLASS_REFRACT_SCALE_MULTIPLIER'),
    'Static Glass, Popover, and ContextMenu must share GLASS_REFRACT_SCALE_MULTIPLIER so refraction amplitude stays identical',
  )
  assert.match(popoverSrc, /refractHandle\??\.updateFrame\(/, 'Popover must drive MorphRefractFilter per frame')
  assert.ok(popoverSrc.includes('interpolateCssGlassSurfaceToMaterial'), 'Popover must derive overlay styles from live computed CSS')
  const glyphHostIdx = popoverSrc.indexOf('ref={glyphHostRef}')
  const morphSurfaceIdx = popoverSrc.indexOf('ref={morphSurfaceRef}')
  const morphBackdropIdx = popoverSrc.indexOf('ref={morphBackdropRef}')
  const morphGlassIdx = popoverSrc.indexOf('ref={morphGlassRef}')
  const motionGlassIdx = popoverSrc.indexOf('<MotionGlass')
  assert.ok(
    morphSurfaceIdx > 0 && morphSurfaceIdx < morphBackdropIdx && morphBackdropIdx < morphGlassIdx && morphGlassIdx < glyphHostIdx && glyphHostIdx < motionGlassIdx,
    'Popover must layer morphSurfaceRef -> morphBackdropRef -> morphGlassRef -> glyphHostRef -> MotionGlass for padded bare trigger handoff',
  )
  assert.ok(
    popoverSrc.includes('inflateBareAnchor') && popoverSrc.includes('bareSurfaceCss'),
    'Popover must wire inflateBareAnchor and bareSurfaceCss so visible padded buttons do not inflate on close/open',
  )
  assert.ok(
    !popoverSrc.includes("clone.style.visibility = 'visible'") && popoverSrc.includes("clone.style.visibility = 'inherit'"),
    'syncClonedGlyph must keep clone.style.visibility inherited so glyphHostEl visibility:hidden hides the clone cleanly',
  )
  assert.match(
    popoverSrc,
    /glyphHostEl\.style\.visibility = 'hidden'\s+glyphHostEl\.style\.opacity = '0'\s+glyphHostEl\.style\.filter = 'none'/,
    'Popover must zero glyphHostEl opacity and filter when hiding glyphHostEl',
  )
  assert.ok(!popoverSrc.includes('data-morph-debug'), 'Temporary data-morph-debug probe must not remain in Popover.tsx')
  assert.ok(
    popoverSrc.includes('useAppearance((s) => s.popoverMotion)') && /reduced\s*=\s*systemReduced\s*\|\|\s*!popoverMotion/.test(popoverSrc),
    'Popover must disable morph transition when popoverMotion setting is turned off',
  )
  const refractFilterSrc = readFileSync(new URL('../src/components/glass/morph/refractFilter.tsx', import.meta.url), 'utf8')
  assert.ok(
    refractFilterSrc.includes('createRefractFilterController') && refractFilterSrc.includes('updateConfig'),
    'MorphRefractFilter must delegate the SVG graph to @sessile/dom and sync glass tuning into it',
  )
  const { document } = new JSDOM('<!doctype html><body></body>').window
  const filter = dom.createRefractFilterController({ id: 'morph-test', document, bezel: 30, strength: 1.32, profile: 'squircle', ior: 1.5, dispersion: 0 })
  filter.mount()
  filter.updateFrame({
    bounds: { x: 0, y: 0, width: 80, height: 60 },
    field: { blendK: 0, primitives: [{ center: { x: 40, y: 30 }, size: { width: 40, height: 24 }, radius: 12 }] },
    blurSigma: 4,
    saturate: 1.6,
    brightness: 1,
    contrast: 1,
  })
  const expectedLut = core.resolveRefractionProfileLut({ profile: 'squircle', ior: 1.5, thicknessRatio: 1.32 })
  approx(
    Number(document.querySelector('#morph-test feDisplacementMap').getAttribute('scale')),
    2 * 12 * expectedLut.maxDisplacementRatio,
    1e-9,
    'MorphRefractFilter must resolve per-frame bezel and Snell LUT scale cleanly',
  )
  assert.equal(
    document.querySelector('#morph-test feGaussianBlur[in="refractRaw"]')?.getAttribute('stdDeviation'),
    '0.5',
    'MorphRefractFilter must include 0.5px post-refraction smoothing matching resting Glass',
  )
  filter.dispose()
})

function decodeStoredRgbaPng(dataUrl) {
  const prefix = 'data:image/png;base64,'
  assert.ok(dataUrl.startsWith(prefix), 'expected PNG data URL')
  const bytes = Buffer.from(dataUrl.slice(prefix.length), 'base64')
  assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], 'valid PNG signature')

  let offset = 8
  let width = 0
  let height = 0
  const idatParts = []
  let sawIend = false
  while (offset < bytes.length) {
    const len = bytes.readUInt32BE(offset)
    const type = bytes.subarray(offset + 4, offset + 8).toString('ascii')
    const dataStart = offset + 8
    const dataEnd = dataStart + len
    const storedCrc = bytes.readUInt32BE(dataEnd)
    const computedCrc = zlibCrc32(bytes.subarray(offset + 4, dataEnd)) >>> 0
    assert.equal(storedCrc, computedCrc, `CRC mismatch in PNG chunk ${type}`)
    if (type === 'IHDR') {
      width = bytes.readUInt32BE(dataStart)
      height = bytes.readUInt32BE(dataStart + 4)
      assert.equal(bytes[dataStart + 8], 8, '8-bit depth')
      assert.equal(bytes[dataStart + 9], 6, 'RGBA color type 6')
    } else if (type === 'IDAT') {
      idatParts.push(bytes.subarray(dataStart, dataEnd))
    } else if (type === 'IEND') {
      sawIend = true
      break
    }
    offset = dataEnd + 4
  }
  assert.ok(sawIend && idatParts.length > 0, 'PNG must contain IDAT and IEND')
  const raw = inflateSync(Buffer.concat(idatParts))
  const stride = 1 + width * 4
  assert.equal(raw.length, height * stride, 'inflated scanline byte count matches dimensions')
  for (let y = 0; y < height; y++) {
    assert.equal(raw[y * stride], 0, `row ${y} uses PNG filter 0`)
  }
  const pixelAt = (px, py) => {
    const idx = py * stride + 1 + px * 4
    return { r: raw[idx], g: raw[idx + 1], b: raw[idx + 2], a: raw[idx + 3] }
  }
  return { width, height, raw, pixelAt }
}

test('createRefractMapBuilder: stored PNG validity (>65535B multi-block), inward normal polarity, bevel decay, inward AA alpha, smin neck, and cache reuse', () => {
  const builder = core.createRefractMapBuilder()
  // 旧参数 (platter, droplet, blendK, isMerged) 换成 field：droplet 为 null 或 isMerged 时只含 platter
  const build = ({ platter, droplet, blendK, isMerged, ...rest }) =>
    builder.build({ ...rest, field: { primitives: droplet && !isMerged ? [platter, droplet] : [platter], blendK } })

  // 1. Multi-block (>65535B) 0.5x stored PNG validity on 400x400 CSS bounds (200x200 PNG -> 160,200 scanline bytes)
  const bounds = { x: 0, y: 0, width: 400, height: 400 }
  const platter = { center: { x: 200, y: 200 }, size: { width: 240, height: 240 }, radius: 24 }
  const singleRes = build({
    bounds,
    platter,
    droplet: null,
    blendK: 0,
    isMerged: true,
    bezel: 20,
    mapScale: 0.5,
  })
  assert.equal(singleRes.changed, true)
  assert.equal(singleRes.width, 400)
  assert.equal(singleRes.height, 400)

  const decoded = decodeStoredRgbaPng(singleRes.dataUrl)
  assert.equal(decoded.width, 200)
  assert.equal(decoded.height, 200)

  // Map CSS world point (wx, wy) -> PNG pixel index (step=2 at 0.5x, pixel center at x = 2*(px+0.5))
  const sampleCss = (wx, wy) => {
    const px = Math.round((wx - bounds.x) / 2 - 0.5)
    const py = Math.round((wy - bounds.y) / 2 - 0.5)
    return decoded.pixelAt(px, py)
  }

  // Platter spans [80..320] x [80..320], bezel=20 -> interior starts at <= 100 / >= 300
  // Left bevel edge (wx=83, wy=200): inward normal points +X -> R > 128, G == 128
  const leftEdge = sampleCss(83, 200)
  assert.ok(leftEdge.r > 135 && Math.abs(leftEdge.g - 128) <= 1, `left bevel expected R>135,G~128 got ${JSON.stringify(leftEdge)}`)
  // Right bevel edge (wx=317, wy=200): inward normal points -X -> R < 128, G == 128
  const rightEdge = sampleCss(317, 200)
  assert.ok(rightEdge.r < 121 && Math.abs(rightEdge.g - 128) <= 1, `right bevel expected R<121,G~128 got ${JSON.stringify(rightEdge)}`)
  // Top bevel edge (wx=200, wy=83): inward normal points +Y -> G > 128, R == 128
  const topEdge = sampleCss(200, 83)
  assert.ok(topEdge.g > 135 && Math.abs(topEdge.r - 128) <= 1, `top bevel expected G>135,R~128 got ${JSON.stringify(topEdge)}`)
  // Bottom bevel edge (wx=200, wy=317): inward normal points -Y -> G < 128, R == 128
  const bottomEdge = sampleCss(200, 317)
  assert.ok(bottomEdge.g < 121 && Math.abs(bottomEdge.r - 128) <= 1, `bottom bevel expected G<121,R~128 got ${JSON.stringify(bottomEdge)}`)

  // Bevel decay across bezel: displacement amplitude near edge (distIn=3) > mid-bezel (distIn=11) > deep interior (distIn>=20 -> 0)
  const leftMid = sampleCss(91, 200)
  const centerPx = sampleCss(200, 200)
  assert.ok(Math.abs(leftEdge.r - 128) > Math.abs(leftMid.r - 128), 'displacement must decay toward interior across bezel')
  assert.deepEqual(centerPx, { r: 128, g: 128, b: 128, a: 255 }, 'deep interior must be neutral (128,128,128,255)')

  // Symmetric edge AA alpha: sd >= 0.5 -> A=0; sd in (-0.5, 0.5) -> midpoint ~128 at sd=0; sd <= -0.5 -> A=255
  const outsidePx = sampleCss(77, 200) // sd = +3 -> outside
  assert.deepEqual(outsidePx, { r: 128, g: 128, b: 128, a: 0 }, 'outside sd >= 0.5 must be transparent neutral')
  const aaRes = build({
    bounds: { x: 0, y: 0, width: 64, height: 64 },
    platter: { center: { x: 32, y: 32 }, size: { width: 32, height: 32 }, radius: 6 },
    droplet: null,
    blendK: 0,
    isMerged: true,
    bezel: 8,
    ior: 1.5,
    thicknessRatio: 1.32,
    mapScale: 1,
  })
  const aaPng = decodeStoredRgbaPng(aaRes.dataUrl)
  // Top edge at y = 16. Pixel py=15 -> wy=15.5 (sd=+0.5 >= 0.5 -> a=0); py=16 -> wy=16.5 (sd=-0.5 <= -0.5 -> a=255)
  assert.equal(aaPng.pixelAt(32, 15).a, 0, 'sd=+0.5 must be alpha 0')
  assert.equal(aaPng.pixelAt(32, 16).a, 255, 'sd=-0.5 <= -0.5 must be opaque 255 so full rim refracts')

  // Half-pixel shifted edge (top at y=16.5) hits sd=0 exact midpoint alpha=128
  const midAaRes = build({
    bounds: { x: 0, y: 0, width: 64, height: 64 },
    platter: { center: { x: 32, y: 32.5 }, size: { width: 32, height: 32 }, radius: 6 },
    droplet: null,
    blendK: 0,
    isMerged: true,
    bezel: 8,
    ior: 1.5,
    thicknessRatio: 1.32,
    mapScale: 1,
  })
  const midAaPng = decodeStoredRgbaPng(midAaRes.dataUrl)
  assert.equal(midAaPng.pixelAt(32, 16).a, 128, 'sd=0 must lie at symmetric AA midpoint alpha 128')

  // Snell IOR change -> cache invalidation + higher peak displacement scale
  const higherIorRes = build({
    bounds: { x: 0, y: 0, width: 64, height: 64 },
    platter: { center: { x: 32, y: 32 }, size: { width: 32, height: 32 }, radius: 6 },
    droplet: null,
    blendK: 0,
    isMerged: true,
    bezel: 8,
    ior: 1.9,
    thicknessRatio: 1.32,
    mapScale: 1,
  })
  assert.equal(higherIorRes.changed, true, 'changing ior must invalidate cached PNG')
  assert.ok(
    higherIorRes.maxDisplacementPx > aaRes.maxDisplacementPx,
    'higher IOR must increase peak Snell displacement',
  )

  // Small shape (< bezel) clamps effBezel to min(halfW, halfH) cleanly
  const tinyRes = build({
    bounds: { x: 0, y: 0, width: 64, height: 64 },
    platter: { center: { x: 32, y: 32 }, size: { width: 16, height: 16 }, radius: 4 },
    droplet: null,
    blendK: 0,
    isMerged: true,
    bezel: 20,
    ior: 1.5,
    thicknessRatio: 1.32,
    mapScale: 1,
  })
  const tinyPng = decodeStoredRgbaPng(tinyRes.dataUrl)
  assert.deepEqual(tinyPng.pixelAt(31, 31), { r: 128, g: 128, b: 128, a: 255 }, 'clamped small shape center stays neutral')

  // 2. Cache reuse: identical or <0.1px jittered geometry hits cache (changed: false)
  build({
    bounds: { x: 0, y: 0, width: 64, height: 64 },
    platter: { center: { x: 32, y: 32 }, size: { width: 32, height: 32 }, radius: 6 },
    droplet: null,
    blendK: 0,
    isMerged: true,
    bezel: 8,
    ior: 1.5,
    thicknessRatio: 1.32,
    mapScale: 1,
  })
  const hit1 = build({
    bounds: { x: 0, y: 0, width: 64, height: 64 },
    platter: { center: { x: 32.04, y: 32.02 }, size: { width: 32, height: 32 }, radius: 6 },
    droplet: null,
    blendK: 0,
    isMerged: true,
    bezel: 8,
    ior: 1.5,
    thicknessRatio: 1.32,
    mapScale: 1,
  })
  assert.equal(hit1.changed, false, 'sub-quarter-pixel quantized geometry must reuse cached PNG')
  builder.reset()
  const afterReset = build({
    bounds: { x: 0, y: 0, width: 64, height: 64 },
    platter: { center: { x: 32, y: 32 }, size: { width: 32, height: 32 }, radius: 6 },
    droplet: null,
    blendK: 0,
    isMerged: true,
    bezel: 8,
    mapScale: 1,
  })
  assert.equal(afterReset.changed, true, 'reset() must invalidate cached PNG')

  // 3. Dual-shape smin neck vs hard-union / single-rect
  const dualBounds = { x: 0, y: 0, width: 200, height: 220 }
  const dualPlatter = { center: { x: 100, y: 150 }, size: { width: 120, height: 100 }, radius: 20 } // top at y=100
  const bridgedDroplet = { center: { x: 100, y: 70 }, size: { width: 60, height: 40 }, radius: 20 } // bottom at y=90, 10px gap -> mid y=95 (sd=5 -> smin(5,5,28)=-2 -> alpha 255)
  const sminNeckRes = build({
    bounds: dualBounds,
    platter: dualPlatter,
    droplet: bridgedDroplet,
    blendK: 28,
    isMerged: false,
    bezel: 12,
    mapScale: 1,
  })
  const sminPng = decodeStoredRgbaPng(sminNeckRes.dataUrl)
  assert.equal(sminPng.pixelAt(100, 95).a, 255, 'smin blendK=28 must form solid opaque goo neck across 10px gap')

  const unblendedRes = build({
    bounds: dualBounds,
    platter: dualPlatter,
    droplet: bridgedDroplet,
    blendK: 0,
    isMerged: false,
    bezel: 12,
    mapScale: 1,
  })
  const unblendedPng = decodeStoredRgbaPng(unblendedRes.dataUrl)
  assert.equal(unblendedPng.pixelAt(100, 95).a, 0, 'blendK=0 hard union must leave 10px gap transparent')

  // 4. Shrunken platter (18x18) inside 44x44 droplet must preserve the droplet's 22px bezel for seamless landing
  const landingRes = build({
    bounds: { x: 0, y: 0, width: 56, height: 56 },
    platter: { center: { x: 28, y: 28 }, size: { width: 18, height: 18 }, radius: 9 },
    droplet: { center: { x: 28, y: 28 }, size: { width: 44, height: 44 }, radius: 22 },
    blendK: 0,
    isMerged: false,
    bezel: 22,
    ior: 1.5,
    thicknessRatio: 1.32,
    mapScale: 1,
  })
  const landingPng = decodeStoredRgbaPng(landingRes.dataUrl)
  // Right interior at px=35 (wx=35.5 -> distIn = 50 - 35.5 = 14.5px > platter half-width 9px, < droplet bezel 22px)
  assert.ok(
    landingPng.pixelAt(35, 28).r < 126,
    `dual-shape bezel must follow 44x44 droplet (22px) rather than shrunken 18x18 platter (got R=${landingPng.pixelAt(35, 28).r})`,
  )
})

test('createPopoverMorphController P2 #5: open() interrupting closing preserves optical channels without snapping (normal & reducedMotion)', () => {
  const createMotionController = presets.createPopoverMorphController

  // 1. Normal spring mode: mid-closing open() must preserve contentOpacity, contentBlurPx, triggerGlyphOpacity, bareGlassOpacity
  const ctrl = createMotionController({ reducedMotion: false })
  ctrl.open(true)
  ctrl.step(0.6)
  assert.equal(ctrl.getState().phase, 'open')

  ctrl.close()
  ctrl.step(0.05) // during 100ms content fade-out window
  const midClose = ctrl.getState()
  assert.equal(midClose.phase, 'closing')
  assert.ok(midClose.contentOpacity > 0 && midClose.contentOpacity < 1, `expected partial contentOpacity, got ${midClose.contentOpacity}`)
  assert.ok(midClose.contentBlurPx > 0, `expected non-zero closing blur, got ${midClose.contentBlurPx}`)
  assert.ok(midClose.triggerGlyphOpacity > 0 && midClose.triggerGlyphOpacity < 1, `expected partial glyph opacity, got ${midClose.triggerGlyphOpacity}`)

  ctrl.open(true)
  const resumed = ctrl.getState()
  assert.equal(resumed.phase, 'opening')
  approx(resumed.contentOpacity, midClose.contentOpacity, 1e-4, 'closing->open preserves contentOpacity seamlessly')
  approx(resumed.contentBlurPx, midClose.contentBlurPx, 1e-3, 'closing->open preserves contentBlurPx seamlessly')
  approx(resumed.triggerGlyphOpacity, midClose.triggerGlyphOpacity, 1e-4, 'closing->open preserves triggerGlyphOpacity seamlessly')
  approx(resumed.bareGlassOpacity, midClose.bareGlassOpacity, 1e-4, 'closing->open preserves bareGlassOpacity seamlessly')

  ctrl.step(0.5)
  const settled = ctrl.getState()
  assert.equal(settled.phase, 'open')
  assert.equal(settled.contentOpacity, 1)
  assert.equal(settled.contentBlurPx, 0)
  assert.equal(settled.triggerGlyphOpacity, 0)

  // Also test interrupting later in closing (0.18s) where contentOpacity=0 and bareGlassOpacity/glyph are mid-way
  ctrl.close()
  ctrl.step(0.18)
  const lateClose = ctrl.getState()
  assert.equal(lateClose.phase, 'closing')
  assert.ok(lateClose.triggerGlyphOpacity > 0 && lateClose.triggerGlyphOpacity < 1)
  ctrl.open(true)
  const resumedLate = ctrl.getState()
  assert.equal(resumedLate.phase, 'opening')
  approx(resumedLate.contentOpacity, lateClose.contentOpacity, 1e-4, 'late closing->open preserves contentOpacity=0')
  approx(resumedLate.triggerGlyphOpacity, lateClose.triggerGlyphOpacity, 1e-4, 'late closing->open preserves glyph opacity')
  approx(resumedLate.bareGlassOpacity, lateClose.bareGlassOpacity, 1e-4, 'late closing->open preserves bareGlassOpacity')
  ctrl.dispose()

  // 2. Reduced motion mode: closing -> open() preserves crossfade opacity & settles cleanly; setReducedMotion mid-flight cleans press & completes
  const rCtrl = createMotionController({ reducedMotion: true })
  rCtrl.open(true)
  rCtrl.step(0.3)
  assert.equal(rCtrl.getState().phase, 'open')

  rCtrl.close()
  rCtrl.step(0.08)
  const rMidClose = rCtrl.getState()
  assert.equal(rMidClose.phase, 'closing')
  assert.ok(rMidClose.contentOpacity > 0.05 && rMidClose.contentOpacity < 0.95)

  rCtrl.open(true)
  const rResumed = rCtrl.getState()
  assert.equal(rResumed.phase, 'opening')
  approx(rResumed.contentOpacity, rMidClose.contentOpacity, 1e-4, 'reducedMotion closing->open preserves contentOpacity')
  approx(rResumed.triggerGlyphOpacity, rMidClose.triggerGlyphOpacity, 1e-4, 'reducedMotion closing->open preserves triggerGlyphOpacity')
  approx(rResumed.bareGlassOpacity, rMidClose.bareGlassOpacity, 1e-4, 'reducedMotion closing->open preserves bareGlassOpacity')

  rCtrl.step(0.25)
  assert.equal(rCtrl.getState().phase, 'open')
  assert.equal(rCtrl.getState().contentOpacity, 1)

  // Mid-flight setReducedMotion(true) resets press offsets/lift and lets step() finish cleanly
  // 按压在 Sessile 里是独立的 createElasticPressController，和形变控制器同步切换减少动态
  const press = core.createElasticPressController()
  rCtrl.setReducedMotion(false)
  press.pressStart({ width: 120, height: 40 })
  press.pressMove({ x: 18, y: 12 }, { width: 120, height: 40 })
  rCtrl.step(0.05)
  press.step(0.05)
  rCtrl.close()
  rCtrl.step(0.05)
  press.step(0.05)
  rCtrl.setReducedMotion(true)
  press.setReducedMotion(true)
  const switched = rCtrl.getState()
  assert.equal(switched.reducedMotion, true)
  assert.equal(press.getState().lift, 0)
  assert.equal(press.getState().offsetX, 0)
  assert.equal(press.getState().offsetY, 0)
  rCtrl.step(0.25)
  assert.equal(rCtrl.getState().phase, 'closed')
  rCtrl.dispose()
})
