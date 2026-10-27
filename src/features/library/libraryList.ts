import type { ApolloCache, ApolloClient } from '@apollo/client'
import { LibraryMangasDocument } from '../../api/gql/graphql.ts'

/**
 * 书库列表是按 inLibrary 过滤的整表。只改漫画实体上的 inLibrary，不会把它从这张表里拿掉。
 * 页面已经离开、没有人订着这条查询时，refetchQueries 也不会重取。这里直接改缓存，下次打开仍是对的。
 */
export function dropFromLibraryList(cache: ApolloCache, ids: readonly number[]) {
  const existing = cache.readQuery({ query: LibraryMangasDocument })
  if (!existing) return
  const drop = new Set(ids)
  const nodes = existing.mangas.nodes.filter((manga) => !drop.has(manga.id))
  const removed = existing.mangas.nodes.length - nodes.length
  if (!removed) return
  cache.writeQuery({
    query: LibraryMangasDocument,
    data: {
      ...existing,
      mangas: {
        ...existing.mangas,
        totalCount: Math.max(0, existing.mangas.totalCount - removed),
        nodes,
      },
    },
  })
}

/** 加入书库后整表重取一次。没有订阅者也会写入缓存；失败就清掉旧列表，免得下次打开还是加入前的结果。 */
export async function refreshLibraryList(client: ApolloClient) {
  try {
    await client.query({ query: LibraryMangasDocument, fetchPolicy: 'network-only' })
  } catch {
    client.cache.evict({ id: 'ROOT_QUERY', fieldName: 'mangas', args: { condition: { inLibrary: true } } })
    client.cache.gc()
  }
}
