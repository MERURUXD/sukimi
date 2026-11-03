import { useApolloClient, useQuery } from '@apollo/client/react'
import { useCallback, useMemo } from 'react'
import { withSnapshot } from '@/api/persist'
import { captureUser, contextGeneration, StaleSessionError } from '@/api/userContext'
import { Categories, SetMangasCategories } from '@/features/library/queries'
import { SHELF_META, shelfIds } from './shelf'
import { CreateShelf, DeleteShelf, ShelfRollbackState, TagShelf } from './queries'
import { errorText } from '@/lib/errorText'
import { t } from '@/i18n'

// 同一个客户端的所有组件共用队列，首次搁置不会各自查到空列表后重复建分类。
const queues = new WeakMap<object, Promise<void>>()

/** 当前账号的搁置分类 id；分类列表到达前 ready 为 false，开关先禁用 */
export function useShelf() {
  const q = useQuery(Categories)
  const data = withSnapshot('categories', q.data)
  const ids = useMemo(() => shelfIds(data?.categories.nodes), [data])
  return { ids, ready: !!data }
}

export function useShelfActions() {
  const client = useApolloClient()
  /** 一次搁置或取消多部；只动搁置分类，其他分类和特别关心照旧 */
  const setShelved = useCallback(async (mangaIds: readonly number[], on: boolean) => {
    if (!mangaIds.length) return
    const capturedUser = captureUser()
    const generation = contextGeneration()
    const still = (cause?: unknown) => {
      try {
        capturedUser()
        // 排队期间即使切回同一个账号，也不能继续执行旧身份环境中的任务。
        if (contextGeneration() !== generation) throw new StaleSessionError()
      } catch (error) {
        if (error instanceof StaleSessionError && cause !== undefined) error.cause = cause
        throw error
      }
    }
    const run = async () => {
      still()
      // 从服务端取最新列表：别的设备可能刚建过搁置分类，免得再建一个
      const { data } = await client.query({ query: Categories, fetchPolicy: 'network-only' })
      still()
      const shelf = [...shelfIds(data?.categories.nodes)].sort((a, b) => a - b)
      if (!on) {
        if (shelf.length) await client.mutate({ mutation: SetMangasCategories, variables: { ids: [...mangaIds], remove: shelf } })
        still()
        return
      }
      if (!shelf.length) {
        const { data: created } = await client.mutate({ mutation: CreateShelf, variables: { name: t('misc.shelf.category') } })
        const id = created?.createCategory?.category.id
        if (id === undefined) { still(); throw new Error(t('misc.shelf.createFailed')) }
        const tag = () => {
          still()
          return client.mutate({ mutation: TagShelf, variables: { id, key: SHELF_META } })
        }
        const failures: unknown[] = []
        try {
          // 分类建好了但没打上标记，就成了普通分类，先补一次；两次失败再清理。
          await tag().catch((error: unknown) => { failures.push(error); return tag() })
          still()
        } catch (error) {
          if (error instanceof StaleSessionError) {
            if (failures.length) error.cause = failures[0]
            throw error
          }
          failures.push(error)
          const tagError = failures.length === 1 ? error : new AggregateError(failures, t('misc.shelf.tagRetryFailed', {
            first: errorText(failures[0]), retry: errorText(error),
          }))
          still(tagError)
          try {
            still()
            const { data: rollback } = await client.query({ query: ShelfRollbackState, variables: { id }, fetchPolicy: 'network-only' })
            still()
            const category = rollback?.category
            if (!category || category.id !== id) throw new Error(t('misc.shelf.rollbackStateUnknown'))
            if (category.mangas.totalCount !== 0) throw new Error(t('misc.shelf.rollbackHasMangas'))
            if (shelfIds([category]).size) throw new Error(t('misc.shelf.rollbackAlreadyTagged'))
            // 只清理本次创建、尚未放入漫画的分类；服务端不支持原子地检查为空并删除。
            const { data: deleted } = await client.mutate({ mutation: DeleteShelf, variables: { id } })
            still()
            if (deleted?.deleteCategory?.category?.id !== id) throw new Error(t('misc.shelf.rollbackDeleteUnknown'))
            client.cache.evict({ id: client.cache.identify({ __typename: 'CategoryType', id }) })
            client.cache.gc()
            await client.refetchQueries({ include: [Categories] })
            still()
          } catch (rollbackError) {
            if (rollbackError instanceof StaleSessionError) {
              rollbackError.cause = tagError
              throw rollbackError
            }
            // 现有调用方只展示 message，两个原因必须也出现在提示中，不能仅藏在 cause 里。
            const failure = new AggregateError([tagError, rollbackError], t('misc.shelf.rollbackFailed', {
              id, tagReason: errorText(tagError), rollbackReason: errorText(rollbackError),
            }))
            still(failure)
            throw failure
          }
          throw tagError
        }
        // 先让分类列表认出新分类再放漫画进去，书库不会闪出一个「搁置」标签
        await client.refetchQueries({ include: [Categories] })
        still()
        shelf.push(id)
      }
      await client.mutate({ mutation: SetMangasCategories, variables: { ids: [...mangaIds], add: [shelf[0]] } })
      still()
    }
    const next = (queues.get(client) ?? Promise.resolve()).then(run)
    // 吞掉的只是队列尾部的拒绝；调用者仍收到 next 的错误，下一项可以继续。
    queues.set(client, next.then(() => {}, () => {}))
    await next
  }, [client])
  return { setShelved }
}
