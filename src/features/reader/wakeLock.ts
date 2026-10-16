import { useEffect } from 'react'

/**
 * 屏幕常亮（Screen Wake Lock）。浏览器只在 HTTPS 或 localhost 下提供；
 * 切到后台时系统会自动释放，回到前台再重新申请。
 */
export const wakeLockSupported = () => typeof navigator !== 'undefined' && 'wakeLock' in navigator && window.isSecureContext

export function useWakeLock(on: boolean) {
  useEffect(() => {
    if (!on || !wakeLockSupported()) return
    let lock: WakeLockSentinel | null = null
    let alive = true
    const acquire = () => {
      if (!alive || lock || document.visibilityState !== 'visible') return
      navigator.wakeLock
        .request('screen')
        .then((l) => {
          if (!alive) return void l.release().catch(() => {})
          lock = l
          l.addEventListener('release', () => {
            if (lock === l) lock = null
          })
        })
        .catch(() => {})
    }
    acquire()
    document.addEventListener('visibilitychange', acquire)
    return () => {
      alive = false
      document.removeEventListener('visibilitychange', acquire)
      void lock?.release().catch(() => {})
    }
  }, [on])
}
