import { useGesture } from '@use-gesture/react'
import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { cn } from '@/lib/cn'
import { blocksWheelTurn, clampPan, flipStillCurrent, invalidateFlip, MAX_ZOOM, NO_ZOOM, panBounds, settle, swipeResult, TAP_ZOOM, zoomAround, type Zoom } from './gestures'
import { ReaderImage } from './ReaderImage'
import { rememberAspect } from './pageCache'
import { decodePage } from './pageDecode'
import type { Half } from './pageTools'
import type { ReaderSettings } from './settings'
import { t } from '@/i18n'

/** 一屏显示的页；拆分宽页时 half 是这一屏显示的那一半 */
export interface Screen {
  pages: number[]
  half?: Half
}

const screenKey = (s: Screen) => s.pages.join('-') + (s.half === undefined ? '' : `h${s.half}`)

/** 缩放复位、双击放大、弹回的过渡时长 */
const SLIDE_MS = 200
/** 减速曲线：起步快、末尾缓，松手时接着手指的速度滑完 */
const EASE = 'cubic-bezier(0.33, 1, 0.68, 1)'
/** 双击的判定间隔；单击要等这么久确认不是双击 */
const DOUBLE_MS = 250
/** Ctrl+滚轮停顿这么久后，接近原大就复位，免得停在 1.02 倍锁住滚轮翻页 */
const WHEEL_SETTLE_MS = 200

/**
 * 单页 / 双页。
 * 点击：左 30% / 中 40% / 右 30%。两侧按阅读方向翻页，中间切换工具栏。
 *       鼠标和触屏任何位置都能双击，单击稍等确认不是双击后才生效。
 *       双击在点到的位置放大 / 复位。
 * 滚轮：向下 = 下一页，向上 = 上一页；页面比屏幕高时先滚到底 / 顶再翻。
 * 手势：横向拖动时整条「上一页 | 当前页 | 下一页」跟着手指走，松手按距离和速度决定翻页或弹回；
 *       翻页时接着手指的速度滑到位，相邻页就地变成当前页（同一个元素，不重建），中间没有空白和跳动；
 *       双指或 Ctrl+滚轮以手指 / 指针为中心缩放，放大后拖动平移（有边界），拖到边缘再轻扫可翻页。
 */
export function PagedView({
  pages,
  screen,
  prevScreen,
  nextScreen,
  src,
  settings,
  onLeft,
  onRight,
  onStep,
  onCenter,
  onAspect,
  hidden,
}: {
  /** 首屏的拼版还没定下来时先不显示（图片仍照常加载），免得拼版变化时整屏换一遍 */
  hidden?: boolean
  /** 原图地址；页码、宽高比都按原图算 */
  pages: string[]
  screen: Screen
  /** 相邻的一屏：拖动时摆在当前页两边，翻过去时直接接上 */
  prevScreen?: Screen
  nextScreen?: Screen
  /** 实际显示的地址（裁边 / 拆半后的图）；拆半页还没处理好时为 undefined */
  src: (i: number, half?: Half) => string | undefined
  settings: ReaderSettings
  onLeft: () => void
  onRight: () => void
  /** 1 = 下一页，-1 = 上一页（与方向无关，滚轮用） */
  onStep: (d: 1 | -1) => void
  onCenter: () => void
  onAspect: () => void
}) {
  const root = useRef<HTMLDivElement>(null)
  // 当前页所在的滚动容器和内容（缩放、平移、长页面滚动都作用在它们上）
  const scroller = useRef<HTMLDivElement>(null)
  const content = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState<Zoom>(NO_ZOOM)
  // 轨道的横向位移；ms = 0 时不加过渡（跟手），否则按这个时长滑到位
  const [slide, setSlide] = useState({ x: 0, ms: 0 })
  // 手指正在拖动 / 缩放：变换不加过渡，跟手；松手后的复位、双击放大才有过渡
  const [live, setLive] = useState(false)
  const lastTap = useRef({ t: 0, x: 0, y: 0 })
  // 刚拖动过：浏览器随后补发的 click 不当作点击翻页（鼠标拖动时会有）
  const dragged = useRef(false)
  const wheel = useRef({ last: 0, acc: 0, locked: false })
  const pendingTap = useRef<ReturnType<typeof setTimeout>>(undefined)
  const zoomSettle = useRef<ReturnType<typeof setTimeout>>(undefined)
  // 翻页动画的序号：卸载或新的翻页开始后，旧的那次不再继续
  const flipping = useRef(0)
  // 放大时这一下拖动开始时顶着哪边：1 = 左边缘（内容右移到底），-1 = 右边缘
  const startEdge = useRef(0)
  // 和捏合松手的复位线一致：1.02 这种看不出的倍数不锁滚轮翻页
  const zoomed = blocksWheelTurn(zoom.s)
  const key = screenKey(screen)
  // 键盘、点击、滚轮已经翻走时，作废还在等的轻扫定时器，并收回轨道
  const [trackedKey, setTrackedKey] = useState(key)
  if (trackedKey !== key) {
    setTrackedKey(key)
    flipping.current = invalidateFlip(flipping.current)
    if (slide.x !== 0 || slide.ms !== 0) setSlide({ x: 0, ms: 0 })
  }

  // 翻页后：复位缩放，滚动回到起点（适应宽度时页面比屏幕高）
  useEffect(() => {
    clearTimeout(zoomSettle.current)
    setZoom(NO_ZOOM)
    scroller.current?.scrollTo({ top: 0, left: settings.dir === 'rtl' ? scroller.current.scrollWidth : 0 })
  }, [key, settings.dir])

  // 相邻两屏和再往外一页提前解码，翻页时直接有画面
  const near = [nextScreen, prevScreen].flatMap((sc) => (sc ? sc.pages.map((i) => src(i, sc.half)) : []))
  const nearKey = near.join('|')
  useEffect(() => {
    const lo = Math.min(...screen.pages)
    const hi = Math.max(...screen.pages)
    for (const u of nearKey.split('|')) void decodePage(u || undefined)
    for (const i of [hi + 2, lo - 2]) void decodePage(pages[i])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, pages, nearKey])

  useEffect(
    () => () => {
      clearTimeout(pendingTap.current)
      clearTimeout(zoomSettle.current)
      flipping.current = invalidateFlip(flipping.current)
    },
    [],
  )

  const bounds = (s: number) => {
    const c = content.current
    const v = scroller.current
    return c && v ? panBounds({ w: c.offsetWidth, h: c.offsetHeight }, { w: v.clientWidth, h: v.clientHeight }, s) : { x: 0, y: 0 }
  }
  /** 屏幕上一点相对内容「未变换时」中心的坐标（gestures.ts 的 zoomAround 要的就是这个） */
  const fromCenter = (clientX: number, clientY: number) => {
    const c = content.current
    const v = scroller.current
    if (!c || !v) return { x: 0, y: 0 }
    const r = v.getBoundingClientRect()
    const cx = r.left + c.offsetLeft - v.scrollLeft + c.offsetWidth / 2
    const cy = r.top + c.offsetTop - v.scrollTop + c.offsetHeight / 2
    return { x: clientX - cx, y: clientY - cy }
  }
  const zoomTo = (z: Zoom) => setZoom(z.s <= 1.01 ? NO_ZOOM : clampPan(z, bounds(z.s)))

  /**
   * 横滑翻页：轨道接着手指的速度滑到相邻页，滑到位后换成新的当前页、轨道归零。
   * 相邻页就是轨道上那个元素（key 不变），换的那一帧画面完全一样，不会空白或跳动。
   * dir：手指方向，1 = 向右（看左边那页），-1 = 向左。
   */
  const flip = (dir: 1 | -1, from = slide.x, velocity = 0) => {
    const w = root.current?.clientWidth ?? window.innerWidth
    // 这条减速曲线起步约是平均速度的 3 倍：按剩余距离和手指速度算时长，看起来就是手指那一下的延续；
    // 限制在 180–300ms，慢慢拖过去松手也不会拖沓
    const ms = Math.round(Math.min(300, Math.max(180, (3 * (w - Math.abs(from))) / Math.max(velocity, 0.5))))
    const id = (flipping.current = invalidateFlip(flipping.current))
    setSlide({ x: dir * w, ms })
    setTimeout(() => {
      if (!flipStillCurrent(flipping.current, id)) return
      // 放大时在边缘轻扫翻页：新页直接以原大出现，不带过渡地复位缩放
      setLive(true)
      setZoom(NO_ZOOM)
      if (dir > 0) onLeft()
      else onRight()
      setSlide({ x: 0, ms: 0 })
      requestAnimationFrame(() => setLive(false))
    }, ms)
  }

  useGesture(
    {
      onDrag: ({ active, first, movement: [mx, my], swipe: [sx], offset: [x, y], velocity: [vx], pinching, cancel, tap, last }) => {
        if (pinching) {
          // 第二根手指落下前横向拖动已经让页面跟着动了，转成缩放时归位
          setSlide({ x: 0, ms: SLIDE_MS })
          return cancel()
        }
        if (tap) return
        if (Math.abs(mx) > 6 || Math.abs(my) > 6) dragged.current = true
        if (zoomed) {
          setLive(active)
          // 放大时拖动平移。按下时就已经顶到左右边缘、再往外轻扫才翻页；
          // 一下快速平移途中碰到边缘不算，免得想看边上的内容却翻走了
          const b = bounds(zoom.s)
          if (first) startEdge.current = zoom.x >= b.x - 1 ? 1 : zoom.x <= -b.x + 1 ? -1 : 0
          if (last && sx !== 0 && sx === startEdge.current) return flip(sx > 0 ? 1 : -1, 0, vx)
          setZoom(clampPan({ ...zoom, x, y }, b))
          return
        }
        if (active) {
          // 新的拖动打断还没滑完的翻页
          flipping.current = invalidateFlip(flipping.current)
          setSlide({ x: mx, ms: 0 })
          return
        }
        const w = root.current?.clientWidth ?? window.innerWidth
        const dir = swipeResult(mx, sx, w)
        if (dir) flip(dir, mx, vx)
        else setSlide({ x: 0, ms: SLIDE_MS })
      },
      onPinch: ({ origin: [ox, oy], first, offset: [s], memo, last }) => {
        // 以两指中点为中心：记下开始时的状态和中点位置
        const start = first || !memo ? { z: zoom, p: fromCenter(ox, oy) } : (memo as { z: Zoom; p: { x: number; y: number } })
        const z = zoomAround(start.z, start.p, s)
        setLive(!last)
        if (last) zoomTo(settle(z))
        else setZoom(z)
        return start
      },
      onWheel: ({ event, delta: [, dy], ctrlKey }) => {
        if (ctrlKey) {
          event.preventDefault()
          const s = Math.min(MAX_ZOOM, Math.max(1, zoom.s * (1 - dy / 400)))
          zoomTo(zoomAround(zoom, fromCenter(event.clientX, event.clientY), s))
          clearTimeout(zoomSettle.current)
          zoomSettle.current = setTimeout(() => setZoom((z) => settle(z)), WHEEL_SETTLE_MS)
          return
        }
        if (zoomed || dy === 0) return
        const el = scroller.current
        if (!el) return
        const atTop = el.scrollTop <= 1
        const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1
        if ((dy > 0 && !atBottom) || (dy < 0 && !atTop)) return // 先正常滚动长页面
        event.preventDefault()
        // 一次滚动手势（含触控板惯性）只翻一页：翻页后锁住，直到滚轮停顿 200ms
        const now = performance.now()
        const w = wheel.current
        const gap = now - w.last
        w.last = now
        if (w.locked && gap < 200) return
        w.locked = false
        w.acc = gap > 200 ? dy : w.acc + dy
        if (Math.abs(w.acc) < 40) return
        w.locked = true
        w.acc = 0
        onStep(dy > 0 ? 1 : -1)
      },
    },
    {
      target: root,
      eventOptions: { passive: false },
      drag: {
        filterTaps: true,
        // 未放大时只认横向：竖向交给浏览器滚动长页面
        axis: zoomed ? undefined : 'x',
        from: () => [zoom.x, zoom.y],
        swipe: { distance: 40, velocity: 0.3 },
      },
      pinch: { scaleBounds: { min: 1, max: MAX_ZOOM }, from: () => [zoom.s, 0] },
    },
  )

  const onClick = (e: MouseEvent) => {
    if (dragged.current) {
      dragged.current = false
      return
    }
    const zones = settings.tapZones === 'auto' ? 'lr' : settings.tapZones
    const x = e.clientX / window.innerWidth
    const y = e.clientY / window.innerHeight
    const pos = zones === 'tb' ? y : x
    // 中间（放大时是任意位置）切换工具栏，两侧按阅读方向翻页
    const center = zones === 'off' || zoomed || (pos >= 0.3 && pos <= 0.7)
    const action = center ? onCenter : zones === 'tb' ? () => onStep(pos < 0.3 ? -1 : 1) : pos < 0.3 ? onLeft : onRight

    // 鼠标和触屏一样，任何位置都能双击放大，所以单击要等一下确认不是双击（两次点击不再算连翻两页）。
    // 双击按时间和距离自己判断
    clearTimeout(pendingTap.current)
    const now = performance.now()
    const prev = lastTap.current
    const double = now - prev.t < DOUBLE_MS && Math.hypot(e.clientX - prev.x, e.clientY - prev.y) < 40
    lastTap.current = double ? { t: 0, x: 0, y: 0 } : { t: now, x: e.clientX, y: e.clientY }
    if (double) zoomTo(zoomed ? NO_ZOOM : zoomAround(NO_ZOOM, fromCenter(e.clientX, e.clientY), TAP_ZOOM))
    else pendingTap.current = setTimeout(action, DOUBLE_MS)
  }

  const fit = settings.fit
  const imgCls = {
    screen: 'max-h-dvh object-contain',
    height: 'h-dvh w-auto max-w-none',
    width: 'w-full h-auto',
    original: 'max-w-none',
  }[fit]
  const imgsOf = ({ pages: sp, half }: Screen) => {
    const style = fit === 'screen' ? { maxWidth: `${100 / sp.length}vw` } : fit === 'width' ? { width: `${100 / sp.length}vw` } : undefined
    return (settings.dir === 'rtl' ? [...sp].reverse() : sp).map((i) => {
      const shown = src(i, half)
      const k = `${pages[i]}#${half ?? ''}`
      // 拆半页还没处理好：先空着，免得整张闪一下再换成半张
      if (!shown) return <div key={k} className="h-dvh w-screen flex-none" aria-label={t('reader.image.processing', { n: i + 1 })} />
      return (
        <ReaderImage
          key={k}
          page={i}
          url={pages[i]}
          src={shown}
          onLoad={(e) => {
            // 宽高比只记原图的：拼版和「是不是宽页」都按原图判断
            if (shown !== pages[i]) return
            rememberAspect(pages[i], e.currentTarget)
            onAspect()
          }}
          className={cn('reader-page block flex-none', imgCls)}
          style={style}
          holdSpace={sp.length > 1}
          fallback={{ width: `${100 / sp.length}vw`, height: '100dvh' }}
        />
      )
    })
  }

  // 屏幕左边那页：RTL 是下一页，LTR 是上一页
  const rtl = settings.dir === 'rtl'
  const panels = [
    { sp: rtl ? nextScreen : prevScreen, pos: -1 },
    { sp: screen, pos: 0 },
    { sp: rtl ? prevScreen : nextScreen, pos: 1 },
  ].filter((p): p is { sp: Screen; pos: number } => !!p.sp)

  return (
    // 外层裁切：轨道平移时内容不会被推出边缘冒出滚动条；手势、点击都挂在这里
    <div
      ref={root}
      onClick={onClick}
      onPointerDown={() => {
        // 每次按下先清掉「刚拖动过」：手指横滑后浏览器不补发 click，标记留着会吞掉下一次真正的点击
        dragged.current = false
      }}
      // 手机长按图片不弹「保存图片」菜单，免得拖动翻页时误触；鼠标右键照常
      onContextMenu={(e) => (e.nativeEvent as PointerEvent).pointerType === 'touch' && e.preventDefault()}
      // 未放大时允许原生上下滚动（适应宽度的长页面），横向拖动与双指缩放交给手势库
      className={cn(
        'absolute inset-0 overflow-hidden select-none [-webkit-touch-callout:none]',
        zoomed ? 'cursor-grab touch-none' : 'cursor-pointer touch-pan-y',
        hidden && 'invisible',
      )}
    >
      <div
        className="absolute inset-0"
        style={{
          transform: slide.x ? `translateX(${slide.x}px)` : undefined,
          transition: slide.ms ? `transform ${slide.ms}ms ${EASE}` : undefined,
        }}
      >
        {panels.map(({ sp, pos }) => {
          const active = pos === 0
          return (
            // key 用页码：翻页后相邻页就是同一个元素，只是位置挪到中间
            <div
              key={screenKey(sp)}
              ref={active ? scroller : undefined}
              aria-hidden={!active || undefined}
              // 当前页：放大后平移靠变换，容器不滚动；overscroll-none：滚到顶再下拉不会触发浏览器的下拉刷新
              className={cn(
                'no-scrollbar absolute inset-0 flex overscroll-none',
                active && !zoomed ? 'touch-pan-y overflow-auto' : 'overflow-hidden',
                zoomed && 'touch-none',
              )}
              style={pos ? { transform: `translateX(${pos * 100}%)` } : undefined}
            >
              <div
                ref={active ? content : undefined}
                className="m-auto flex items-center justify-center"
                style={
                  active
                    ? {
                        transform: `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.s})`,
                        transition: live ? undefined : `transform ${SLIDE_MS}ms ${EASE}`,
                      }
                    : undefined
                }
              >
                {imgsOf(sp)}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
