import type { ApolloClient } from '@apollo/client'
import type { BgmSubject } from '../bangumi/rating'
import { bindRemote, RemoteNotFoundError } from './bindRemote'

export async function bindBgmSubject(client: ApolloClient, mangaId: number, trackerId: number, subject: Pick<BgmSubject, 'id' | 'name' | 'nameCn'>, still: () => void) {
  try {
    await bindRemote(client, { mangaId, trackerId, remoteId: String(subject.id), keywords: [subject.name, subject.nameCn] }, still)
  } catch (e) {
    if (e instanceof RemoteNotFoundError) throw new Error('追踪服务未找到所选 Bangumi 条目，请打开追踪设置手动搜索绑定')
    throw e
  }
}
