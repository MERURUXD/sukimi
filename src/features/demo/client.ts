import { ApolloClient, ApolloLink, Observable } from '@apollo/client'
import { buildSchema, executeSync } from 'graphql'
import { createCache } from '@/api/cache'
import schemaText from '@/api/schema.graphql?raw'
import { createDemoData, type OpenWork } from './data'

const OPEN_BASE = '/dev-data/open-comics/'

/** 开发环境下读取 pnpm fetch:comics 生成的本地缓存；没有缓存或在正式构建里都返回空。 */
async function loadOpenWorks() {
  if (!import.meta.env.DEV) return []
  try {
    const res = await fetch(`${OPEN_BASE}manifest.json`)
    if (!res.ok) return []
    const { works } = await res.json() as { works: OpenWork[] }
    return works.map((work) => ({ work, url: (file: string) => `${OPEN_BASE}${file}` }))
  } catch { return [] }
}

/** 只执行本地虚构数据；没有 HTTP、订阅或回退到服务端的链路。 */
export async function createDemoClient() {
  const schema = buildSchema(schemaText)
  const rootValue = createDemoData(Date.now(), await loadOpenWorks())
  return new ApolloClient({
    cache: createCache(),
    link: new ApolloLink((operation) => new Observable((observer) => {
      const timer = setTimeout(() => {
        try {
          const result = executeSync({ schema, document: operation.query, rootValue, variableValues: operation.variables })
          observer.next(result)
          observer.complete()
        } catch (error) { observer.error(error) }
      }, 80)
      return () => clearTimeout(timer)
    })),
  })
}
