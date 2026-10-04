/*
 * 阅读历史。服务端没有删除阅读记录的接口（lastReadAt 改不了），
 * 「删除」是在章节元数据里记下删除时的阅读时间：之后没再读过就不显示，重新读了又会出现。
 * 存在服务端，所以换设备也一致。
 */
export const HIDDEN_KEY = 'suwayomi-web.historyHiddenAt'

export interface HistoryChapter {
  id: number
  /** 秒，LongString */
  lastReadAt: string
  meta: readonly { key: string; value: string }[]
  manga: { id: number }
}

export const isVisible = (c: Pick<HistoryChapter, 'lastReadAt' | 'meta'>) => {
  const hidden = c.meta.find((m) => m.key === HIDDEN_KEY)
  return !hidden || Number(c.lastReadAt) > Number(hidden.value)
}

export interface HistoryEntry<C extends HistoryChapter> {
  /** 这一天里最后读的那一话 */
  latest: C
  /** 这一天读过的这部漫画的所有章节（含 latest），删除时一起隐藏 */
  chapters: C[]
}

/**
 * 按天分组，同一天同一部漫画合成一条（和 Mihon 一样），列表已按阅读时间倒序。
 * dayOf 把毫秒时间换成分组名（今天、昨天……）。
 */
export function groupHistory<C extends HistoryChapter>(list: readonly C[], dayOf: (t: number) => string) {
  const days: { label: string; entries: HistoryEntry<C>[] }[] = []
  for (const c of list) {
    if (!isVisible(c)) continue
    const label = dayOf(Number(c.lastReadAt) * 1000)
    let day = days.at(-1)
    if (day?.label !== label) days.push((day = { label, entries: [] }))
    const entry = day.entries.find((e) => e.latest.manga.id === c.manga.id)
    if (entry) entry.chapters.push(c)
    else day.entries.push({ latest: c, chapters: [c] })
  }
  return days
}

/** 隐藏一条记录要写的元数据值：这条里最晚的阅读时间 */
export const hiddenValue = (entry: HistoryEntry<HistoryChapter>) =>
  String(Math.max(...entry.chapters.map((c) => Number(c.lastReadAt))))
