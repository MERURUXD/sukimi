import { useEffect } from 'react'
import { AnimatePresence } from 'motion/react'
import { RefreshCw, X } from 'lucide-react'
import { create } from 'zustand'
import { MotionGlass } from '@/components/glass/Glass'
import { spring } from '@/design/motion'
import { entryScript } from '@/lib/appVersion'

/** 服务端上新入口地址；dismissed 记住用户按过「稍后」的那一版，再部署一次才重新提示 */
const useAppUpdate = create<{ next?: string; dismissed?: string }>(() => ({}))

// 开发服务器的入口是 /src/main.tsx，不会变，也没必要检查
const current = import.meta.env.DEV ? undefined : entryScript(document.documentElement.outerHTML)
const MIN_GAP = 60_000
const INTERVAL = 10 * 60_000
let lastCheck = 0

/**
 * 拉一次首页对比入口脚本。deploy:server 热更新后服务端立即返回新首页，
 * 而旧的带哈希资源仍保留，所以不强制刷新，只提示用户在方便时刷新。
 * 返回 true 表示有新版本，undefined 表示没法判断（开发环境、离线或返回的不是本前端）。
 */
export async function checkForUpdate(force = false): Promise<boolean | undefined> {
  if (!current) return
  if (!force && Date.now() - lastCheck < MIN_GAP) return !!useAppUpdate.getState().next
  lastCheck = Date.now()
  try {
    const res = await fetch(new URL('/', location.origin), { cache: 'no-store', credentials: 'same-origin' })
    if (!res.ok) return
    const next = entryScript(await res.text())
    if (!next) return
    if (next === current) {
      useAppUpdate.setState({ next: undefined })
      return false
    }
    useAppUpdate.setState({ next })
    return true
  } catch {
    return
  }
}

/** 懒加载分块失败多半是服务端重启后旧资源被清掉了，同样提示刷新 */
function onPreloadError() {
  useAppUpdate.setState({ next: 'chunk-missing', dismissed: undefined })
}

function useUpdateWatch() {
  useEffect(() => {
    if (!current) return
    const check = () => {
      if (document.visibilityState === 'visible') void checkForUpdate()
    }
    check()
    const timer = setInterval(check, INTERVAL)
    // 切回标签页、电脑从睡眠中恢复时最可能错过了部署
    document.addEventListener('visibilitychange', check)
    window.addEventListener('focus', check)
    window.addEventListener('vite:preloadError', onPreloadError)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', check)
      window.removeEventListener('focus', check)
      window.removeEventListener('vite:preloadError', onPreloadError)
    }
  }, [])
}

/** 前端有新版本时的常驻提示；阅读页不挂，读完回到其他页面时再出现 */
export function UpdatePrompt() {
  useUpdateWatch()
  const next = useAppUpdate((s) => s.next)
  const dismissed = useAppUpdate((s) => s.dismissed)
  const show = !!next && next !== dismissed
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[calc(var(--nav-h)+8px)] z-[59] flex justify-center px-4 md:justify-end md:px-6">
      <AnimatePresence>
        {show && (
          <MotionGlass
            dense
            role="status"
            initial={{ opacity: 0, y: -12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={spring.fast}
            suspendRefract
            className="pointer-events-auto flex items-center gap-1 rounded-full py-1.5 pr-1.5 pl-5 text-[13px] font-semibold"
          >
            <span className="mr-2">Sukimi 有新版本</span>
            <button type="button" className="solid min-h-8 gap-1.5 px-3.5 text-[13px] shadow-none" onClick={() => location.reload()}>
              <RefreshCw className="size-4" strokeWidth={2} />
              刷新
            </button>
            <button
              type="button"
              aria-label="稍后再说"
              title="稍后再说"
              className="grid size-8 place-items-center rounded-full text-muted hover:text-text"
              onClick={() => useAppUpdate.setState({ dismissed: next })}
            >
              <X className="size-4" strokeWidth={2} />
            </button>
          </MotionGlass>
        )}
      </AnimatePresence>
    </div>
  )
}
