import { useMutation } from '@apollo/client/react'
import type { UpdateTrackInput, UpdateTrackMutation } from '@/api/gql/graphql'
import { toastError } from '@/components/ui/toast'
import { UpdateTrack, type TrackRecord } from './queries'
import { scoreValue } from './tracking'

/** 改追踪记录：先按预期改缓存，点星星、改状态不用等网站回应；失败时 Apollo 自动撤回并提示 */
export function useSaveTrack(r: TrackRecord) {
  const [update] = useMutation(UpdateTrack)
  return (patch: Omit<UpdateTrackInput, 'recordId'>) => {
    const { scoreString, ...rest } = patch
    const next: TrackRecord = { ...r }
    for (const [k, v] of Object.entries(rest)) if (v != null && k in next) Object.assign(next, { [k]: v })
    if (scoreString != null) Object.assign(next, { displayScore: scoreString, score: scoreValue(scoreString) })
    void update({
      variables: { input: { recordId: r.id, ...patch } },
      optimisticResponse: { updateTrack: { __typename: 'UpdateTrackPayload', trackRecord: { __typename: 'TrackRecordType', ...next } } } as UpdateTrackMutation,
    }).catch((e) => toastError('保存失败', e))
  }
}
