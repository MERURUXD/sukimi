import { useState } from 'react'
import { useApplyAppearance } from '@/design/settings'
import { PagedView } from '@/features/reader/PagedView'
import { DEFAULTS, type ReaderSettings } from '@/features/reader/settings'

// 虚构页面：带页码和网格的 SVG，方便看出缩放中心和平移
const page = (n: number) =>
  'data:image/svg+xml,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="700" height="1000"><rect width="700" height="1000" fill="hsl(${n * 50},40%,30%)"/>` +
      Array.from({ length: 9 }, (_, i) => `<line x1="${(i + 1) * 70}" y1="0" x2="${(i + 1) * 70}" y2="1000" stroke="#fff3"/><line x1="0" y1="${(i + 1) * 100}" x2="700" y2="${(i + 1) * 100}" stroke="#fff3"/>`).join('') +
      `<text x="350" y="540" font-size="220" text-anchor="middle" fill="#fff" font-family="sans-serif">${n + 1}</text></svg>`,
  )
const PAGES = Array.from({ length: 6 }, (_, i) => page(i))

/** 只在开发环境：翻页视图的手势验收（拖动跟手、轻扫翻页、双击 / 双指缩放、平移边界） */
export function ReaderGesturesLab() {
  useApplyAppearance()
  const [i, setI] = useState(0)
  const [ui, setUi] = useState(0)
  const [dir, setDir] = useState<'ltr' | 'rtl'>('ltr')
  const settings: ReaderSettings = { ...DEFAULTS, mode: 'single', dir, fit: 'screen' }
  const go = (d: 1 | -1) => setI((n) => Math.min(PAGES.length - 1, Math.max(0, n + d)))
  return (
    <div className="fixed inset-0 bg-black" data-sfw="">
      <PagedView
        pages={PAGES}
        spread={[i]}
        prevSpread={i > 0 ? [i - 1] : undefined}
        nextSpread={i < PAGES.length - 1 ? [i + 1] : undefined}
        settings={settings}
        onLeft={() => go(dir === 'rtl' ? 1 : -1)}
        onRight={() => go(dir === 'rtl' ? -1 : 1)}
        onStep={go}
        onCenter={() => setUi((n) => n + 1)}
        onAspect={() => {}}
      />
      <div className="pointer-events-none fixed top-2 left-2 z-10 rounded bg-black/60 px-2 py-1 text-xs text-white" id="lab-status">
        第 {i + 1} 页 · 中间单击 {ui} 次 · {dir}
      </div>
      <button type="button" className="fixed top-2 right-2 z-10 rounded bg-black/60 px-2 py-1 text-xs text-white" onClick={() => setDir((d) => (d === 'ltr' ? 'rtl' : 'ltr'))}>
        切换方向
      </button>
    </div>
  )
}
