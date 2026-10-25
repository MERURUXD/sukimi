// 从 Suwayomi 服务端内省 GraphQL schema，写入 src/api/schema.graphql
import { writeFileSync } from 'node:fs'
import { buildClientSchema, getIntrospectionQuery, printSchema } from 'graphql'
import { loadEnv } from 'vite'

const env = loadEnv('development', process.cwd(), '')
const url = `${env.SUWAYOMI_URL || 'http://localhost:4567'}/api/graphql`

const res = await fetch(url, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  // 服务端把废弃的输入字段标了 @deprecated，默认内省会省掉它们，
  // 只剩 maxUpdates 的输入类型就成了空类型，schema 建不起来、codegen 失败
  body: JSON.stringify({ query: getIntrospectionQuery({ inputValueDeprecation: true }) }),
})
const json = await res.json()
if (json.errors) throw new Error(JSON.stringify(json.errors))

writeFileSync('src/api/schema.graphql', printSchema(buildClientSchema(json.data)))
console.log(`schema written from ${url}`)
