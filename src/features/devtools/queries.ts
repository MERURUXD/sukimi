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

// 批量已读 / 未读的预演：书库作品连同分类，以及还没到目标状态的章节（只要 id 和所属作品）；
// 章节条件由调用方给（见 readTargetFilter）
export const DevToolsReadTargets = graphql(`
  query DevToolsReadTargets($filter: ChapterFilterInput!) {
    mangas(condition: { inLibrary: true }) {
      nodes {
        id
        title
        categories {
          nodes {
            id
          }
        }
      }
    }
    chapters(filter: $filter) {
      nodes {
        id
        mangaId
      }
    }
  }
`)
