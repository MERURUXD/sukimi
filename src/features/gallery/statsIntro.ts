/** 进出场进度由各块直接绘制，不让一帧进度触发整页 React 重渲染。 */
export function createIntro(initial: number) {
  let t = initial
  const listeners = new Set<() => void>()
  return {
    get t() { return t },
    paint(next: number) {
      t = next
      listeners.forEach((fn) => fn())
    },
    subscribe(fn: () => void) {
      listeners.add(fn)
      fn()
      return () => { listeners.delete(fn) }
    },
  }
}

export type Intro = ReturnType<typeof createIntro>
