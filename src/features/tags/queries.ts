import { graphql } from '@/api/gql'

/** prefix 用 tags.ts 的 tagsPrefix(账号 id)，只取当前账号的键 */
export const TagMetas = graphql(`
  query TagMetas($prefix: String!) {
    metas(filter: { key: { startsWith: $prefix } }) {
      nodes {
        key
        value
      }
    }
  }
`)

export const SetTags = graphql(`
  mutation SetTags($key: String!, $value: String!) {
    setGlobalMeta(input: { meta: { key: $key, value: $value } }) {
      meta {
        key
        value
      }
    }
  }
`)

export const RemoveTags = graphql(`
  mutation RemoveTags($keys: [String!]!) {
    deleteGlobalMetas(input: { keys: $keys }) {
      metas {
        key
      }
    }
  }
`)

/** 设置里改名、删除标签时，一次写完所有改到的漫画 */
export const SetManyTags = graphql(`
  mutation SetManyTags($metas: [MetaInput!]!) {
    setGlobalMetas(input: { metas: $metas }) {
      metas {
        key
        value
      }
    }
  }
`)
