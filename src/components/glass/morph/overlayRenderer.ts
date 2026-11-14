/**
 * Clean-room WebGL2 + 2D Canvas fallback overlay renderer for Live-DOM Hybrid Liquid Glass morphing.
 *
 * Renders ONLY the optical boundary layer on a transparent overlay `<canvas>`:
 * 1. Outside-only drop shadow (`d > 0`, never bleeding into translucent glass)
 * 2. Dark outer hairline (`0.67px`) with side / corner / flat alpha falloff
 * 3. Directional `control` / `menu` rim highlights (`inset < 5px`) blended via `styleMix` & `rimOpacity`
 *
 * Leaves the flat interior (`inset >= 5px`) strictly transparent (`alpha = 0`) so live DOM
 * `backdrop-filter` clipped by `contour.ts` shows through cleanly underneath.
 *
 * SPDX-License-Identifier: MPL-2.0
 */

import type {
  GlassShapeState,
  IMorphOverlayRenderer,
  MorphOverlayFrame,
  RendererCapabilities,
} from './contracts'

export const OVERLAY_VERTEX_SHADER = /* glsl */ `#version 300 es
precision highp float;

out vec2 vUv;

void main() {
  vec2 pos = vec2(
    (gl_VertexID == 1) ? 3.0 : -1.0,
    (gl_VertexID == 2) ? 3.0 : -1.0
  );
  vUv = pos * 0.5 + 0.5;
  gl_Position = vec4(pos, 0.0, 1.0);
}
`

export const OVERLAY_FRAGMENT_SHADER = /* glsl */ `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform vec2 uViewport;
uniform float uDpr;
uniform vec4 uPlatter;          // (cx, cy, halfW, halfH) in local CSS px
uniform float uPlatterRadius;
uniform vec4 uDroplet;          // (cx, cy, halfW, halfH) in local CSS px
uniform float uDropletRadius;
uniform float uBlendK;
uniform float uIsMerged;
uniform float uRimOpacity;
uniform float uStyleMix;
uniform float uOpacity;

uniform vec4 uRimParams;        // (style.rimOpacity, style.rimWidth, style.rimTail, style.rimFocus)
uniform vec4 uHairline;         // (width, sideAlpha, cornerAlpha, flatAlpha)
uniform vec3 uShadow;           // (blur, offsetY, alpha)
uniform vec4 uBorderColor;      // normalized RGBA of optional uniform inner CSS border
uniform vec2 uBorderParams;     // (borderWidthPx, rimBottomRatio)

struct SdfSample {
  float dist;
  vec2 normal;
};

float safePow(float x, float y) {
  return (x <= 1e-6) ? 0.0 : pow(x, y);
}

SdfSample sdRoundedBoxRefined(vec2 p, vec2 center, vec2 halfSize, float r) {
  vec2 safeHalf = max(halfSize, vec2(0.001));
  float rad = clamp(r, 0.0, min(safeHalf.x, safeHalf.y));
  vec2 rel = p - center;
  vec2 s = vec2(rel.x >= 0.0 ? 1.0 : -1.0, rel.y >= 0.0 ? 1.0 : -1.0);
  vec2 q = abs(rel) - safeHalf + rad;
  vec2 qPos = max(q, 0.0);

  float outside = length(qPos);
  float inside = min(max(q.x, q.y), 0.0);
  float baseDist = outside + inside - rad;

  vec2 baseNormal;
  if (q.x > 0.0 && q.y > 0.0) {
    baseNormal = (outside > 1e-5) ? (qPos / outside) * s : normalize(s);
  } else if (q.x > q.y) {
    baseNormal = vec2(s.x, 0.0);
  } else {
    baseNormal = vec2(0.0, s.y);
  }

  // Superellipse octant normal refinement within 5 CSS px of the boundary for smooth corner specular lighting;
  // dist stays exact baseDist so the SDF boundary aligns 1:1 with contour.ts and CSS border-radius (0.00px gap).
  float rimProximity = smoothstep(5.0, 0.0, abs(baseDist));
  vec2 normal = baseNormal;

  if (rimProximity > 0.001 && rad > 1.0 && q.x > 0.0 && q.y > 0.0) {
    const float pExp = 2.55;
    vec2 qn = qPos / rad;
    vec2 grad = vec2(
      safePow(qn.x, pExp - 1.0),
      safePow(qn.y, pExp - 1.0)
    );
    float gl = length(grad);
    if (gl > 1e-5) {
      vec2 superNormal = (grad / gl) * s;
      vec2 mixedN = mix(baseNormal, superNormal, rimProximity);
      float mnl = length(mixedN);
      normal = (mnl > 1e-5) ? (mixedN / mnl) : baseNormal;
    }
  }

  return SdfSample(baseDist, normal);
}

SdfSample evaluateGlassSdf(vec2 p) {
  SdfSample a = sdRoundedBoxRefined(p, uPlatter.xy, uPlatter.zw, uPlatterRadius);
  if (uIsMerged > 0.5 || uDroplet.z <= 0.01 || uDroplet.w <= 0.01) {
    return a;
  }

  SdfSample b = sdRoundedBoxRefined(p, uDroplet.xy, uDroplet.zw, uDropletRadius);
  if (uBlendK <= 0.001) {
    if (a.dist <= b.dist) {
      return a;
    }
    return b;
  }

  float h = clamp(0.5 + 0.5 * (b.dist - a.dist) / uBlendK, 0.0, 1.0);
  float d = mix(b.dist, a.dist, h) - uBlendK * h * (1.0 - h);
  vec2 n = mix(b.normal, a.normal, h);
  float nl = length(n);
  n = (nl > 1e-5) ? (n / nl) : a.normal;
  return SdfSample(d, n);
}

void main() {
  if (uOpacity <= 0.001) {
    fragColor = vec4(0.0);
    return;
  }

  // Convert GL UV (bottom-left origin) to local CSS pixels (top-left origin).
  vec2 pCss = vec2(vUv.x * uViewport.x, (1.0 - vUv.y) * uViewport.y);
  SdfSample sdf = evaluateGlassSdf(pCss);
  float d = sdf.dist;
  vec2 normal = sdf.normal;

  float aa = 1.0 / max(uDpr, 1.0);
  float glassMask = smoothstep(0.5 * aa, -0.5 * aa, d);
  float outsideMask = 1.0 - glassMask;

  // 1. Outside-only drop shadow (d > 0)
  float shadowA = 0.0;
  if (outsideMask > 0.001 && uShadow.z > 0.001) {
    SdfSample shadowSdf = evaluateGlassSdf(pCss - vec2(0.0, uShadow.y));
    float sigma = max(uShadow.x * 0.5, 1.0);
    float shadowFalloff = 1.0 / (1.0 + exp(clamp(1.65 * shadowSdf.dist / sigma, -12.0, 12.0)));
    shadowA = outsideMask * shadowFalloff * uShadow.z * uOpacity;
  }

  // 2. Dark outer hairline: strictly outside border (d >= 0) when resting CSS border parity is active,
  // otherwise straddles outer edge (d >= -0.25) for legacy PrismUI showcase mode.
  float hw = max(uHairline.x, 0.5 / max(uDpr, 1.0));
  float hairlineHalfW = hw * 0.5;
  float hasUniformBorder = step(0.001, uBorderParams.x);
  float hairlineCenter = mix(-0.25 + hairlineHalfW, hairlineHalfW, hasUniformBorder);
  float hairlineMinD = mix(-0.25 - 0.5 * aa, -0.15 * aa, hasUniformBorder);
  float hairlineBand =
    smoothstep(hairlineHalfW + 0.5 * aa, hairlineHalfW * 0.25, abs(d - hairlineCenter)) *
    smoothstep(hairlineMinD, hairlineMinD + 0.75 * aa, d);
  float hairA = 0.0;
  if (hairlineBand > 0.001) {
    float ax = abs(normal.x);
    float ay = abs(normal.y);
    float cornerW = safePow(clamp(2.0 * ax * ay, 0.0, 1.0), 1.5);
    float sideVsFlat = mix(uHairline.y, uHairline.w, ay * ay);
    float hairlineProfileAlpha = mix(sideVsFlat, uHairline.z, cornerW);
    hairA = hairlineBand * hairlineProfileAlpha * uOpacity;
  }

  // 3. Optional uniform 1px inner border + directional/isotropic inset catchlights (inset < 5.0 CSS px)
  float inset = max(-d, 0.0);
  float borderMask = 0.0;
  float borderA = 0.0;
  vec3 borderRgb = vec3(0.0);
  if (glassMask > 0.001 && hasUniformBorder > 0.5 && inset < uBorderParams.x + aa) {
    borderMask = smoothstep(uBorderParams.x + 0.5 * aa, max(0.0, uBorderParams.x - 0.5 * aa), inset) * glassMask;
    borderA = clamp(borderMask * uBorderColor.a * uOpacity, 0.0, 1.0);
    borderRgb = uBorderColor.rgb * borderA;
  }

  float rimA = 0.0;
  if (glassMask > 0.001 && inset < 5.0 && uRimParams.x > 0.001) {
    float ny = abs(normal.y);
    float wControl = 1.0 - clamp(uStyleMix, 0.0, 1.0);
    float wMenu = clamp(uStyleMix, 0.0, 1.0) * clamp(uRimOpacity, 0.0, 1.0);

    if (hasUniformBorder > 0.5) {
      // Resting CSS inset box-shadow parity: keep inset catchlight inside padding edge (never double-brighten 1px border)
      float padInset = max(inset - uBorderParams.x, 0.0);
      float padMask = 1.0 - borderMask;
      float topBias = clamp(-normal.y, 0.0, 1.0);
      float botBias = clamp(normal.y, 0.0, 1.0);
      float dirWeight = (uRimParams.w < 0.05)
        ? 1.0
        : safePow(max(topBias, botBias * clamp(uBorderParams.y, 0.0, 1.0)), max(uRimParams.w, 0.25));
      float core = smoothstep(max(uRimParams.y, 0.4) + 0.6, 0.0, padInset);
      float tail = exp(-padInset / 1.8) * uRimParams.z * smoothstep(5.0, 3.2, inset);
      rimA = clamp((core + tail) * dirWeight * uRimParams.x * padMask * glassMask * uOpacity, 0.0, 1.0);
    } else {
      if (wControl > 0.001) {
        float topBias = clamp(-normal.y, 0.0, 1.0);
        float botBias = clamp(normal.y, 0.0, 1.0);
        float dirWeight = safePow(max(topBias, botBias * clamp(uBorderParams.y, 0.0, 1.0)), max(uRimParams.w, 0.25));
        float core = smoothstep(max(uRimParams.y, 0.4) + 0.6, 0.0, inset);
        float tail = exp(-inset / 1.8) * uRimParams.z * smoothstep(5.0, 3.2, inset);
        rimA += (core + tail) * dirWeight * uRimParams.x * wControl;
      }

      if (wMenu > 0.001) {
        float bandT = clamp(inset / 5.0, 0.0, 1.0);
        float steppedT = min(floor(bandT * 9.0) / 9.0, 1.0);
        float bandCurve = mix(safePow(1.0 - bandT, 2.1), safePow(1.0 - steppedT, 2.1), 0.35);
        float rimCoreBoost = 0.65 + 0.35 * smoothstep(1.2, 0.0, inset);
        float angWeight = mix(0.015, 1.0, safePow(ny, 2.1)) * (normal.y < 0.0 ? 1.0 : 0.85);
        rimA += bandCurve * rimCoreBoost * angWeight * uRimParams.x * wMenu;
      }

      // Lift specular catchlight for source-over alpha compositing so luminosity matches additive shaders.ts
      rimA = clamp(rimA * 1.35 * glassMask * uOpacity, 0.0, 1.0);
    }
  }

  // Strictly transparent interior when outside shadow, hairline, border, and rim are all zero
  if (shadowA <= 0.0001 && hairA <= 0.0001 && borderA <= 0.0001 && rimA <= 0.0001) {
    fragColor = vec4(0.0);
    return;
  }

  // Premultiplied alpha composite: uniform CSS border over inset specular catchlight over outer hairline + shadow
  float darkA = clamp(shadowA + hairA * (1.0 - shadowA), 0.0, 1.0);
  vec3 afterRimRgb = vec3(rimA);
  float afterRimA = rimA + darkA * (1.0 - rimA);
  vec3 outRgb = borderRgb + afterRimRgb * (1.0 - borderA);
  float outA = clamp(borderA + afterRimA * (1.0 - borderA), 0.0, 1.0);
  fragColor = vec4(outRgb, outA);
}
`

interface OverlayUniforms {
  uViewport: WebGLUniformLocation | null
  uDpr: WebGLUniformLocation | null
  uPlatter: WebGLUniformLocation | null
  uPlatterRadius: WebGLUniformLocation | null
  uDroplet: WebGLUniformLocation | null
  uDropletRadius: WebGLUniformLocation | null
  uBlendK: WebGLUniformLocation | null
  uIsMerged: WebGLUniformLocation | null
  uRimOpacity: WebGLUniformLocation | null
  uStyleMix: WebGLUniformLocation | null
  uOpacity: WebGLUniformLocation | null
  uRimParams: WebGLUniformLocation | null
  uHairline: WebGLUniformLocation | null
  uShadow: WebGLUniformLocation | null
  uBorderColor: WebGLUniformLocation | null
  uBorderParams: WebGLUniformLocation | null
}

function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type)
  if (!shader) {
    throw new Error('Failed to allocate WebGL2 overlay shader')
  }
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) ?? 'Unknown shader compile error'
    gl.deleteShader(shader)
    throw new Error(`WebGL2 overlay shader compile error: ${log}`)
  }
  return shader
}

function linkProgram(gl: WebGL2RenderingContext, vsSource: string, fsSource: string): WebGLProgram {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vsSource)
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSource)
  const program = gl.createProgram()
  if (!program) {
    gl.deleteShader(vs)
    gl.deleteShader(fs)
    throw new Error('Failed to allocate WebGL2 overlay program')
  }
  gl.attachShader(program, vs)
  gl.attachShader(program, fs)
  gl.linkProgram(program)
  gl.deleteShader(vs)
  gl.deleteShader(fs)

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program) ?? 'Unknown program link error'
    gl.deleteProgram(program)
    throw new Error(`WebGL2 overlay program link error: ${log}`)
  }
  return program
}

function traceRoundedShape(ctx: CanvasRenderingContext2D, shape: GlassShapeState): void {
  const x = shape.center.x - shape.size.width * 0.5
  const y = shape.center.y - shape.size.height * 0.5
  const w = Math.max(0, shape.size.width)
  const h = Math.max(0, shape.size.height)
  const r = Math.max(0, Math.min(shape.radius, w * 0.5, h * 0.5))
  ctx.roundRect(x, y, w, h, r)
}

function renderFallback2d(ctx: CanvasRenderingContext2D, frame: MorphOverlayFrame): void {
  const dpr = Math.max(1, frame.dpr)
  const vpW = Math.max(1, frame.viewport.width)
  const vpH = Math.max(1, frame.viewport.height)
  const { geometry, style, opacity } = frame

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, vpW, vpH)
  if (opacity <= 0.001) return

  const showDroplet =
    !geometry.isMerged && geometry.droplet.size.width > 0.01 && geometry.droplet.size.height > 0.01

  // 1. Outside-only drop shadow using evenodd clip exclusion
  if (style.shadowAlpha > 0.001) {
    ctx.save()
    ctx.beginPath()
    ctx.rect(0, 0, vpW, vpH)
    traceRoundedShape(ctx, geometry.platter)
    if (showDroplet) {
      traceRoundedShape(ctx, geometry.droplet)
    }
    ctx.clip('evenodd')

    ctx.shadowColor = `rgba(0, 0, 0, ${(style.shadowAlpha * opacity).toFixed(4)})`
    ctx.shadowBlur = style.shadowBlur
    ctx.shadowOffsetX = 0
    ctx.shadowOffsetY = style.shadowOffsetY
    ctx.fillStyle = 'rgba(0, 0, 0, 1)'
    ctx.beginPath()
    traceRoundedShape(ctx, geometry.platter)
    if (showDroplet) {
      traceRoundedShape(ctx, geometry.droplet)
    }
    ctx.fill()
    ctx.restore()
  }

  // 2. Subtle dark outer hairline + inner top rim highlight
  const hairlineAlpha = ((style.hairlineSideAlpha + style.hairlineCornerAlpha) * 0.5) * opacity
  if (hairlineAlpha > 0.001 && style.hairlineWidth > 0) {
    ctx.save()
    ctx.lineWidth = style.hairlineWidth
    ctx.strokeStyle = `rgba(0, 0, 0, ${Math.min(1, hairlineAlpha).toFixed(4)})`
    ctx.beginPath()
    traceRoundedShape(ctx, geometry.platter)
    if (showDroplet) {
      traceRoundedShape(ctx, geometry.droplet)
    }
    ctx.stroke()
    ctx.restore()
  }

  const borderWidth = style.borderWidth ?? 0
  if (borderWidth > 0.001 && style.borderRgba && style.borderRgba[3] * opacity > 0.001) {
    const [r, g, b, a] = style.borderRgba
    ctx.save()
    ctx.lineWidth = borderWidth
    ctx.strokeStyle = `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${Math.min(1, a * opacity).toFixed(4)})`
    ctx.beginPath()
    traceRoundedShape(ctx, geometry.platter)
    if (showDroplet) {
      traceRoundedShape(ctx, geometry.droplet)
    }
    ctx.stroke()
    ctx.restore()
  }

  const effectiveRim =
    borderWidth > 0.001
      ? style.rimOpacity * opacity
      : style.rimOpacity *
        (1 - geometry.styleMix + geometry.styleMix * geometry.rimOpacity) *
        opacity
  if (effectiveRim > 0.001) {
    ctx.save()
    ctx.beginPath()
    traceRoundedShape(ctx, geometry.platter)
    if (showDroplet) {
      traceRoundedShape(ctx, geometry.droplet)
    }
    ctx.clip()

    const topGrad = ctx.createLinearGradient(0, 0, 0, vpH)
    topGrad.addColorStop(0, `rgba(255, 255, 255, ${Math.min(1, effectiveRim).toFixed(4)})`)
    topGrad.addColorStop(1, `rgba(255, 255, 255, ${(effectiveRim * 0.65).toFixed(4)})`)
    ctx.lineWidth = Math.max(1.2, Math.min(2.5, style.rimWidth))
    ctx.strokeStyle = topGrad
    ctx.beginPath()
    traceRoundedShape(ctx, geometry.platter)
    if (showDroplet) {
      traceRoundedShape(ctx, geometry.droplet)
    }
    ctx.stroke()
    ctx.restore()
  }
}

export function createMorphOverlayRenderer(): IMorphOverlayRenderer {
  let capabilities: RendererCapabilities = {
    webgl2: false,
    floatFbo: false,
    maxTextureSize: 0,
    fallbackNotice: 'Overlay renderer not yet mounted.',
  }

  let canvas: HTMLCanvasElement | null = null
  let gl: WebGL2RenderingContext | null = null
  let fallback2d: CanvasRenderingContext2D | null = null
  let contextLost = false

  let vao: WebGLVertexArrayObject | null = null
  let program: WebGLProgram | null = null
  let uniforms: OverlayUniforms | null = null

  function destroyGlResources(): void {
    if (!gl) return
    if (vao) {
      gl.deleteVertexArray(vao)
      vao = null
    }
    if (program) {
      gl.deleteProgram(program)
      program = null
    }
    uniforms = null
  }

  function initGlResources(): boolean {
    if (!gl) return false
    destroyGlResources()
    try {
      vao = gl.createVertexArray()
      program = linkProgram(gl, OVERLAY_VERTEX_SHADER, OVERLAY_FRAGMENT_SHADER)
      uniforms = {
        uViewport: gl.getUniformLocation(program, 'uViewport'),
        uDpr: gl.getUniformLocation(program, 'uDpr'),
        uPlatter: gl.getUniformLocation(program, 'uPlatter'),
        uPlatterRadius: gl.getUniformLocation(program, 'uPlatterRadius'),
        uDroplet: gl.getUniformLocation(program, 'uDroplet'),
        uDropletRadius: gl.getUniformLocation(program, 'uDropletRadius'),
        uBlendK: gl.getUniformLocation(program, 'uBlendK'),
        uIsMerged: gl.getUniformLocation(program, 'uIsMerged'),
        uRimOpacity: gl.getUniformLocation(program, 'uRimOpacity'),
        uStyleMix: gl.getUniformLocation(program, 'uStyleMix'),
        uOpacity: gl.getUniformLocation(program, 'uOpacity'),
        uRimParams: gl.getUniformLocation(program, 'uRimParams'),
        uHairline: gl.getUniformLocation(program, 'uHairline'),
        uShadow: gl.getUniformLocation(program, 'uShadow'),
        uBorderColor: gl.getUniformLocation(program, 'uBorderColor'),
        uBorderParams: gl.getUniformLocation(program, 'uBorderParams'),
      }
      return true
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'WebGL2 overlay shader initialization failed.'
      capabilities = {
        ...capabilities,
        webgl2: false,
        fallbackNotice: msg,
      }
      destroyGlResources()
      return false
    }
  }

  const handleContextLost = (event: Event) => {
    event.preventDefault()
    contextLost = true
    capabilities = {
      ...capabilities,
      fallbackNotice: 'WebGL2 overlay context lost.',
    }
  }

  const handleContextRestored = () => {
    contextLost = false
    if (gl && initGlResources()) {
      capabilities = {
        ...capabilities,
        webgl2: true,
        fallbackNotice: undefined,
      }
    }
  }

  return {
    get capabilities(): RendererCapabilities {
      return capabilities
    },

    mount(targetCanvas: HTMLCanvasElement): RendererCapabilities {
      if (canvas && canvas !== targetCanvas) {
        canvas.removeEventListener('webglcontextlost', handleContextLost)
        canvas.removeEventListener('webglcontextrestored', handleContextRestored)
        destroyGlResources()
      }

      canvas = targetCanvas
      fallback2d = null
      gl = null
      contextLost = false

      canvas.addEventListener('webglcontextlost', handleContextLost)
      canvas.addEventListener('webglcontextrestored', handleContextRestored)

      const glCtx = canvas.getContext('webgl2', {
        alpha: true,
        antialias: false,
        premultipliedAlpha: true,
        depth: false,
        stencil: false,
        preserveDrawingBuffer: false,
      })

      if (glCtx) {
        gl = glCtx
        contextLost = glCtx.isContextLost()
        const floatFbo = Boolean(glCtx.getExtension('EXT_color_buffer_float'))
        const maxTextureSize = Number(glCtx.getParameter(glCtx.MAX_TEXTURE_SIZE)) || 4096
        capabilities = {
          webgl2: !contextLost,
          floatFbo,
          maxTextureSize,
        }
        if (!contextLost && initGlResources()) {
          return capabilities
        }
        gl = null
      }

      // Automatic 2D Canvas fallback when WebGL2 is unavailable or fails initialization
      fallback2d = canvas.getContext('2d')
      capabilities = {
        webgl2: false,
        floatFbo: false,
        maxTextureSize: 0,
        fallbackNotice: fallback2d
          ? 'WebGL2 unavailable; using 2D Canvas overlay fallback.'
          : 'Neither WebGL2 nor 2D Canvas context is available.',
      }
      return capabilities
    },

    render(frame: MorphOverlayFrame): void {
      if (!canvas) return

      const dpr = Math.max(1, frame.dpr)
      const targetW = Math.max(1, Math.round(frame.viewport.width * dpr))
      const targetH = Math.max(1, Math.round(frame.viewport.height * dpr))
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW
        canvas.height = targetH
      }

      if (gl && !contextLost && capabilities.webgl2 && program && uniforms && vao) {
        if (frame.opacity <= 0.001) {
          this.clear()
          return
        }

        const { geometry, style } = frame
        gl.bindFramebuffer(gl.FRAMEBUFFER, null)
        gl.viewport(0, 0, canvas.width, canvas.height)
        gl.clearColor(0, 0, 0, 0)
        gl.clear(gl.COLOR_BUFFER_BIT)

        gl.useProgram(program)
        gl.bindVertexArray(vao)
        gl.disable(gl.BLEND)
        gl.disable(gl.DEPTH_TEST)

        gl.uniform2f(uniforms.uViewport, Math.max(1, frame.viewport.width), Math.max(1, frame.viewport.height))
        gl.uniform1f(uniforms.uDpr, dpr)
        gl.uniform4f(
          uniforms.uPlatter,
          geometry.platter.center.x,
          geometry.platter.center.y,
          geometry.platter.size.width * 0.5,
          geometry.platter.size.height * 0.5,
        )
        gl.uniform1f(uniforms.uPlatterRadius, geometry.platter.radius)
        gl.uniform4f(
          uniforms.uDroplet,
          geometry.droplet.center.x,
          geometry.droplet.center.y,
          geometry.droplet.size.width * 0.5,
          geometry.droplet.size.height * 0.5,
        )
        gl.uniform1f(uniforms.uDropletRadius, geometry.droplet.radius)
        gl.uniform1f(uniforms.uBlendK, geometry.blendK)
        gl.uniform1f(uniforms.uIsMerged, geometry.isMerged ? 1 : 0)
        gl.uniform1f(uniforms.uRimOpacity, geometry.rimOpacity)
        gl.uniform1f(uniforms.uStyleMix, geometry.styleMix)
        gl.uniform1f(uniforms.uOpacity, frame.opacity)

        gl.uniform4f(uniforms.uRimParams, style.rimOpacity, style.rimWidth, style.rimTail, style.rimFocus)
        gl.uniform4f(
          uniforms.uHairline,
          style.hairlineWidth,
          style.hairlineSideAlpha,
          style.hairlineCornerAlpha,
          style.hairlineFlatAlpha,
        )
        gl.uniform3f(uniforms.uShadow, style.shadowBlur, style.shadowOffsetY, style.shadowAlpha)
        const borderRgba = style.borderRgba ?? [1, 1, 1, 0]
        gl.uniform4f(uniforms.uBorderColor, borderRgba[0], borderRgba[1], borderRgba[2], borderRgba[3])
        gl.uniform2f(uniforms.uBorderParams, style.borderWidth ?? 0, style.rimBottomRatio ?? 0.72)

        gl.drawArrays(gl.TRIANGLES, 0, 3)
        gl.bindVertexArray(null)
        return
      }

      if (fallback2d) {
        renderFallback2d(fallback2d, frame)
      }
    },

    clear(): void {
      if (gl && !contextLost) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null)
        gl.clearColor(0, 0, 0, 0)
        gl.clear(gl.COLOR_BUFFER_BIT)
        return
      }
      if (fallback2d && canvas) {
        fallback2d.setTransform(1, 0, 0, 1, 0, 0)
        fallback2d.clearRect(0, 0, canvas.width, canvas.height)
      }
    },

    dispose(): void {
      if (canvas) {
        canvas.removeEventListener('webglcontextlost', handleContextLost)
        canvas.removeEventListener('webglcontextrestored', handleContextRestored)
      }
      destroyGlResources()
      canvas = null
      gl = null
      fallback2d = null
      contextLost = false
    },
  }
}
