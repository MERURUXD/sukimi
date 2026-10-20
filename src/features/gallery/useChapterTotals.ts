import type { ApolloClient } from '@apollo/client'
import { useApolloClient } from '@apollo/client/react'
import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { resetOnUserContext } from '@/api/userContext'
import type { LibraryManga } from '@/features/library/queries'
import { chapterTotalsFor } from './chapterTotals'

const registered = new WeakSet<ApolloClient>()
function storeFor(client: ApolloClient) {
  const store = chapterTotalsFor(client)
  if (!registered.has(client)) {
    registered.add(client)
    resetOnUserContext(store.reset)
  }
  return store
}

/** 切页沿用总话数；书库或阅读数据变化后刷新，已有数字在过渡落地前保持不动。 */
export function useChapterTotals(library: readonly LibraryManga[] | undefined, landed = true) {
  const store = storeFor(useApolloClient())
  const state = useSyncExternalStore(store.subscribe, store.snapshot)
  useEffect(() => {
    if (library && (landed || !state.totals)) void store.load(library)
  }, [store, library, landed, state.totals, state.generation])
  const refetch = useCallback(() => library ? store.load(library, true) : Promise.resolve(), [store, library])
  return { totals: state.totals, error: state.totals ? undefined : state.error, refetch }
}
