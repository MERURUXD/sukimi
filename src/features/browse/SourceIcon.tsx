import { useState } from 'react'

/** 来源 / 扩展图标；加载失败时用名称首字代替 */
export function SourceIcon({ s, size = 32 }: { s: { iconUrl: string; displayName: string }; size?: number }) {
  const [failed, setFailed] = useState(false)
  return failed || !s.iconUrl ? (
    <span
      className="grid flex-none place-items-center rounded-[9px] bg-solid font-bold text-on-solid"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {s.displayName.slice(0, 1)}
    </span>
  ) : (
    <img src={s.iconUrl} alt="" loading="lazy" onError={() => setFailed(true)} className="flex-none rounded-[9px]" style={{ width: size, height: size }} />
  )
}
