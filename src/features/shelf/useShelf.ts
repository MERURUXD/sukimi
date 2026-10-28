import { useApolloClient, useQuery } from '@apollo/client/react'
import { useCallback, useMemo } from 'react'
import { withSnapshot } from '@/api/persist'
import { captureUser } from '@/api/userContext'
import { Categories, SetMangasCategories } from '@/features/library/queries'
import { SHELF_META, shelfIds } from './shelf'
import { CreateShelf, TagShelf } from './queries'
import { t } from '@/i18n'

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
    const still = captureUser()
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
      still()
      const id = created?.createCategory?.category.id
      if (id === undefined) throw new Error(t('misc.shelf.createFailed'))
      const tag = () => client.mutate({ mutation: TagShelf, variables: { id, key: SHELF_META } })
      // 分类建好了但没打上标记，就成了一个用户看得见的普通分类，先补一次
      await tag().catch(() => { still(); return tag() })
      still()
      // 先让分类列表认出新分类再放漫画进去，书库不会闪出一个「搁置」标签
      await client.refetchQueries({ include: [Categories] })
      still()
      shelf.push(id)
    }
    await client.mutate({ mutation: SetMangasCategories, variables: { ids: [...mangaIds], add: [shelf[0]] } })
    still()
  }, [client])
  return { setShelved }
}
