import { useApolloClient } from '@apollo/client/react'
import { AnimatePresence } from 'motion/react'
import { ChevronRight, Star, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { create } from 'zustand'
import { useAuth } from '@/api/auth'
import { captureUser } from '@/api/userContext'
import { MotionGlass } from '@/components/glass/Glass'
import { spring } from '@/design/motion'
import { useAppearance } from '@/design/settings'
import { scopedKey } from '@/features/auth/userScope'
import { LibraryMangas } from '@/features/library/queries'
import { useLibraryView } from '@/features/library/store'
import { useNsfw } from '@/features/nsfw/useNsfw'
import { isDemo, isDevLab } from '@/lib/demo'
import { AWAY_MIN_SEC, awayUpdates } from './favorite'
import { useFavorites } from './useFavorites'
import { t as tl } from '@/i18n'

/** 这台设备上次离开（关掉或切走标签页）的时间，秒；只是本机的便利功能，存不了就不提示 */
const LEFT_KEY = 'suwayomi-web.leftAt'
const SHOW_MS = 8000

const key = () => scopedKey(LEFT_KEY, useAuth.getState().user?.id, isDemo || isDevLab)

function readLeftAt() {
  try {
    const k = key()
    const v = k ? Number(localStorage.getItem(k)) : NaN
    return Number.isFinite(v) && v > 0 ? v : null
  } catch {
    return null
  }
}

/**
 * 要比较的离开时间：打开网页和切回标签页时各取一次，比较完就清掉。
 * fresh：切回标签页时内存里的书库可能是离开前的（标签页被冻结、连接断过，没收到更新结束的刷新），要重新取
 */
const useAway = create<{ away: { since: number; fresh: boolean } | null }>(() => ({ away: null }))
const check = (fresh: boolean) => {
  const since = readLeftAt()
  useAway.setState({ away: since === null ? null : { since, fresh } })
}

// 挂在模块上而不是组件里：在阅读页关掉网页也要记下离开时间
if (typeof document !== 'undefined') {
  const leave = () => {
    try {
      const k = key()
      if (k) localStorage.setItem(k, String(Math.floor(Date.now() / 1000)))
    } catch {
      /* 存不了就下次不提示 */
    }
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') leave()
    else check(true)
  })
  window.addEventListener('pagehide', leave)
}

/**
 * 「离开期间 N 部特别关心更新了」。离开不到 30 分钟、第一次打开时不提示。
 * 只在要比较时查一次书库，不常驻订阅（否则整库查询在每个页面都算活跃，每轮更新结束都会重取）；
 * 也不用本地快照：快照是上次离开时存的，拿它比较永远没有新章节。
 */
export function AwayPrompt() {
  const userId = useAuth((s) => s.user?.id)
  const client = useApolloClient()
  const favorites = useFavorites()
  const { hidden } = useNsfw()
  const away = useAway((s) => s.away)
  const [shown, setShown] = useState<number | null>(null)
  const homeOn = useAppearance((s) => s.homeSections.favorite)
  const setCategory = useLibraryView((s) => s.setCategory)
  const navigate = useNavigate()

  // 打开网页时读一次上次离开的时间；刚打开时内存里没有旧书库，有缓存也是这次取到的
  useEffect(() => {
    if (userId !== undefined) check(false)
  }, [userId])

  // 标记到了才比较，比较一次就清掉；离开太短不查书库。NSFW 作品不计入
  useEffect(() => {
    const map = favorites.map
    if (!away || !map) return
    useAway.setState({ away: null })
    if (Date.now() / 1000 - away.since < AWAY_MIN_SEC || map.size === 0) return
    const still = captureUser()
    client.query({ query: LibraryMangas, fetchPolicy: away.fresh ? 'network-only' : 'cache-first' })
      .then(({ data }) => {
        still()
        const n = data ? awayUpdates(data.mangas.nodes.filter((m) => !hidden(m)), map, away.since, Date.now() / 1000).length : 0
        if (n) setShown(n)
      })
      // 查不到、或期间换了账号：这次就不提示
      .catch(() => {})
  }, [away, favorites.map, hidden, client])
  useEffect(() => {
    if (shown === null) return
    const t = setTimeout(() => setShown(null), SHOW_MS)
    return () => clearTimeout(t)
  }, [shown])

  // 首页模块开着就去首页那一栏，关着就去书库的「特别关心」标签
  const go = () => {
    setShown(null)
    if (!homeOn) {
      setCategory('favorite')
      navigate('/library')
      return
    }
    navigate('/')
    let tries = 0
    const find = () => {
      const el = document.getElementById('h-favorite')
      // 减少动态效果时直接跳过去，不平滑滚动
      if (el) el.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' })
      else if (++tries < 30) requestAnimationFrame(find)
    }
    requestAnimationFrame(find)
  }

  return (
    // 放在底部：顶部是操作提示（toast）和新版本提示的位置，同时出现会叠在一起
    <div className="pointer-events-none fixed right-0 bottom-[calc(var(--tabbar-h)+20px)] left-[var(--side-w)] z-[58] flex justify-center px-4">
      <AnimatePresence>
        {shown !== null && (
          <MotionGlass
            dense
            role="status"
            initial={{ opacity: 0, y: 10, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.97 }}
            transition={spring.default}
            className="pointer-events-auto flex max-w-full items-center gap-1 rounded-full p-1.5 [--g-drop:0_24px_60px_rgba(0,0,0,.45)]"
          >
            <button type="button" className="flex min-h-10 min-w-0 items-center gap-2.5 rounded-full border-0 bg-transparent py-1 pr-2 pl-3 text-left text-[14px] font-semibold text-text" onClick={go}>
              <Star className="size-[18px] flex-none fill-current" strokeWidth={1.8} />
              <span className="min-w-0 truncate">{tl('misc.favorite.away', { count: shown })}</span>
              <ChevronRight className="size-[18px] flex-none text-muted" strokeWidth={1.8} />
            </button>
            <button type="button" className="gicon size-10 flex-none rounded-full text-muted hover:text-text" onClick={() => setShown(null)} aria-label={tl('misc.favorite.closeAria')}>
              <X className="size-[18px]" strokeWidth={1.8} />
            </button>
          </MotionGlass>
        )}
      </AnimatePresence>
    </div>
  )
}
