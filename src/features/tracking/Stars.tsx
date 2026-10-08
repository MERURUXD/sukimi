import { Star } from 'lucide-react'
import { useState, type KeyboardEvent } from 'react'
import { cn } from '@/lib/cn'
import './Stars.css'

export type StarSize = 'md' | 'lg'
const STAR = {
  md: { slot: 'size-9', icon: 'size-[24px]', gap: 'gap-2.5', num: 'text-[19px]' },
  lg: { slot: 'size-11', icon: 'size-[30px]', gap: 'gap-3', num: 'text-[22px]' },
} as const

/** 星级评分：十分制每颗星两分、可点半颗；悬停预览，定分时点亮的星从左到右轻弹 */
export function Stars({ max, value, word, onChange, size }: { max: 5 | 10; value: number; word: (v: number) => string; onChange: (v: number) => void; size: StarSize }) {
  const [hover, setHover] = useState<number | null>(null)
  // 每次定分换一次 key，点亮的星星重新挂载、从左到右轻弹一下
  const [pop, setPop] = useState({ n: 0, v: 0 })
  const per = max / 5
  const shown = hover ?? value

  // 十分制按指针落在星星左半还是右半区分单数、双数分
  const at = (e: { currentTarget: HTMLElement; clientX: number }, i: number) => {
    const box = e.currentTarget.getBoundingClientRect()
    const half = per === 2 && e.clientX - box.left < box.width / 2
    return i * per + (half ? 1 : per)
  }
  const set = (v: number) => {
    const n = Math.max(0, Math.min(max, v))
    if (n === value) return
    setPop((p) => ({ n: p.n + 1, v: n }))
    onChange(n)
  }
  const onKey = (e: KeyboardEvent) => {
    const keys: Record<string, number> = { ArrowRight: value + 1, ArrowUp: value + 1, ArrowLeft: value - 1, ArrowDown: value - 1, Home: 0, End: max, Delete: 0, Backspace: 0 }
    if (!(e.key in keys)) return
    e.preventDefault()
    set(keys[e.key])
  }

  const text = word(shown)
  const { slot, icon, gap, num } = STAR[size]
  return (
    <span
      role="slider"
      tabIndex={0}
      aria-label="评分"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={value ? `${value} 分${word(value) ? `，${word(value)}` : ''}` : '未评分'}
      onKeyDown={onKey}
      className={cn('flex items-center rounded-full outline-offset-4', gap)}
    >
      <span className="flex items-center" onPointerLeave={() => setHover(null)}>
        {Array.from({ length: 5 }, (_, i) => {
          const fill = Math.max(0, Math.min(1, (shown - i * per) / per))
          return (
            <span
              key={`${i}:${pop.n}`}
              style={{ animationDelay: `${i * 45}ms` }}
              className={cn('relative grid cursor-pointer place-items-center transition-[scale] duration-150 hover:scale-115 active:scale-95', slot, pop.n > 0 && i * per < pop.v && 'track-star-pop')}
              onPointerMove={(e) => e.pointerType === 'mouse' && setHover(at(e, i))}
              // 点当前分数等于取消评分
              onClick={(e) => { const v = at(e, i); setHover(null); set(v === value ? 0 : v) }}
            >
              <Star className={cn(icon, 'text-faint')} strokeWidth={1.6} />
              <Star
                className={cn(icon, 'absolute fill-current text-text transition-[clip-path] duration-150', hover != null && 'opacity-80')}
                strokeWidth={1.6}
                style={{ clipPath: `inset(0 ${100 - fill * 100}% 0 0)` }}
              />
            </span>
          )
        })}
      </span>
      {/* 宽度按最长的评价词留好，悬停换词时星星不左右跳 */}
      <span className={cn('text-sm leading-none num', word(max) ? 'min-w-[6.4em]' : 'min-w-[2em]')} aria-hidden>
        {shown > 0 ? <><b className={cn('font-bold', num)}>{shown}</b>{text && <span className="ml-1.5 text-muted">{text}</span>}</> : <span className="text-faint">未评分</span>}
      </span>
    </span>
  )
}
