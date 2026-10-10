import type { LibraryManga } from '@/features/library/queries'
import { WindowWall } from './SharedWindowWall'

/** 橱窗是共用墙的取景位置，封面与流动状态在往返期间保留。 */
export function CoverWall({ items, mobile, picks, className }: { items: readonly LibraryManga[]; mobile: boolean; picks?: readonly number[]; className?: string }) {
  return <WindowWall kind="window" items={items} mobile={mobile} picks={picks} className={className} />
}
