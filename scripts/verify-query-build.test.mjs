import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'
import ts from 'typescript'
import { build } from 'vite'
import configuration from '../vite.config.ts'
import * as documents from '../src/api/gql/graphql.ts'

const sourceFile = (path, text) => ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true)
const visit = (node, fn) => { fn(node); ts.forEachChild(node, child => visit(child, fn)) }

test('生产构建直接引用所有操作的生成文档，保留内容且移除查询字符串映射', async (t) => {
  // 从生成的旧映射取得预期引用，不依赖优化器自己的命名规则。
  const expected = new Map()
  const generated = sourceFile('gql.ts', readFileSync('src/api/gql/gql.ts', 'utf8'))
  visit(generated, node => {
    if (ts.isVariableDeclaration(node) && node.name.getText(generated) === 'documents') {
      for (const field of node.initializer.properties) expected.set(field.name.text, field.initializer.name.text)
    }
  })
  const calls = new Map()
  function scan(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = `${dir}/${entry.name}`
      if (path === 'src/api/gql') continue
      if (entry.isDirectory()) scan(path)
      else if (/\.tsx?$/.test(path)) {
        const file = sourceFile(path, readFileSync(path, 'utf8'))
        visit(file, node => {
          if (!ts.isCallExpression(node) || !ts.isIdentifier(node.expression) || node.expression.text !== 'graphql') return
          const [argument] = node.arguments
          assert.ok(ts.isNoSubstitutionTemplateLiteral(argument), `${path} 的 GraphQL 文档必须是静态模板`)
          assert.ok(expected.has(argument.text), `${path} 的文档尚未生成，请运行 pnpm codegen`)
          calls.set(argument.text, argument.getText(file))
        })
      }
    }
  }
  scan('src')
  assert.ok(calls.size > 100, '必须覆盖整个应用的查询、变更、订阅和片段')
  const entries = [...calls], id = resolve('src/__query_build_probe.tsx')
  const source = `import { graphql } from '@/api/gql'\n${entries.map(([, arg], i) => `export const document${i} = graphql(${arg})`).join('\n')}`
  const config = configuration({ mode: 'production', command: 'build' })
  const plugins = await Promise.all(config.plugins)
  const optimizer = plugins.find(plugin => plugin?.name === '@rolldown/plugin-babel')
  assert.ok(optimizer, '正式构建没有接入文档优化器')
  const result = await build({
    configFile: false, logLevel: 'silent', resolve: config.resolve,
    plugins: [optimizer, { name: 'query-build-probe', resolveId: input => input === id ? id : undefined, load: input => input === id ? source : undefined }],
    build: { write: false, minify: false, lib: { entry: id, formats: ['es'] } },
  })
  const chunk = (Array.isArray(result) ? result : [result]).flatMap(output => output.output).find(item => item.type === 'chunk' && item.isEntry)
  assert.ok(chunk)
  visit(sourceFile('bundle.js', chunk.code), node => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) assert.ok(!calls.has(node.text), '构建仍带有整张查询字符串映射')
  })
  const built = await import(`data:text/javascript;base64,${Buffer.from(chunk.code).toString('base64')}`)
  for (const [i, [text]] of entries.entries()) assert.deepEqual(built[`document${i}`], documents[expected.get(text)], expected.get(text))
  t.diagnostic(`已核对 ${entries.length} 个静态文档`)
})
