import { useApolloClient } from '@apollo/client/react'
import { useEffect } from 'react'
import { loadPages } from './pageCache'

const READER_LINK = /\/manga\/\d+\/chapter\/(\d+)$/

let chunk: Promise<unknown> | undefined
const loadChunk = () => (chunk ??= import('./ReaderPage').catch(() => { chunk = undefined }))

/**
 * 提前准备阅读器，点开时展开动画马上开始、途中少一次渲染：
 * - 代码块：页面空闲时就加载；鼠标移到阅读入口上时再催一次。第一次打开不用等下载，点了不会先停一下。
 * - 页面列表：鼠标按下就开始取，松开时多半已经回来，阅读器挂上时直接有页面。
 *   只认鼠标：触屏按下常常是在滚动列表，不能为划过的每一话都向来源要页面。
 */
export function useReaderPreload() {
  const client = useApolloClient()
  useEffect(() => {
    const idle = window.requestIdleCallback?.(() => void loadChunk(), { timeout: 3000 })
    const linkOf = (e: Event) => {
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null
      return a ? new URL(a.href).pathname.match(READER_LINK) : null
    }
    const over = (e: PointerEvent) => {
      if (linkOf(e)) void loadChunk()
    }
    const down = (e: PointerEvent) => {
      const m = e.pointerType === 'mouse' && e.button === 0 ? linkOf(e) : null
      if (!m) return
      void loadChunk()
      void loadPages(client, Number(m[1])).catch(() => {})
    }
    document.addEventListener('pointerover', over, { passive: true })
    document.addEventListener('pointerdown', down, { passive: true })
    return () => {
      if (idle !== undefined) window.cancelIdleCallback(idle)
      document.removeEventListener('pointerover', over)
      document.removeEventListener('pointerdown', down)
    }
  }, [client])
}
