/**
 * Clean-room WebGL2 Liquid Glass renderer implementing `ILiquidGlassRenderer`.
 *
 * Pipeline:
 * 1. Captures `BackdropSceneHandle` (HTMLCanvasElement, ImageBitmap, or 2D draw callback)
 *    into a GPU texture only when `version` / `size` / `dpr` changes and backdrop hold is inactive.
 * 2. Builds a 3-level downsampled (1/2, 1/4, 1/8) separable Gaussian blur FBO pyramid
 *    (ping-pong H/V passes) once per backdrop update so 60/120fps morph frames need zero blur passes.
 * 3. Renders the fused platter + droplet SDF liquid glass surface (with outside-only shadow,
 *    circular bevel refraction, 16-tap Vogel-disc residual frost, behind-luma contrast thickening,
 *    blended control/menu rim highlights, and 0.67px outer hairline) in a single fragment pass.
 *
 * SPDX-License-Identifier: MPL-2.0
 */

import type {
  BackdropSceneHandle,
  GlassRenderFrame,
  ILiquidGlassRenderer,
  Rect,
  RendererCapabilities,
} from './contracts'
import {
  FULLSCREEN_VERTEX_SHADER,
  LIQUID_GLASS_FRAGMENT_SHADER,
  SEPARABLE_BLUR_FRAGMENT_SHADER,
} from './shaders'

export type GlassDebugMode = 'off' | 'sdf' | 'normals'

export interface ILiquidGlassRendererWithDebug extends ILiquidGlassRenderer {
  setDebugMode(mode: GlassDebugMode): void
  getDebugMode(): GlassDebugMode
}

interface PyramidLevel {
  width: number
  height: number
  texH: WebGLTexture
  fboH: WebGLFramebuffer
  texV: WebGLTexture
  fboV: WebGLFramebuffer
}

interface BlurProgramUniforms {
  uSourceTex: WebGLUniformLocation | null
  uDirection: WebGLUniformLocation | null
}

interface GlassProgramUniforms {
  uTexSharp: WebGLUniformLocation | null
  uTexBlur1: WebGLUniformLocation | null
  uTexBlur2: WebGLUniformLocation | null
  uTexBlur3: WebGLUniformLocation | null
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
  uThemeDark: WebGLUniformLocation | null
  uBevel: WebGLUniformLocation | null
  uRefraction: WebGLUniformLocation | null
  uBlur: WebGLUniformLocation | null
  uDispersion: WebGLUniformLocation | null
  uSaturation: WebGLUniformLocation | null
  uBrightness: WebGLUniformLocation | null
  uContrast: WebGLUniformLocation | null
  uTintRgba: WebGLUniformLocation | null
  uRimParams: WebGLUniformLocation | null
  uRimAdded: WebGLUniformLocation | null
  uHairline: WebGLUniformLocation | null
  uShadow: WebGLUniformLocation | null
  uDebugMode: WebGLUniformLocation | null
}

interface HoldState {
  rect: Rect
  frostPx?: number
}

function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type)
  if (!shader) {
    throw new Error('Failed to allocate WebGL2 shader')
  }
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) ?? 'Unknown shader compile error'
    gl.deleteShader(shader)
    throw new Error(`WebGL2 shader compile error: ${log}`)
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
    throw new Error('Failed to allocate WebGL2 program')
  }
  gl.attachShader(program, vs)
  gl.attachShader(program, fs)
  gl.linkProgram(program)
  gl.deleteShader(vs)
  gl.deleteShader(fs)

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program) ?? 'Unknown program link error'
    gl.deleteProgram(program)
    throw new Error(`WebGL2 program link error: ${log}`)
  }
  return program
}

function createRgbaTexture(gl: WebGL2RenderingContext, width: number, height: number): WebGLTexture {
  const tex = gl.createTexture()
  if (!tex) {
    throw new Error('Failed to create WebGL2 texture')
  }
  gl.bindTexture(gl.TEXTURE_2D, tex)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
  return tex
}

function createFboForTexture(gl: WebGL2RenderingContext, tex: WebGLTexture): WebGLFramebuffer {
  const fbo = gl.createFramebuffer()
  if (!fbo) {
    throw new Error('Failed to create WebGL2 framebuffer')
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0)
  return fbo
}

function clampTexDim(value: number, maxTextureSize: number): number {
  return Math.max(1, Math.min(Math.round(value), maxTextureSize))
}

export function createLiquidGlassRenderer(): ILiquidGlassRendererWithDebug {
  let capabilities: RendererCapabilities = {
    webgl2: false,
    floatFbo: false,
    maxTextureSize: 0,
    fallbackNotice: 'Renderer not yet mounted.',
  }

  let canvas: HTMLCanvasElement | null = null
  let gl: WebGL2RenderingContext | null = null
  let contextLost = false

  let vao: WebGLVertexArrayObject | null = null
  let blurProgram: WebGLProgram | null = null
  let blurUniforms: BlurProgramUniforms | null = null
  let glassProgram: WebGLProgram | null = null
  let glassUniforms: GlassProgramUniforms | null = null

  let texSharp: WebGLTexture | null = null
  let sharpWidth = 0
  let pyramid: PyramidLevel[] = []
  let pyramidBuilt = false

  let offscreenCanvas: HTMLCanvasElement | null = null
  let offscreenCtx: CanvasRenderingContext2D | null = null

  let currentScene: BackdropSceneHandle | null = null
  let lastUploadedKey = ''
  let needsUpload = false
  let holdState: HoldState | null = null
  let debugMode: GlassDebugMode = 'off'

  const handleContextLost = (event: Event) => {
    event.preventDefault()
    contextLost = true
    capabilities = {
      ...capabilities,
      fallbackNotice: 'WebGL2 context was lost.',
    }
  }

  const handleContextRestored = () => {
    contextLost = false
    if (canvas) {
      initResources()
      if (currentScene) {
        lastUploadedKey = ''
        needsUpload = true
      }
    }
  }

  function destroyPyramid(): void {
    if (!gl) return
    for (const lvl of pyramid) {
      gl.deleteFramebuffer(lvl.fboH)
      gl.deleteFramebuffer(lvl.fboV)
      gl.deleteTexture(lvl.texH)
      gl.deleteTexture(lvl.texV)
    }
    pyramid = []
    pyramidBuilt = false
  }

  function destroyResources(): void {
    if (!gl) return
    destroyPyramid()
    if (texSharp) {
      gl.deleteTexture(texSharp)
      texSharp = null
    }
    sharpWidth = 0
    if (vao) {
      gl.deleteVertexArray(vao)
      vao = null
    }
    if (blurProgram) {
      gl.deleteProgram(blurProgram)
      blurProgram = null
    }
    if (glassProgram) {
      gl.deleteProgram(glassProgram)
      glassProgram = null
    }
    blurUniforms = null
    glassUniforms = null
  }

  function ensurePyramidSize(baseW: number, baseH: number): void {
    if (!gl) return
    const targetSizes: Array<[number, number]> = [
      [Math.max(1, Math.ceil(baseW / 2)), Math.max(1, Math.ceil(baseH / 2))],
      [Math.max(1, Math.ceil(baseW / 4)), Math.max(1, Math.ceil(baseH / 4))],
      [Math.max(1, Math.ceil(baseW / 8)), Math.max(1, Math.ceil(baseH / 8))],
    ]

    const matches =
      pyramid.length === 3 &&
      pyramid.every((lvl, i) => lvl.width === targetSizes[i][0] && lvl.height === targetSizes[i][1])

    if (matches) return

    destroyPyramid()
    for (const [w, h] of targetSizes) {
      const texH = createRgbaTexture(gl, w, h)
      const fboH = createFboForTexture(gl, texH)
      const texV = createRgbaTexture(gl, w, h)
      const fboV = createFboForTexture(gl, texV)
      pyramid.push({ width: w, height: h, texH, fboH, texV, fboV })
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.bindTexture(gl.TEXTURE_2D, null)
  }

  function initResources(): void {
    if (!gl) return
    destroyResources()

    try {
      vao = gl.createVertexArray()
      blurProgram = linkProgram(gl, FULLSCREEN_VERTEX_SHADER, SEPARABLE_BLUR_FRAGMENT_SHADER)
      glassProgram = linkProgram(gl, FULLSCREEN_VERTEX_SHADER, LIQUID_GLASS_FRAGMENT_SHADER)

      blurUniforms = {
        uSourceTex: gl.getUniformLocation(blurProgram, 'uSourceTex'),
        uDirection: gl.getUniformLocation(blurProgram, 'uDirection'),
      }

      glassUniforms = {
        uTexSharp: gl.getUniformLocation(glassProgram, 'uTexSharp'),
        uTexBlur1: gl.getUniformLocation(glassProgram, 'uTexBlur1'),
        uTexBlur2: gl.getUniformLocation(glassProgram, 'uTexBlur2'),
        uTexBlur3: gl.getUniformLocation(glassProgram, 'uTexBlur3'),
        uViewport: gl.getUniformLocation(glassProgram, 'uViewport'),
        uDpr: gl.getUniformLocation(glassProgram, 'uDpr'),
        uPlatter: gl.getUniformLocation(glassProgram, 'uPlatter'),
        uPlatterRadius: gl.getUniformLocation(glassProgram, 'uPlatterRadius'),
        uDroplet: gl.getUniformLocation(glassProgram, 'uDroplet'),
        uDropletRadius: gl.getUniformLocation(glassProgram, 'uDropletRadius'),
        uBlendK: gl.getUniformLocation(glassProgram, 'uBlendK'),
        uIsMerged: gl.getUniformLocation(glassProgram, 'uIsMerged'),
        uRimOpacity: gl.getUniformLocation(glassProgram, 'uRimOpacity'),
        uStyleMix: gl.getUniformLocation(glassProgram, 'uStyleMix'),
        uOpacity: gl.getUniformLocation(glassProgram, 'uOpacity'),
        uThemeDark: gl.getUniformLocation(glassProgram, 'uThemeDark'),
        uBevel: gl.getUniformLocation(glassProgram, 'uBevel'),
        uRefraction: gl.getUniformLocation(glassProgram, 'uRefraction'),
        uBlur: gl.getUniformLocation(glassProgram, 'uBlur'),
        uDispersion: gl.getUniformLocation(glassProgram, 'uDispersion'),
        uSaturation: gl.getUniformLocation(glassProgram, 'uSaturation'),
        uBrightness: gl.getUniformLocation(glassProgram, 'uBrightness'),
        uContrast: gl.getUniformLocation(glassProgram, 'uContrast'),
        uTintRgba: gl.getUniformLocation(glassProgram, 'uTintRgba'),
        uRimParams: gl.getUniformLocation(glassProgram, 'uRimParams'),
        uRimAdded: gl.getUniformLocation(glassProgram, 'uRimAdded'),
        uHairline: gl.getUniformLocation(glassProgram, 'uHairline'),
        uShadow: gl.getUniformLocation(glassProgram, 'uShadow'),
        uDebugMode: gl.getUniformLocation(glassProgram, 'uDebugMode'),
      }

      // Initialize 4x4 neutral placeholder texture & pyramid so first render is always texture-complete.
      texSharp = createRgbaTexture(gl, 4, 4)
      sharpWidth = 4
      const neutral = new Uint8Array(4 * 4 * 4).fill(128)
      gl.bindTexture(gl.TEXTURE_2D, texSharp)
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 4, 4, gl.RGBA, gl.UNSIGNED_BYTE, neutral)
      ensurePyramidSize(4, 4)
      runBlurPyramid()
      gl.bindTexture(gl.TEXTURE_2D, null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to initialize WebGL2 glass pipeline.'
      capabilities = {
        ...capabilities,
        webgl2: false,
        fallbackNotice: message,
      }
      destroyResources()
    }
  }

  function runBlurPyramid(): void {
    if (!gl || !blurProgram || !blurUniforms || !texSharp || !vao || pyramid.length !== 3) {
      return
    }

    gl.useProgram(blurProgram)
    gl.bindVertexArray(vao)
    gl.disable(gl.BLEND)
    gl.disable(gl.DEPTH_TEST)
    gl.activeTexture(gl.TEXTURE0)
    gl.uniform1i(blurUniforms.uSourceTex, 0)

    let srcTex = texSharp
    let srcW = sharpWidth

    for (const lvl of pyramid) {
      // Horizontal separable Gaussian pass (reads previous level)
      gl.bindFramebuffer(gl.FRAMEBUFFER, lvl.fboH)
      gl.viewport(0, 0, lvl.width, lvl.height)
      gl.bindTexture(gl.TEXTURE_2D, srcTex)
      gl.uniform2f(blurUniforms.uDirection, 1 / Math.max(1, srcW), 0)
      gl.drawArrays(gl.TRIANGLES, 0, 3)

      // Vertical separable Gaussian pass (reads lvl.texH)
      gl.bindFramebuffer(gl.FRAMEBUFFER, lvl.fboV)
      gl.viewport(0, 0, lvl.width, lvl.height)
      gl.bindTexture(gl.TEXTURE_2D, lvl.texH)
      gl.uniform2f(blurUniforms.uDirection, 0, 1 / Math.max(1, lvl.height))
      gl.drawArrays(gl.TRIANGLES, 0, 3)

      srcTex = lvl.texV
      srcW = lvl.width
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.bindVertexArray(null)
    pyramidBuilt = true
  }

  function uploadSceneToGpu(scene: BackdropSceneHandle): void {
    if (!gl || !texSharp) return
    const maxTex = Math.max(256, capabilities.maxTextureSize)
    const targetW = clampTexDim(scene.size.width * scene.dpr, maxTex)
    const targetH = clampTexDim(scene.size.height * scene.dpr, maxTex)

    let uploadSource: TexImageSource
    if (typeof scene.source === 'function') {
      if (!offscreenCanvas) {
        offscreenCanvas = document.createElement('canvas')
      }
      if (offscreenCanvas.width !== targetW || offscreenCanvas.height !== targetH) {
        offscreenCanvas.width = targetW
        offscreenCanvas.height = targetH
      }
      if (!offscreenCtx) {
        offscreenCtx = offscreenCanvas.getContext('2d')
      }
      if (!offscreenCtx) {
        return
      }
      offscreenCtx.setTransform(1, 0, 0, 1, 0, 0)
      offscreenCtx.clearRect(0, 0, targetW, targetH)
      const effDprX = targetW / Math.max(1, scene.size.width)
      const effDprY = targetH / Math.max(1, scene.size.height)
      offscreenCtx.setTransform(effDprX, 0, 0, effDprY, 0, 0)
      scene.source(offscreenCtx, scene.size.width, scene.size.height, scene.dpr)
      uploadSource = offscreenCanvas
    } else {
      uploadSource = scene.source
    }

    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, texSharp)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, uploadSource)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0)

    sharpWidth = targetW
    ensurePyramidSize(targetW, targetH)
    runBlurPyramid()

    lastUploadedKey = `${scene.version}:${scene.size.width}:${scene.size.height}:${scene.dpr}`
    needsUpload = false
  }

  function sceneKey(scene: BackdropSceneHandle): string {
    return `${scene.version}:${scene.size.width}:${scene.size.height}:${scene.dpr}`
  }

  return {
    get capabilities(): RendererCapabilities {
      return capabilities
    },

    mount(targetCanvas: HTMLCanvasElement): RendererCapabilities {
      if (canvas && canvas !== targetCanvas) {
        canvas.removeEventListener('webglcontextlost', handleContextLost)
        canvas.removeEventListener('webglcontextrestored', handleContextRestored)
        destroyResources()
      }

      canvas = targetCanvas
      canvas.addEventListener('webglcontextlost', handleContextLost)
      canvas.addEventListener('webglcontextrestored', handleContextRestored)

      const ctx = canvas.getContext('webgl2', {
        alpha: true,
        antialias: false,
        premultipliedAlpha: true,
        depth: false,
        stencil: false,
        preserveDrawingBuffer: false,
      })

      if (!ctx) {
        gl = null
        capabilities = {
          webgl2: false,
          floatFbo: false,
          maxTextureSize: 0,
          fallbackNotice: 'WebGL2 is unavailable; falling back to CSS backdrop surface.',
        }
        return capabilities
      }

      gl = ctx
      contextLost = ctx.isContextLost()
      const floatFbo = Boolean(ctx.getExtension('EXT_color_buffer_float'))
      const maxTextureSize = Number(ctx.getParameter(ctx.MAX_TEXTURE_SIZE)) || 4096

      capabilities = {
        webgl2: !contextLost,
        floatFbo,
        maxTextureSize,
      }

      if (!contextLost) {
        initResources()
      }

      if (currentScene) {
        needsUpload = true
      }

      return capabilities
    },

    setBackdrop(scene: BackdropSceneHandle): void {
      currentScene = scene
      const key = sceneKey(scene)
      if (key !== lastUploadedKey) {
        needsUpload = true
      }
      if (gl && !contextLost && capabilities.webgl2 && needsUpload && (!holdState || !pyramidBuilt)) {
        uploadSceneToGpu(scene)
      }
    },

    holdBackdrop(rect: Rect, frostPx?: number): void {
      holdState = { rect, frostPx }
    },

    releaseBackdropHold(): void {
      holdState = null
      if (currentScene && sceneKey(currentScene) !== lastUploadedKey) {
        needsUpload = true
      }
    },

    setDebugMode(mode: GlassDebugMode): void {
      debugMode = mode
    },

    getDebugMode(): GlassDebugMode {
      return debugMode
    },

    render(frame: GlassRenderFrame): void {
      if (!canvas || !gl || contextLost || !capabilities.webgl2 || !glassProgram || !glassUniforms || !vao) {
        return
      }

      const dpr = Math.max(1, frame.dpr)
      const targetBackingW = Math.max(1, Math.round(frame.viewport.width * dpr))
      const targetBackingH = Math.max(1, Math.round(frame.viewport.height * dpr))
      if (canvas.width !== targetBackingW || canvas.height !== targetBackingH) {
        canvas.width = targetBackingW
        canvas.height = targetBackingH
      }

      if (currentScene && needsUpload && (!holdState || !pyramidBuilt)) {
        uploadSceneToGpu(currentScene)
      }

      if (frame.opacity <= 0.001) {
        this.clear()
        return
      }

      const { geometry, style } = frame
      const effectiveBlur = Math.max(0, (frame.holdFrost ?? holdState?.frostPx ?? style.blur) + frame.blurBumpPx)

      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)

      gl.useProgram(glassProgram)
      gl.bindVertexArray(vao)
      gl.disable(gl.BLEND)
      gl.disable(gl.DEPTH_TEST)

      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, texSharp)
      gl.uniform1i(glassUniforms.uTexSharp, 0)

      if (pyramid.length === 3) {
        gl.activeTexture(gl.TEXTURE1)
        gl.bindTexture(gl.TEXTURE_2D, pyramid[0].texV)
        gl.uniform1i(glassUniforms.uTexBlur1, 1)

        gl.activeTexture(gl.TEXTURE2)
        gl.bindTexture(gl.TEXTURE_2D, pyramid[1].texV)
        gl.uniform1i(glassUniforms.uTexBlur2, 2)

        gl.activeTexture(gl.TEXTURE3)
        gl.bindTexture(gl.TEXTURE_2D, pyramid[2].texV)
        gl.uniform1i(glassUniforms.uTexBlur3, 3)
      }

      gl.uniform2f(glassUniforms.uViewport, Math.max(1, frame.viewport.width), Math.max(1, frame.viewport.height))
      gl.uniform1f(glassUniforms.uDpr, dpr)

      gl.uniform4f(
        glassUniforms.uPlatter,
        geometry.platter.center.x,
        geometry.platter.center.y,
        geometry.platter.size.width * 0.5,
        geometry.platter.size.height * 0.5,
      )
      gl.uniform1f(glassUniforms.uPlatterRadius, geometry.platter.radius)

      gl.uniform4f(
        glassUniforms.uDroplet,
        geometry.droplet.center.x,
        geometry.droplet.center.y,
        geometry.droplet.size.width * 0.5,
        geometry.droplet.size.height * 0.5,
      )
      gl.uniform1f(glassUniforms.uDropletRadius, geometry.droplet.radius)

      gl.uniform1f(glassUniforms.uBlendK, geometry.blendK)
      gl.uniform1f(glassUniforms.uIsMerged, geometry.isMerged ? 1 : 0)
      gl.uniform1f(glassUniforms.uRimOpacity, geometry.rimOpacity)
      gl.uniform1f(glassUniforms.uStyleMix, geometry.styleMix)
      gl.uniform1f(glassUniforms.uOpacity, frame.opacity)
      gl.uniform1f(glassUniforms.uThemeDark, frame.theme === 'dark' ? 1 : 0)

      gl.uniform1f(glassUniforms.uBevel, style.bevel)
      gl.uniform1f(glassUniforms.uRefraction, style.refraction)
      gl.uniform1f(glassUniforms.uBlur, effectiveBlur)
      gl.uniform1f(glassUniforms.uDispersion, style.dispersion)
      gl.uniform1f(glassUniforms.uSaturation, style.saturation)
      gl.uniform1f(glassUniforms.uBrightness, style.brightness)
      gl.uniform1f(glassUniforms.uContrast, style.contrast)
      gl.uniform4f(
        glassUniforms.uTintRgba,
        style.tintRgba[0],
        style.tintRgba[1],
        style.tintRgba[2],
        style.tintRgba[3],
      )

      gl.uniform4f(glassUniforms.uRimParams, style.rimOpacity, style.rimWidth, style.rimTail, style.rimFocus)
      gl.uniform1f(glassUniforms.uRimAdded, style.rimAdded)
      gl.uniform4f(
        glassUniforms.uHairline,
        style.hairlineWidth,
        style.hairlineSideAlpha,
        style.hairlineCornerAlpha,
        style.hairlineFlatAlpha,
      )
      gl.uniform3f(glassUniforms.uShadow, style.shadowBlur, style.shadowOffsetY, style.shadowAlpha)

      const debugInt = debugMode === 'sdf' ? 1 : debugMode === 'normals' ? 2 : 0
      gl.uniform1i(glassUniforms.uDebugMode, debugInt)

      gl.drawArrays(gl.TRIANGLES, 0, 3)
      gl.bindVertexArray(null)
    },

    clear(): void {
      if (!gl || contextLost) return
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
    },

    dispose(): void {
      if (canvas) {
        canvas.removeEventListener('webglcontextlost', handleContextLost)
        canvas.removeEventListener('webglcontextrestored', handleContextRestored)
      }
      destroyResources()
      canvas = null
      gl = null
      offscreenCanvas = null
      offscreenCtx = null
      currentScene = null
      holdState = null
      lastUploadedKey = ''
      needsUpload = false
    },
  }
}
