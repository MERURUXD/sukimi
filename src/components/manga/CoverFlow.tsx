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
 * 开启 pull 时，鼠标光标带着一团与光标处反差最大的封面色，移动时最浓、停下后渐淡。
 */
export function CoverFlow({
  src,
  className,
  fallback,
  speed = 1,
  still = false,
  pull = false,
}: {
  src?: string | null
  className?: string
  fallback: ReactNode
  /** 流动速度倍数，详情页比首页慢 */
  speed?: number
  /** 只显示取色结果、不流动（关闭「动态背景」时的详情页） */
  still?: boolean
  /** 鼠标光标带着一团对比色（首页舞台）；触控和减弱动态效果时不做 */
  pull?: boolean
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
    flow.current?.interact(pull)
  }, [pull, failed])

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
  interact: (pull: boolean) => void
  dispose: () => void
}

const N = 4
// 取色只需要缩略图
const SAMPLE = 48
const SCALE = 0.5
const FADE_MS = 900
// 光标色团：浓度、半径（以画面高度为 1）、追光标的快慢、停下后留下的比例
const PULL = 0.6
const PULL_RADIUS = 0.3
const FOLLOW = 5
const REST = 0.3

const VERT = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}'

const FRAG = `
precision mediump float;
uniform vec3 uC[4];
uniform vec4 uK;
uniform float uTime;
uniform vec2 uRes;
// 光标位置（与 p 同一坐标）、牵引强度、光标色团半径
uniform vec4 uPtr;

// 离光标近的色心被轻轻拉过去一点
vec2 pull(vec2 P) {
  vec2 d = uPtr.xy - P;
  return P + d * 0.35 * uPtr.z * exp(-dot(d, d) * 1.2);
}

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

  // 光标处原本是什么颜色：按未牵引的色心算，否则拉过来的颜色会改变自己的选中权重，来回摆动
  vec2 m = uPtr.xy;
  vec4 dm = vec4(dot(m - P0, m - P0), dot(m - P1, m - P1), dot(m - P2, m - P2), dot(m - P3, m - P3));
  vec4 wm = uK / (dm + 0.03);
  wm = wm * wm;
  vec3 cm = (uC[0] * wm.x + uC[1] * wm.y + uC[2] * wm.z + uC[3] * wm.w) / (wm.x + wm.y + wm.z + wm.w);
  // 光标带着一团「别处的颜色」：和光标处差得越多的颜色占比越大，按比例混合而不是只挑一个，换色时不跳
  vec4 s = smoothstep(0.03, 0.3, vec4(distance(uC[0], cm), distance(uC[1], cm), distance(uC[2], cm), distance(uC[3], cm)));
  float sn = s.x + s.y + s.z + s.w;
  vec3 c5 = sn > 0.001 ? (uC[0] * s.x + uC[1] * s.y + uC[2] * s.z + uC[3] * s.w) / sn : cm;

  P0 = pull(P0); P1 = pull(P1); P2 = pull(P2); P3 = pull(P3);
  vec4 d = vec4(dot(q - P0, q - P0), dot(q - P1, q - P1), dot(q - P2, q - P2), dot(q - P3, q - P3));
  vec4 w = uK / (d + 0.03);
  w = w * w;
  vec3 col = (uC[0] * w.x + uC[1] * w.y + uC[2] * w.z + uC[3] * w.w) / (w.x + w.y + w.z + w.w);
  // 色团直接按圆形渐隐叠上去：并进反比混色的话，周围色心强的一侧会把它挤偏一百多像素。
  // 只取一小部分扭曲，边缘跟着液体起伏，中心仍落在光标上
  vec2 qm = mix(p, q, 0.25) - m;
  col = mix(col, c5, 0.8 * uPtr.z * exp(-dot(qm, qm) / (uPtr.w * uPtr.w + 0.0001)));

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
  const uC = u('uC'), uK = u('uK'), uTime = u('uTime'), uRes = u('uRes'), uPtr = u('uPtr')

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
  // 鼠标互动：tgt 是光标的实际位置，ptr 带惯性追过去；pullAmt 平滑起落，开关时不跳
  let interactive = false
  const tgt = { x: 0, y: 0 }
  const ptr = { x: 0, y: 0 }
  let inside = false
  let movedAt = 0
  let pullAmt = 0
  const onPointer = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return
    const r = canvas.getBoundingClientRect()
    const was = inside
    inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom
    if (!inside || !r.height) return
    tgt.x = (e.clientX - r.left - r.width / 2) / r.height
    tgt.y = (r.top + r.height / 2 - e.clientY) / r.height
    // 从外面移进来时直接落在光标处，免得色团从上一次离开的位置滑过来
    if (!was && pullAmt < 0.01) Object.assign(ptr, tgt)
    movedAt = performance.now()
  }
  const onLeave = () => { inside = false }

  const lerp = (a: number, b: number, k: number) => a + (b - a) * k
  const draw = () => {
    gl.uniform3fv(uC, cur.c.flat())
    gl.uniform4fv(uK, cur.k)
    gl.uniform1f(uTime, time)
    gl.uniform2f(uRes, canvas.width, canvas.height)
    gl.uniform4f(uPtr, ptr.x, ptr.y, pullAmt * PULL, PULL_RADIUS)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }
  const step = (now: number) => {
    raf = 0
    // 约 30 帧就够流畅，省一半功耗
    if (now - last >= 32) {
      const dt = Math.min((now - last) / 1000, 0.1)
      last = now
      if (!frozen()) time += dt * speed
      // 移动时最浓，停下约 1 秒后只留一点，离开画面后慢慢散开
      const pullTo = interactive && inside && !frozen() ? (now - movedAt < 900 ? 1 : REST) : 0
      const ease = (k: number) => 1 - Math.exp(-dt * k)
      ptr.x += (tgt.x - ptr.x) * ease(FOLLOW)
      ptr.y += (tgt.y - ptr.y) * ease(FOLLOW)
      pullAmt += (pullTo - pullAmt) * ease(pullTo > pullAmt ? 2.5 : 0.9)
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
    interact(on) {
      interactive = on
      if (on) {
        window.addEventListener('pointermove', onPointer, { passive: true })
        document.documentElement.addEventListener('pointerleave', onLeave)
      } else {
        window.removeEventListener('pointermove', onPointer)
        document.documentElement.removeEventListener('pointerleave', onLeave)
        inside = false
      }
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
      window.removeEventListener('pointermove', onPointer)
      document.documentElement.removeEventListener('pointerleave', onLeave)
      gl.getExtension('WEBGL_lose_context')?.loseContext()
      canvas.remove()
    },
  }
}
