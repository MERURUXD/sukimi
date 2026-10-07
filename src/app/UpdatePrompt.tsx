import { useEffect, useState } from 'react'
import { AnimatePresence } from 'motion/react'
import { Sparkles } from 'lucide-react'
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

const RETURN_KEY = 'suwayomi-web.update-return'

/**
 * 换到新版本。不能直接 reload：服务端缓存了深层路径的回退页，热更新后只有 / 是新首页，
 * 所以先记下当前地址回到 /，由 index.html 的内联脚本在启动前换回原地址。
 */
function applyUpdate() {
  if (location.pathname === '/') return location.reload()
  try {
    sessionStorage.setItem(RETURN_KEY, location.pathname + location.search + location.hash)
  } catch {
    /* 存不了就停在首页 */
  }
  location.replace('/')
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
  const [reloading, setReloading] = useState(false)
  const show = !!next && next !== dismissed
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[calc(var(--nav-h)+10px)] z-[59] flex justify-center px-4 md:justify-end md:px-6">
      <AnimatePresence>
        {show && (
          <MotionGlass
            dense
            role="status"
            initial={{ opacity: 0, y: -10, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={spring.default}
            suspendRefract
            className="pointer-events-auto flex w-full max-w-[380px] items-center gap-3.5 rounded-[26px] py-3 pr-3 pl-3.5"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-solid text-on-solid">
              <Sparkles className="size-[18px]" strokeWidth={2} />
            </span>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block text-[14px] font-semibold">新版本已就绪</span>
              <span className="mt-1 block text-[12px] text-muted">更新后页面会重新载入</span>
            </span>
            <button
              type="button"
              className="h-9 shrink-0 rounded-full px-3 text-[13px] font-semibold text-muted transition-colors hover:text-text"
              onClick={() => useAppUpdate.setState({ dismissed: next })}
            >
              稍后
            </button>
            <button
              type="button"
              disabled={reloading}
              className="h-9 shrink-0 rounded-full bg-solid px-4 text-[13px] font-bold text-on-solid transition-opacity hover:opacity-90 disabled:opacity-60"
              onClick={() => {
                setReloading(true)
                applyUpdate()
              }}
            >
              {reloading ? '更新中…' : '更新'}
            </button>
          </MotionGlass>
        )}
      </AnimatePresence>
    </div>
  )
}
