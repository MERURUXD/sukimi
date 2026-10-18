import { useApolloClient, useQuery } from '@apollo/client/react'
import { useDrag } from '@use-gesture/react'
import { BookOpen, Play, Search, Shuffle, X } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Link, useLocation, useNavigate, useNavigationType } from 'react-router'
import { Glass } from '@/components/glass/Glass'
import { CoverImg } from '@/components/manga/CoverImg'
import { MangaChapters, MangaDetail } from '@/features/manga/queries'
import { STATUS } from '@/features/manga/status'
import type { LibraryManga } from '@/features/library/queries'
import { NEUTRAL, coverColor, rgbCss } from '@/lib/coverColor'
import { count } from '@/lib/format'
import { cn } from '@/lib/cn'
import { PAGE_PATH_ATTR } from '@/lib/coverTransition'
import { MobileTabBar } from '@/app/MobileTabBar'
import { SideNav } from '@/app/SideNav'
import { TopNav } from '@/app/TopNav'
import type { Rgb } from '@/lib/palette'
import {
  HOME_WALL,
  assignSlots,
  homeWallExtra,
  DESKTOP_GRID,
  MOBILE_GRID,
  centerOn,
  clamp01,
  clampSpeed,
  decay,
  domePose,
  introPhases,
  nearestCell,
  nearestCellOf,
  reticleTarget,
  snapTarget,
  visibleCells,
  type Grid,
} from './canvasMath'
import { GALLERY, HERO_BOX, HERO_VIGNETTE, HeroCopy, type HeroLayout } from './GalleryHero'
import { wallItem, wallPosOf, wallState } from './wall'
import { BACK_SLOT, GalleryBack } from './GalleryBack'
import { armCanvasBack } from './readMorph'
import { GlassLink } from '@/components/glass/GlassLink'
import { useForceDark } from '@/design/settings'
import { galleryOrder, NSFW_ALL_HIDDEN, useGalleryLibrary, useMobile, useReducedMotionPref } from './hooks'
import { GalleryPeek } from './queries'
import { PERSPECTIVE, poseTransform, screenCenter, tileTransform, type TilePose } from './coverPose'
import { PlayView, type PlayEntry } from './PlayView'
import { fit } from './titleFit'
import './gallery.css'

/** 详情层：选中的是第几部，从哪一格飞出来 */
interface Selection {
  index: number
  /** 打开时的那一部；翻到别的作品后关闭直接淡出，不飞回 */
  origin: number
  key: string | null
  /** 被点的格子；从详情页返回恢复时没有，封面直接停在详情位 */
  tile: TilePose | null
}

/** 放映层：叠在画布上；退出时封面飞回 landing 那一格 */
interface PlayState extends PlayEntry {
  /** 每次进放映换一个，重新挂载放映层 */
  seq: number
  closing: boolean
  landing: TilePose | null
}

/** 离开画布（进详情页）时记下位置、打开的详情和放映到的那一部，返回时原样恢复，封面才能飞回来 */
let memory: { ox: number; oy: number; sel: Selection | null; selId: number | null; playId: number | null; mobile: boolean } | null = null

const pad = (i: number) => String(i + 1).padStart(2, '0')


/** 无限画布：整个书库铺成一颗可以拖动的球面。固定深色、全屏，不在 AppShell 里。 */
export function CanvasPage() {
  useForceDark()
  const { all, full, totals, stats, categories, loading, error, refetch } = useGalleryLibrary()
  const items = useMemo(() => galleryOrder(all), [all])
  const n = items.length
  const mobile = useMobile()
  const reduced = useReducedMotionPref()
  const grid = mobile ? MOBILE_GRID : DESKTOP_GRID
  const location = useLocation()
  const navType = useNavigationType()
  const navigate = useNavigate()
  const client = useApolloClient()
  const navState = location.state as { from?: string; layout?: HeroLayout } | null
  const fromGallery = navState?.from === 'gallery'
  // 首页首屏在屏幕上的位置；直接打开网址时没有，按首页没滚动时的样子摆
  const hero = fromGallery ? navState?.layout : undefined
  const restoring = navType === 'POP' && memory?.mobile === mobile ? memory : null
  // 放映和画布是同一个页面（见 router）：放映叠在画布上，封面在页面里直接飞，不靠换页动画
  const atPlay = location.pathname === `${GALLERY}/play`

  const root = useRef<HTMLDivElement>(null)
  const field = useRef<HTMLDivElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const hud = useRef<HTMLDivElement>(null)
  const reticle = useRef<HTMLDivElement>(null)
  const introVig = useRef<HTMLDivElement>(null)
  const domeVig = useRef<HTMLDivElement>(null)
  const slots = useRef<(HTMLButtonElement | null)[]>([])
  const slotMeta = useRef<({ key: string; idx: number; url: string | null } & TilePose)[]>([])

  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight })
  const [focus, setFocus] = useState(-1)
  const [ready, setReady] = useState(!fromGallery || reduced || !!restoring)
  // 返回时那一部可能已被移出书库（排序下标对不上了）：对不上就不恢复详情层
  const [sel, setSel] = useState<Selection | null>(restoring?.sel && items[restoring.sel.index]?.id === restoring.selId ? restoring.sel : null)
  const [hudStart] = useState(ready ? 1 : 0)
  const [closing, setClosing] = useState(false)
  // 关闭动画期间仍算「打开」：输入照样屏蔽，那一格要等封面飞回去才露出来
  const selRef = useRef(sel)
  selRef.current = sel
  const closingRef = useRef(closing)
  closingRef.current = closing
  const [play, setPlay] = useState<PlayState | null>(() =>
    atPlay ? { id: restoring?.playId ?? (location.state as { id?: number } | null)?.id ?? -1, tile: null, restored: !!restoring, seq: 0, closing: false, landing: null } : null,
  )
  const playRef = useRef(play)
  playRef.current = play
  /** 放映飞走（或要飞回）的那一格，先藏起来 */
  const playKey = useRef<string | null>(null)
  /** 放映当前放到的那一部 */
  const playCur = useRef<number | null>(null)

  /** 每帧改的状态放在 ref 里，不让 React 每帧重渲染 */
  const view = useRef({
    // 从首页进来时在第一次画的时候接着首页那面墙的位置（要用画布实际的宽高换算，见 paint）
    ox: restoring?.ox ?? NaN,
    oy: restoring?.oy ?? NaN,
    vx: 0,
    vy: 0,
    /** 进入过渡进度：0 是画廊首页的墙，1 是球面画布 */
    t: ready ? 1 : 0,
    tween: null as null | { from: number; to: number; start: number | null; delay: number; dur: number; done?: () => void },
    dragging: false,
    moved: false,
    lastInput: 0,
    last: 0,
    panTo: null as null | { x: number; y: number },
    /** 取景框当前的位置（框中心的屏幕坐标与放大倍数）和它要去的位置 */
    ret: { x: NaN, y: 0, k: 1 },
    retTo: null as null | { x: number; y: number; k: number },
  })
  const assigned = useRef(new Map<string, number>())
  const painted = useRef({ ox: NaN, oy: NaN, t: NaN, playKey: null as string | null })
  /** 正在倒放过渡回首页：不再重放进入过渡，也不记住位置 */
  const leaving = useRef(false)
  const raf = useRef(0)
  const itemsRef = useRef(items)
  itemsRef.current = items

  /* 尺寸 */
  useLayoutEffect(() => {
    const el = root.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // 格子池：按最大可见范围（过渡开始时墙缩小倾斜）算一次，之后只改位置和图片
  const poolSize = useMemo(() => {
    const cells = visibleCells(0, 0, size.w, size.h, grid, { scale: HOME_WALL.scale, ...homeWallExtra(size.w, size.h) })
    return cells.length + 24
  }, [size, grid])

  /** 取景框只改位置和大小，居中的偏移放在 translate 里 */
  const drawReticle = useCallback(() => {
    const el = reticle.current
    const r = view.current.ret
    if (!el || Number.isNaN(r.x)) return
    const bw = grid.cw + 54
    const bh = grid.ch + 54
    el.style.transform = `translate3d(${(r.x - bw / 2).toFixed(1)}px, ${(r.y - bh / 2).toFixed(1)}px, 0) scale(${r.k.toFixed(4)})`
  }, [grid])

  /** 把当前状态画到 DOM 上 */
  const paint = useCallback(() => {
    const v = view.current
    const list = itemsRef.current
    // 读实际尺寸：尺寸状态的初值是窗口宽度，比画布实际宽一个滚动条，第一帧就会和首页错开
    const w = root.current?.clientWidth || size.w
    const h = root.current?.clientHeight || size.h
    if (!list.length || !w) return
    if (Number.isNaN(v.ox)) {
      // 从首页进来时接着首页那面墙的位置，第一帧和首页一模一样
      const fromWall = fromGallery && wallState.grid === grid && !Number.isNaN(wallState.cx)
      const c = fromWall ? { x: wallState.cx + w / 2, y: wallState.cy + h / 2 } : centerOn(0, 0, w, h, grid)
      v.ox = c.x
      v.oy = c.y
    }
    // 取景框落位时还会继续请求帧，墙没有移动就沿用已画好的封面。
    const prev = painted.current
    if (prev.ox === v.ox && prev.oy === v.oy && prev.t === v.t && prev.playKey === playKey.current) return
    Object.assign(prev, { ox: v.ox, oy: v.oy, t: v.t, playKey: playKey.current })
    const p = introPhases(v.t)
    const scale = HOME_WALL.scale + (1 - HOME_WALL.scale) * p.wall
    // 过渡时整面墙顺着首页的流动方向再滑一段（首页的墙按同样的偏移画，第一帧正好接上）
    const ox = v.ox + HOME_WALL.slide * (1 - p.wall)
    const cells = visibleCells(ox, v.oy, w, h, grid, { scale, ...homeWallExtra(w, h, p.wall) })
    const center = nearestCell(cells)
    const s = selRef.current
    const pl = playRef.current
    const open = (!!s && !closingRef.current) || (!!pl && !pl.closing)

    const next = assignSlots(assigned.current, cells.map((c) => c.key), poolSize)
    assigned.current = next
    const used = new Set(next.values())

    const byKey = new Map(cells.map((c) => [c.key, c]))
    for (let i = 0; i < poolSize; i++) {
      const el = slots.current[i]
      if (!el) continue
      if (!used.has(i) && el.style.visibility !== 'hidden') {
        el.style.visibility = 'hidden'
        continue
      }
    }
    for (const [key, i] of next) {
      const el = slots.current[i]
      const cell = byKey.get(key)
      if (!el || !cell) continue
      const idx = wallItem(cell.c, cell.r, list.length)
      const m = list[idx]
      const meta = (slotMeta.current[i] ??= { key: '', idx: -1, x: 0, y: 0, z: 0, rx: 0, ry: 0, url: null })
      if (meta.idx !== idx || meta.url !== m.thumbnailUrl) {
        const img = el.firstElementChild as HTMLImageElement
        img.style.visibility = ''
        if (m.thumbnailUrl) img.src = m.thumbnailUrl
        else img.removeAttribute('src')
        el.setAttribute('aria-label', m.title)
        meta.url = m.thumbnailUrl
      }
      const focused = cell === center
      const pose = domePose(cell.nx, cell.ny, p.dome, focused)
      meta.key = key
      meta.idx = idx
      meta.x = cell.x
      meta.y = cell.y
      meta.z = pose.z
      meta.rx = pose.rx
      meta.ry = pose.ry
      // 正在详情里展示的那一格先藏起来，看起来就是它飞出去了
      const away = (s && s.key === key && s.index === s.origin) || playKey.current === key
      const visibility = away ? 'hidden' : ''
      if (el.style.visibility !== visibility) el.style.visibility = visibility
      el.style.opacity = String(pose.opacity)
      const zIndex = focused ? '3' : '1'
      if (el.style.zIndex !== zIndex) el.style.zIndex = zIndex
      el.style.transform = `translate3d(${cell.x.toFixed(1)}px, ${cell.y.toFixed(1)}px, ${pose.z.toFixed(1)}px) rotateY(${pose.ry.toFixed(2)}deg) rotateX(${pose.rx.toFixed(2)}deg)`
    }

    if (field.current) {
      // 首页那面墙的中心不一定在屏幕中心（手机上墙只占上半屏），过渡开始时对准它
      const off = 1 - p.wall
      const dx = hero ? (hero.left + hero.width / 2 - w / 2) * off : 0
      const dy = hero ? (hero.top + hero.height / 2 - h / 2) * off : 0
      field.current.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) perspective(1800px) rotateX(${(HOME_WALL.rotateX * (1 - p.wall)).toFixed(2)}deg) rotateZ(${(HOME_WALL.rotateZ * (1 - p.wall)).toFixed(2)}deg) scale(${(scale * (open ? 1.08 : 1)).toFixed(4)})`
    }
    if (introVig.current) introVig.current.style.opacity = (1 - p.wall).toFixed(3)
    if (domeVig.current) domeVig.current.style.opacity = p.wall.toFixed(3)
    // 透明度只放在玻璃和文字自身：祖先带透明度时玻璃采不到背后的墙
    if (stage.current) {
      const st = stage.current.style
      st.display = v.t >= 1 ? 'none' : ''
      st.setProperty('--fade', (1 - p.panel).toFixed(3))
      st.setProperty('--lift', `${(-24 * p.panel).toFixed(1)}px`)
      st.setProperty('--panel', p.panel.toFixed(3))
    }
    if (hud.current) {
      // 详情层收起、封面还在飞回时也先不显示：底部大标题等封面落回格子后再淡入，免得被飞行中的封面压住
      hud.current.style.setProperty('--hud', s || pl ? '0' : p.hud.toFixed(3))
      hud.current.style.pointerEvents = !s && !pl && p.hud > 0.5 ? '' : 'none'
    }
    if (center) {
      v.retTo = reticleTarget(center, grid, w, h, p.dome, scale, PERSPECTIVE)
      // 第一次出现和进入过渡中（取景框还看不见）直接就位，之后由 tick 滑过去
      if (Number.isNaN(v.ret.x) || v.t < 1 || reduced) {
        v.ret = { ...v.retTo }
        drawReticle()
      }
      setFocus(wallItem(center.c, center.r, list.length))
    }
  }, [size, grid, poolSize, hero, fromGallery, reduced, drawReticle])

  /** 推进一帧：过渡补间、惯性、吸附、平移动画 */
  const tick = useCallback(
    (now: number) => {
      raf.current = 0
      const v = view.current
      const dt = v.last ? Math.min(48, now - v.last) : 16
      v.last = now
      let active = false
      if (v.tween) {
        const tw = v.tween
        tw.start ??= now
        const k = clamp01((now - tw.start - tw.delay) / tw.dur)
        const t = tw.from + (tw.to - tw.from) * k
        // 首页那面墙一直缓慢流动，和首页接上
        if (!reduced && t < 1) v.ox -= dt * HOME_WALL.drift * (1 - t)
        v.t = t
        if (k >= 1) {
          v.tween = null
          tw.done?.()
        } else active = true
      } else if (!v.dragging && !selRef.current && !playRef.current && v.t >= 1 && size.w) {
        if (v.panTo) {
          const k = reduced ? 1 : Math.min(1, dt * 0.008)
          v.ox += (v.panTo.x - v.ox) * k
          v.oy += (v.panTo.y - v.oy) * k
          if (Math.hypot(v.panTo.x - v.ox, v.panTo.y - v.oy) < 0.5) {
            v.ox = v.panTo.x
            v.oy = v.panTo.y
            v.panTo = null
          } else active = true
        } else {
          v.vx = decay(v.vx, dt)
          v.vy = decay(v.vy, dt)
          v.ox += v.vx * dt
          v.oy += v.vy * dt
          if (Math.abs(v.vx) + Math.abs(v.vy) < 0.06) {
            v.vx = v.vy = 0
            // 松手稍等一下再吸附，免得慢慢拖的时候被拽走
            if (now - v.lastInput > 180) {
              const target = snapTarget(v.ox, v.oy, size.w, size.h, grid)
              const k = reduced ? 1 : Math.min(1, dt * 0.01)
              v.ox += (target.x - v.ox) * k
              v.oy += (target.y - v.oy) * k
              if (Math.hypot(target.x - v.ox, target.y - v.oy) < 0.3) {
                v.ox = target.x
                v.oy = target.y
              } else active = true
            } else active = true
          } else active = true
        }
      }
      paint()
      // 取景框吸附到最近的封面：拖动时一格一格跳着套，停稳后随画面吸附回中心
      const r = v.ret
      const to = v.retTo
      if (to && v.t >= 1 && !reduced && (r.x !== to.x || r.y !== to.y || r.k !== to.k)) {
        const e = 1 - Math.exp(-dt / 70)
        r.x += (to.x - r.x) * e
        r.y += (to.y - r.y) * e
        r.k += (to.k - r.k) * e
        if (Math.abs(to.x - r.x) + Math.abs(to.y - r.y) < 0.3 && Math.abs(to.k - r.k) < 0.002) Object.assign(r, to)
        else active = true
        drawReticle()
      }
      if (active) raf.current = requestAnimationFrame((t) => tickRef.current(t))
      else v.last = 0
    },
    [paint, drawReticle, reduced, size, grid],
  )

  // 下一帧总是用最新的 tick（尺寸、格距变了以后闭包会换）
  const tickRef = useRef<(now: number) => void>(() => {})
  useLayoutEffect(() => {
    tickRef.current = tick
  }, [tick])
  const kick = useCallback(() => {
    if (!raf.current) raf.current = requestAnimationFrame((t) => tickRef.current(t))
  }, [])

  // 尺寸、书目、格子池变化后重画；新的 tick 闭包接手正在进行的动画。
  // ready 变化时首屏层（stage）会重新挂上，样式要重画一遍：返回倒放的第一帧与上次画的位置相同，paint 会直接跳过
  useLayoutEffect(() => {
    cancelAnimationFrame(raf.current)
    raf.current = 0
    painted.current.t = NaN
    paint()
    kick()
  }, [paint, kick, items, sel, closing, play, ready])
  useEffect(
    () => () => {
      cancelAnimationFrame(raf.current)
      // 清零：开发模式的严格模式会模拟卸载再挂载，留着旧编号 kick 就再也排不上下一帧
      raf.current = 0
    },
    [],
  )

  // 换了手机 / 桌面格距：回到第一格
  const lastGrid = useRef<Grid>(grid)
  useEffect(() => {
    if (lastGrid.current === grid) return
    lastGrid.current = grid
    const c = centerOn(0, 0, size.w, size.h, grid)
    Object.assign(view.current, { ox: c.x, oy: c.y, vx: 0, vy: 0, panTo: null })
    assigned.current = new Map()
    kick()
  }, [grid, size, kick])

  /* 进入过渡：从画廊首页点进来时，先摆成首页的墙，再散开、转正、鼓成球 */
  useEffect(() => {
    if (ready || !n || leaving.current) return
    view.current.tween = {
      from: view.current.t,
      to: 1,
      start: null,
      delay: 150,
      dur: 2400,
      done: () => setReady(true),
    }
    kick()
  }, [ready, n, kick])

  const goHome = () => {
    if (leaving.current) return
    leaving.current = true
    memory = null
    let gone = false
    // 从画廊首页点进来的就后退（首页滚动位置还在），否则打开首页
    const back = () => {
      if (gone) return
      gone = true
      if (fromGallery && !reduced) armCanvasBack()
      if (fromGallery && (window.history.state?.idx ?? 0) > 0) navigate(-1)
      else navigate(GALLERY)
    }
    if (!fromGallery || reduced) return back()
    // 倒放靠动画帧推进，标签页切到后台时动画帧会停；到时间没放完也照样回首页
    setTimeout(back, 1700 * view.current.t + 600)
    // 倒放进入过渡，结束后再回首页（首页的墙正好接上）
    setSel(null)
    setReady(false)
    const v = view.current
    v.vx = v.vy = 0
    v.panTo = null
    v.tween = {
      from: v.t,
      to: 0,
      start: null,
      delay: 0,
      dur: 1700 * v.t + 1,
      done: () => {
        // 把墙的位置交还给首页，首页的墙从这里接着流动
        const w = root.current?.clientWidth || size.w
        const h = root.current?.clientHeight || size.h
        Object.assign(wallState, { cx: v.ox - w / 2, cy: v.oy - h / 2, grid })
        back()
      },
    }
    kick()
  }

  // 仅开发环境：控制台用 __galleryCanvas.seek(0.3) 把进入过渡停在某个进度，逐帧检查位置；state() 看当前状态
  useEffect(() => {
    if (!import.meta.env.DEV) return
    const w = window as unknown as { __galleryCanvas?: object }
    w.__galleryCanvas = {
      seek: (t: number) => {
        view.current.tween = null
        view.current.t = clamp01(t)
        paint()
      },
      state: () => ({ t: view.current.t, ready, leaving: leaving.current, tween: !!view.current.tween, ox: view.current.ox, oy: view.current.oy, play: playRef.current }),
    }
    return () => {
      delete w.__galleryCanvas
    }
  })

  /* 拖动、甩动；点按交给格子自己的 onClick */
  const bind = useDrag(
    ({ first, last, movement: [mx, my], velocity: [vx, vy], direction: [dx, dy], memo }) => {
      const v = view.current
      if (selRef.current || playRef.current || v.t < 1) return memo
      const start = first ? { ox: v.ox, oy: v.oy } : (memo as { ox: number; oy: number } | undefined)
      if (!start) return memo
      if (first) {
        v.vx = v.vy = 0
        v.panTo = null
        v.moved = false
      }
      v.dragging = !last
      v.ox = start.ox + mx
      v.oy = start.oy + my
      if (Math.abs(mx) + Math.abs(my) > 4) v.moved = true
      v.lastInput = performance.now()
      if (last && !reduced) {
        v.vx = clampSpeed(vx * dx)
        v.vy = clampSpeed(vy * dy)
      }
      kick()
      return start
    },
    { pointer: { capture: false }, filterTaps: true },
  )

  const onWheel = (e: React.WheelEvent) => {
    const v = view.current
    if (selRef.current || playRef.current || v.t < 1) return
    v.lastInput = performance.now()
    v.vx = v.vy = 0
    v.panTo = null
    // 只有竖向滚轮时按住 Shift 横着走
    const sx = e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX
    const sy = e.shiftKey && !e.deltaX ? 0 : e.deltaY
    v.ox -= sx
    v.oy -= sy
    kick()
  }

  const centerCell = () => {
    const v = view.current
    const cells = visibleCells(v.ox, v.oy, size.w, size.h, grid)
    return nearestCell(cells)
  }

  const panToCell = (c: number, r: number) => {
    const v = view.current
    v.vx = v.vy = 0
    v.panTo = centerOn(c, r, size.w, size.h, grid)
    v.lastInput = performance.now()
    kick()
  }

  const spin = () => {
    const v = view.current
    v.panTo = null
    v.lastInput = performance.now()
    if (reduced) {
      // 不放动画时直接跳到随机一格
      const c = centerCell()
      if (c) panToCell(c.c + Math.round(Math.random() * 16 - 8), c.r + Math.round(Math.random() * 10 - 5))
      return
    }
    const a = Math.random() * Math.PI * 2
    const sp = 2.6 + Math.random() * 1.2
    v.vx = Math.cos(a) * sp
    v.vy = Math.sin(a) * sp
    kick()
  }

  const openSlot = (i: number) => {
    const v = view.current
    if (v.moved || v.t < 1 || selRef.current) return
    const el = slots.current[i]
    const meta = slotMeta.current[i]
    if (!el || !meta) return
    setClosing(false)
    setSel({ index: meta.idx, origin: meta.idx, key: meta.key, tile: { x: meta.x, y: meta.y, z: meta.z, rx: meta.rx, ry: meta.ry } })
  }

  const close = useCallback(() => {
    const s = selRef.current
    if (!s) return
    // 从作品详情页返回时详情层是直接摆好的，不知道从哪一格来：画布已恢复到原来的位置，按格子编号找回那一格，封面照样飞回去
    if (!s.tile && s.key && s.index === s.origin) {
      const slot = assigned.current.get(s.key)
      const meta = slot === undefined ? undefined : slotMeta.current[slot]
      if (meta && meta.idx === s.index) setSel({ ...s, tile: { x: meta.x, y: meta.y, z: meta.z, rx: meta.rx, ry: meta.ry } })
    }
    setClosing(true)
  }, [])
  const closed = useCallback(() => {
    setSel(null)
    setClosing(false)
  }, [])

  const step = useCallback(
    (d: number) => {
      setSel((s) => (s && n ? { ...s, index: (s.index + d + n) % n } : s))
    },
    [n],
  )

  /* 键盘：方向键平移一格，回车打开中心那部；详情里 ← → 翻页，Esc 关闭 */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.ctrlKey || e.metaKey || e.altKey || playRef.current) return
      if (selRef.current) {
        if (e.key === 'Escape') close()
        else if (e.key === 'ArrowLeft') step(-1)
        else if (e.key === 'ArrowRight') step(1)
        else return
        e.preventDefault()
        return
      }
      if (view.current.t < 1) return
      const c = centerCell()
      if (!c) return
      const moves: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }
      const mv = moves[e.key]
      if (mv) {
        e.preventDefault()
        panToCell(c.c + mv[0], c.r + mv[1])
      } else if (e.key === 'Enter' && document.activeElement === document.body) {
        const slot = assigned.current.get(c.key)
        if (slot !== undefined) openSlot(slot)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // 离开画布时记下位置；从详情页返回时恢复
  useEffect(
    () => () => {
      // 不记格子位置：返回时封面由视图过渡飞回，详情层直接摆在终点，免得两段动画叠在一起
      if (!leaving.current)
        memory = {
          ox: view.current.ox,
          oy: view.current.oy,
          sel: selRef.current && { ...selRef.current, tile: null },
          selId: selRef.current && (itemsRef.current[selRef.current.index]?.id ?? null),
          playId: playRef.current && playCur.current,
          mobile,
        }
    },
    [mobile],
  )

  /*
   * 放映（只在画布上有入口）：从中心那部开始，那一格的封面直接飞成放映页左侧的大封面。
   * 放映叠在画布上，退出时画布把正在放的那一部摆到中心，封面再飞回那一格。
   */
  const startPlay = () => {
    const c = centerCell()
    const slot = c ? assigned.current.get(c.key) : undefined
    const meta = slot === undefined ? undefined : slotMeta.current[slot]
    if (!c || !meta || !n || playRef.current) return
    const id = items[meta.idx].id
    playKey.current = c.key
    // 等网址变了再挂上放映（见下面的网址同步）：换页和这里的状态更新不一定在同一次渲染里生效
    pendingPlay.current = { id, tile: { x: meta.x, y: meta.y, z: meta.z, rx: meta.rx, ry: meta.ry } }
    navigate(`${GALLERY}/play`, { state: { from: 'canvas', id } })
  }

  const leavePlay = () => {
    const id = playCur.current ?? playRef.current?.id
    const idx = items.findIndex((m) => m.id === id)
    const c = centerCell()
    const target = idx >= 0 && c ? nearestCellOf(wallPosOf(idx, n), n, c) : null
    let landing: TilePose | null = null
    if (target) {
      // 放映盖着画布，直接把这一部摆到中心，不用平移过去
      const o = centerOn(target.c, target.r, size.w, size.h, grid)
      Object.assign(view.current, { ox: o.x, oy: o.y, vx: 0, vy: 0, panTo: null })
      playKey.current = `${target.c}:${target.r}`
      paint()
      const slot = assigned.current.get(playKey.current)
      const meta = slot === undefined ? undefined : slotMeta.current[slot]
      if (meta) landing = { x: meta.x, y: meta.y, z: meta.z, rx: meta.rx, ry: meta.ry }
    }
    setPlay((p) => p && { ...p, closing: true, landing })
  }

  const exitPlay = useCallback(() => {
    // 从画布点进来的就后退，否则换成画布的网址；两者是同一个页面，网址变了以后再开始退出动画
    if ((location.state as { from?: string } | null)?.from === 'canvas' && (window.history.state?.idx ?? 0) > 0) navigate(-1)
    else navigate(`${GALLERY}/canvas`, { replace: true })
  }, [location.state, navigate])

  const playClosed = useCallback(() => {
    playKey.current = null
    setPlay(null)
  }, [])
  const onPlayCurrent = useCallback((id: number) => {
    playCur.current = id
  }, [])

  // 网址进出放映（包括浏览器的前进后退）都在这里挂上、收起放映层
  const pendingPlay = useRef<PlayEntry | null>(null)
  const wasAtPlay = useRef(atPlay)
  useEffect(() => {
    if (wasAtPlay.current === atPlay) return
    wasAtPlay.current = atPlay
    if (atPlay) {
      const entry = pendingPlay.current ?? { id: (location.state as { id?: number } | null)?.id ?? -1, tile: null }
      pendingPlay.current = null
      // 上一次退出还没飞完就又进来：直接换成新的一层
      setPlay((p) => ({ ...entry, seq: (p?.seq ?? 0) + 1, closing: false, landing: null }))
    } else if (playRef.current && !playRef.current.closing) leavePlay()
  })

  /* 搜索：跳到最近一格放着这部的位置 */
  const [searching, setSearching] = useState(false)
  const jumpTo = (index: number) => {
    setSearching(false)
    const c = centerCell()
    const target = c && nearestCellOf(wallPosOf(index, n), n, c)
    if (target) panToCell(target.c, target.r)
  }

  const focused = focus >= 0 ? items[focus] : undefined
  const chapterCount = (m: LibraryManga) => (totals ? count(totals.get(m.id) ?? 0) : '—')
  const status = (m: LibraryManga) => STATUS[m.status] ?? ''
  const titleSize = focused ? (mobile ? fit(focused.title, size.w - 40, 64, 28, 3) : fit(focused.title, size.w - 104, 184, 56, 3)) : 0
  const selected = sel ? items[sel.index] : undefined

  // 打开详情时预取详情页数据，点「作品详情」进去时已经在缓存里
  useEffect(() => {
    if (!selected) return
    void client.query({ query: MangaDetail, variables: { id: selected.id } }).catch(() => {})
    void client.query({ query: MangaChapters, variables: { mangaId: selected.id } }).catch(() => {})
  }, [client, selected])

  return (
    <div
      ref={root}
      data-theme="dark"
      {...{ [PAGE_PATH_ATTR]: location.pathname }}
      className="fixed inset-0 touch-none overflow-hidden bg-bg text-text select-none"
    >
      {/* 拖动手势只绑在封面层上：按钮和详情层若在手势区域里，按下时被拦住冒泡，
          手势库只收到松开，会把这次点击当成拖动结束吞掉（「点标志回不去」就是这样） */}
      <div
        className={cn('absolute inset-0', ready && !sel && 'cursor-grab active:cursor-grabbing')}
        {...bind()}
        // 拖动手势过了阈值才开始，单击时不会进手势处理；每次按下先清掉上次拖动的标记
        onPointerDownCapture={() => (view.current.moved = false)}
        onWheel={onWheel}
      >
        {/* 球面：每格只改 transform，换成另一部时才换图 */}
        <div
          ref={field}
          className={cn('absolute inset-0 origin-center', ready && 'transition-[filter,transform] duration-700 ease-[cubic-bezier(.2,.8,.2,1)]')}
          style={{ perspective: PERSPECTIVE, filter: (sel && !closing) || (play && !play.closing) ? 'blur(16px) brightness(.45) saturate(1.2)' : undefined }}
        >
          {Array.from({ length: n ? poolSize : 0 }, (_, i) => (
            <button
              key={i}
              ref={(el) => {
                slots.current[i] = el
              }}
              type="button"
              tabIndex={-1}
              className="gallery-tile cv absolute top-0 left-0 rounded-[14px] p-0 md:shadow-[0_30px_60px_-24px_rgba(0,0,0,.9)]"
              style={{ width: grid.cw, visibility: 'hidden', backfaceVisibility: 'hidden' }}
              onClick={() => openSlot(i)}
            >
              <img alt="" draggable={false} decoding="async" onError={(e) => (e.currentTarget.style.visibility = 'hidden')} />
            </button>
          ))}
        </div>
      </div>

      {/* 首页的暗角，和首页同一位置（画廊固定深色）；首屏以外是首页的底色（手机上墙只占上半屏）。过渡中淡出 */}
      <div ref={introVig} aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute"
          style={{
            ...(hero ? { left: hero.left, top: hero.top, width: hero.width, height: hero.height } : { inset: 0 }),
            background: HERO_VIGNETTE[mobile ? 'mobile' : 'desktop'],
            boxShadow: '0 0 0 200vmax var(--bg)',
          }}
        />
      </div>
      <div
        ref={domeVig}
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(ellipse 62% 66% at 50% 50%, rgba(11,11,13,0) 40%, rgba(11,11,13,.72) 82%, rgba(11,11,13,.98) 100%)' }}
      />

      {/* 进入过渡的第一帧：在首页原来的位置摆出同一份首屏和导航，随后文字淡出上移、导航滑出。
          纯装饰，读屏跳过、点不到；app-shell 带上导航和内容需要的尺寸变量 */}
      {!ready && (
        <div ref={stage} aria-hidden inert className="app-shell has-tabbar pointer-events-none absolute inset-0">
          <div
            className={HERO_BOX}
            style={{ position: 'absolute', ...(hero ? { left: hero.left, top: hero.top, width: hero.width, height: hero.height, minHeight: 0 } : { left: 0, right: 0, top: 0 }) }}
          >
            <HeroCopy stats={stats} mobile={mobile} decorative />
          </div>
          {/* 只用位移让导航离开，不用透明度：祖先带透明度时里面的玻璃会失效 */}
          <div className="absolute inset-0 [translate:0_calc(var(--panel,0)*-140px)]">
            <TopNav />
          </div>
          <div className="absolute inset-0 [translate:calc(var(--panel,0)*-140px)_0]">
            <SideNav />
          </div>
          {mobile && (
            <div className="absolute inset-0 [translate:0_calc(var(--panel,0)*180px)]">
              <MobileTabBar />
            </div>
          )}
        </div>
      )}

      {/* 界面：中心取景框、底部大标题、顶部按钮 */}
      {/* --hud 由每个元素各自读成透明度，容器本身不带透明度 */}
      {/* --hud 由每个元素各自读成透明度，容器本身不带透明度；之后由 paint 逐帧改，React 不再覆盖 */}
      <div ref={hud} className="pointer-events-none absolute inset-0" style={{ '--hud': hudStart } as CSSProperties}>
        <div
          ref={reticle}
          aria-hidden
          className="absolute top-0 left-0 transition-opacity duration-500 [opacity:var(--hud)]"
          style={{ width: grid.cw + 54, height: grid.ch + 54, transform: `translate3d(${(size.w - grid.cw - 54) / 2}px, ${(size.h - grid.ch - 54) / 2}px, 0)` }}
        >
          {['top-0 left-0 border-t-2 border-l-2 rounded-tl-2xl', 'top-0 right-0 border-t-2 border-r-2 rounded-tr-2xl', 'bottom-0 left-0 border-b-2 border-l-2 rounded-bl-2xl', 'bottom-0 right-0 border-b-2 border-r-2 rounded-br-2xl'].map((c) => (
            <span key={c} className={cn('absolute size-[30px] border-white/90', c)} />
          ))}
        </div>

        {focused && (
          <div aria-live="polite" className="absolute inset-x-5 transition-opacity duration-500 [opacity:var(--hud)] bottom-[max(20px,env(safe-area-inset-bottom))] text-white mix-blend-difference md:inset-x-[52px] md:bottom-[34px]">
            <p className="m-0 mb-2 ml-1 text-xs font-medium tracking-[.3em] num md:text-[15px]">
              {[`No.${pad(focus)} / ${count(n)}`, focused.author, `${chapterCount(focused)} 话`, status(focused)].filter(Boolean).join('　')}
            </p>
            <p key={focus} className="gallery-title-in m-0 -mb-[.14em] line-clamp-3 pb-[.14em] font-cjk leading-[1.02] font-black tracking-[-0.03em] [overflow-wrap:anywhere]" style={{ fontSize: titleSize }}>
              {focused.title}
            </p>
          </div>
        )}

        <div className={cn('pointer-events-auto absolute top-[max(14px,env(safe-area-inset-top))] left-4 flex items-center gap-4', BACK_SLOT)} onPointerDown={(e) => e.stopPropagation()}>
          <GalleryBack onClick={goHome} className="[opacity:var(--hud)]" />
          <div className="flex flex-col gap-0.5 [opacity:var(--hud)]">
            <span className="font-cjk text-base font-black md:text-xl">书库画廊</span>
            <span className="text-xs text-muted md:text-[13px]">
              {count(n)} 部作品<span className="max-md:hidden"> · 拖动、甩动或滚动 · 点左侧「画廊」返回</span>
            </span>
          </div>
        </div>

        <div className="pointer-events-auto absolute top-[max(14px,env(safe-area-inset-top))] right-4 flex items-center gap-2.5 md:top-5 md:right-7" onPointerDown={(e) => e.stopPropagation()}>
          <button type="button" onClick={spin} className="solid h-11 min-h-0 gap-2 px-4 text-[15px] [opacity:var(--hud)] md:h-[50px] md:pr-[22px] md:pl-[18px]" aria-label="转一转">
            <Shuffle className="size-[18px]" strokeWidth={2} />
            <span className="max-md:hidden">转一转</span>
          </button>
          <CanvasSearch open={searching} onOpen={setSearching} items={items} onPick={jumpTo} />
          <Glass as="button" type="button" onClick={startPlay} className="gbtn h-[50px] rounded-full pr-5 pl-4 text-[15px] font-semibold [opacity:var(--hud)] max-md:hidden">
            <Play className="size-[15px] fill-current" strokeWidth={1.8} />
            放映
          </Glass>
        </div>
      </div>

      {!n && (
        <div className="absolute inset-0 grid place-items-center p-6 text-center">
          <div className="flex flex-col items-center gap-4">
            {error ? (
              <>
                <p className="m-0 text-danger">加载失败：{error.message.split('\n')[0]}</p>
                <button type="button" className="solid" onClick={() => void refetch()}>
                  重试
                </button>
              </>
            ) : (
              <p className="m-0 text-muted">{loading ? '正在加载书库…' : full.length ? NSFW_ALL_HIDDEN : '书库是空的，去「发现」页添加漫画吧。'}</p>
            )}
            {!loading && (
              <Link to={GALLERY} className={error ? 'gbtn no-underline' : 'solid no-underline'}>
                回到画廊
              </Link>
            )}
          </div>
        </div>
      )}

      {play && n > 0 && (
        <PlayView
          key={play.seq}
          items={items}
          totals={totals}
          categories={categories}
          entry={play}
          closing={play.closing}
          landing={play.landing}
          tileW={grid.cw}
          mobile={mobile}
          reduced={reduced}
          onCurrent={onPlayCurrent}
          onExit={exitPlay}
          onClosed={playClosed}
        />
      )}

      {sel && selected && (
        <CanvasDetail
          key={sel.origin + ':' + (sel.key ?? '')}
          sel={sel}
          manga={selected}
          total={n}
          chapters={chapterCount(selected)}
          status={status(selected)}
          closing={closing}
          reduced={reduced}
          mobile={mobile}
          width={size.w}
          tileW={grid.cw}
          onClose={close}
          onClosed={closed}
        />
      )}
    </div>
  )
}

/** 画布上的搜索：输入标题或作者，选中后平移到最近放着这部的格子 */
function CanvasSearch({ open, onOpen, items, onPick }: { open: boolean; onOpen: (v: boolean) => void; items: LibraryManga[]; onPick: (index: number) => void }) {
  const [q, setQ] = useState('')
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (open) input.current?.focus()
    else setQ('')
  }, [open])
  const word = q.trim().toLowerCase()
  const hits = word
    ? items
        .map((m, i) => ({ m, i }))
        .filter(({ m }) => [m.title, m.author, m.artist].filter(Boolean).join('\n').toLowerCase().includes(word))
        .slice(0, 8)
    : []
  return (
    <div className="relative">
      <Glass as="button" type="button" className="gicon size-11 rounded-full [opacity:var(--hud,1)] md:size-[50px]" aria-label="搜索书库" aria-expanded={open} onClick={() => onOpen(!open)}>
        <Search className="size-[19px]" strokeWidth={1.8} />
      </Glass>
      {open && (
        <Glass dense className="absolute top-[calc(100%+10px)] right-0 z-10 flex [opacity:var(--hud,1)] w-[min(340px,calc(100vw-32px))] flex-col gap-1 rounded-[22px] p-2">
          <label className="flex h-11 items-center gap-2.5 px-3 text-muted">
            <Search className="size-[18px] flex-none" strokeWidth={1.8} />
            <span className="sr">搜索书库</span>
            <input
              ref={input}
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') onOpen(false)
                if (e.key === 'Enter' && hits[0]) onPick(hits[0].i)
              }}
              placeholder="标题或作者"
              className="min-w-0 flex-1 border-0 bg-transparent text-text outline-none placeholder:text-faint"
            />
          </label>
          {hits.map(({ m, i }) => (
            <button key={m.id} type="button" className="opt" onClick={() => onPick(i)}>
              <span className="cv w-8 flex-none rounded-[5px]">
                <CoverImg src={m.thumbnailUrl} loading="lazy" />
              </span>
              <span className="min-w-0 flex-1 truncate text-left">{m.title}</span>
            </button>
          ))}
          {word && !hits.length && <p className="m-0 px-3 py-2 text-[13px] text-muted">书库里没有符合的作品</p>}
        </Glass>
      )}
    </div>
  )
}

/** 详情层：大封面从被点的格子飞到左侧，背景是封面主色。封面本身是进详情页的链接，能接上封面过渡。 */
function CanvasDetail({
  sel,
  manga,
  total,
  chapters,
  status,
  closing,
  reduced,
  mobile,
  width,
  tileW,
  onClose,
  onClosed,
}: {
  sel: Selection
  manga: LibraryManga
  total: number
  chapters: string
  status: string
  closing: boolean
  reduced: boolean
  mobile: boolean
  width: number
  /** 画布格子的宽度 */
  tileW: number
  onClose: () => void
  onClosed: () => void
}) {
  const cover = useRef<HTMLAnchorElement>(null)
  const [color, setColor] = useState<Rgb>(NEUTRAL)
  const [shown, setShown] = useState(!sel.tile || reduced)
  const peek = useQuery(GalleryPeek, { variables: { id: manga.id } })
  const firstUnread = peek.data?.manga.firstUnreadChapter?.id
  const description = peek.data?.manga.description
  const swapped = sel.index !== sel.origin
  useEffect(() => {
    let alive = true
    void coverColor(manga.thumbnailUrl).then((c) => alive && setColor(c))
    return () => {
      alive = false
    }
  }, [manga.thumbnailUrl])

  // 静止时封面微微侧转；手机上正对着，省出横向空间。透视原点和格子一样放在屏幕中心（见 coverPose）
  const rest = useCallback(() => {
    const el = cover.current
    return el ? poseTransform(el, PERSPECTIVE, { dx: 0, dy: 0, z: 0, ry: mobile ? 0 : 12, rx: 0, rz: mobile ? 0 : -2, s: 1 }, screenCenter()) : 'none'
  }, [mobile])

  const fromTransform = useCallback(() => {
    const el = cover.current
    return el && sel.tile ? tileTransform(el, sel.tile, tileW) : rest()
  }, [sel.tile, rest, tileW])

  // 静止姿态要按布局算：封面挂上（含翻页换封面）和窗口尺寸变化时摆好；换封面的进场动画以它为终点
  useLayoutEffect(() => {
    const el = cover.current
    if (!el) return
    const place = () => el.style.setProperty('--rest', rest())
    place()
    if (!el.style.transform) el.style.transform = rest()
    const resize = () => {
      place()
      el.style.transition = 'none'
      el.style.transform = rest()
    }
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [rest, sel.index])

  // 打开：先叠在原格子上，下一帧再飞到详情位
  useLayoutEffect(() => {
    const el = cover.current
    if (!el || shown) return
    el.style.transition = 'none'
    el.style.transform = fromTransform()
    let r2 = 0
    const r1 = requestAnimationFrame(() => {
      r2 = requestAnimationFrame(() => {
        el.style.transition = 'transform .85s cubic-bezier(.2,.8,.2,1)'
        el.style.transform = rest()
        setShown(true)
      })
    })
    return () => {
      cancelAnimationFrame(r1)
      cancelAnimationFrame(r2)
    }
    // 只在打开时飞一次（shown 之后直接返回）：之后的翻页由换封面的进场动画负责
  }, [shown, fromTransform, rest])

  // 关闭：还是原来那部就飞回原格子再收起；翻到别的作品后直接淡出
  useEffect(() => {
    if (!closing) return
    const el = cover.current
    if (!el || reduced || swapped || !sel.tile) {
      // 不飞回时跟着背景一起淡出
      const t = setTimeout(onClosed, reduced ? 0 : 320)
      return () => clearTimeout(t)
    }
    el.style.animation = 'none'
    el.style.transition = 'transform .62s cubic-bezier(.4,0,.2,1)'
    el.style.transform = fromTransform()
    const t = setTimeout(onClosed, 640)
    return () => clearTimeout(t)
  }, [closing, reduced, swapped, sel.tile, onClosed, fromTransform])

  const titleSize = mobile ? fit(manga.title, width - 40, 48, 26, 3) : fit(manga.title, Math.max(320, width * 0.48), 132, 44, 3)
  const up = (i: number) => ({ '--d': `${0.22 + i * 0.06}s` }) as CSSProperties
  const info = shown && !closing

  return (
    <div role="dialog" aria-modal aria-label={manga.title} className="absolute inset-0 z-20" onPointerDown={(e) => e.stopPropagation()}>
      <div
        aria-hidden
        onClick={onClose}
        className="absolute inset-0 transition-opacity duration-500"
        style={{
          opacity: closing ? 0 : 1,
          background: `radial-gradient(circle at ${mobile ? '50% 28%' : '26% 50%'}, ${rgbCss(color, 0.9)} 0%, ${rgbCss(color, 0.4)} 34%, rgba(11,11,13,.88) 72%)`,
        }}
      />
      <section
        className={cn(
          'pointer-events-none absolute inset-0 flex cursor-default',
          mobile ? 'flex-col items-center gap-6 overflow-y-auto px-5 pt-[calc(max(14px,env(safe-area-inset-top))+72px)] pb-10' : 'items-center gap-[clamp(40px,6vw,90px)] pr-24 pl-[max(56px,9vw)]',
        )}
      >
        <Link
          ref={cover}
          key={`cover-${sel.index}`}
          to={`/manga/${manga.id}`}
          viewTransition
          aria-label={`${manga.title}，作品详情`}
          className={cn(
            'cv pointer-events-auto flex-none rounded-[18px] shadow-[0_60px_120px_-40px_rgba(0,0,0,.95)]',
            mobile ? 'w-[min(56vw,240px)]' : 'w-[min(420px,calc((100vh-200px)*2/3))]',
            swapped && !closing && 'gallery-swap',
            swapped && closing && 'opacity-0 transition-opacity duration-300',
          )}
          style={{ WebkitBoxReflect: mobile ? undefined : 'below 16px linear-gradient(transparent 70%, rgba(255,255,255,.16))' } as CSSProperties}
        >
          <CoverImg src={manga.thumbnailUrl} />
        </Link>

        <div key={`info-${sel.index}`} className={cn('pointer-events-auto flex min-w-0 flex-col', mobile ? 'items-center gap-4 text-center' : 'flex-1 gap-[22px]')} style={{ visibility: info ? undefined : 'hidden' }}>
          <p className="gallery-up m-0 text-xs font-medium tracking-[.3em] text-white/80 num md:text-[15px]" style={up(0)}>
            No.{pad(sel.index)} / {count(total)}
            {status && `　${status}`}
          </p>
          <h2 className="gallery-up m-0 -mb-[.14em] line-clamp-3 pb-[.14em] font-cjk leading-[1.06] font-black tracking-[-0.03em] [overflow-wrap:anywhere]" style={{ ...up(1), fontSize: titleSize }}>
            {manga.title}
          </h2>
          <p className="gallery-up m-0 text-base font-bold md:text-[22px]" style={up(2)}>
            {manga.author || manga.artist || '佚名'}
            <span className="font-medium text-white/70">　·　{chapters} 话</span>
          </p>
          {description && (
            <p className="gallery-up m-0 line-clamp-4 max-w-[520px] text-[15px] leading-[1.8] whitespace-pre-line text-white/80 md:text-[17px]" style={up(3)}>
              {description}
            </p>
          )}
          {/* 进场动画放在每个按钮自身，「作品详情」是玻璃，祖先不能带透明度 */}
          <div className="mt-3 flex flex-wrap gap-3 max-md:justify-center">
            {firstUnread ? (
              <Link to={`/manga/${manga.id}/chapter/${firstUnread}`} viewTransition className="gallery-up solid h-14 px-[30px] text-[17px] no-underline" style={up(4)}>
                <BookOpen className="size-[19px]" strokeWidth={1.8} />
                {manga.unreadCount > 0 && Number(manga.lastReadChapter?.lastReadAt) > 0 ? '继续阅读' : '开始阅读'}
              </Link>
            ) : (
              peek.data && <span className="gallery-up solid h-14 px-[30px] text-[17px] opacity-60" style={up(4)}>已全部读完</span>
            )}
            <GlassLink to={`/manga/${manga.id}`} viewTransition className="gallery-up gbtn h-14 rounded-full px-[26px] text-[17px] font-semibold no-underline" style={up(5)}>
              作品详情
            </GlassLink>
          </div>
        </div>
      </section>

      <div className="absolute top-[max(14px,env(safe-area-inset-top))] right-4 flex gap-2.5 md:top-5 md:right-7 [&>*]:transition-opacity [&>*]:duration-300" style={{ '--info': info ? 1 : 0, pointerEvents: info ? undefined : 'none' } as CSSProperties}>
        <Glass as="button" type="button" onClick={onClose} className="gbtn h-11 rounded-full pr-5 pl-4 text-[15px] font-semibold [opacity:var(--info)] md:h-[50px]" autoFocus>
          <X className="size-[18px]" strokeWidth={2} />
          <span className="max-md:sr">回到画布</span>
        </Glass>
      </div>
    </div>
  )
}
