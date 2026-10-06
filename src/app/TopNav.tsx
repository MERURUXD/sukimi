import { AnimatePresence } from 'motion/react'
import { ArrowDown, ChevronLeft } from 'lucide-react'
import { NavLink, useLocation, useMatch, useNavigate } from 'react-router'
import { useLive } from '@/api/live'
import { Glass, MotionGlass } from '@/components/glass/Glass'
import { spring } from '@/design/motion'
import { cn } from '@/lib/cn'
import { NavPill } from '@/components/ui/NavPill'
import { useNavPill } from '@/components/ui/useNavPill'
import { AppearanceMenu } from './AppearanceMenu'
import { isDemo } from '@/lib/demo'
import { DemoNotice } from '@/features/demo/DemoGate'

const LINKS = [
  { to: '/', label: '首页', end: true },
  { to: '/library', label: '书库' },
  { to: '/updates', label: '更新' },
  { to: '/browse', label: '发现' },
]

export function TopNav() {
  const inManga = useMatch('/manga/:id/*')
  const navigate = useNavigate()
  const { ref: pillRef, box: pillBox } = useNavPill(useLocation().pathname)
  // 从站内进来就后退，直接打开的详情页回书库
  const back = () => ((window.history.state?.idx ?? 0) > 0 ? navigate(-1) : navigate('/library'))

  return (
    <header className="fixed inset-x-0 top-0 z-40">
      <div className="wrap flex h-[var(--nav-h)] items-center justify-between gap-4">
        {inManga ? (
          <Glass as="button" type="button" className="gicon rounded-full" onClick={back} aria-label="返回">
            <ChevronLeft className="size-6" strokeWidth={1.8} />
          </Glass>
        ) : (
          // 顶栏本身透明，标志也放进玻璃胶囊里，滚到内容上方时才看得清
          <NavLink to="/" aria-label="Sukimi 首页" className="rounded-full text-text no-underline">
            <Glass as="span" className="flex items-center gap-2.5 rounded-full p-[5px] text-[17px] font-bold sm:pr-4">
              <span className="grid size-10 place-items-center rounded-full bg-solid text-on-solid">S</span>
              <span className="max-sm:hidden">Sukimi</span>
            </Glass>
          </NavLink>
        )}

        <Glass as="nav" ref={pillRef} className="flex max-w-full items-center gap-0.5 overflow-x-auto rounded-full p-[5px] max-md:hidden">
          <NavPill box={pillBox} className="rounded-full" />
          {LINKS.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) =>
                cn(
                  'relative inline-flex min-h-10 items-center rounded-full px-4 font-semibold whitespace-nowrap no-underline transition-colors',
                  isActive ? 'text-text' : 'text-muted hover:text-text',
                )
              }
            >
              {l.label}
            </NavLink>
          ))}
        </Glass>

        <div className="flex items-center gap-2">
          {isDemo && <DemoNotice />}
          <DownloadIndicator />
          <AppearanceMenu />
        </div>
      </div>
    </header>
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
