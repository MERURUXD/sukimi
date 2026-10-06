import { ApolloClient, ApolloLink, Observable } from '@apollo/client'
import { buildSchema, executeSync } from 'graphql'
import { createCache } from '@/api/cache'
import schemaText from '@/api/schema.graphql?raw'
import { createDemoData } from './data'

/** 只执行本地虚构数据；没有 HTTP、订阅或回退到服务端的链路。 */
export function createDemoClient() {
  const schema = buildSchema(schemaText)
  const rootValue = createDemoData()
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
