import type { ApolloClient } from '@apollo/client'
import type { BgmSubject } from '../bangumi/rating'
import { bindRemote, RemoteNotFoundError } from './bindRemote'
import { t } from '../../i18n/core.ts'

export async function bindBgmSubject(client: ApolloClient, mangaId: number, trackerId: number, subject: Pick<BgmSubject, 'id' | 'name' | 'nameCn'>, still: () => void) {
  try {
    await bindRemote(client, { mangaId, trackerId, remoteId: String(subject.id), keywords: [subject.name, subject.nameCn] }, still)
  } catch (e) {
    if (e instanceof RemoteNotFoundError) throw new Error(t('track.notFoundBgm'))
    throw e
  }
}
