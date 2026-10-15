import { graphql } from '@/api/gql'

/** prefix 用 nsfw.ts 的 nsfwPrefix(账号 id)，只取当前账号的键 */
export const NsfwMetas = graphql(`
  query NsfwMetas($prefix: String!) {
    metas(filter: { key: { startsWith: $prefix } }) {
      nodes {
        key
        value
      }
    }
  }
`)

export const SetNsfwMetas = graphql(`
  mutation SetNsfwMetas($metas: [MetaInput!]!) {
    setGlobalMetas(input: { metas: $metas }) {
      metas {
        key
        value
      }
    }
  }
`)

export const RemoveNsfwMetas = graphql(`
  mutation RemoveNsfwMetas($keys: [String!]!) {
    deleteGlobalMetas(input: { keys: $keys }) {
      metas {
        key
      }
    }
  }
`)
