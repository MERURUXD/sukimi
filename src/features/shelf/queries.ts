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

// 发现、更新页的条目不带分类，缓存里没有时菜单按需补取，结果按 MangaType 归一化后 MangaCategoryIds 就能读到
export const MangaCategories = graphql(`
  query MangaCategories($id: Int!) {
    manga(id: $id) {
      id
      ...MangaCategoryIds
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
