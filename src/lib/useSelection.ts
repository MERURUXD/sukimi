import { useCallback, useRef, useState } from 'react'

/** 多选：单击切换，Shift + 单击选中一段（以当前可见顺序为准） */
export function useSelection(order: readonly number[]) {
  const [selected, setSelected] = useState<ReadonlySet<number>>(new Set())
  const anchor = useRef<number | null>(null)
  const orderRef = useRef(order)
  orderRef.current = order

  const toggle = useCallback((id: number, index: number, shift = false) => {
    // 状态更新函数是延后执行的，锚点要先取出来
    const from = shift ? anchor.current : null
    setSelected((prev) => {
      const next = new Set(prev)
      if (from != null) {
        const [a, b] = [from, index].sort((x, y) => x - y)
        const on = !prev.has(id)
        for (const rid of orderRef.current.slice(a, b + 1)) {
          if (on) next.add(rid)
          else next.delete(rid)
        }
      } else if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    anchor.current = index
  }, [])

  const selectAll = useCallback(() => setSelected(new Set(orderRef.current)), [])
  const clear = useCallback(() => {
    setSelected(new Set())
    anchor.current = null
  }, [])

  return { selected, toggle, selectAll, clear, setSelected }
}
