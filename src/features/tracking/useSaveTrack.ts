import type { ApolloClient } from '@apollo/client'
import { useApolloClient } from '@apollo/client/react'
import type { UpdateTrackInput } from '@/api/gql/graphql'
import { captureUser, resetOnUserContext, StaleSessionError } from '@/api/userContext'
import { toastError } from '@/components/ui/toast'
import { TrackRecordFieldsFragmentDoc } from '@/api/gql/graphql'
import { UpdateTrack, type TrackRecord } from './queries'
import { scoreValue } from './tracking'
import { t } from '../../i18n/core.ts'

// 同一条记录的写入排队发出：连点两次状态或评分时，若两个请求同时在路上、旧的后返回，
// 它带回的整条记录会把后选的值盖掉。手动修改和自动同步共用这条队列
const queue = new Map<number, Promise<unknown>>()
// 换账号后记录 id 可能与上一个账号重叠，排着的旧修改不能带新账号的令牌发出
resetOnUserContext(() => queue.clear())

/**
 * 按顺序写一条追踪记录；返回的记录带 id，直接改缓存。
 * 轮到发出时账号已经换了就放弃，抛出 StaleSessionError。
 * forwardOnly：自动同步用，轮到发出时再读一次最新进度（含排在前面的手动修改），已经不落后就不写，返回 null
 */
export function updateTrackQueued(client: ApolloClient, input: UpdateTrackInput, { forwardOnly = false } = {}) {
  const still = captureUser()
  const run = (queue.get(input.recordId) ?? Promise.resolve()).catch(() => {}).then(() => {
    still()
    if (forwardOnly && input.lastChapterRead != null) {
      const now = client.cache.readFragment({ fragment: TrackRecordFieldsFragmentDoc, id: client.cache.identify({ __typename: 'TrackRecordType', id: input.recordId }), optimistic: true })
      if (now && now.lastChapterRead >= input.lastChapterRead) return null
    }
    return client.mutate({ mutation: UpdateTrack, variables: { input } })
  })
  queue.set(input.recordId, run)
  const done = () => { if (queue.get(input.recordId) === run) queue.delete(input.recordId) }
  run.then(done, done)
  return run
}

let layer = 0

/**
 * 改追踪记录：先在乐观层里改好缓存，点星星、改状态立刻生效，不用等排在前面的请求；
 * 请求结束后撤掉这一层，以服务端返回为准，失败时自然回到原值并提示
 */
export function useSaveTrack(r: TrackRecord) {
  const client = useApolloClient()
  return (patch: Omit<UpdateTrackInput, 'recordId'>) => {
    // 只改这次动到的字段，连续改不同项时不会用旧值覆盖前一层
    const { scoreString, ...rest } = patch
    const changed: Record<string, unknown> = Object.fromEntries(Object.entries(rest).filter(([k, v]) => v != null && k in r))
    if (scoreString != null) Object.assign(changed, { displayScore: scoreString, score: scoreValue(scoreString) })
    const id = `track-save-${++layer}`
    client.cache.recordOptimisticTransaction((cache) => {
      cache.modify({ id: cache.identify({ __typename: 'TrackRecordType', id: r.id }), fields: Object.fromEntries(Object.entries(changed).map(([k, v]) => [k, () => v])) })
    }, id)
    updateTrackQueued(client, { recordId: r.id, ...patch })
      .catch((e) => { if (!(e instanceof StaleSessionError)) toastError(t('track.saveFailed'), e) })
      .finally(() => client.cache.removeOptimistic(id))
  }
}
