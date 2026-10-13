import { graphql } from '@/api/gql'

// 只取去重要用的两个字段，并且每次都向服务端要最新的，不用书库快照
export const DevToolsLibraryTitles = graphql(`
  query DevToolsLibraryTitles {
    mangas(condition: { inLibrary: true }) {
      nodes {
        id
        title
      }
    }
  }
`)

// 量延迟用的轻量查询，顺带显示服务端版本
export const DevToolsPing = graphql(`
  query DevToolsPing {
    aboutServer {
      name
      version
      buildType
    }
  }
`)
