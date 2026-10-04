import type { CodegenConfig } from '@graphql-codegen/cli'

// schema.graphql 由 `pnpm schema` 从服务端内省得到（无需登录），升级服务端后重新拉取
const config: CodegenConfig = {
  schema: 'src/api/schema.graphql',
  documents: ['src/**/*.{ts,tsx}', '!src/api/gql/**'],
  ignoreNoDocuments: true,
  generates: {
    'src/api/gql/': {
      preset: 'client',
      presetConfig: { fragmentMasking: false },
      config: {
        useTypeImports: true,
        enumsAsTypes: true,
        avoidOptionals: { field: true, inputValue: false },
        defaultScalarType: 'unknown',
        scalars: { LongString: 'string', Cursor: 'string', Duration: 'string', Upload: 'File' },
        skipTypeNameForRoot: true,
      },
    },
  },
}

export default config
