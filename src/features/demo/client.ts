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

/**
 * 开发环境与 Preview：`/demo/…?scale=600` 再生成几百部虚构作品测性能，`&edge=1` 追加边界作品，
 * `&long=1` 追加一话 180 页的长话。进入演示时读一次，之后切页不再看网址。正式构建直接比较构建常量，不读网址。
 */
function devOptions() {
  if (!(import.meta.env.DEV || __APP_CHANNEL__ === 'preview')) return {}
  const q = new URLSearchParams(window.location.search)
  return { scale: Math.max(0, Number(q.get('scale')) || 0), edge: q.get('edge') === '1', long: q.get('long') === '1' }
}

/** 只执行本地虚构数据；没有 HTTP、订阅或回退到服务端的链路。 */
export async function createDemoClient() {
  const schema = buildSchema(schemaText)
  const rootValue = createDemoData(Date.now(), await loadOpenWorks(), devOptions())
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
