import { useQuery } from '@apollo/client/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { saveSnapshot, useSnapshots, withSnapshot } from '@/api/persist'
import { IN_LIBRARY, RecentUpdates } from './queries'
import { completeWeekUpdates, mergeWeekUpdates, WEEK_UPDATES_PAGE, type WeekUpdatesSnapshot } from './weekUpdates'

/** 整周分页取齐后才显示、保存，后台刷新期间继续显示上一份完整结果。 */
export function useWeekUpdates(start: number, skip: boolean, landed: boolean) {
  useSnapshots((s) => s.loaded)
  const variables = useMemo(() => ({
    first: WEEK_UPDATES_PAGE, offset: 0,
    filter: { ...IN_LIBRARY, fetchedAt: { greaterThan: String(start - 1) } },
  }), [start])
  const { data: current, loading, error, fetchMore, refetch } = useQuery(RecentUpdates, {
    variables, skip, fetchPolicy: landed ? 'cache-and-network' : 'cache-first',
    notifyOnNetworkStatusChange: true,
  })
  const [failure, setFailure] = useState<{ start: number; error: unknown }>()
  const pageError = failure?.start === start ? failure.error : undefined
  const [paging, setPaging] = useState(false)
  const pending = useRef(false)
  const full = current && !current.chapters.pageInfo.hasNextPage ? current : undefined
  const saved = withSnapshot<WeekUpdatesSnapshot>('weekUpdates', undefined)
  const data = completeWeekUpdates(start, current, saved)

  useEffect(() => {
    if (full) saveSnapshot('weekUpdates', { start, data: full } satisfies WeekUpdatesSnapshot, 0)
  }, [start, full])
  useEffect(() => {
    if (skip || loading || paging || pending.current || error || pageError || !current?.chapters.pageInfo.hasNextPage) return
    pending.current = true
    setPaging(true)
    void fetchMore({
      variables: { offset: current.chapters.nodes.length },
      updateQuery: (previous, { fetchMoreResult }) => mergeWeekUpdates(previous, fetchMoreResult),
    }).catch(error => setFailure({ start, error })).finally(() => {
      pending.current = false
      setPaging(false)
    })
  }, [skip, loading, error, current, fetchMore, paging, pageError, start])

  const retry = () => {
    setFailure(undefined)
    void refetch().catch(() => {})
  }
  return { chapters: data?.chapters, error: error ?? pageError, retry }
}
