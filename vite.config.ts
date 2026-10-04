import { execSync } from 'node:child_process'
import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const target = env.SUWAYOMI_URL || 'http://localhost:4567'
  let commit = 'dev'
  try {
    commit = execSync('git rev-parse --short HEAD').toString().trim()
  } catch {
    /* 不是 git 仓库 */
  }

  return {
    plugins: [react(), tailwindcss()],
    // 设置页「关于」里显示的前端版本
    define: {
      __APP_COMMIT__: JSON.stringify(commit),
      __APP_BUILT_AT__: JSON.stringify(new Date().toISOString()),
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
