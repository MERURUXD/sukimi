import { graphql } from '@/api/gql'

// 返回的字段与 Categories 一致：新分类写进缓存时字段齐全，详情页的章节分类不会因缺字段而重取
export const CreateShelf = graphql(`
  mutation CreateShelf($name: String!) {
    createCategory(input: { name: $name, includeInUpdate: EXCLUDE, includeInDownload: EXCLUDE }) {
      category {
        id
        name
        order
        default
        meta {
          key
          value
        }
      }
    }
  }
`)

export const TagShelf = graphql(`
  mutation TagShelf($id: Int!, $key: String!) {
    setCategoryMeta(input: { meta: { categoryId: $id, key: $key, value: "1" } }) {
      meta {
        categoryId
        key
        value
      }
    }
  }
`)

export const MangaCategoryIds = graphql(`
  fragment MangaCategoryIds on MangaType {
    categories {
      nodes {
        id
      }
    }
  }
`)
