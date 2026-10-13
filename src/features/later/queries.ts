import { graphql } from '@/api/gql'
import type { LaterMangasQuery } from '@/api/gql/graphql'

/** prefix 用 later.ts 的 laterPrefix(账号 id)，只取当前账号的键 */
export const LaterMetas = graphql(`
  query LaterMetas($prefix: String!) {
    metas(filter: { key: { startsWith: $prefix } }) {
      nodes {
        key
        value
      }
    }
  }
`)

/** 列表里的漫画可能不在书库：按 id 取，字段和书库一样，网格与筛选排序直接复用 */
export const LaterMangas = graphql(`
  query LaterMangas($ids: [Int!]!) {
    mangas(filter: { id: { in: $ids } }) {
      nodes {
        ...LibraryMangaFields
        inLibrary
      }
    }
  }
`)

export type LaterManga = LaterMangasQuery['mangas']['nodes'][number]

export const SetLater = graphql(`
  mutation SetLater($key: String!, $value: String!) {
    setGlobalMeta(input: { meta: { key: $key, value: $value } }) {
      meta {
        key
        value
      }
    }
  }
`)

export const RemoveLater = graphql(`
  mutation RemoveLater($keys: [String!]!) {
    deleteGlobalMetas(input: { keys: $keys }) {
      metas {
        key
      }
    }
  }
`)
