import { useMutation } from '@apollo/client/react'
import { AnimatePresence } from 'motion/react'
import { Pause, Play } from 'lucide-react'
import { Link } from 'react-router'
import { StartDownloader, StopDownloader, useLive } from '@/api/live'
import { MotionGlass } from '@/components/glass/Glass'
import { toastError } from '@/components/ui/toast'
import { spring } from '@/design/motion'
import { chapterNo } from '@/lib/format'
import { CoverImg } from './CoverImg'

const label = (c: { chapterNumber: number; name: string }) => {
  const n = chapterNo(c.chapterNumber)
  return n ? `第 ${n} 话` : c.name
}

/** 吸底的下载状态条：当前下载、进度环、暂停 / 继续；完整队列在 /downloads */
export function DownloadPill() {
  const queue = useLive((s) => s.queue)
  const running = useLive((s) => s.downloader) === 'STARTED'
  const [start] = useMutation(StartDownloader)
  const [stop] = useMutation(StopDownloader)

  const cur = queue.find((d) => d.state === 'DOWNLOADING') ?? queue[0]
  const r = 19
  const len = 2 * Math.PI * r

  const toggle = async () => {
    try {
      if (running) await stop()
      else await start()
    } catch (e) {
      toastError(running ? '暂停失败' : '继续失败', e)
    }
  }

  return (
    <AnimatePresence>
      {cur && (
        <div className="pointer-events-none sticky bottom-[calc(var(--tabbar-h)+20px)] z-30 mt-7 flex justify-center">
          <MotionGlass
            role="status"
            aria-label="下载状态"
            dense
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={spring.default}
            className="pointer-events-auto flex max-w-full items-center gap-3.5 rounded-full p-2 [--g-drop:0_20px_50px_rgba(0,0,0,.45)]"
          >
            <span className="relative grid size-11 flex-none place-items-center">
              <svg viewBox="0 0 44 44" className="absolute inset-0 -rotate-90" aria-hidden>
                <circle cx="22" cy="22" r={r} fill="none" stroke="var(--track)" strokeWidth="2.5" />
                <circle
                  cx="22"
                  cy="22"
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
              {/* 封面裁成圆形，留在进度环里面；原来的 2:3 矩形四角会盖住进度环 */}
              <span className="cv size-[32px] aspect-square rounded-full">
                <CoverImg src={cur.manga.thumbnailUrl} />
              </span>
            </span>
            <span className="flex min-w-0 flex-col leading-[1.35]">
              <span className="truncate text-[13px] font-semibold">
                {running ? '正在下载' : '已暂停'} · {cur.manga.title} {label(cur.chapter)}
              </span>
              <span className="truncate text-xs text-muted num">
                {cur.chapter.pageCount > 0
                  ? `${Math.round(cur.progress * cur.chapter.pageCount)} / ${cur.chapter.pageCount} 页`
                  : `${Math.round(cur.progress * 100)}%`}
                {queue.length > 1 && ` · 队列中还有 ${queue.length - 1} 话`}
                {cur.state === 'ERROR' && ' · 出错，稍后重试'}
              </span>
            </span>
            <button type="button" className="gicon size-10" onClick={toggle} aria-label={running ? '暂停下载' : '继续下载'}>
              {running ? <Pause className="size-5" strokeWidth={1.8} /> : <Play className="size-5" strokeWidth={1.8} />}
            </button>
            <Link to="/downloads" className="gbtn min-h-10 bg-g-hi text-text no-underline">
              下载队列
            </Link>
          </MotionGlass>
        </div>
      )}
    </AnimatePresence>
  )
}
