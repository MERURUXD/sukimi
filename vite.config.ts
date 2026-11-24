import { execSync } from 'node:child_process'
import { createReadStream } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, URL } from 'node:url'
import { babelOptimizerPlugin } from '@graphql-codegen/client-preset'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { openComicsFile } from './scripts/open-comics-path.ts'

// https://vite.dev/config/
export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const target = env.SUWAYOMI_URL || 'http://localhost:4567'
  // SUKIMI_CHANNEL=preview 打出 Preview 构建：带环境标识，不让搜索引擎收录
  const channel = env.SUKIMI_CHANNEL === 'preview' ? 'preview' : 'production'
  // SUKIMI_TEST_INSTANCE=1 只给连独立测试服务端的构建用：工具箱才提供批量已读 / 未读这类会大面积改数据的操作
  const testInstance = env.SUKIMI_TEST_INSTANCE === '1'
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
          const file = openComicsFile(root, req.url)
          if (!file) return next()
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
      __TEST_INSTANCE__: JSON.stringify(testInstance),
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
      // Vite 8 在检测到 AI 编程代理的环境变量时会自动加上 vite:forward-console 插件，插件名会进依赖预构建的配置哈希。
      // 不固定的话，从代理、预览工具和自己的终端轮流启动，哈希就来回变，每次都整包重新预构建（首个请求卡几十秒）。
      forwardConsole: false,
      // .claude/ 里有十几万个验收截图和记录，不忽略的话 Vite 启动时给其中上万个文件逐个建监听，
      // 同步卡住主线程十几秒（页面空白、请求超时）；它们和前端源码无关
      watch: { ignored: ['**/.claude/**', '**/.agents/**', '**/.codex/**', '**/.cache/**', '**/.codex-remote-attachments/**', '**/dist/**'] },
      // 同源代理：令牌 Cookie 才能随 <img> 和 WebSocket 一起发出去
      proxy: {
        '/api': { target, changeOrigin: true, ws: true },
      },
    },
  }
})
