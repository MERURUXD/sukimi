import { AnimatePresence } from 'motion/react'
import { useRef } from 'react'
import { ArrowDown, ChevronLeft } from 'lucide-react'
import { NavLink, useLocation, useMatch, useNavigate } from 'react-router'
import { useLive } from '@/api/live'
import { Glass, MotionGlass } from '@/components/glass/Glass'
import { spring } from '@/design/motion'
import { useAppearance } from '@/design/settings'
import { cn } from '@/lib/cn'
import { NavPill } from '@/components/ui/NavPill'
import { useNavPill } from '@/components/ui/useNavPill'
import { AppearanceMenu } from './AppearanceMenu'
import { exitGalleryToLibrary } from '@/features/gallery/readMorph'
import { markNavDirection } from './navTabs'
import { ThemeToggle } from './ThemeToggle'
import { useHideOnScroll } from './useHideOnScroll'
import { isDemo } from '@/lib/demo'
import { DemoNotice } from '@/features/demo/DemoGate'

const LINKS = [
  { to: '/', label: '首页', end: true },
  { to: '/library', label: '书库' },
  { to: '/history', label: '历史' },
  { to: '/updates', label: '更新' },
  { to: '/browse', label: '发现' },
]

export function TopNav() {
  const inManga = useMatch('/manga/:id/*')
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { ref: pillRef, box: pillBox } = useNavPill(pathname)
  // 从站内进来就后退，直接打开的详情页回书库
  const back = () => ((window.history.state?.idx ?? 0) > 0 ? navigate(-1) : navigate('/library'))

  const bar = useRef<HTMLElement>(null)
  const hidden = useHideOnScroll(useAppearance((s) => s.autoHideNav), bar)
  const blur = useAppearance((s) => s.navBlur)

  return (
    // 隐藏用独立的 translate（不用透明度或滤镜），玻璃的背景采样不受影响
    <header
      ref={bar}
      data-vt-bar="topnav"
      className={cn('fixed inset-x-0 top-0 z-40 transition-[translate] duration-300 ease-out', hidden && '-translate-y-full pointer-events-none')}
      inert={hidden || undefined}
    >
      {blur && <NavBlur hidden={hidden} />}
      {/* 宽桌面用居中三栏网格；窄桌面按两侧实际宽度分配空间，放大后仍能操作顶栏 */}
      <div className="topnav-layout wrap h-[var(--nav-h)] items-center justify-between gap-4">
        {inManga ? (
          // 网格项默认会拉满整列，要贴着一侧只占自身宽度
          <Glass as="button" data-vt-glass="topnav-back" type="button" className="gicon rounded-full justify-self-start" onClick={back} aria-label="返回">
            <ChevronLeft className="size-6" strokeWidth={1.8} />
          </Glass>
        ) : (
          // 顶栏本身透明，标志也放进玻璃胶囊里，滚到内容上方时才看得清；平板的标志在左侧导航栏
          <NavLink to="/" aria-label="Sukimi 首页" className="topnav-brand rounded-full text-text no-underline justify-self-start">
            <Glass as="span" data-vt-glass="topnav-brand" className="flex items-center gap-2.5 rounded-full p-[5px] text-[17px] font-bold sm:pr-4">
              <span className="grid size-10 place-items-center rounded-full bg-solid text-on-solid">S</span>
              <span className="max-sm:hidden md:max-xl:hidden">Sukimi</span>
            </Glass>
          </NavLink>
        )}

        <Glass as="nav" data-vt-glass="topnav-tabs" ref={pillRef} className="topnav-tabs min-w-0 max-w-full items-center gap-0.5 overflow-x-auto rounded-full p-[5px]">
          <NavPill box={pillBox} className="rounded-full" />
          {LINKS.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              viewTransition
              onClick={(e) => {
                // 在画廊首页点「书库」：播放封面飞回书库的动画，由画廊自己换页
                if (l.to === '/library' && exitGalleryToLibrary(e)) return e.preventDefault()
                markNavDirection(pathname, l.to)
              }}
              className={({ isActive }) =>
                cn(
                  'relative inline-flex min-h-10 items-center rounded-full px-4 font-semibold whitespace-nowrap no-underline transition-colors',
                  // 未选中项悬停时先垫一层淡玻璃底，选中块滑过来之前就有反馈；选中项有自己的选中块，不叠
                  isActive ? 'text-text' : 'text-muted hover:bg-g-hi/50 hover:text-text',
                )
              }
            >
              {l.label}
            </NavLink>
          ))}
        </Glass>

        {/* 侧栏和顶栏的显隐、右侧按钮的对齐共用同一组导航规则 */}
        <div className="topnav-actions flex items-center gap-2">
          {isDemo && <DemoNotice />}
          <DownloadIndicator />
          <ThemeToggle />
          <AppearanceMenu />
        </div>
      </div>
    </header>
  )
}

/** 模糊带比顶栏多出的高度，渐隐到这里为止 */
const BLUR_TAIL = 20
const BLUR_LAYERS = 5
const BLUR_MAX = 16

/** 越往上越模糊：t 为距模糊带底边的比例，指数曲线让模糊集中在屏幕顶端 */
const blurAt = (t: number) => (BLUR_MAX * (2 ** (4 * t) - 1)) / 15

/**
 * 每层从自己那一段开始一直盖到顶端；高斯模糊叠加时方差相加，
 * 所以每层半径取相邻两档的平方差开方，叠起来正好是该高度的目标模糊
 */
const BLUR_STACK = Array.from({ length: BLUR_LAYERS }, (_, i) => {
  const from = i / BLUR_LAYERS
  const to = (i + 1) / BLUR_LAYERS
  const r = Math.sqrt(blurAt(to) ** 2 - blurAt(from) ** 2)
  return {
    backdropFilter: `blur(${r.toFixed(2)}px)`,
    maskImage: `linear-gradient(to top, transparent ${from * 100}%, #000 ${to * 100}%)`,
  }
})

/**
 * 顶栏背后的渐进模糊（参考 React Bits 的 Gradual Blur，不加色调）。
 * 是导航内容的兄弟元素而不是父元素：父元素带滤镜或遮罩会把玻璃的背景采样截断。
 * 比顶栏多出的那段尾巴在顶栏隐藏时再往上收，不留一条模糊边；只用位移，不动透明度
 */
function NavBlur({ hidden }: { hidden: boolean }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 -z-10 transition-[translate] duration-300 ease-out"
      // 收起距离和尾巴同用 px，浏览器改了默认字号也不会留边
      style={{ height: `calc(var(--nav-h) + ${BLUR_TAIL}px)`, translate: hidden ? `0 -${BLUR_TAIL}px` : undefined }}
    >
      {BLUR_STACK.map((style, i) => (
        <div key={i} className="absolute inset-0" style={style} />
      ))}
    </div>
  )
}

/** 有章节在排队时出现：进度环显示当前这话，角标是剩余数量；点开是下载队列 */
function DownloadIndicator() {
  const queue = useLive((s) => s.queue)
  const running = useLive((s) => s.downloader) === 'STARTED'
  const inDownloads = useMatch('/downloads')
  const cur = queue.find((d) => d.state === 'DOWNLOADING') ?? queue[0]
  const r = 17
  const len = 2 * Math.PI * r
  return (
    <AnimatePresence>
      {cur && !inDownloads && (
        // 透明度动画放在玻璃元素自己身上，外面的链接不动（否则玻璃失效）
        <NavLink to="/downloads" className="rounded-full text-text no-underline" aria-label={`下载队列：${running ? '正在下载' : '已暂停'}，${queue.length} 话`} title="下载队列">
          <MotionGlass
            as="span"
            data-vt-glass="topnav-downloads"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={spring.fast}
            className="relative grid size-11 place-items-center rounded-full"
          >
            <svg viewBox="0 0 40 40" className="absolute inset-[2px] -rotate-90" aria-hidden>
              <circle cx="20" cy="20" r={r} fill="none" stroke="var(--track)" strokeWidth="2.5" />
              <circle
                cx="20"
                cy="20"
                r={r}
                fill="none"
                stroke="var(--accent)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray={len}
                strokeDashoffset={len * (1 - cur.progress)}
                className="transition-[stroke-dashoffset] duration-500"
              />
            </svg>
            <ArrowDown className={cn('size-[18px]', !running && 'text-muted')} strokeWidth={2} />
            <span className="absolute -top-1 -right-1 grid h-5 min-w-5 place-items-center rounded-full bg-solid px-1 text-[11px] font-bold text-on-solid num">
              {queue.length > 99 ? '99+' : queue.length}
            </span>
          </MotionGlass>
        </NavLink>
      )}
    </AnimatePresence>
  )
}
