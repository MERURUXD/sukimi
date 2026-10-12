import { execSync } from 'node:child_process'
import { createReadStream, existsSync } from 'node:fs'
import { join, normalize } from 'node:path'
import { fileURLToPath, URL } from 'node:url'
import { babelOptimizerPlugin } from '@graphql-codegen/client-preset'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const target = env.SUWAYOMI_URL || 'http://localhost:4567'
  // SUKIMI_CHANNEL=preview 打出 Preview 构建：带环境标识，不让搜索引擎收录
  const channel = env.SUKIMI_CHANNEL === 'preview' ? 'preview' : 'production'
  let commit = 'dev'
  try {
    commit = execSync('git rev-parse --short HEAD').toString().trim()
  } catch {
    /* 不是 git 仓库 */
  }

  return {
    plugins: [react(), command === 'build' && babel({
      // 构建时直接引用生成文档，避免 graphql() 的整张映射把所有操作带进首屏。
      presets: [{
        preset: { plugins: [[babelOptimizerPlugin, { artifactDirectory: './src/api/gql', gqlTagName: 'graphql' }]] },
        rolldown: {
          filter: {
            id: { include: /[\\/]src[\\/].*\.[jt]sx?$/, exclude: /[\\/]api[\\/]gql[\\/]/ },
            code: /\bgraphql\s*\(/,
          },
        },
      }],
    }), tailwindcss(), channel === 'preview' && {
      name: 'preview-channel-html',
      transformIndexHtml: (html: string) =>
        html
          .replace('<title>Sukimi</title>', '<title>[Preview] Sukimi</title>')
          .replace('</head>', '    <meta name="robots" content="noindex, nofollow" />\n  </head>'),
    }, {
      // 只在 dev 服务器上提供 .cache/open-comics 里的本地测试漫画；build 不会带上它们
      name: 'open-comics-cache',
      apply: 'serve',
      configureServer(server) {
        const root = join(process.cwd(), '.cache', 'open-comics')
        server.middlewares.use('/dev-data/open-comics', (req, res, next) => {
          const file = normalize(join(root, decodeURIComponent((req.url ?? '/').split('?')[0])))
          if (!file.startsWith(root) || !existsSync(file)) return next()
          res.setHeader('Content-Type', file.endsWith('.json') ? 'application/json' : 'image/jpeg')
          createReadStream(file).pipe(res)
        })
      },
    }],
    // 设置页「关于」里显示的前端版本
    define: {
      __APP_COMMIT__: JSON.stringify(commit),
      __APP_BUILT_AT__: JSON.stringify(new Date().toISOString()),
      __APP_CHANNEL__: JSON.stringify(channel),
    },
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    build: {
      // 随构建产物保留实际打包依赖的许可，便于发布与分发。
      license: { fileName: 'dependency-licenses.md' },
      rolldownOptions: {
        output: {
          // 第三方库单独成包：更新前端时文件名不变，浏览器缓存继续有效
          codeSplitting: {
            groups: [
              { name: 'react', test: /node_modules[\\/](react|react-dom|react-router|scheduler)[\\/]/ },
              { name: 'apollo', test: /node_modules[\\/](@apollo|graphql|graphql-ws|rxjs|@wry|optimism|@graphql-typed-document-node)[\\/]/ },
              { name: 'motion', test: /node_modules[\\/](motion|framer-motion|motion-dom|motion-utils)[\\/]/ },
              { name: 'vendor', test: /node_modules[\\/]/ },
            ],
          },
        },
      },
    },
    server: {
      // 同源代理：令牌 Cookie 才能随 <img> 和 WebSocket 一起发出去
      proxy: {
        '/api': { target, changeOrigin: true, ws: true },
      },
    },
  }
})
