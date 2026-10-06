import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { extractPalette, type Rgb } from '@/lib/palette'

/**
 * 首页的动态封面背景：从封面取 4 种主色，让 4 团色块沿各自的轨道缓慢游走、相互交融，
 * 类似 Apple Music 播放页。颜色数量和运动幅度固定，不受封面构图影响，
 * 既不会因整张封面的零碎颜色而显得杂，也不会因局部单调而看不出在动。
 * 着色器参考 shadcn 注册表里的 @glint-ui/grain-gradient 与 @neon-ui/mesh-gradient：
 * 画面全是低频色块，半分辨率绘制，再加一点抖动消除 8 位色深下的色带。
 * 不支持 WebGL、上下文丢失或封面像素无法读取时显示 fallback（静态模糊封面）。
 */
export function CoverFlow({
  src,
  className,
  fallback,
  speed = 1,
  still = false,
}: {
  src?: string | null
  className?: string
  fallback: ReactNode
  /** 流动速度倍数，详情页比首页慢 */
  speed?: number
  /** 只显示取色结果、不流动（关闭「动态背景」时的详情页） */
  still?: boolean
}) {
  const host = useRef<HTMLDivElement>(null)
  const flow = useRef<Flow | null>(null)
  const [failed, setFailed] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const el = host.current
    if (!el) return
    // 每次挂载新建画布：严格模式下重复挂载时，旧画布的上下文已被释放
    const f = createFlow(el, () => setFailed(true))
    if (!f) return setFailed(true)
    flow.current = f
    return () => {
      f.dispose()
      flow.current = null
    }
  }, [])

  useEffect(() => {
    flow.current?.motion(speed, still)
  }, [speed, still, failed])

  useEffect(() => {
    if (!src || failed) return
    let alive = true
    const img = new Image()
    img.decoding = 'async'
    img.src = src
    img
      .decode()
      .then(() => {
        if (!alive || !flow.current) return
        // 封面跨域时读取像素会抛错，退回静态背景
        if (!flow.current.show(img)) setFailed(true)
        else setReady(true)
      })
      .catch(() => {
        /* 封面加载失败就保留上一张的颜色，没有上一张则停在底色 */
      })
    return () => {
      alive = false
    }
  }, [src, failed])

  if (failed) return fallback
  return (
    <div
      ref={host}
      aria-hidden
      className={cn('cover-flow transition-opacity duration-700', ready ? 'opacity-95' : 'opacity-0', className)}
    />
  )
}

interface Flow {
  show: (img: HTMLImageElement) => boolean
  motion: (speed: number, still: boolean) => void
  dispose: () => void
}

const N = 4
// 取色只需要缩略图
const SAMPLE = 48
const SCALE = 0.5
const FADE_MS = 900

const VERT = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}'

const FRAG = `
precision mediump float;
uniform vec3 uC[4];
uniform vec4 uK;
uniform float uTime;
uniform vec2 uRes;

float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

void main() {
  float asp = uRes.x / uRes.y;
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  float t = uTime * 0.26;

  // 正弦扭曲让色块边缘像液体一样起伏
  vec2 q = p + 0.16 * vec2(
    sin(p.y * 2.1 + t * 1.3) + sin(p.y * 3.7 - t * 0.9 + p.x),
    cos(p.x * 1.8 - t * 1.1) + sin(p.x * 3.1 + t * 0.7 - p.y));

  // 4 个色心沿各自的李萨如轨道慢慢游走，按距离反比混色；uK 是各色面积占比
  vec2 h = vec2(asp * 0.5, 0.5);
  vec2 P0 = (vec2(sin(t * 0.9), cos(t * 0.7)) * 0.7 + vec2(-0.3, 0.2)) * h;
  vec2 P1 = (vec2(cos(t * 0.6 + 1.0), sin(t * 0.8 + 2.0)) * 0.7 + vec2(0.35, 0.25)) * h;
  vec2 P2 = (vec2(sin(t * 0.5 + 4.0), cos(t * 0.9 + 1.0)) * 0.7 + vec2(0.3, -0.3)) * h;
  vec2 P3 = (vec2(cos(t * 0.8 + 3.0), sin(t * 0.55 + 5.0)) * 0.7 + vec2(-0.35, -0.25)) * h;
  vec4 d = vec4(dot(q - P0, q - P0), dot(q - P1, q - P1), dot(q - P2, q - P2), dot(q - P3, q - P3));
  vec4 w = uK / (d + 0.03);
  w = w * w;
  vec3 col = (uC[0] * w.x + uC[1] * w.y + uC[2] * w.z + uC[3] * w.w) / (w.x + w.y + w.z + w.w);

  col += (hash(gl_FragCoord.xy + fract(uTime) * 61.0) - 0.5) * (2.0 / 255.0);
  gl_FragColor = vec4(col, 1.0);
}
`

type Palette = { c: Rgb[]; k: number[] }

function createFlow(host: HTMLElement, onLost: () => void): Flow | null {
  const canvas = document.createElement('canvas')
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block'
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, depth: false, powerPreference: 'low-power' })
  if (!gl) return null
  const prog = gl.createProgram()
  if (!prog) return null
  for (const [type, src] of [[gl.VERTEX_SHADER, VERT], [gl.FRAGMENT_SHADER, FRAG]] as const) {
    const sh = gl.createShader(type)!
    gl.shaderSource(sh, src)
    gl.compileShader(sh)
    gl.attachShader(prog, sh)
  }
  gl.bindAttribLocation(prog, 0, 'p')
  gl.linkProgram(prog)
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null
  gl.useProgram(prog)
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
  gl.enableVertexAttribArray(0)
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
  const u = (n: string) => gl.getUniformLocation(prog, n)
  const uC = u('uC'), uK = u('uK'), uTime = u('uTime'), uRes = u('uRes')

  const sample = document.createElement('canvas')
  sample.width = sample.height = SAMPLE
  const ctx = sample.getContext('2d', { willReadFrequently: true })

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
  const dark: Palette = { c: Array.from({ length: N }, () => [0.04, 0.04, 0.05] as Rgb), k: Array(N).fill(1 / N) }
  let from = dark
  let to = dark
  let cur = dark
  let time = Math.random() * 100
  let fadeFrom = 0
  let fading = false
  let raf = 0
  let last = 0
  let visible = true
  let speed = 1
  let still = false
  const frozen = () => still || reduced.matches

  const lerp = (a: number, b: number, k: number) => a + (b - a) * k
  const draw = () => {
    gl.uniform3fv(uC, cur.c.flat())
    gl.uniform4fv(uK, cur.k)
    gl.uniform1f(uTime, time)
    gl.uniform2f(uRes, canvas.width, canvas.height)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }
  const step = (now: number) => {
    raf = 0
    // 约 30 帧就够流畅，省一半功耗
    if (now - last >= 32) {
      const dt = Math.min((now - last) / 1000, 0.1)
      last = now
      if (!frozen()) time += dt * speed
      if (fading) {
        const x = Math.min((now - fadeFrom) / FADE_MS, 1)
        const k = x * x * (3 - 2 * x)
        cur = {
          c: from.c.map((c, i) => c.map((v, j) => lerp(v, to.c[i][j], k)) as Rgb),
          k: from.k.map((v, i) => lerp(v, to.k[i], k)),
        }
        if (x >= 1) fading = false
      }
      draw()
    }
    schedule()
  }
  const schedule = () => {
    if (raf || !visible) return
    // 静止或减弱动态效果时只在换封面过渡期间逐帧绘制
    if (frozen() && !fading) return
    raf = requestAnimationFrame(step)
  }

  const resize = () => {
    const w = Math.max(1, Math.round(canvas.clientWidth * SCALE))
    const h = Math.max(1, Math.round(canvas.clientHeight * SCALE))
    if (canvas.width === w && canvas.height === h) return
    canvas.width = w
    canvas.height = h
    gl.viewport(0, 0, w, h)
    draw()
  }
  const ro = new ResizeObserver(resize)
  ro.observe(canvas)
  const io = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting
    if (visible) {
      last = performance.now()
      schedule()
    }
  })
  io.observe(canvas)
  const lost = (e: Event) => {
    e.preventDefault()
    onLost()
  }
  canvas.addEventListener('webglcontextlost', lost)
  const motionChanged = () => {
    last = performance.now()
    draw()
    schedule()
  }
  reduced.addEventListener('change', motionChanged)
  host.appendChild(canvas)
  resize()

  return {
    show(img) {
      if (!ctx) return false
      let swatches
      try {
        ctx.clearRect(0, 0, SAMPLE, SAMPLE)
        ctx.drawImage(img, 0, 0, SAMPLE, SAMPLE)
        swatches = extractPalette(ctx.getImageData(0, 0, SAMPLE, SAMPLE).data, N)
      } catch {
        return false
      }
      // 从当前画面（可能正在过渡）出发，连续切换时不会跳色
      from = cur
      to = { c: swatches.map((s) => s.rgb), k: swatches.map((s) => s.weight) }
      fading = true
      fadeFrom = performance.now()
      last = fadeFrom
      schedule()
      return true
    },
    motion(s, st) {
      speed = s
      still = st
      motionChanged()
    },
    dispose() {
      cancelAnimationFrame(raf)
      ro.disconnect()
      io.disconnect()
      canvas.removeEventListener('webglcontextlost', lost)
      reduced.removeEventListener('change', motionChanged)
      gl.getExtension('WEBGL_lose_context')?.loseContext()
      canvas.remove()
    },
  }
}
