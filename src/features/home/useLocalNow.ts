import { useEffect, useState } from 'react'

/** 本地日期变化时一起更新查询范围和日期分组，支持后台、休眠后返回。 */
export function useLocalNow() {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const check = () => setNow((prev) => (new Date(prev).toDateString() === new Date().toDateString() ? prev : Date.now()))
    const d = new Date(now)
    const t = setTimeout(check, new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime() - Date.now() + 1000)
    document.addEventListener('visibilitychange', check)
    return () => {
      clearTimeout(t)
      document.removeEventListener('visibilitychange', check)
    }
  }, [now])
  return now
}
