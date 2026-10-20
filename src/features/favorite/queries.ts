import { graphql } from '@/api/gql'

/** prefix 用 favorite.ts 的 favoritePrefix(账号 id)，只取当前账号的键 */
export const FavoriteMetas = graphql(`
  query FavoriteMetas($prefix: String!) {
    metas(filter: { key: { startsWith: $prefix } }) {
      nodes {
        key
        value
      }
    }
  }
`)

export const SetFavorites = graphql(`
  mutation SetFavorites($metas: [MetaInput!]!) {
    setGlobalMetas(input: { metas: $metas }) {
      metas {
        key
        value
      }
    }
  }
`)

export const RemoveFavorites = graphql(`
  mutation RemoveFavorites($keys: [String!]!) {
    deleteGlobalMetas(input: { keys: $keys }) {
      metas {
        key
      }
    }
  }
`)
