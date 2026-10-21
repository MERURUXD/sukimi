import type { CoverRect } from './readMorph.ts'

export interface LibraryLanding {
  cx: number
  cy: number
  keys: ReadonlyMap<string, CoverRect & { id: number }>
  from: ReadonlyMap<number, CoverRect>
}

/** 隐藏作品保留位置，但进出场叠层不能显示书库捕获的原图。 */
export function withoutHiddenCovers(rects: ReadonlyMap<number, CoverRect>, visible: ReadonlySet<number>) {
  return new Map([...rects].map(([id, r]) => [id, visible.has(id) || !r.src ? r : { ...r, src: null }]))
}

/** 隐私过滤会创建新映射，按作品和布局识别原入口；返回叠层使用这次过滤后的图片。 */
export function libraryRewind(landing: LibraryLanding | null, rects: ReadonlyMap<number, CoverRect>, cx: number, cy: number) {
  if (!landing || landing.from.size !== rects.size) return null
  for (const [id, before] of landing.from) {
    const now = rects.get(id)
    if (!now || before.x !== now.x || before.y !== now.y || before.w !== now.w || before.h !== now.h) return null
  }
  const keys = new Map<string, CoverRect>()
  for (const [key, before] of landing.keys) {
    const now = rects.get(before.id)
    if (!now) return null
    keys.set(key, now)
  }
  return { keys, from: [cx, cy] as [number, number], to: [landing.cx, landing.cy] as [number, number] }
}
